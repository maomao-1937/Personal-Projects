import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ReportPanel } from "@/components/report-panel";
import type { AnalysisResponse } from "@/lib/api";


const dimensionNames = [
  "需求理解",
  "情绪与语气",
  "信息准确性",
  "异议处理",
  "推进能力",
  "风险话术",
] as const;


function report(
  status: AnalysisResponse["analysis_status"] = "scored",
): AnalysisResponse {
  const scoredCount = status === "scored" ? 6 : status === "partial" ? 3 : 0;
  return {
    analysis_id: "analysis-1",
    qa_type: "sales",
    analysis_status: status,
    total_score: status === "scored" ? 70 : null,
    scored_dimension_count: scoredCount,
    confidence: status === "unable_to_score" ? "low" : "high",
    risk_level: "medium",
    risk_flags: ["绝对化价格承诺"],
    rubric_version: "qa-rubric-v1",
    prompt_version: "qa-analysis-v1",
    model_version: "fake-model-v1",
    dimensions: dimensionNames.map((name, index) => ({
      name,
      status: index < scoredCount ? ("scored" as const) : ("insufficient_context" as const),
      score: index < scoredCount ? 70 : null,
      summary:
        index < scoredCount ? "未澄清客户真实顾虑。" : "当前对话信息不足，无法可靠判断。",
      evidence:
        index < scoredCount
          ? [
              {
                type: "missed_opportunity" as const,
                turn_ids: ["t1", "t2"],
                quotes: ["这个价格有些贵", "我们已经是最低价格了"],
                rationale: "客户提出价格异议后，销售没有澄清预算或价值顾虑。",
              },
            ]
          : [],
      improvement: index < scoredCount ? "先追问预算或价值顾虑。" : null,
      confidence: index < scoredCount ? ("high" as const) : ("low" as const),
    })),
    major_issues: [
      {
        severity: "high",
        dimension: "信息准确性",
        title: "绝对化价格承诺",
        reason: "没有产品政策可以支持最低价结论。",
        evidence_turn_ids: ["t2"],
      },
    ],
    suggested_reply: "理解您的顾虑，方便说说主要是在比较预算还是方案价值吗？",
    limitations: ["缺少企业价格政策，无法核验最低价说法。"],
    remaining_uses: 49,
  };
}


it("renders a scored report with risk, issues and evidence rail", () => {
  render(<ReportPanel analyzing={false} error={null} report={report()} />);

  expect(screen.getByTestId("total-score")).toHaveTextContent("70");
  expect(screen.getByText("6 / 6 个维度参与总分")).toBeInTheDocument();
  expect(screen.getAllByText("绝对化价格承诺").length).toBeGreaterThan(0);
  expect(screen.getByText("建议回复")).toBeInTheDocument();
  expect(screen.getAllByText("t2").length).toBeGreaterThan(0);
  expect(screen.getAllByText("“我们已经是最低价格了”").length).toBeGreaterThan(0);
  expect(screen.getByText("总体置信度：高")).toBeInTheDocument();
});


it("never renders a total score for partial reports", () => {
  render(
    <ReportPanel analyzing={false} error={null} report={report("partial")} />,
  );

  expect(
    screen.getByRole("heading", { name: "部分结果" }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId("total-score")).not.toBeInTheDocument();
  expect(screen.getByText("3 / 6 个维度有可靠证据")).toBeInTheDocument();
});


it("shows corrective guidance for unable-to-score reports", () => {
  render(
    <ReportPanel
      analyzing={false}
      error={null}
      report={report("unable_to_score")}
    />,
  );

  expect(
    screen.getByRole("heading", { name: "无法可靠评分" }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId("total-score")).not.toBeInTheDocument();
  expect(screen.getByText(/补充更完整的双角色对话/)).toBeInTheDocument();
});


it("shows a recoverable message when copying a report fails", async () => {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  render(<ReportPanel analyzing={false} error={null} report={report()} />);

  await user.click(screen.getByRole("button", { name: "复制报告" }));

  expect(
    await screen.findByRole("button", { name: "复制失败，请重试" }),
  ).toBeInTheDocument();
});


it("copies issues, evidence quotes, rationale and improvement actions", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<ReportPanel analyzing={false} error={null} report={report()} />);

  await user.click(screen.getByRole("button", { name: "复制报告" }));

  expect(writeText).toHaveBeenCalledOnce();
  const copiedText = String(writeText.mock.calls[0][0]);
  expect(copiedText).toContain("主要问题");
  expect(copiedText).toContain("绝对化价格承诺");
  expect(copiedText).toContain("t2｜“我们已经是最低价格了”");
  expect(copiedText).toContain("客户提出价格异议后，销售没有澄清预算或价值顾虑。");
  expect(copiedText).toContain("改进动作：先追问预算或价值顾虑。");
});
