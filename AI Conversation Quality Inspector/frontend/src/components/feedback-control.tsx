"use client";

import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";

import type { FeedbackReason } from "@/lib/api";


export type FeedbackPayload = {
  helpful: boolean;
  reason_code: FeedbackReason | null;
};


const reasons: Array<[FeedbackReason, string]> = [
  ["evidence_wrong", "证据对应错误"],
  ["score_unfair", "评分不公平"],
  ["reply_unusable", "建议回复不可用"],
  ["context_missing", "遗漏了上下文"],
  ["other", "其他原因"],
];


export function FeedbackControl({
  onFeedback,
}: {
  onFeedback: (payload: FeedbackPayload) => Promise<void>;
}) {
  const [mode, setMode] = useState<"helpful" | "unhelpful" | null>(null);
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(payload: FeedbackPayload) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onFeedback(payload);
      setSaved(true);
    } catch {
      setSaved(false);
      setError("反馈暂时没有保存，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feedback-control" aria-labelledby="feedback-title">
      <div>
        <p className="panel-index">YOUR REVIEW</p>
        <h3 id="feedback-title">这份报告对复盘有帮助吗？</h3>
        <p>只记录选择和分析 ID，不保存聊天内容。</p>
      </div>
      <div className="feedback-actions">
        <button
          aria-pressed={mode === "helpful"}
          className={mode === "helpful" ? "is-selected" : ""}
          disabled={busy}
          onClick={() => {
            setMode("helpful");
            setReason(null);
            void submit({ helpful: true, reason_code: null });
          }}
          type="button"
        >
          <ThumbsUp aria-hidden="true" size={14} />
          有用
        </button>
        <button
          aria-pressed={mode === "unhelpful"}
          className={mode === "unhelpful" ? "is-selected" : ""}
          disabled={busy}
          onClick={() => {
            setMode("unhelpful");
            setSaved(false);
          }}
          type="button"
        >
          <ThumbsDown aria-hidden="true" size={14} />
          需改进
        </button>
      </div>

      {mode === "unhelpful" && (
        <div className="feedback-reasons">
          <fieldset>
            <legend>主要原因</legend>
            {reasons.map(([value, label]) => (
              <label key={value}>
                <input
                  checked={reason === value}
                  name="feedback-reason"
                  onChange={() => setReason(value)}
                  type="radio"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <button
            className="feedback-submit"
            disabled={busy || !reason}
            onClick={() =>
              void submit({ helpful: false, reason_code: reason })
            }
            type="button"
          >
            提交反馈
          </button>
        </div>
      )}

      {saved && (
        <p className="feedback-saved" aria-live="polite">
          <Check aria-hidden="true" size={13} />
          反馈已记录
        </p>
      )}
      {error && (
        <p className="feedback-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
