import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SummaryEditor } from "@/components/summary-editor";
import type { SummaryVersion, TranscriptSegment } from "@/lib/types/api";

const segments: TranscriptSegment[] = [
  {
    id: "seg-1",
    sequence: 0,
    start_ms: 0,
    end_ms: 1000,
    speaker: "林一",
    text: "确认发布。",
  },
  {
    id: "seg-2",
    sequence: 1,
    start_ms: 1000,
    end_ms: 2000,
    speaker: "周楠",
    text: "完成核验。",
  },
];

const summary: SummaryVersion = {
  id: "summary-1",
  meeting_id: "meeting-1",
  version: 2,
  schema_version: "1.0",
  content: {
    summary_version: "1.0",
    headline: "原始摘要",
    topics: [
      {
        title: "发布节奏",
        summary: "保持本周发布。",
        source_segment_ids: ["seg-1"],
      },
    ],
    decisions: [
      {
        text: "周三发布",
        source_segment_ids: ["seg-1"],
        confidence: "high",
      },
    ],
    action_items: [
      {
        task: "完成清单",
        owner: "周楠",
        due_date: null,
        source_segment_ids: ["seg-1"],
        confidence: "high",
      },
    ],
    open_questions: [],
    quality_flags: [],
  },
  quality_flags: [],
  status: "draft",
  parent_version_id: null,
  created_source: "ai",
  created_at: "2026-08-23T02:32:00Z",
};

describe("SummaryEditor", () => {
  it("edits structured fields without dropping source references", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SummaryEditor
        summary={summary}
        segments={segments}
        onCancel={() => {}}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText("摘要标题"));
    await user.type(screen.getByLabelText("摘要标题"), "更新后的摘要");
    await user.clear(screen.getByLabelText("决策 1"));
    await user.type(screen.getByLabelText("决策 1"), "周四发布");
    await user.click(screen.getByRole("button", { name: "添加决策" }));
    await user.type(screen.getByLabelText("决策 2"), "先完成移动端核验");
    await user.click(screen.getByRole("button", { name: "保存为新版本" }));
    expect(onSave).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText("决策 2 来源"), "seg-2");
    await user.click(screen.getByRole("button", { name: "保存为新版本" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        headline: "更新后的摘要",
        decisions: [
          expect.objectContaining({
            text: "周四发布",
            source_segment_ids: ["seg-1"],
          }),
          expect.objectContaining({
            text: "先完成移动端核验",
            source_segment_ids: ["seg-2"],
          }),
        ],
      }),
    );
  });

  it("edits every structured section and explicit evidence metadata", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SummaryEditor
        summary={summary}
        segments={segments}
        onCancel={() => {}}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "添加主题" }));
    await user.type(screen.getByLabelText("主题 2"), "移动端核验");
    await user.type(screen.getByLabelText("主题说明 2"), "确认摘要编辑和导出。 ");
    await user.selectOptions(screen.getByLabelText("主题 2 来源"), "seg-2");
    await user.selectOptions(screen.getByLabelText("决策 1 置信度"), "medium");
    await user.selectOptions(screen.getByLabelText("行动项 1 来源"), "seg-2");
    await user.selectOptions(screen.getByLabelText("行动项 1 置信度"), "low");
    await user.click(screen.getByRole("button", { name: "添加待确认问题" }));
    await user.type(screen.getByLabelText("待确认问题 1"), "谁负责最终发布？");
    await user.selectOptions(screen.getByLabelText("待确认问题 1 来源"), "seg-1");
    await user.click(screen.getByRole("button", { name: "保存为新版本" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        topics: expect.arrayContaining([
          expect.objectContaining({ title: "移动端核验", source_segment_ids: ["seg-2"] }),
        ]),
        decisions: [expect.objectContaining({ confidence: "medium" })],
        action_items: [
          expect.objectContaining({ source_segment_ids: ["seg-2"], confidence: "low" }),
        ],
        open_questions: [
          expect.objectContaining({ text: "谁负责最终发布？", source_segment_ids: ["seg-1"] }),
        ],
      }),
    );
  });

  it("keeps inputs visible when save reports a version conflict", () => {
    render(
      <SummaryEditor
        summary={summary}
        error="摘要已被其他页面更新，请核对最新版本后再保存。"
        onCancel={() => {}}
        onSave={() => Promise.resolve()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("摘要已被其他页面更新");
    expect(screen.getByLabelText("摘要标题")).toHaveValue("原始摘要");
  });

  it("closes with Escape when no save is running", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <SummaryEditor
        summary={summary}
        onCancel={onCancel}
        onSave={() => Promise.resolve()}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
