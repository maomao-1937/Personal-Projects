import type { SubmitAttemptInput } from "@/lib/validation";
import {
  AiConfigurationError,
  createLazyAiTutor,
  type AiTutor,
} from "@/server/ai/tutor";
import { getDatabase } from "@/server/db/client";
import { createAnalyticsRepository } from "@/server/repositories/analytics-repository";
import { createSessionRepository } from "@/server/repositories/session-repository";
import {
  ConcurrentConceptUpdateError,
  createTrainingRepository,
  type PracticeAttempt,
} from "@/server/repositories/training-repository";
import {
  getAttemptKind,
  transitionAfterAssessment,
  transitionAfterSupport,
} from "@/server/training/engine";
import {
  AiConfigurationServiceError,
  ConflictError,
  InvalidStateError,
  NotFoundError,
  TutorOperationError,
} from "@/server/services/errors";
import {
  createTransactionRunner,
  type TransactionRunner,
} from "@/server/services/transaction";

export interface TrainingServiceDeps {
  sessions: ReturnType<typeof createSessionRepository>;
  training: ReturnType<typeof createTrainingRepository>;
  analytics: ReturnType<typeof createAnalyticsRepository>;
  tutor: AiTutor;
  runInTransaction: TransactionRunner;
}

function defaultDeps(): TrainingServiceDeps {
  const db = getDatabase();
  return {
    sessions: createSessionRepository(db),
    training: createTrainingRepository(db),
    analytics: createAnalyticsRepository(db),
    tutor: createLazyAiTutor(),
    runInTransaction: createTransactionRunner(db),
  };
}

function getContext(conceptId: string, deps: TrainingServiceDeps) {
  const context = deps.sessions.getConceptWithSession(conceptId);
  if (!context) {
    throw new NotFoundError("知识点不存在");
  }
  return context;
}

function getTrainingView(conceptId: string, deps: TrainingServiceDeps) {
  const view = deps.training.getTrainingView(conceptId);
  if (!view) {
    throw new NotFoundError("知识点不存在");
  }
  return view;
}

async function retryTutorCall<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function startTraining(
  conceptId: string,
  deps: TrainingServiceDeps = defaultDeps(),
) {
  const { concept, session } = getContext(conceptId, deps);

  if (
    concept.status === "not_started" ||
    concept.status === "needs_review" ||
    concept.status === "mastered"
  ) {
    const initialQuestion = `先别看资料。请用你自己的话解释：${concept.title}。`;
    deps.runInTransaction(() => {
      deps.training.startConcept(conceptId, initialQuestion, concept.stateVersion);
      deps.analytics.record({
        eventName: "concept_started",
        sessionId: session.id,
        conceptId,
      });
    });
  }

  return { ...getTrainingView(conceptId, deps), session };
}

function resolveAttemptForSubmission(
  conceptId: string,
  input: SubmitAttemptInput,
  deps: TrainingServiceDeps,
): { attempt: PracticeAttempt; shouldProcess: boolean } | null {
  const existing = deps.training.getAttemptByClientRequestId(
    input.clientRequestId,
  );

  if (!existing) {
    if (input.retryAttemptId) {
      throw new ConflictError("重试必须沿用原回答的请求编号");
    }
    return null;
  }

  if (existing.conceptId !== conceptId) {
    throw new ConflictError("请求编号已用于另一个知识点");
  }

  if (!input.retryAttemptId) {
    return { attempt: existing, shouldProcess: false };
  }

  if (input.retryAttemptId !== existing.id) {
    throw new ConflictError("重试的回答编号不匹配");
  }
  if (existing.processingStatus !== "failed") {
    return { attempt: existing, shouldProcess: false };
  }
  if (existing.userAnswer !== input.userAnswer) {
    throw new ConflictError("重试时不能修改原回答");
  }

  return {
    attempt: deps.training.retryPendingAttempt(existing.id),
    shouldProcess: true,
  };
}

