export type Tactic = "calm" | "empathy" | "pressure";
export type DefenseBand = "calm" | "guarded" | "shaken" | "breaking";
export type EvidenceState =
  | "public"
  | "discovered"
  | "selected"
  | "effective"
  | "used_ineffective";

export type Evidence = {
  id: string;
  name: string;
  description: string;
  source: string;
  hint: string;
  public: boolean;
};

export type CaseOption = { id: string; label: string };

export type PublicCase = {
  caseId: string;
  caseCode: string;
  generationSource: "llm" | "manual_fallback";
  title: string;
  subtitle: string;
  time: string;
  location: string;
  summary: string;
  contentRating: string;
  suspect: {
    id: string;
    name: string;
    age: number;
    role: string;
    publicIdentity: string;
    demeanor: string;
  };
  initialStatement: string;
  publicFacts: string[];
  evidence: Evidence[];
  truthOptions: CaseOption[];
  motiveOptions: CaseOption[];
  methodOptions: CaseOption[];
};

export type Message = {
  id: string;
  role: "detective" | "suspect";
  text: string;
  turn: number;
  tactic?: Tactic | null;
  evidenceId?: string | null;
  evidenceEffect: "none" | "effective" | "used_ineffective";
  createdAt: string;
};

export type Claim = {
  id: string;
  text: string;
  source: string;
  turn: number;
  kind: "statement" | "contradiction" | "timeline" | "empathy";
};

export type GameSession = {
  schemaVersion: number;
  sessionId: string;
  caseId: string;
  stage: "briefing" | "interrogation" | "report_ready" | "report_required" | "completed";
  turnCount: number;
  defense: number;
  hostility: number;
  defenseBand: DefenseBand;
  selectedEvidenceId: string | null;
  discoveredEvidenceIds: string[];
  effectiveEvidenceIds: string[];
  hitLieNodeIds: string[];
  claims: Claim[];
  messages: Message[];
  canSubmitReport: boolean;
  invalidPressureCount: number;
  reportResult: ScoreResult | null;
  evidence: Evidence[];
};

export type TurnResult = GameSession & {
  reply: string;
  evidenceEffect: "none" | "effective" | "used_ineffective";
  newEvidenceIds: string[];
  newClaimIds: string[];
  isRepeated: boolean;
  invalidPressure: boolean;
  forceReport: boolean;
};

export type ReportDraft = {
  verdictId: string;
  evidenceIds: string[];
  motiveId: string;
  methodId: string;
};

export type ScoreResult = {
  totalScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
  breakdown: {
    truth: number;
    motive: number;
    method: number;
    evidence: number;
    efficiency: number;
  };
  playerConclusion: Record<string, string>;
  trueConclusion: Record<string, string>;
  truthSummary: string;
  truthTimeline: string[];
  hitContradictions: Array<{ id: string; claim: string; evidenceId: string }>;
  missedContradictions: Array<{ id: string; claim: string; evidenceId: string }>;
  stats: {
    turnCount: number;
    effectiveEvidenceCount: number;
    invalidPressureCount: number;
  };
};
