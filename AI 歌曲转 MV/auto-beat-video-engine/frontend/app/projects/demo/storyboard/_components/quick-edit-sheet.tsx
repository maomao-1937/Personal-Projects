import { useState } from "react";
import type { RefObject } from "react";
import { ArrowUpRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { WorkspaceSheet } from "../../_components/workspace-sheet";
import type { ShotEdits } from "../../_lib/state";
import type { Shot } from "../../_lib/types";
import styles from "./storyboard-workspace.module.css";

interface QuickEditSheetProps {
  open: boolean;
  shot: Shot | null;
  triggerRef: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onApply: (shotId: string, edits: ShotEdits) => void;
}

const motionOptions = [
  "固定镜头",
  "缓慢推进",
  "横向跟随",
  "低机位跟随",
  "缓慢横移",
  "后方跟随",
  "缓慢拉远",
  "缓慢上升",
  "手持漂移",
];

function QuickEditContent({
  onApply,
  onOpenChange,
  shot,
}: {
  onApply: (shotId: string, edits: ShotEdits) => void;
  onOpenChange: (open: boolean) => void;
  shot: Shot;
}) {
  const [cameraMotion, setCameraMotion] = useState(shot.cameraMotion);
  const [prompt, setPrompt] = useState(shot.prompt);
  const [applyMessage, setApplyMessage] = useState("");
  const number = String(shot.number).padStart(2, "0");
  const availableMotionOptions = Array.from(
    new Set([shot.cameraMotion, ...motionOptions]),
  );

  return (
    <div className={styles.quickEdit}>
      <div className={styles.sheetShot}>
        <picture>
          <source
            sizes="104px"
            srcSet={`${shot.poster.width400} 400w, ${shot.poster.width800} 800w`}
          />
          <img alt="" height={225} sizes="104px" src={shot.poster.width400} width={400} />
        </picture>
        <div>
          <span>镜头 {number}</span>
          <strong>{shot.title}</strong>
          <small>
            <Clock3 aria-hidden="true" size={12} />
            {shot.range} · {shot.durationSec}s
          </small>
        </div>
      </div>

      <label className={styles.field}>
        <span>画面描述</span>
        <textarea
          onChange={(event) => {
            setApplyMessage("");
            setPrompt(event.target.value);
          }}
          rows={6}
          value={prompt}
        />
      </label>

      <label className={styles.field}>
        <span>镜头运动</span>
        <select
          onChange={(event) => {
            setApplyMessage("");
            setCameraMotion(event.target.value);
          }}
          value={cameraMotion}
        >
          {availableMotionOptions.map((motion) => (
            <option key={motion}>{motion}</option>
          ))}
        </select>
      </label>

      <div className={styles.sheetNote}>
        应用后会写入共享的本地项目，并将 Preview 标记为 Stale。
      </div>
      {applyMessage ? <p className={styles.applyMessage}>{applyMessage}</p> : null}
      <button
        className={styles.applyButton}
        onClick={() => {
          onApply(shot.id, { prompt, cameraMotion });
          setApplyMessage("已应用到本地项目");
        }}
        type="button"
      >
        应用到本地项目
      </button>
      <Link
        className={styles.editorButton}
        href={`/projects/demo/storyboard/shots/${shot.id}`}
        onClick={() => onOpenChange(false)}
      >
        打开镜头编辑器
        <ArrowUpRight aria-hidden="true" size={16} />
      </Link>
    </div>
  );
}

export function QuickEditSheet({
  onApply,
  onOpenChange,
  open,
  shot,
  triggerRef,
}: QuickEditSheetProps) {
  if (!shot) return null;

  const number = String(shot.number).padStart(2, "0");

  return (
    <WorkspaceSheet
      onOpenChange={onOpenChange}
      open={open}
      side="right"
      title={`快速编辑 · 镜头 ${number}`}
      triggerRef={triggerRef}
    >
      <QuickEditContent
        key={shot.id}
        onApply={onApply}
        onOpenChange={onOpenChange}
        shot={shot}
      />
    </WorkspaceSheet>
  );
}
