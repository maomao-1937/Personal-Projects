import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, Play, RefreshCw } from "lucide-react";
import type { PreviewStatus, WorkspaceState } from "../_lib/types";

interface PreviewStatusBarProps {
  state: WorkspaceState;
  onRebuild: () => void;
}

export function PreviewStatusBar({ state, onRebuild }: PreviewStatusBarProps) {
  const running = state.cuts.filter((cut) => cut.status === "running").length;
  const failed = state.cuts.filter((cut) => cut.status === "failed_retryable").length;
  const queued = state.cuts.filter((cut) => cut.status === "queued").length;

  return (
    <section className="preview-status-bar" aria-label="Preview 状态">
      <div className="stat-list">
        <StatusStat icon={CheckCircle2} value={`${state.projectStats.succeeded} / ${state.projectStats.total}`} label="已完成" tone="success" />
        <StatusStat icon={LoaderCircle} value={String(running)} label="生成中" tone="running" />
        <StatusStat icon={AlertCircle} value={String(failed)} label="失败" tone="danger" />
        <StatusStat icon={Clock3} value={String(queued)} label="排队中" tone="warning" />
      </div>
      <PreviewState status={state.preview.status} />
      <div className="preview-actions">
        {state.preview.status === "stale" ? (
          <button type="button" className="primary-button" onClick={onRebuild}>
            <RefreshCw aria-hidden="true" size={17} />
            重新构建预览
          </button>
        ) : null}
        {state.preview.status === "building" ? (
          <button type="button" className="primary-button" disabled>
            <LoaderCircle aria-hidden="true" size={17} />
            正在构建
          </button>
        ) : null}
        <button type="button" className="secondary-button" disabled={state.preview.status !== "ready"}>
          <Play aria-hidden="true" size={17} />
          进入预览
        </button>
      </div>
    </section>
  );
}

function StatusStat({ icon: Icon, value, label, tone }: { icon: typeof CheckCircle2; value: string; label: string; tone: string }) {
  return <div className={`status-stat tone-${tone}`}><Icon aria-hidden="true" size={21} /><span><strong>{value}</strong><small>{label}</small></span></div>;
}

function PreviewState({ status }: { status: PreviewStatus }) {
  const labels = { ready: "预览已就绪", building: "预览构建中", stale: "预览需要更新", failed: "预览构建失败" };
  return <div className={`preview-state preview-${status}`}><AlertCircle aria-hidden="true" size={22} /><span><strong>{labels[status]}</strong><small>UI 预览数据 · {status === "stale" ? "修改后的 Cut 尚未构建" : "未连接真实服务"}</small></span></div>;
}
