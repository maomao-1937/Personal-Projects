"use client";

import {
  AudioLines,
  CalendarDays,
  FileText,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { MeetingWorkspace } from "@/components/meeting-workspace";
import { SummaryEditor } from "@/components/summary-editor";
import { useModalFocus } from "@/hooks/use-modal-focus";
import { useProcessingJobs } from "@/hooks/use-processing-job";
import { api, type ApiClient } from "@/lib/api/client";
import type {
  Meeting,
  MeetingDetail,
  ProcessingJob,
  SummaryPayload,
  SummaryVersion,
} from "@/lib/types/api";

type MeetingMemoClient = Pick<
  ApiClient,
  | "listMeetings"
  | "getMeeting"
  | "listSummaries"
  | "createMeeting"
  | "replaceTranscriptText"
  | "uploadTranscript"
  | "createSummaryJob"
  | "getJob"
  | "retryJob"
  | "createRevision"
  | "approveSummary"
  | "deleteMeeting"
  | "logout"
>;

interface MeetingMemoAppProps {
  client?: MeetingMemoClient;
}

function meetingDate(value: string | null, createdAt: string) {
  const date = new Date(value ?? createdAt);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "今天";
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function jobLabel(job: ProcessingJob | null) {
  if (!job) return null;
  if (job.status === "queued") return "正在排队";
  if (job.status === "running") return "AI 处理中";
  if (job.status === "succeeded") return "摘要已生成";
  if (job.status === "failed") return "处理失败";
  return "处理已取消";
}

function Brand() {
  return (
    <div className="workspace-brand">
      <div className="brand-mark brand-mark--small" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span>MeetingMemo</span>
    </div>
  );
}

function NewMeetingDialog({
  open,
  pending,
  error,
  onClose,
  onCreate,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: {
    title: string;
    meetingAt: string | null;
    language: string;
    transcript: string;
    file: File | null;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [title, setTitle] = useState("");
  const [meetingAt, setMeetingAt] = useState("");
  const [language, setLanguage] = useState("zh-CN");
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useModalFocus({
    active: open,
    containerRef: dialogRef,
    initialFocusRef: closeButton,
    onEscape: () => {
      if (!pending) onClose();
    },
  });

  if (!open) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate({
      title: title.trim(),
      meetingAt: meetingAt ? new Date(meetingAt).toISOString() : null,
      language,
      transcript: transcript.trim(),
      file,
    });
  }

  const validInput =
    title.trim().length > 0 &&
    (mode === "paste" ? transcript.trim().length > 0 : file !== null);

  return (
    <div className="dialog-backdrop">
      <section
        className="new-meeting-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-meeting-title"
        ref={dialogRef}
      >
        <header className="dialog-header">
          <div>
            <p className="eyebrow">导入会议记录</p>
            <h2 id="new-meeting-title">新建会议</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="关闭新建会议"
            onClick={onClose}
            disabled={pending}
            ref={closeButton}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit} className="meeting-form">
          <div className="form-grid">
            <label className="field field--wide">
              <span>会议标题</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：产品体验复盘"
                maxLength={240}
                required
              />
            </label>
            <label className="field">
              <span>会议时间</span>
              <input
                type="datetime-local"
                value={meetingAt}
                onChange={(event) => setMeetingAt(event.target.value)}
              />
            </label>
            <label className="field">
              <span>语言</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </label>
          </div>

          <div className="input-methods" role="tablist" aria-label="转写导入方式">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "paste"}
              onClick={() => setMode("paste")}
            >
              <FileText size={15} aria-hidden="true" />
              粘贴转写
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "file"}
              onClick={() => setMode("file")}
            >
              <Upload size={15} aria-hidden="true" />
              上传文件
            </button>
          </div>

          {mode === "paste" ? (
            <label className="field transcript-field">
              <span>粘贴转写文本</span>
              <textarea
                aria-label="粘贴转写文本"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="粘贴会议转写。支持说话人、时间戳和普通段落文本。"
                rows={9}
                maxLength={500000}
                required
              />
              <small>{transcript.length.toLocaleString("zh-CN")} / 500,000 字符</small>
            </label>
          ) : (
            <label className="file-drop">
              <Upload size={21} aria-hidden="true" />
              <strong>{file ? file.name : "选择 TXT、VTT 或 SRT 文件"}</strong>
              <span>单个文件最大 5 MB</span>
              <input
                type="file"
                accept=".txt,.vtt,.srt,text/plain,text/vtt,application/x-subrip"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          )}

          <div className="future-inputs" aria-label="待配置的输入方式">
            <button type="button" disabled aria-label="上传音频，转录服务待配置">
              <AudioLines size={16} aria-hidden="true" />
              <span><strong>音频</strong><small>转录服务待配置</small></span>
            </button>
            <button type="button" disabled aria-label="上传视频，转录服务待配置">
              <Video size={16} aria-hidden="true" />
              <span><strong>视频</strong><small>转录服务待配置</small></span>
            </button>
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <footer className="dialog-footer">
            <p>
              <Sparkles size={13} aria-hidden="true" />
              创建后将自动开始 AI 摘要处理
            </p>
            <div>
              <button className="button button--quiet" type="button" onClick={onClose} disabled={pending}>
                取消
              </button>
              <button className="button button--primary" type="submit" disabled={!validInput || pending}>
                {pending ? "正在创建…" : "创建并生成摘要"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

export function MeetingMemoApp({ client = api }: MeetingMemoAppProps) {
  const stableClient = useMemo(() => client, [client]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MeetingDetail | null>(null);
  const [summary, setSummary] = useState<SummaryVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadRequest = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarCloseRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLButtonElement>(null);

  useModalFocus({
    active: sidebarOpen,
    containerRef: sidebarRef,
    initialFocusRef: sidebarCloseRef,
    onEscape: () => setSidebarOpen(false),
  });

  const loadMeeting = useCallback(
    async (meetingId: string, propagateError = false) => {
      const requestId = ++loadRequest.current;
      setDocumentLoading(true);
      setSelectedId(meetingId);
      selectedIdRef.current = meetingId;
      setError(null);
      try {
        const [meetingDetail, versions] = await Promise.all([
          stableClient.getMeeting(meetingId),
          stableClient.listSummaries(meetingId),
        ]);
        if (requestId !== loadRequest.current) return;
        const latest = [...versions.items].sort((a, b) => b.version - a.version)[0] ?? null;
        setDetail(meetingDetail);
        setSummary(latest);
        setSidebarOpen(false);
      } catch (cause) {
        if (requestId === loadRequest.current) {
          setDetail(null);
          setSummary(null);
          setError(cause instanceof Error ? cause.message : "无法读取会议内容");
        }
        if (propagateError) throw cause;
      } finally {
        if (requestId === loadRequest.current) setDocumentLoading(false);
      }
    },
    [stableClient],
  );

  const {
    jobs,
    start: setJob,
    clear: clearJobs,
    pollingErrors,
  } = useProcessingJobs({
    getJob: stableClient.getJob,
    onComplete: (completedJob) =>
      selectedIdRef.current === completedJob.meeting_id
        ? loadMeeting(completedJob.meeting_id, true)
        : undefined,
  });
  const selectedJob = selectedId ? jobs[selectedId] ?? null : null;

  useEffect(() => {
    let active = true;
    stableClient
      .listMeetings()
      .then(async (meetingList) => {
        if (!active) return;
        setMeetings(meetingList.items);
        if (meetingList.items[0]) await loadMeeting(meetingList.items[0].id);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "无法加载会议列表");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadMeeting, stableClient]);

  async function createMeeting(input: {
    title: string;
    meetingAt: string | null;
    language: string;
    transcript: string;
    file: File | null;
  }) {
    setCreating(true);
    setError(null);
    setNotice(null);
    let created: Meeting | null = null;
    try {
      created = await stableClient.createMeeting({
        title: input.title,
        meeting_at: input.meetingAt,
        timezone: "Asia/Shanghai",
        language: input.language,
      });
      if (input.file) await stableClient.uploadTranscript(created.id, input.file);
      else await stableClient.replaceTranscriptText(created.id, input.transcript);
      const nextJob = await stableClient.createSummaryJob(created.id);
      const readyMeeting = created;
      setMeetings((current) => [
        readyMeeting,
        ...current.filter((item) => item.id !== readyMeeting.id),
      ]);
      setJob(nextJob);
      setDialogOpen(false);
      await loadMeeting(readyMeeting.id);
    } catch (cause) {
      if (created) {
        try {
          await stableClient.deleteMeeting(created.id);
        } catch {
          setError("会议已创建，但后续导入失败且自动清理未完成，请避免重复提交并联系管理员。");
          return;
        }
      }
      setError(cause instanceof Error ? cause.message : "创建会议失败，请重试");
    } finally {
      setCreating(false);
    }
  }

  async function approve() {
    if (!summary) return;
    try {
      setSummary(await stableClient.approveSummary(summary.id));
      setNotice("摘要已确认，现在可以导出。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "审批失败");
    }
  }

  async function saveRevision(content: SummaryPayload) {
    if (!summary) return;
    setEditorError(null);
    try {
      const revised = await stableClient.createRevision(
        summary.id,
        summary.version,
        content,
      );
      setSummary(revised);
      setEditing(false);
      setNotice(`已保存为 v${revised.version}。`);
    } catch (cause) {
      setEditorError(
        cause instanceof Error
          ? cause.message
          : "摘要已被更新，请核对最新版本后再保存。",
      );
    }
  }

  async function retryProcessing() {
    if (!selectedJob) return;
    try {
      setError(null);
      setJob(await stableClient.retryJob(selectedJob.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法重试处理任务");
    }
  }

  async function deleteHistoricalMeeting(item: Meeting) {
    if (deletingId) return;
    const confirmed = window.confirm(
      `确定删除“${item.title}”吗？删除后无法恢复。`,
    );
    if (!confirmed) return;

    setDeletingId(item.id);
    setError(null);
    setNotice(null);
    try {
      await stableClient.deleteMeeting(item.id);
      clearJobs(item.id);
      const remaining = meetings.filter((meetingItem) => meetingItem.id !== item.id);
      setMeetings(remaining);

      if (selectedIdRef.current === item.id) {
        ++loadRequest.current;
        setSelectedId(null);
        selectedIdRef.current = null;
        setDetail(null);
        setSummary(null);
        setDocumentLoading(false);
        setEditing(false);
        setEditorError(null);
        if (remaining[0]) await loadMeeting(remaining[0].id);
        else setSidebarOpen(false);
      }
      setNotice("会议已删除。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除会议失败，请重试");
    } finally {
      setDeletingId(null);
    }
  }

  async function logout() {
    clearJobs();
    await stableClient.logout();
    window.location.reload();
  }

  if (loading) {
    return (
      <main className="workspace-loading" aria-busy="true">
        <Brand />
        <div className="access-status">
          <span className="status-dot status-dot--processing" aria-hidden="true" />
          正在整理会议桌面…
        </div>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <button
        className="mobile-menu-button"
        type="button"
        aria-label="打开会议列表"
        onClick={() => setSidebarOpen(true)}
        ref={mobileMenuRef}
      >
        <Menu size={18} aria-hidden="true" />
      </button>
      {sidebarOpen ? (
        <button className="sidebar-scrim" aria-label="关闭会议列表" onClick={() => setSidebarOpen(false)} />
      ) : null}
      <aside
        className={`meeting-sidebar${sidebarOpen ? " meeting-sidebar--open" : ""}`}
        ref={sidebarRef}
      >
        <div className="sidebar-topline">
          <Brand />
          <button className="sidebar-close" type="button" aria-label="关闭会议列表" onClick={() => setSidebarOpen(false)} ref={sidebarCloseRef}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <button className="new-meeting-button" type="button" onClick={() => setDialogOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          新建会议
        </button>

        <nav className="sidebar-nav" aria-label="会议导航">
          <button className="nav-item nav-item--active" type="button">
            <FileText size={15} aria-hidden="true" />
            全部会议
            <span>{meetings.length}</span>
          </button>
        </nav>

        <div className="meeting-list-header">
          <span>最近会议</span>
          <Search size={14} aria-hidden="true" />
        </div>
        <div className="meeting-list">
          {meetings.length ? (
            meetings.map((item) => (
              <div className="meeting-row-shell" key={item.id}>
                <button
                  className={`meeting-row${selectedId === item.id ? " meeting-row--active" : ""}`}
                  type="button"
                  aria-label={`打开会议 ${item.title}`}
                  onClick={() => loadMeeting(item.id)}
                >
                  <span className="meeting-row-title">{item.title}</span>
                  <span className="meeting-row-meta">
                    <span>{meetingDate(item.meeting_at, item.created_at)}</span>
                    <span>{item.source === "manual" ? "手动导入" : item.source}</span>
                  </span>
                </button>
                <button
                  className="meeting-delete-button"
                  type="button"
                  aria-label={`删除会议 ${item.title}`}
                  title={`删除会议 ${item.title}`}
                  disabled={deletingId !== null}
                  onClick={() => deleteHistoricalMeeting(item)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))
          ) : (
            <p className="sidebar-empty">还没有会议记录。</p>
          )}
        </div>

        <footer className="sidebar-footer">
          <div className="beta-note">
            <span className="status-dot" aria-hidden="true" />
            封闭 Beta
          </div>
          <button type="button" aria-label="集成状态">
            <Settings2 size={15} aria-hidden="true" />
          </button>
          <button type="button" aria-label="退出当前设备" onClick={logout}>
            <LogOut size={15} aria-hidden="true" />
          </button>
        </footer>
      </aside>

      <section className="workspace-content">
        {error ? (
          <div className="workspace-alert" role="alert">
            <span>{error}</span>
            <button type="button" aria-label="关闭提示" onClick={() => setError(null)}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {notice && !error ? (
          <div className="workspace-notice" role="status">
            <span>{notice}</span>
            <button type="button" aria-label="关闭状态提示" onClick={() => setNotice(null)}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {documentLoading ? (
          <div className="document-loading" aria-busy="true">
            <span className="status-dot status-dot--processing" aria-hidden="true" />
            正在打开会议记录…
          </div>
        ) : detail ? (
          <MeetingWorkspace
            meeting={detail}
            summary={summary}
            processingLabel={jobLabel(selectedJob)}
            processingError={
              selectedJob?.status === "failed"
                ? selectedJob.error?.message ?? "处理失败，请重试。"
                : pollingErrors[detail.id]
                  ? `${pollingErrors[detail.id]}，正在自动重试。`
                  : null
            }
            onEdit={() => {
              setEditorError(null);
              setEditing(true);
            }}
            onApprove={approve}
            onRetry={selectedJob?.status === "failed" ? retryProcessing : undefined}
          />
        ) : (
          <div className="workspace-empty">
            <div className="empty-notebook" aria-hidden="true">
              <span />
              <span />
              <span />
              <Sparkles size={16} />
            </div>
            <p className="eyebrow">从一次真实会议开始</p>
            <h1>把散落的讨论，整理成清楚的下一步。</h1>
            <p>粘贴转写文本，或上传 TXT、VTT、SRT 文件。MeetingMemo 会提取摘要、决策和行动项。</p>
            <button className="button button--primary" type="button" onClick={() => setDialogOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              导入一次会议
            </button>
            <div className="supported-row">
              <span><FileText size={14} aria-hidden="true" /> 文本转写</span>
              <span><CalendarDays size={14} aria-hidden="true" /> 会议时间</span>
              <span><Sparkles size={14} aria-hidden="true" /> AI 结构化</span>
            </div>
          </div>
        )}
      </section>

      <NewMeetingDialog
        open={dialogOpen}
        pending={creating}
        error={dialogOpen ? error : null}
        onClose={() => setDialogOpen(false)}
        onCreate={createMeeting}
      />
      {editing && summary && detail ? (
        <SummaryEditor
          summary={summary}
          segments={detail.segments}
          error={editorError}
          onCancel={() => {
            setEditing(false);
            setEditorError(null);
          }}
          onSave={saveRevision}
        />
      ) : null}
    </main>
  );
}
