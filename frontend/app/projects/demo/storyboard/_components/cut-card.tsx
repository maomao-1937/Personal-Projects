import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MoreVertical,
  Play,
  RefreshCw,
} from "lucide-react";
import type { Cut } from "../_lib/types";

const cutStatus = {
  succeeded: { label: "已完成", icon: CheckCircle2 },
  running: { label: "生成中", icon: RefreshCw },
  failed_retryable: { label: "生成失败", icon: AlertCircle },
  queued: { label: "排队中", icon: Clock3 },
} as const;

interface CutCardProps {
  cut: Cut;
  selected: boolean;
  onSelect: (cutId: string) => void;
  onRetry: (cutId: string) => void;
}

export function CutCard({ cut, selected, onSelect, onRetry }: CutCardProps) {
  const status = cutStatus[cut.status];
  const StatusIcon = status.icon;

  return (
    <article
      className={`cut-card status-${cut.status} ${selected ? "is-selected" : ""}`}
      data-testid={`cut-${cut.id}`}
    >
      <div className="cut-card-heading">
        <strong>{String(cut.number).padStart(2, "0")}</strong>
        <span>{cut.range}</span>
        <StatusIcon aria-hidden="true" size={17} />
      </div>
      <button
        type="button"
        className={`cut-preview visual-${cut.visualTone}`}
        aria-label={`选择 Cut ${String(cut.number).padStart(2, "0")}`}
        onClick={() => onSelect(cut.id)}
      >
        {cut.status === "succeeded" ? (
          <span className="preview-play"><Play aria-hidden="true" fill="currentColor" size={18} /></span>
        ) : null}
        {cut.status === "failed_retryable" ? (
          <span className="preview-failure"><AlertCircle aria-hidden="true" size={36} /><b>生成失败</b></span>
        ) : null}
        {cut.status === "queued" ? (
          <span className="preview-pending"><Clock3 aria-hidden="true" size={34} /><b>等待生成</b></span>
        ) : null}
        {cut.status === "running" ? (
          <span
            className="card-progress"
            role="progressbar"
            aria-label={`Cut ${String(cut.number).padStart(2, "0")} 生成进度`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={cut.progress}
          >
            <i style={{ width: `${cut.progress ?? 0}%` }} />
            <b>{cut.progress}%</b>
          </span>
        ) : null}
        <small>{cut.duration}</small>
      </button>
      <p>{cut.purpose}</p>
      <div className={`cut-state cut-state-${cut.status}`}>
        <StatusIcon aria-hidden="true" size={15} />
        <span>{cut.status === "running" ? `${status.label} ${cut.progress}%` : status.label}</span>
      </div>
      {cut.error ? <p className="cut-error">{cut.error}</p> : null}
      <div className="cut-actions">
        {cut.status === "failed_retryable" ? (
          <button type="button" onClick={() => onRetry(cut.id)}>
            <RefreshCw aria-hidden="true" size={16} />
            重试 Cut {String(cut.number).padStart(2, "0")}
          </button>
        ) : (
          <button type="button" disabled={cut.status !== "succeeded"}>
            <Play aria-hidden="true" size={16} />
            预览
          </button>
        )}
        <button type="button" className="more-button" aria-label={`Cut ${String(cut.number).padStart(2, "0")} 更多操作`}>
          <MoreVertical aria-hidden="true" size={17} />
        </button>
      </div>
    </article>
  );
}
