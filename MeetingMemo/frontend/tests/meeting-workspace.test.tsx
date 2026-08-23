import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MeetingWorkspace } from "@/components/meeting-workspace";
import type {
  MeetingDetail,
  SummaryVersion,
} from "@/lib/types/api";

const meeting: MeetingDetail = {
  id: "meeting-1",
  title: "产品体验复盘",
  meeting_at: "2026-08-23T02:00:00Z",
  timezone: "Asia/Shanghai",
  source: "manual",
  language: "zh-CN",
  status: "ready",
  created_at: "2026-08-23T02:00:00Z",
  updated_at: "2026-08-23T02:30:00Z",
  segments: [
    {
      id: "seg-1",
      sequence: 0,
      start_ms: 0,
      end_ms: 18000,
      speaker: "林一",
      text: "今天重点确认内测反馈和发布节奏。",
    },
    {
      id: "seg-2",
      sequence: 1,
      start_ms: 65000,
      end_ms: 85000,
      speaker: "周楠",
      text: "确认周三发布，我来完成上线清单。",
    },
  ],
};

const summary: SummaryVersion = {
  id: "summary-1",
  meeting_id: "meeting-1",
  version: 2,
  schema_version: "1.0",
  content: {
    summary_version: "1.0",
    headline: "团队确认周三发布，并在发布前完成最后一轮体验核验。",
    topics: [
      {
        title: "发布节奏",
        summary: "内测问题已收敛，发布计划保持不变。",
        source_segment_ids: ["seg-1", "seg-2"],
      },
    ],
    decisions: [
      {
        text: "本周三正式发布。",
        source_segment_ids: ["seg-2"],
        confidence: "high",
      },
    ],
    action_items: [
      {
        task: "完成上线清单并发到项目群。",
        owner: "周楠",
        due_date: "2026-08-26",
        source_segment_ids: ["seg-2"],
        confidence: "high",
      },
    ],
    open_questions: [],
    quality_flags: [],
  },
  quality_flags: [],
  status: "draft",
  parent_version_id: "summary-0",
  created_source: "user",
  created_at: "2026-08-23T02:32:00Z",
};

describe("MeetingWorkspace", () => {
  it("renders a quiet review workspace with traceable AI insights", () => {
    render(
      <MeetingWorkspace
        meeting={meeting}
        summary={summary}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "产品体验复盘" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("AI 生成").length).toBeGreaterThan(0);
    expect(screen.getAllByText(summary.content.headline)).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "决策事项" })).toBeInTheDocument();
    expect(screen.getByText("本周三正式发布。")).toBeInTheDocument();
    expect(screen.getByText("周楠")).toBeInTheDocument();
    expect(screen.getByText("8 月 26 日")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认摘要" })).toBeInTheDocument();
  });

  it("opens the transcript and focuses the cited source", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <MeetingWorkspace
        meeting={meeting}
        summary={summary}
      />,
    );

    await user.click(
      screen.getAllByRole("button", { name: "查看来源 01:05" })[0],
    );

    expect(screen.getByRole("tab", { name: "转写" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(scrollIntoView).toHaveBeenCalled();
    const sourceText = screen.getByText("确认周三发布，我来完成上线清单。");
    expect(sourceText).toBeVisible();
    expect(sourceText.closest("section")).toHaveFocus();
  });

  it("keeps the review action while hiding version and delivery controls", () => {
    render(
      <MeetingWorkspace
        meeting={meeting}
        summary={{ ...summary, status: "approved" }}
      />,
    );

    expect(screen.getByRole("button", { name: "已审批此版本" })).toBeInTheDocument();
    expect(screen.queryByText("当前版本")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "发送邮件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Slack" })).not.toBeInTheDocument();
    expect(screen.queryByText("邮件与 Slack 均未配置")).not.toBeInTheDocument();
  });

  it("opens and closes the responsive insight drawer", async () => {
    const user = userEvent.setup();
    render(
      <MeetingWorkspace
        meeting={meeting}
        summary={summary}
      />,
    );

    await user.click(screen.getByRole("button", { name: "打开会议洞察" }));
    expect(screen.getByRole("complementary", { name: "会议洞察" })).toHaveClass(
      "insight-pane--open",
    );
    await user.keyboard("{Escape}");
    expect(screen.getByRole("complementary", { name: "会议洞察" })).not.toHaveClass(
      "insight-pane--open",
    );
  });

  it("offers a compact retry action after processing fails", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <MeetingWorkspace
        meeting={meeting}
        summary={null}
        processingLabel="处理失败"
        processingError="尚未配置模型 API Key"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("尚未配置模型 API Key")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重试处理" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
