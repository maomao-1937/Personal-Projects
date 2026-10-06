import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BriefingScreen } from "@/app/case/001/briefing/page";
import { useGameData } from "@/features/game/use-game-data";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/game/use-game-data", () => ({ useGameData: vi.fn() }));

const caseData = {
  caseCode: "CASE-TEST", title: "画廊展画失踪案", subtitle: "闭馆后的异常", contentRating: "12+",
  time: "夜间", location: "画廊", summary: "展画失踪，需要核对证词。", evidence: [],
  suspect: { name: "林宁", role: "管理员", age: 28, publicIdentity: "值班人员" }, initialStatement: "我在巡查。",
};

describe("Briefing case direction", () => {
  it("shows the public direction and adaptation note without implementation labels", () => {
    vi.mocked(useGameData).mockReturnValue({
      caseData: { ...caseData, generationIntent: {
        scene: "虚构城市的一间画廊", incident: "展画在闭馆后被调包", suspectRole: "夜班管理员",
        atmosphere: "紧张", preferences: "侧重时间线", adaptationNote: "已改为虚构画廊，保留调包主题。",
      } }, session: { sessionId: "ses_test" }, loading: false, error: null, retry: vi.fn(),
    } as unknown as ReturnType<typeof useGameData>);
    render(<BriefingScreen caseId="case_test" />);
    expect(screen.getByRole("heading", { name: "你的案件方向" })).toBeVisible();
    expect(screen.getByText("虚构城市的一间画廊")).toBeVisible();
    expect(screen.getByText("展画在闭馆后被调包")).toBeVisible();
    expect(screen.getByText("夜班管理员")).toBeVisible();
    expect(screen.getByText("紧张")).toBeVisible();
    expect(screen.getByText("侧重时间线")).toBeVisible();
    expect(screen.getByText("已改为虚构画廊，保留调包主题。")).toBeVisible();
    expect(screen.queryByText(/目标玩家|使用的工具|产品三卡/)).not.toBeInTheDocument();
  });

  it.each([undefined, null])("keeps old cases readable with intent %s", (generationIntent) => {
    vi.mocked(useGameData).mockReturnValue({
      caseData: { ...caseData, generationIntent }, session: { sessionId: "ses_old" },
      loading: false, error: null, retry: vi.fn(),
    } as unknown as ReturnType<typeof useGameData>);
    render(<BriefingScreen caseId="001" />);
    expect(screen.getByRole("heading", { name: "画廊展画失踪案" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "你的案件方向" })).not.toBeInTheDocument();
  });
});
