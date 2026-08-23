"use client";

import { Check, Plus, Sparkles, Trash2, X } from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";

import { useModalFocus } from "@/hooks/use-modal-focus";

import type {
  SummaryPayload,
  SummaryVersion,
  TranscriptSegment,
  Confidence,
} from "@/lib/types/api";

interface SummaryEditorProps {
  summary: SummaryVersion;
  segments?: TranscriptSegment[];
  error?: string | null;
  onCancel: () => void;
  onSave: (content: SummaryPayload) => Promise<void>;
}

function clonePayload(payload: SummaryPayload): SummaryPayload {
  return {
    ...payload,
    topics: payload.topics.map((item) => ({ ...item, source_segment_ids: [...item.source_segment_ids] })),
    decisions: payload.decisions.map((item) => ({ ...item, source_segment_ids: [...item.source_segment_ids] })),
    action_items: payload.action_items.map((item) => ({ ...item, source_segment_ids: [...item.source_segment_ids] })),
    open_questions: payload.open_questions.map((item) => ({ ...item, source_segment_ids: [...item.source_segment_ids] })),
    quality_flags: [...payload.quality_flags],
  };
}

function sourceLabel(segment: TranscriptSegment) {
  const speaker = segment.speaker ? `${segment.speaker} · ` : "";
  const excerpt = segment.text.length > 46 ? `${segment.text.slice(0, 46)}…` : segment.text;
  return `片段 ${segment.sequence + 1} · ${speaker}${excerpt}`;
}

function SourceSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: TranscriptSegment[];
  onChange: (sourceId: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      >
        <option value="" disabled>请选择真实来源片段</option>
        {options.map((segment) => (
          <option value={segment.id} key={segment.id}>
            {sourceLabel(segment)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConfidenceSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Confidence;
  onChange: (confidence: Confidence) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as Confidence)}
      >
        <option value="high">高置信</option>
        <option value="medium">需核对</option>
        <option value="low">低置信</option>
      </select>
    </label>
  );
}

export function SummaryEditor({
  summary,
  segments = [],
  error,
  onCancel,
  onSave,
}: SummaryEditorProps) {
  const [content, setContent] = useState(() => clonePayload(summary.content));
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sourceOptions = useMemo(() => {
    if (segments.length) return segments;
    const ids = [
      ...content.topics.flatMap((item) => item.source_segment_ids),
      ...content.decisions.flatMap((item) => item.source_segment_ids),
      ...content.action_items.flatMap((item) => item.source_segment_ids),
      ...content.open_questions.flatMap((item) => item.source_segment_ids),
    ];
    return [...new Set(ids)].map((id, index) => ({
      id,
      sequence: index,
      start_ms: null,
      end_ms: null,
      speaker: null,
      text: `来源片段 ${index + 1}`,
    }));
  }, [content.action_items, content.decisions, content.open_questions, content.topics, segments]);

  useModalFocus({
    active: true,
    containerRef: editorRef,
    initialFocusRef: closeButtonRef,
    onEscape: () => {
      if (!saving) onCancel();
    },
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(content);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor-backdrop">
      <section className="summary-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title" ref={editorRef}>
        <header className="editor-header">
          <div>
            <p className="eyebrow">人工修订 · v{summary.version}</p>
            <h2 id="editor-title">编辑会议摘要</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭摘要编辑" onClick={onCancel} disabled={saving} ref={closeButtonRef}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form className="editor-form" onSubmit={submit}>
          <div className="editor-scroll">
            <section className="editor-section editor-section--lead">
              <div className="editor-section-heading">
                <div>
                  <span className="section-label">关键结论</span>
                  <h3>摘要标题</h3>
                </div>
                <span className="ai-badge"><Sparkles size={12} aria-hidden="true" />AI 初稿</span>
              </div>
              <label className="sr-only" htmlFor="summary-headline">摘要标题</label>
              <textarea
                id="summary-headline"
                aria-label="摘要标题"
                value={content.headline}
                onChange={(event) => setContent((current) => ({ ...current, headline: event.target.value }))}
                rows={3}
                required
              />
            </section>

            <section className="editor-section">
              <div className="editor-section-heading">
                <h3>讨论主题</h3>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setContent((current) => ({
                      ...current,
                      topics: [
                        ...current.topics,
                        { title: "", summary: "", source_segment_ids: [] },
                      ],
                    }))
                  }
                  disabled={!sourceOptions.length}
                >
                  <Plus size={14} aria-hidden="true" />添加主题
                </button>
              </div>
              <div className="editor-stack">
                {content.topics.map((topic, index) => (
                  <div className="editor-card" key={`topic-${index}`}>
                    <div className="editor-card-topline">
                      <span>主题 {index + 1}</span>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`删除主题 ${index + 1}`}
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            topics: current.topics.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <label>
                      <span>主题 {index + 1}</span>
                      <input
                        aria-label={`主题 ${index + 1}`}
                        value={topic.title}
                        onChange={(event) =>
                          setContent((current) => ({
                            ...current,
                            topics: current.topics.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, title: event.target.value } : item,
                            ),
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      <span>主题说明 {index + 1}</span>
                      <textarea
                        aria-label={`主题说明 ${index + 1}`}
                        value={topic.summary}
                        onChange={(event) =>
                          setContent((current) => ({
                            ...current,
                            topics: current.topics.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, summary: event.target.value } : item,
                            ),
                          }))
                        }
                        rows={3}
                        required
                      />
                    </label>
                    <SourceSelect
                      label={`主题 ${index + 1} 来源`}
                      value={topic.source_segment_ids[0] ?? ""}
                      options={sourceOptions}
                      onChange={(sourceId) =>
                        setContent((current) => ({
                          ...current,
                          topics: current.topics.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, source_segment_ids: [sourceId] } : item,
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-heading">
                <h3>决策事项</h3>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setContent((current) => ({
                      ...current,
                      decisions: [
                        ...current.decisions,
                        {
                          text: "",
                          source_segment_ids: [],
                          confidence: "medium",
                        },
                      ],
                    }))
                  }
                  disabled={!sourceOptions.length}
                >
                  <Plus size={14} aria-hidden="true" />添加决策
                </button>
              </div>
              <div className="editor-stack">
                {content.decisions.map((decision, index) => (
                  <div className="editor-card" key={`decision-${index}`}>
                    <div className="editor-card-topline">
                      <span>决策 {index + 1}</span>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`删除决策 ${index + 1}`}
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            decisions: current.decisions.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <label htmlFor={`decision-${index}`}>
                      <span>内容</span>
                      <textarea
                        id={`decision-${index}`}
                        aria-label={`决策 ${index + 1}`}
                        value={decision.text}
                        onChange={(event) =>
                          setContent((current) => ({
                            ...current,
                            decisions: current.decisions.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, text: event.target.value } : item,
                            ),
                          }))
                        }
                        rows={2}
                        required
                      />
                    </label>
                    <div className="editor-field-grid">
                      <SourceSelect
                        label={`决策 ${index + 1} 来源`}
                        value={decision.source_segment_ids[0] ?? ""}
                        options={sourceOptions}
                        onChange={(sourceId) =>
                          setContent((current) => ({
                            ...current,
                            decisions: current.decisions.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, source_segment_ids: [sourceId] } : item,
                            ),
                          }))
                        }
                      />
                      <ConfidenceSelect
                        label={`决策 ${index + 1} 置信度`}
                        value={decision.confidence}
                        onChange={(confidence) =>
                          setContent((current) => ({
                            ...current,
                            decisions: current.decisions.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, confidence } : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-heading">
                <h3>行动项</h3>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setContent((current) => ({
                      ...current,
                      action_items: [
                        ...current.action_items,
                        {
                          task: "",
                          owner: null,
                          due_date: null,
                          source_segment_ids: [],
                          confidence: "medium",
                        },
                      ],
                    }))
                  }
                  disabled={!sourceOptions.length}
                >
                  <Plus size={14} aria-hidden="true" />添加行动项
                </button>
              </div>
              <div className="editor-stack">
                {content.action_items.map((item, index) => (
                  <div className="editor-card" key={`action-${index}`}>
                    <div className="editor-card-topline">
                      <span>行动项 {index + 1}</span>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`删除行动项 ${index + 1}`}
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            action_items: current.action_items.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <label>
                      <span>任务</span>
                      <textarea
                        aria-label={`行动项 ${index + 1}`}
                        value={item.task}
                        onChange={(event) =>
                          setContent((current) => ({
                            ...current,
                            action_items: current.action_items.map((currentItem, itemIndex) =>
                              itemIndex === index ? { ...currentItem, task: event.target.value } : currentItem,
                            ),
                          }))
                        }
                        rows={2}
                        required
                      />
                    </label>
                    <div className="editor-field-grid">
                      <label>
                        <span>负责人</span>
                        <input
                          value={item.owner ?? ""}
                          onChange={(event) =>
                            setContent((current) => ({
                              ...current,
                              action_items: current.action_items.map((currentItem, itemIndex) =>
                                itemIndex === index
                                  ? { ...currentItem, owner: event.target.value || null }
                                  : currentItem,
                              ),
                            }))
                          }
                          placeholder="待分配"
                        />
                      </label>
                      <label>
                        <span>截止时间</span>
                        <input
                          type="date"
                          value={item.due_date ?? ""}
                          onChange={(event) =>
                            setContent((current) => ({
                              ...current,
                              action_items: current.action_items.map((currentItem, itemIndex) =>
                                itemIndex === index
                                  ? { ...currentItem, due_date: event.target.value || null }
                                  : currentItem,
                              ),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="editor-field-grid">
                      <SourceSelect
                        label={`行动项 ${index + 1} 来源`}
                        value={item.source_segment_ids[0] ?? ""}
                        options={sourceOptions}
                        onChange={(sourceId) =>
                          setContent((current) => ({
                            ...current,
                            action_items: current.action_items.map((currentItem, itemIndex) =>
                              itemIndex === index
                                ? { ...currentItem, source_segment_ids: [sourceId] }
                                : currentItem,
                            ),
                          }))
                        }
                      />
                      <ConfidenceSelect
                        label={`行动项 ${index + 1} 置信度`}
                        value={item.confidence}
                        onChange={(confidence) =>
                          setContent((current) => ({
                            ...current,
                            action_items: current.action_items.map((currentItem, itemIndex) =>
                              itemIndex === index ? { ...currentItem, confidence } : currentItem,
                            ),
                          }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-heading">
                <h3>待确认问题</h3>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setContent((current) => ({
                      ...current,
                      open_questions: [
                        ...current.open_questions,
                        { text: "", source_segment_ids: [] },
                      ],
                    }))
                  }
                  disabled={!sourceOptions.length}
                >
                  <Plus size={14} aria-hidden="true" />添加待确认问题
                </button>
              </div>
              <div className="editor-stack">
                {content.open_questions.map((question, index) => (
                  <div className="editor-card" key={`question-${index}`}>
                    <div className="editor-card-topline">
                      <span>待确认问题 {index + 1}</span>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`删除待确认问题 ${index + 1}`}
                        onClick={() =>
                          setContent((current) => ({
                            ...current,
                            open_questions: current.open_questions.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          }))
                        }
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                    <label>
                      <span>问题</span>
                      <textarea
                        aria-label={`待确认问题 ${index + 1}`}
                        value={question.text}
                        onChange={(event) =>
                          setContent((current) => ({
                            ...current,
                            open_questions: current.open_questions.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, text: event.target.value } : item,
                            ),
                          }))
                        }
                        rows={2}
                        required
                      />
                    </label>
                    <SourceSelect
                      label={`待确认问题 ${index + 1} 来源`}
                      value={question.source_segment_ids[0] ?? ""}
                      options={sourceOptions}
                      onChange={(sourceId) =>
                        setContent((current) => ({
                          ...current,
                          open_questions: current.open_questions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, source_segment_ids: [sourceId] } : item,
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            {error ? <p className="editor-error" role="alert">{error}</p> : null}
          </div>

          <footer className="editor-footer">
            <p>保存后会创建 v{summary.version + 1}，不会覆盖当前版本。</p>
            <div>
              <button className="button button--quiet" type="button" onClick={onCancel} disabled={saving}>取消</button>
              <button className="button button--primary" type="submit" disabled={saving}>
                <Check size={15} aria-hidden="true" />
                {saving ? "正在保存…" : "保存为新版本"}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
