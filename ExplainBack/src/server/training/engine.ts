import type {
  Assessment,
  AttemptKind,
  ConceptStatus,
  SupportLevel,
  TrainingStage,
} from "@/lib/domain";

export interface TransitionInput {
  stage: TrainingStage;
  status: ConceptStatus;
  supportLevel: SupportLevel;
  assessment: Assessment;
  nextQuestion: string;
}

export interface TransitionResult {
  stage: TrainingStage;
  status: ConceptStatus;
  supportLevel: SupportLevel;
  mastered: boolean;
  currentQuestion: string | null;
}

export interface SupportTransitionInput {
  currentLevel: SupportLevel;
  requestedLevel: Exclude<SupportLevel, 0>;
  nextQuestion: string;
}

export interface SupportTransitionResult {
  stage: "support" | "retest";
  supportLevel: Exclude<SupportLevel, 0>;
  currentQuestion: string;
}

function complete(
  status: "mastered" | "needs_review",
  supportLevel: SupportLevel,
): TransitionResult {
  return {
    stage: "complete",
    status,
    supportLevel,
    mastered: status === "mastered",
    currentQuestion: null,
  };
}

export function transitionAfterAssessment(
  input: TransitionInput,
): TransitionResult {
  const {
    stage,
    status,
    supportLevel,
    assessment,
    nextQuestion,
  } = input;

  if (stage === "complete") {
    throw new Error("完成态不能继续推进训练");
  }

  if (assessment === "unclear") {
    return {
      stage,
      status,
      supportLevel,
      mastered: status === "mastered",
      currentQuestion: nextQuestion,
    };
  }

  if (stage === "retest") {
    return complete(
      assessment === "correct" ? "mastered" : "needs_review",
      supportLevel,
    );
  }

  if (stage === "validation_probe" && assessment === "correct") {
    return complete("mastered", supportLevel);
  }

  if (assessment === "correct") {
    return {
      stage: "validation_probe",
      status: "learning",
      supportLevel,
      mastered: false,
      currentQuestion: nextQuestion,
    };
  }

  return {
    stage: stage === "support" ? "support" : "targeted_probe",
    status: "learning",
    supportLevel,
    mastered: false,
    currentQuestion: nextQuestion,
  };
}

export function transitionAfterSupport(
  input: SupportTransitionInput,
): SupportTransitionResult {
  const { currentLevel, requestedLevel, nextQuestion } = input;

  if (requestedLevel !== currentLevel + 1) {
    throw new Error("支持等级必须逐级增加");
  }

  return {
    stage: requestedLevel === 3 ? "retest" : "support",
    supportLevel: requestedLevel,
    currentQuestion: nextQuestion,
  };
}

export function getAttemptKind(stage: TrainingStage): AttemptKind {
  switch (stage) {
    case "initial_explanation":
      return "explanation";
    case "validation_probe":
    case "targeted_probe":
    case "support":
      return "followup";
    case "retest":
      return "retest";
    case "complete":
      throw new Error("完成态不能提交回答");
  }
}
