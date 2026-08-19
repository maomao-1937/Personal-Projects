import type { CreateSessionInput } from "@/lib/validation";
import { getKnowledgeMode } from "@/lib/knowledge-mode";
import {
  AiConfigurationError,
  createLazyAiTutor,
  type AiTutor,
} from "@/server/ai/tutor";
import { sourceContainsContext } from "@/server/ai/schemas";
import { getDatabase } from "@/server/db/client";
import { createAnalyticsRepository } from "@/server/repositories/analytics-repository";
import {
  createSessionRepository,
  type ConceptDraft,
  type SessionWithConcepts,
} from "@/server/repositories/session-repository";
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

export interface SessionServiceDeps {
  sessions: ReturnType<typeof createSessionRepository>;
  analytics: ReturnType<typeof createAnalyticsRepository>;
  tutor: AiTutor;
  runInTransaction: TransactionRunner;
}

type StudyMaterialInput = Pick<CreateSessionInput, "title" | "sourceText">;

function defaultDeps(): SessionServiceDeps {
  const db = getDatabase();
  return {
    sessions: createSessionRepository(db),
    analytics: createAnalyticsRepository(db),
    tutor: createLazyAiTutor(),
    runInTransaction: createTransactionRunner(db),
  };
}

function getRequiredSession(
  sessionId: string,
  sessions: SessionServiceDeps["sessions"],
): SessionWithConcepts {
  const session = sessions.getSessionWithConcepts(sessionId);
  if (!session) {
    throw new NotFoundError("学习 Session 不存在");
  }
  return session;
}

async function extractGroundedConcepts(
  input: StudyMaterialInput,
  tutor: AiTutor,
): Promise<ConceptDraft[]> {
  let lastError: unknown;
  const mode = getKnowledgeMode(input.sourceText);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const concepts = await tutor.extractConcepts(input);
      if (
        concepts.length > 0 &&
        (mode === "topic_general" ||
          concepts.every((concept) =>
            sourceContainsContext(input.sourceText, concept.sourceContext),
          ))
      ) {
        return concepts;
      }
      lastError =
        mode === "topic_general"
          ? new Error("AI 未返回有效知识点")
          : new Error("AI 返回了资料中不存在的引用片段");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("AI 未返回有效知识点");
}

async function generateLearningMap(
  sessionId: string,
  input: StudyMaterialInput,
  deps: SessionServiceDeps,
): Promise<SessionWithConcepts> {
  try {
    const concepts = await extractGroundedConcepts(input, deps.tutor);
    deps.sessions.replaceConceptsAndMarkReady(sessionId, concepts);
    return getRequiredSession(sessionId, deps.sessions);
  } catch (error) {
    const publicMessage = "知识地图生成失败，请稍后重试";
    deps.sessions.markMapFailed(sessionId, publicMessage);
    if (error instanceof AiConfigurationError) {
      throw new AiConfigurationServiceError(
        "AI 尚未配置，你的学习资料已保存",
        sessionId,
        error,
      );
    }
    throw new TutorOperationError(publicMessage, sessionId, error);
  }
}

export async function createStudySession(
  input: CreateSessionInput,
  deps: SessionServiceDeps = defaultDeps(),
): Promise<SessionWithConcepts> {
  const existing = deps.sessions.getByClientRequestId(input.clientRequestId);
  if (existing) {
    if (existing.title !== input.title || existing.sourceText !== input.sourceText) {
      throw new ConflictError("这个创建请求已用于另一份学习资料");
    }
    return getRequiredSession(existing.id, deps.sessions);
  }

  const session = deps.runInTransaction(() => {
    const created = deps.sessions.createProcessing(input);
    deps.analytics.record({
      eventName: "session_created",
      sessionId: created.id,
    });
    return created;
  });

  return generateLearningMap(session.id, input, deps);
}

export async function retryLearningMap(
  sessionId: string,
  deps: SessionServiceDeps = defaultDeps(),
): Promise<SessionWithConcepts> {
  const session = getRequiredSession(sessionId, deps.sessions);
  if (session.mapStatus !== "failed") {
    throw new InvalidStateError("只有生成失败的学习地图可以重试");
  }
  deps.sessions.markMapProcessing(sessionId);

  return generateLearningMap(
    sessionId,
    { title: session.title, sourceText: session.sourceText },
    deps,
  );
}
