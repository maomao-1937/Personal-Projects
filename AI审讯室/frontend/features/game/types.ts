export type Tactic = "calm" | "empathy" | "pressure";
export type DefenseBand = "calm" | "guarded" | "shaken" | "breaking";
export type EvidenceState = "public" | "discovered" | "selected" | "effective" | "used_ineffective";

export type Evidence = {
  id: string;
  name: string;
  description: string;
  source: string;
  hint: string;
  public: boolean;
};

export type Suspect = {
  id: string;
  name: string;
  age: number;
  role: string;
  publicIdentity: string;
  demeanor: string;
  initialStatement?: string;
};

export type CaseOption = { id: string; label: string };

export type PublicCase = {
  caseId: string;
  caseCode: string;
  generationSource: "llm" | "manual_fallback";
  generationIntent?: {
    scene: string;
    incident: string;
    suspectRole: string;
    atmosphere: "克制" | "紧张" | "轻松" | "温和";
    preferences: string;
    adaptationNote: string;
  } | null;
  title: string;
  subtitle: string;
  time: string;
  location: string;
  summary: string;
  contentRating: string;
  /** Compatibility for snapshots created before the multi-suspect schema. */
  suspect?: Suspect;
  suspects?: Suspect[];
  initialStatement?: string;
  publicFacts: string[];
  evidenceCount?: number;
  evidence: Evidence[];
  truthOptions: CaseOption[];
  motiveOptions: CaseOption[];
  methodOptions: CaseOption[];
  difficulty?: "standard" | "hard" | string;
  estimatedMinutes?: number;
};

export type CaseListItem = Pick<
  PublicCase,
  "caseId" | "caseCode" | "generationSource" | "title" | "subtitle" | "time" | "location" | "contentRating"
> & {
  summary?: string;
  suspectCount?: number;
  evidenceCount?: number;
  difficulty?: string;
  estimatedMinutes?: number;
};

export type Message = {
  id: string;
  role: "detective" | "suspect" | "system";
  text: string;
  turn: number;
  suspectId?: string | null;
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
  suspectId?: string | null;
  kind: "statement" | "contradiction" | "timeline" | "empathy";
};

export type GameSession = {
  schemaVersion: number;
  sessionId: string;
  caseId: string;
  stage: "briefing" | "interrogation" | "report_ready" | "report_required" | "completed";
  turnCount: number;
  maxTurns?: number;
  activeSuspectId?: string | null;
  defense: number;
  hostility: number;
  defenseBand: DefenseBand;
  defenseBySuspect?: Record<string, number>;
  defenseBandBySuspect?: Record<string, DefenseBand>;
  suspectStates?: Record<string, { defense: number; defenseBand: DefenseBand; hostility: number }>;
  suspects?: Array<Suspect & { defense?: number; defenseBand?: DefenseBand; hostility?: number }>;
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
  breakdown: { truth: number; motive: number; method: number; evidence: number; efficiency: number };
  playerConclusion: Record<string, string>;
  trueConclusion: Record<string, string>;
  truthSummary: string;
  truthTimeline: string[];
  hitContradictions: Array<{ id: string; claim: string; evidenceId: string }>;
  missedContradictions: Array<{ id: string; claim: string; evidenceId: string }>;
  stats: { turnCount: number; effectiveEvidenceCount: number; invalidPressureCount: number };
};
