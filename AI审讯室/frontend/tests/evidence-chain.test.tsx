import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvidenceChain } from "@/features/game/components/evidence-chain";
import type { GameSession } from "@/features/game/types";

const baseSession: GameSession = {
  schemaVersion: 1,
  sessionId: "ses_portfolio_001",
  caseId: "001",
  stage: "interrogation",
  turnCount: 0,
  defense: 100,
  hostility: 0,
  defenseBand: "calm",
  selectedEvidenceId: null,
  discoveredEvidenceIds: [],
  effectiveEvidenceIds: [],
  hitLieNodeIds: [],
  claims: [],
  messages: [
    {
      id: "msg_initial",
      role: "suspect",
      text: "21 点以后我一直在档案室修复索引。",
      turn: 0,
      evidenceEffect: "none",
      createdAt: "2026-08-17T21:05:00+08:00",
    },
  ],
  canSubmitReport: false,
  invalidPressureCount: 0,
  reportResult: null,
  evidence: [
    {
      id: "E02",
      name: "侧门门禁记录",
      description: "21:17，个人门禁卡打开侧门。",
      source: "门禁控制器",
      hint: "对照嫌疑人的位置证词。",
      public: true,
    },
  ],
};

describe("EvidenceChain", () => {
  it("shows the three-step investigation path before a contradiction is found", () => {
    render(<EvidenceChain session={baseSession} />);

    const chain = screen.getByRole("region", { name: "实时矛盾链" });
    expect(within(chain).getByText("证词")).toBeVisible();
    expect(within(chain).getByText("证据")).toBeVisible();
    expect(within(chain).getByText("矛盾")).toBeVisible();
    expect(within(chain).getByText("21 点以后我一直在档案室修复索引。")).toBeVisible();
    expect(within(chain).getByText("等待记录")).toBeVisible();
    expect(within(chain).getByText("等待对质")).toBeVisible();
    expect(within(chain).getByText("0 条有效证据 · 0 处矛盾")).toBeVisible();
  });

  it("renders real effective evidence and contradiction claims as a hit chain", () => {
    const session: GameSession = {
      ...baseSession,
      turnCount: 3,
      effectiveEvidenceIds: ["E02"],
      hitLieNodeIds: ["L02"],
      claims: [
        {
          id: "C01",
          text: "我整晚都没有靠近侧门。",
          source: "第 1 回合证词",
          turn: 1,
          kind: "statement",
        },
        {
          id: "L02",
          text: "门禁记录与不在场证词冲突。",
          source: "E02 对质",
          turn: 3,
          kind: "contradiction",
        },
      ],
    };

    render(<EvidenceChain session={session} />);

    const chain = screen.getByRole("region", { name: "实时矛盾链" });
    expect(within(chain).getByText("E02")).toBeVisible();
    expect(within(chain).getByText("侧门门禁记录")).toBeVisible();
    expect(within(chain).getByText("门禁记录与不在场证词冲突。")).toBeVisible();
    expect(within(chain).getByText("已击中")).toBeVisible();
    expect(within(chain).getByText("1 条有效证据 · 1 处矛盾")).toBeVisible();
  });
});
