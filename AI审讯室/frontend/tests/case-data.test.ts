import { describe, expect, it } from "vitest";

import { getActiveSuspect, getDefenseBand, getSuspects, getVerdictOptions } from "@/features/game/case-data";
import type { GameSession, PublicCase } from "@/features/game/types";

const multiCase = {
  suspects: [
    { id: "s01", name: "林墨", age: 31, role: "档案员", publicIdentity: "夜班值守", demeanor: "谨慎" },
    { id: "s02", name: "周祁", age: 38, role: "保安", publicIdentity: "侧门巡逻", demeanor: "急躁" },
  ],
  truthOptions: [{ id: "legacy", label: "旧结论" }],
} as PublicCase;

describe("multi-suspect compatibility helpers", () => {
  it("prefers the multi-suspect roster and resolves the active person", () => {
    expect(getSuspects(multiCase)).toHaveLength(2);
    expect(getActiveSuspect(multiCase, "s02").name).toBe("周祁");
  });

  it("keeps backend truth option ids for report submission", () => {
    expect(getVerdictOptions(multiCase)).toEqual([
      { id: "legacy", label: "旧结论" },
    ]);
  });

  it("uses the suspect-scoped defense band", () => {
    const session = {
      defenseBand: "calm",
      suspectStates: { s02: { defense: 43, defenseBand: "shaken", hostility: 1 } },
    } as unknown as GameSession;
    expect(getDefenseBand(session, "s02")).toBe("shaken");
  });
});
