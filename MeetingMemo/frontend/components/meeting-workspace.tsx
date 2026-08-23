"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  PencilLine,
  PanelRightOpen,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useModalFocus } from "@/hooks/use-modal-focus";

import type {
  MeetingDetail,
  SummaryVersion,
  TranscriptSegment,
} from "@/lib/types/api";

interface MeetingWorkspaceProps {
  meeting: MeetingDetail;
  summary: SummaryVersion | null;
  processingLabel?: string | null;
  processingError?: string | null;
  onEdit?: () => void;
  onApprove?: () => void;
  onRetry?: () => void;
}

function formatMeetingDate(value: string | null) {
  if (!value) return "未记录会议时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatDueDate(value: string | null) {
  if (!value) return "未提及";
  const [, month, day] = value.split("-").map(Number);
  return `${month} 月 ${day} 日`;
}

function formatTimestamp(value: number | null) {
  if (value === null) return null;
  const seconds = Math.floor(value / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function AiBadge() {
  return (
    <span className="ai-badge">
      <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" />
      AI 生成
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const labels: Record<string, string> = {
    high: "高置信",
    medium: "需核对",
    low: "低置信",
  };
  return (
    <span className={`confidence confidence--${confidence}`}>
      {labels[confidence] ?? confidence}
    </span>
  );
}

function SourceButton({
  segmentId,
  segments,
  onSelect,
}: {
  segmentId: string | undefined;
  segments: TranscriptSegment[];
  onSelect: (segmentId: string) => void;
}) {
  if (!segmentId) return null;
  const segment = segments.find((item) => item.id === segmentId);
  const label = formatTimestamp(segment?.start_ms ?? null) ?? `片段 ${(segment?.sequence ?? 0) + 1}`;
  return (
    <button
      className="source-link"
      type="button"
      onClick={() => onSelect(segmentId)}
      aria-label={`查看来源 ${label}`}
    >
      <Clock3 size={12} aria-hidden="true" />
      {label}
    </button>
  );
}

function SectionEmpty({ children }: { children: string }) {
  return <p className="section-empty">{children}</p>;
}

export function MeetingWorkspace({
  meeting,
  summary,
  processingLabel,
  processingError,
  onEdit,
  onApprove,
  onRetry,
}: MeetingWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "transcript">("summary");
  const [highlightedSource, setHighlightedSource] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const insightPaneRef = useRef<HTMLElement>(null);
  const insightCloseRef = useRef<HTMLButtonElement>(null);
  const insightTriggerRef = useRef<HTMLButtonElement>(null);
  const content = summary?.content;
  useEffect(() => {
    if (activeTab !== "transcript" || !highlightedSource) return;
    const target = document.getElementById(`segment-${highlightedSource}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
  }, [activeTab, highlightedSource]);

  useModalFocus({
    active: insightsOpen,
    containerRef: insightPaneRef,
    initialFocusRef: insightCloseRef,
    onEscape: () => setInsightsOpen(false),
  });

  function showSource(segmentId: string) {
    setInsightsOpen(false);
    setHighlightedSource(segmentId);
    setActiveTab("transcript");
  }

  return (
    <div className="meeting-stage">
      <section className="document-pane">
        <header className="document-header">
          <div className="document-heading">
            <div className="document-kicker">
              <span>{formatMeetingDate(meeting.meeting_at)}</span>
              <span aria-hidden="true">·</span>
              <span>{meeting.language === "zh-CN" ? "中文" : meeting.language}</span>
              {processingLabel ? (
                <span className="inline-status">
                  <span
                    className={`status-dot ${processingError ? "status-dot--error" : "status-dot--processing"}`}
                    aria-hidden="true"
                  />
                  {processingLabel}
                </span>
              ) : null}
            </div>
            <h1>{meeting.title}</h1>
          </div>
          <div className="document-actions">
            <button
              className="button button--quiet insight-toggle"
              type="button"
              aria-label="打开会议洞察"
              aria-expanded={insightsOpen}
              onClick={() => setInsightsOpen(true)}
              ref={insightTriggerRef}
            >
              <PanelRightOpen size={15} aria-hidden="true" />
              <span className="mobile-hide-label">洞察</span>
            </button>
            <button
              className="button button--quiet"
              type="button"
              aria-label="编辑摘要"
              onClick={onEdit}
              disabled={!summary}
            >
              <PencilLine size={15} aria-hidden="true" />
              <span className="mobile-hide-label">编辑摘要</span>
            </button>
            <details className="export-menu">
              <summary
                className="button button--quiet"
                aria-label="导出会议摘要"
                aria-disabled={!summary}
                onClick={(event) => {
                  if (!summary) event.preventDefault();
                }}
              >
                <Download size={15} aria-hidden="true" />
                <span className="mobile-hide-label">导出</span>
                <ChevronDown className="export-chevron" size={14} aria-hidden="true" />
              </summary>
              <div className="export-popover" role="menu">
                {(["markdown", "text", "json"] as const).map((format) => (
                  <a
                    key={format}
                    role="menuitem"
                    href={summary ? `/api/v1/summaries/${summary.id}/export?format=${format}` : undefined}
                    aria-disabled={!summary}
                    onClick={(event) => {
                      if (!summary) event.preventDefault();
                    }}
                  >
                    {format === "markdown" ? "Markdown" : format === "text" ? "纯文本" : "JSON"}
                  </a>
                ))}
              </div>
            </details>
          </div>
        </header>

        <div className="document-tabs" role="tablist" aria-label="会议内容">
          <button
            type="button"
            role="tab"
            aria-label="摘要"
            aria-selected={activeTab === "summary"}
            onClick={() => setActiveTab("summary")}
          >
            摘要
          </button>
          <button
            type="button"
            role="tab"
            aria-label="转写"
            aria-selected={activeTab === "transcript"}
            onClick={() => setActiveTab("transcript")}
          >
            转写
            <span>{meeting.segments.length}</span>
          </button>
        </div>

        <div className="document-scroll">
          {processingError ? (
            <div className="processing-error" role="alert">
              <span>{processingError}</span>
              {onRetry ? <button type="button" onClick={onRetry}>重试处理</button> : null}
            </div>
          ) : null}
          {activeTab === "summary" ? (
            <article className="summary-document" aria-label="会议摘要">
              {content ? (
                <>
                  <section className="summary-lead">
                    <div className="section-label-row">
                      <span className="section-label">会议摘要</span>
                      <AiBadge />
                    </div>
                    <p>{content.headline}</p>
                  </section>

                  <section className="summary-section">
                    <div className="summary-section-title">
                      <span>讨论脉络</span>
                      <span>{content.topics.length}</span>
                    </div>
                    {content.topics.length ? (
                      content.topics.map((topic, index) => (
                        <div className="topic-block" key={`${topic.title}-${index}`}>
                          <div className="topic-heading">
                            <h2>{topic.title}</h2>
                            <SourceButton
                              segmentId={topic.source_segment_ids[0]}
                              segments={meeting.segments}
                              onSelect={showSource}
                            />
                          </div>
                          <p>{topic.summary}</p>
                        </div>
                      ))
                    ) : (
                      <SectionEmpty>没有提取到独立讨论主题。</SectionEmpty>
                    )}
                  </section>

                  {content.open_questions.length ? (
                    <section className="summary-section">
                      <div className="summary-section-title">
                        <span>待确认问题</span>
                        <span>{content.open_questions.length}</span>
                      </div>
                      <ul className="question-list">
                        {content.open_questions.map((question, index) => (
                          <li key={`${question.text}-${index}`}>
                            <CircleHelp size={16} aria-hidden="true" />
                            <span>{question.text}</span>
                            <SourceButton
                              segmentId={question.source_segment_ids[0]}
                              segments={meeting.segments}
                              onSelect={showSource}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : (
                <div className="document-empty">
                  <Sparkles size={20} aria-hidden="true" />
                  <h2>还没有会议摘要</h2>
                  <p>导入转写并开始 AI 处理后，摘要会出现在这里。</p>
                </div>
              )}
            </article>
          ) : (
            <article className="transcript-document" aria-label="会议转写">
              <div className="transcript-intro">
                <span>完整转写</span>
                <span>{meeting.segments.length} 个片段</span>
              </div>
              {meeting.segments.length ? (
                meeting.segments.map((segment) => (
                  <section
                    className={`transcript-row${highlightedSource === segment.id ? " transcript-row--active" : ""}`}
                    id={`segment-${segment.id}`}
                    key={segment.id}
                    tabIndex={highlightedSource === segment.id ? -1 : undefined}
                  >
                    <div className="transcript-meta">
                      <strong>{segment.speaker ?? "未识别发言人"}</strong>
                      <span>{formatTimestamp(segment.start_ms) ?? `片段 ${segment.sequence + 1}`}</span>
                    </div>
                    <p>{segment.text}</p>
                  </section>
                ))
              ) : (
                <div className="document-empty">
                  <h2>暂无转写</h2>
                  <p>请先粘贴转写文本或上传 TXT、VTT、SRT 文件。</p>
                </div>
              )}
            </article>
          )}
        </div>
      </section>

      {insightsOpen ? (
        <button
          className="insight-scrim"
          type="button"
          aria-label="关闭会议洞察"
          onClick={() => setInsightsOpen(false)}
        />
      ) : null}
      <aside
        className={`insight-pane${insightsOpen ? " insight-pane--open" : ""}`}
        aria-label="会议洞察"
        ref={insightPaneRef}
      >
        <div className="insight-drawer-header">
          <strong>会议洞察</strong>
          <button type="button" aria-label="关闭会议洞察" onClick={() => setInsightsOpen(false)} ref={insightCloseRef}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="insight-scroll">
          <section className="insight-section insight-section--lead">
            <div className="insight-heading">
              <div>
                <span className="section-label">关键结论</span>
                <h2>这场会议意味着什么</h2>
              </div>
              <AiBadge />
            </div>
            <p className="key-takeaway">
              {content?.headline ?? "摘要完成后，关键结论会显示在这里。"}
            </p>
          </section>

          <section className="insight-section">
            <div className="insight-heading">
              <h2>决策事项</h2>
              <span className="count-badge">{content?.decisions.length ?? 0}</span>
            </div>
            {content?.decisions.length ? (
              <div className="insight-list">
                {content.decisions.map((decision, index) => (
                  <article className="insight-card" key={`${decision.text}-${index}`}>
                    <div className="insight-icon">
                      <Check size={14} aria-hidden="true" />
                    </div>
                    <p>{decision.text}</p>
                    <div className="insight-meta">
                      <ConfidenceBadge confidence={decision.confidence} />
                      <SourceButton
                        segmentId={decision.source_segment_ids[0]}
                        segments={meeting.segments}
                        onSelect={showSource}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <SectionEmpty>没有识别到明确决策。</SectionEmpty>
            )}
          </section>

          <section className="insight-section">
            <div className="insight-heading">
              <h2>行动项</h2>
              <span className="count-badge">{content?.action_items.length ?? 0}</span>
            </div>
            {content?.action_items.length ? (
              <div className="insight-list">
                {content.action_items.map((item, index) => (
                  <article className="action-card" key={`${item.task}-${index}`}>
                    <div className="action-check" aria-hidden="true" />
                    <div className="action-body">
                      <p>{item.task}</p>
                      <div className="action-details">
                        <span>
                          <UserRound size={13} aria-hidden="true" />
                          {item.owner ?? "待分配"}
                        </span>
                        <span>
                          <CalendarDays size={13} aria-hidden="true" />
                          {formatDueDate(item.due_date)}
                        </span>
                      </div>
                      <div className="insight-meta">
                        <ConfidenceBadge confidence={item.confidence} />
                        <SourceButton
                          segmentId={item.source_segment_ids[0]}
                          segments={meeting.segments}
                          onSelect={showSource}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <SectionEmpty>没有识别到明确行动项。</SectionEmpty>
            )}
          </section>

          {content?.quality_flags.length ? (
            <section className="quality-note">
              <span>需要人工核对</span>
              <p>{content.quality_flags.join(" · ")}</p>
            </section>
          ) : null}

          {summary ? (
            <section className="review-actions">
              <button className="button button--primary button--full" type="button" onClick={onApprove}>
                <Check size={15} aria-hidden="true" />
                {summary.status === "approved" ? "已审批此版本" : "确认摘要"}
              </button>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