export async function submitAttempt(
  conceptId: string,
  input: SubmitAttemptInput,
  deps: TrainingServiceDeps = defaultDeps(),
) {
  const { concept, session } = getContext(conceptId, deps);
  let resolved;
  try {
    resolved = resolveAttemptForSubmission(conceptId, input, deps);
  } catch (error) {
    if (error instanceof ConcurrentConceptUpdateError) {
      throw new ConflictError(error.message);
    }
    throw error;
  }

  if (resolved && !resolved.shouldProcess) {
    return {
      attempt: resolved.attempt,
      training: getTrainingView(conceptId, deps),
      duplicate: true,
    };
  }

  if (concept.status !== "learning" || concept.trainingStage === "complete") {
    throw new InvalidStateError("当前知识点不接受回答，请先开始训练");
  }
  if (!concept.currentQuestion) {
    throw new InvalidStateError("当前训练问题不存在，请重新开始训练");
  }

  const attempt =
    resolved?.attempt ??
    deps.runInTransaction(() => {
      const created = deps.training.createPendingAttempt({
        conceptId,
        clientRequestId: input.clientRequestId,
        kind: getAttemptKind(concept.trainingStage),
        question: concept.currentQuestion!,
        userAnswer: input.userAnswer,
        conceptVersion: concept.stateVersion,
      });
      deps.analytics.record({
        eventName:
          created.kind === "explanation"
            ? "explanation_submitted"
            : "followup_answered",
        sessionId: session.id,
        conceptId,
        properties: { attemptId: created.id, kind: created.kind },
      });
      return created;
    });

  let assessment;
  try {
    assessment = await retryTutorCall(() =>
      deps.tutor.assessAnswer({
        conceptTitle: concept.title,
        sourceText: session.sourceText,
        sourceContext: concept.sourceContext,
        question: attempt.question,
        userAnswer: attempt.userAnswer,
        stage: concept.trainingStage,
      }),
    );
  } catch (error) {
    deps.training.failAttempt(attempt.id, "AI 判断失败，请重试");
    if (error instanceof AiConfigurationError) {
      throw new AiConfigurationServiceError(
        "AI 尚未配置，你的回答已保存",
        attempt.id,
        error,
      );
    }
    throw new TutorOperationError(
      "AI 暂时没有完成判断，你的回答已保存",
      attempt.id,
      error,
    );
  }

  const transition =
    concept.isRetraining &&
    assessment.misconceptions.length > 0
      ? {
          stage: "complete" as const,
          status: "needs_review" as const,
          supportLevel: concept.supportLevel,
          mastered: false,
          currentQuestion: null,
        }
      : transitionAfterAssessment({
          stage: concept.trainingStage,
          status: concept.status,
          supportLevel: concept.supportLevel,
          assessment: assessment.assessment,
          nextQuestion: assessment.nextQuestion,
        });
  let completedAttempt;
  try {
    completedAttempt = deps.runInTransaction(() => {
      const completed = deps.training.completeAttemptAndTransition({
        attemptId: attempt.id,
        expectedConceptVersion: attempt.conceptVersion,
        assessment: assessment.assessment,
        understoodPoints: assessment.understoodPoints,
        missingPoints: assessment.missingPoints,
        misconceptions: assessment.misconceptions,
        nextQuestion: assessment.nextQuestion,
        transition,
      });
      if (transition.status === "mastered") {
        deps.analytics.record({
          eventName: "concept_mastered",
          sessionId: session.id,
          conceptId,
        });
      }
      return completed;
    });
  } catch (error) {
    if (error instanceof ConcurrentConceptUpdateError) {
      deps.training.failAttempt(
        attempt.id,
        "训练状态已更新，这次回答未参与判断",
      );
      throw new ConflictError("训练状态已在其他页面更新，请刷新查看最新进度");
    }
    throw error;
  }

  return {
    attempt: completedAttempt,
    training: getTrainingView(conceptId, deps),
    duplicate: false,
  };
}

export async function requestSupport(
  conceptId: string,
  deps: TrainingServiceDeps = defaultDeps(),
) {
  const { concept, session } = getContext(conceptId, deps);
  const training = getTrainingView(conceptId, deps);

  if (
    concept.status !== "learning" ||
    !["targeted_probe", "support"].includes(concept.trainingStage)
  ) {
    throw new InvalidStateError("当前阶段不能请求提示");
  }
  if (concept.supportLevel >= 3 || !concept.currentQuestion) {
    throw new InvalidStateError("提示已用完，请完成重新解释");
  }

  const requestedLevel = (concept.supportLevel + 1) as 1 | 2 | 3;
  const lastAttempt = training.attempts.at(-1);
  if (!lastAttempt) {
    throw new InvalidStateError("请先提交一次回答再请求提示");
  }

  let support;
  try {
    support = await retryTutorCall(() =>
      deps.tutor.generateSupport({
        conceptTitle: concept.title,
        sourceText: session.sourceText,
        sourceContext: concept.sourceContext,
        question: concept.currentQuestion!,
        userAnswer: lastAttempt.userAnswer,
        stage: concept.trainingStage,
        level: requestedLevel,
      }),
    );
  } catch (error) {
    if (error instanceof AiConfigurationError) {
      throw new AiConfigurationServiceError(
        "AI 尚未配置，请完成配置后重试",
        conceptId,
        error,
      );
    }
    throw new TutorOperationError(
      "AI 暂时没有生成提示，请稍后重试",
      conceptId,
      error,
    );
  }

  const transition = transitionAfterSupport({
    currentLevel: concept.supportLevel,
    requestedLevel,
    nextQuestion: support.nextQuestion,
  });
  try {
    deps.runInTransaction(() => {
      deps.training.saveSupportAndTransition({
        conceptId,
        level: support.level,
        content: support.content,
        nextQuestion: support.nextQuestion,
        stage: transition.stage,
        expectedConceptVersion: concept.stateVersion,
      });
      deps.analytics.record({
        eventName: "hint_requested",
        sessionId: session.id,
        conceptId,
        properties: { level: support.level },
      });
    });
  } catch (error) {
    if (error instanceof ConcurrentConceptUpdateError) {
      throw new ConflictError("训练状态已在其他页面更新，请刷新查看最新进度");
    }
    throw error;
  }

  return getTrainingView(conceptId, deps);
}

export function abandonTraining(
  conceptId: string,
  deps: TrainingServiceDeps = defaultDeps(),
) {
  const { concept: current, session } = getContext(conceptId, deps);
  try {
    return deps.runInTransaction(() => {
      const concept = deps.training.abandonConcept(
        conceptId,
        current.stateVersion,
      );
      deps.analytics.record({
        eventName: "concept_abandoned",
        sessionId: session.id,
        conceptId,
      });
      return concept;
    });
  } catch (error) {
    if (error instanceof ConcurrentConceptUpdateError) {
      throw new ConflictError("训练状态已在其他页面更新，请刷新查看最新进度");
    }
    throw error;
  }
}
