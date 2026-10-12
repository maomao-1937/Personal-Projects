import type { CaseOption, GameSession, PublicCase, Suspect } from "./types";

const UNKNOWN_SUSPECT: Suspect = {
  id: "suspect-01",
  name: "待核身份",
  age: 0,
  role: "涉案人员",
  publicIdentity: "身份信息仍在核验",
  demeanor: "保持沉默",
};

export function getSuspects(caseData: PublicCase): Suspect[] {
  if (caseData.suspects?.length) return caseData.suspects;
  if (caseData.suspect) {
    return [{ ...caseData.suspect, initialStatement: caseData.suspect.initialStatement ?? caseData.initialStatement }];
  }
  return [UNKNOWN_SUSPECT];
}

export function getActiveSuspect(caseData: PublicCase, activeSuspectId?: string | null): Suspect {
  const suspects = getSuspects(caseData);
  return suspects.find((suspect) => suspect.id === activeSuspectId) ?? suspects[0];
}

export function getDefenseBand(session: GameSession, suspectId: string) {
  return session.suspectStates?.[suspectId]?.defenseBand
    ?? session.suspects?.find((suspect) => suspect.id === suspectId)?.defenseBand
    ?? session.defenseBandBySuspect?.[suspectId]
    ?? session.defenseBand;
}

export function getVerdictOptions(caseData: PublicCase): CaseOption[] {
  return caseData.truthOptions;
}
