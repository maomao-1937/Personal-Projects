import { AlertTriangle, Clock3, RefreshCw, Save } from "lucide-react";
import type { Cut } from "../_lib/types";

interface CutInspectorProps {
  cut: Cut | undefined;
  draftPrompt: string;
  savedMessage: string;
  open: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onRetry: (cutId: string) => void;
}

export function CutInspector({
  cut,
  draftPrompt,
  savedMessage,
  open,
  onDraftChange,
  onSave,
  onRetry,
}: CutInspectorProps) {
  if (!cut) {
    return (
      <aside className={`cut-inspector ${open ? "is-panel-open" : ""}`} aria-label="Cut 编辑" id="inspector-panel">
        <h2>未选择 Cut</h2>
        <p>当前场景没有可编辑的界面预览数据。</p>
      </aside>
    );
  }

  const failed = cut.status === "failed_retryable";

  return (
    <aside className={`cut-inspector ${open ? "is-panel-open" : ""}`} aria-label="Cut 编辑" id="inspector-panel">
      <div className="inspector-heading">
        <h2>Cut {String(cut.number).padStart(2, "0")}</h2>
        <span className={failed ? "inspector-failed" : "inspector-status"}>
          {failed ? <AlertTriangle aria-hidden="true" size={16} /> : <Clock3 aria-hidden="true" size={16} />}
          {failed ? "生成失败" : cutStatusText(cut)}
        </span>
      </div>

      <label className="field-label">
        <span>镜头目的</span>
        <input readOnly value={cut.purpose} />
      </label>
      <label className="field-label">
        <span>视频提示词</span>
        <textarea value={draftPrompt} onChange={(event) => onDraftChange(event.target.value)} rows={5} />
      </label>
      <div className="field-grid">
        <label className="field-label">
          <span>景别</span>
          <input readOnly value={cut.shotSize} />
        </label>
        <label className="field-label">
          <span>镜头运动</span>
          <input readOnly value={cut.cameraMotion} />
        </label>
      </div>
      <label className="field-label">
        <span>时间范围 · 由 Beat 决定</span>
        <input readOnly value={`${cut.range} · ${cut.duration}`} />
      </label>

      {failed && cut.error ? (
        <div className="inspector-error">
          <AlertTriangle aria-hidden="true" size={18} />
          <span>{cut.error}</span>
        </div>
      ) : null}

      <p className="local-data-note">此处仅修改 UI 预览数据，不会调用模型或服务端。</p>
      {savedMessage ? <p className="save-feedback" role="status">{savedMessage}</p> : null}
      <div className="inspector-actions">
        <button type="button" className="secondary-button" onClick={onSave}>
          <Save aria-hidden="true" size={17} />
          保存修改
        </button>
        {failed ? (
          <button type="button" className="primary-button" aria-label={`在编辑器中重试 Cut ${String(cut.number).padStart(2, "0")}`} onClick={() => onRetry(cut.id)}>
            <RefreshCw aria-hidden="true" size={17} />
            重新生成
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function cutStatusText(cut: Cut) {
  if (cut.status === "succeeded") return "已完成";
  if (cut.status === "running") return `生成中 ${cut.progress}%`;
  return "排队中";
}
