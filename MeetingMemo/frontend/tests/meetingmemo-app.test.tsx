import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MeetingMemoApp } from "@/components/meetingmemo-app";
import type { Meeting, MeetingDetail, SummaryVersion } from "@/lib/types/api";

const meeting: Meeting = {
  id: "meeting-1",
  title: "产品体验复盘",
  meeting_at: "2026-08-23T02:00:00Z",
  timezone: "Asia/Shanghai",
  source: "manual",
  language: "zh-CN",
  status: "ready",
  created_at: "2026-08-23T02:00:00Z",
  updated_at: "2026-08-23T02:30:00Z",
};

const detail: MeetingDetail = { ...meeting, segments: [] };

const secondMeeting: Meeting = {
  ...meeting,
  id: "meeting-2",
  title: "客户访谈",
};
const secondDetail: MeetingDetail = { ...secondMeeting, segments: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

const summary: SummaryVersion = {
  id: "summary-1",
  meeting_id: meeting.id,
  version: 1,
  schema_version: "1.0",
  content: {
    summary_version: "1.0",
    headline: "初始摘要",
    topics: [],
    decisions: [],
    action_items: [],
    open_questions: [],
    quality_flags: [],
  },
  quality_flags: [],
  status: "draft",
  parent_version_id: null,
  created_source: "ai",
  created_at: "2026-08-23T02:32:00Z",
};

function client(overrides: Record<string, unknown> = {}) {
  return {
    listMeetings: vi.fn().mockResolvedValue({ items: [meeting] }),
    getMeeting: vi.fn().mockResolvedValue(detail),
    listSummaries: vi.fn().mockResolvedValue({ items: [] }),
    getIntegrations: vi.fn().mockResolvedValue({
      slack: { status: "not_configured" },
      email: { status: "not_configured" },
      zoom: { status: "not_configured" },
      google_meet: { status: "not_configured" },
    }),
    createMeeting: vi.fn().mockResolvedValue(meeting),
    replaceTranscriptText: vi
      .fn()
      .mockResolvedValue({ meeting_id: meeting.id, segment_count: 1 }),
    uploadTranscript: vi.fn(),
    createSummaryJob: vi.fn().mockResolvedValue({
      id: "job-1",
      meeting_id: meeting.id,
      job_type: "summary",
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      error: null,
      created_at: "2026-08-23T02:31:00Z",
      updated_at: "2026-08-23T02:31:00Z",
    }),
    getJob: vi.fn(),
    retryJob: vi.fn(),
    createRevision: vi.fn(),
    approveSummary: vi.fn(),
    deliverSummary: vi.fn(),
    deleteMeeting: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

describe("MeetingMemoApp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the meeting navigation and selected document", async () => {
    const api = client();

    render(<MeetingMemoApp client={api} />);

    expect(screen.getByText("正在整理会议桌面…")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { level: 1, name: "产品体验复盘" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "会议导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建会议" })).toBeInTheDocument();
    expect(api.getMeeting).toHaveBeenCalledWith("meeting-1");
  });

  it("creates a meeting from pasted text and starts the AI job", async () => {
    const user = userEvent.setup();
    const api = client({
      listMeetings: vi.fn().mockResolvedValue({ items: [] }),
      getMeeting: vi.fn().mockResolvedValue(detail),
    });

    render(<MeetingMemoApp client={api} />);

    await user.click(await screen.findByRole("button", { name: "导入一次会议" }));
    expect(screen.getByRole("dialog", { name: "新建会议" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上传音频，转录服务待配置" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "上传视频，转录服务待配置" })).toBeDisabled();

    await user.type(screen.getByLabelText("会议标题"), "本周产品周会");
    await user.type(
      screen.getByLabelText("粘贴转写文本"),
      "林一：确认周三发布。周楠：我来完成上线清单。",
    );
    await user.click(screen.getByRole("button", { name: "创建并生成摘要" }));

    expect(api.createMeeting).toHaveBeenCalledWith(
      expect.objectContaining({ title: "本周产品周会", language: "zh-CN" }),
    );
    expect(api.replaceTranscriptText).toHaveBeenCalledWith(
      "meeting-1",
      "林一：确认周三发布。周楠：我来完成上线清单。",
    );
    expect(api.createSummaryJob).toHaveBeenCalledWith("meeting-1");
    expect(await screen.findByText("正在排队")).toBeInTheDocument();
  });

  it("saves summary edits as a new backend version", async () => {
    const user = userEvent.setup();
    const revised = { ...summary, version: 2, content: { ...summary.content, headline: "修订摘要" } };
    const api = client({
      listSummaries: vi.fn().mockResolvedValue({ items: [summary] }),
      createRevision: vi.fn().mockResolvedValue(revised),
    });

    render(<MeetingMemoApp client={api} />);

    await user.click(await screen.findByRole("button", { name: "编辑摘要" }));
    await user.clear(screen.getByLabelText("摘要标题"));
    await user.type(screen.getByLabelText("摘要标题"), "修订摘要");
    const saveButton = screen.getByRole("button", { name: "保存为新版本" });
    expect(saveButton).toBeEnabled();
    expect(saveButton.closest("form")).toBeValid();
    await user.click(saveButton);

    await waitFor(() => {
      expect(api.createRevision).toHaveBeenCalledWith(
        "summary-1",
        1,
        expect.objectContaining({ headline: "修订摘要" }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("已保存为 v2。");
  });

  it("ignores a stale meeting response after a newer selection", async () => {
    const user = userEvent.setup();
    const delayedDetail = deferred<MeetingDetail>();
    const delayedSummaries = deferred<{ items: SummaryVersion[] }>();
    const api = client({
      listMeetings: vi.fn().mockResolvedValue({ items: [meeting, secondMeeting] }),
      getMeeting: vi.fn((meetingId: string) => {
        if (meetingId === "meeting-2") return delayedDetail.promise;
        return Promise.resolve(detail);
      }),
      listSummaries: vi.fn((meetingId: string) => {
        if (meetingId === "meeting-2") return delayedSummaries.promise;
        return Promise.resolve({ items: [] });
      }),
    });

    render(<MeetingMemoApp client={api} />);
    expect(await screen.findByRole("heading", { name: "产品体验复盘" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "打开会议 客户访谈" }));
    await user.click(screen.getByRole("button", { name: "打开会议 产品体验复盘" }));
    await act(async () => {
      delayedDetail.resolve(secondDetail);
      delayedSummaries.resolve({ items: [] });
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: "产品体验复盘" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "客户访谈" })).not.toBeInTheDocument();
  });

  it("does not request integration state for the simplified review workspace", async () => {
    const api = client({
      getIntegrations: vi.fn().mockRejectedValue(new Error("集成服务暂时不可用")),
    });

    render(<MeetingMemoApp client={api} />);

    expect(await screen.findByRole("heading", { name: "产品体验复盘" })).toBeInTheDocument();
    expect(api.getIntegrations).not.toHaveBeenCalled();
  });

  it("cleans up a newly created meeting when transcript import fails", async () => {
    const user = userEvent.setup();
    const deleteMeeting = vi.fn().mockResolvedValue(undefined);
    const api = client({
      listMeetings: vi.fn().mockResolvedValue({ items: [] }),
      replaceTranscriptText: vi.fn().mockRejectedValue(new Error("转写导入失败")),
      deleteMeeting,
    });

    render(<MeetingMemoApp client={api} />);
    await user.click(await screen.findByRole("button", { name: "导入一次会议" }));
    await user.type(screen.getByLabelText("会议标题"), "失败恢复测试");
    await user.type(screen.getByLabelText("粘贴转写文本"), "这是一段有效转写。");
    await user.click(screen.getByRole("button", { name: "创建并生成摘要" }));

    await waitFor(() => expect(deleteMeeting).toHaveBeenCalledWith("meeting-1"));
    expect(api.createSummaryJob).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "新建会议" })).toBeInTheDocument();
    expect(screen.getByLabelText("粘贴转写文本")).toHaveValue("这是一段有效转写。");
  });

  it("reports approval as ready to export without mentioning delivery", async () => {
    const user = userEvent.setup();
    const approved = { ...summary, status: "approved" };
    const approveSummary = vi.fn().mockResolvedValue(approved);
    const api = client({
      listSummaries: vi.fn().mockResolvedValue({ items: [summary] }),
      approveSummary,
    });

    render(<MeetingMemoApp client={api} />);
    await user.click(await screen.findByRole("button", { name: "确认摘要" }));

    expect(approveSummary).toHaveBeenCalledWith(summary.id);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "摘要已确认，现在可以导出。",
    );
  });

  it("deletes the selected historical meeting and opens the next one", async () => {
    const user = userEvent.setup();
    const deleteMeeting = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = client({
      listMeetings: vi.fn().mockResolvedValue({ items: [meeting, secondMeeting] }),
      getMeeting: vi.fn((meetingId: string) =>
        Promise.resolve(meetingId === secondMeeting.id ? secondDetail : detail),
      ),
      deleteMeeting,
    });

    render(<MeetingMemoApp client={api} />);
    expect(await screen.findByRole("heading", { name: "产品体验复盘" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "删除会议 产品体验复盘" }));

    await waitFor(() => expect(deleteMeeting).toHaveBeenCalledWith("meeting-1"));
    expect(
      screen.queryByRole("button", { name: "打开会议 产品体验复盘" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "客户访谈" })).toBeInTheDocument();
  });

  it("keeps the historical meeting when deletion is cancelled", async () => {
    const user = userEvent.setup();
    const deleteMeeting = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const api = client({ deleteMeeting });

    render(<MeetingMemoApp client={api} />);
    await screen.findByRole("heading", { name: "产品体验复盘" });
    await user.click(screen.getByRole("button", { name: "删除会议 产品体验复盘" }));

    expect(deleteMeeting).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "打开会议 产品体验复盘" }),
    ).toBeInTheDocument();
  });

  it("keeps the historical meeting and reports a deletion failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const api = client({
      deleteMeeting: vi.fn().mockRejectedValue(new Error("删除会议失败")),
    });

    render(<MeetingMemoApp client={api} />);
    await screen.findByRole("heading", { name: "产品体验复盘" });
    await user.click(screen.getByRole("button", { name: "删除会议 产品体验复盘" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("删除会议失败");
    expect(
      screen.getByRole("button", { name: "打开会议 产品体验复盘" }),
    ).toBeInTheDocument();
  });

  it("removes processing labels from the sidebar while keeping document progress", async () => {
    window.localStorage.setItem(
      "meetingmemo.active-jobs.v1",
      JSON.stringify([
        {
          id: "job-1",
          meeting_id: meeting.id,
          job_type: "summary",
          status: "queued",
          attempts: 0,
          max_attempts: 3,
          error: null,
          created_at: "2026-08-23T02:31:00Z",
          updated_at: "2026-08-23T02:31:00Z",
        },
      ]),
    );

    render(<MeetingMemoApp client={client()} />);

    expect(await screen.findByText("正在排队")).toBeInTheDocument();
    expect(screen.queryByText("处理中", { exact: true })).not.toBeInTheDocument();
  });
});
