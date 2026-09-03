"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDemoProject } from "../../../../_components/demo-project-provider";
import { deriveShotGenerationDraft } from "../../../../_lib/state";
import type { ShotGenerationDraft } from "../../../../_lib/types";
import { ReadonlyTimeline } from "./readonly-timeline";
import { ShotSettingsPanel } from "./shot-settings-panel";
import { TakeViewer } from "./take-viewer";
import styles from "./shot-editor.module.css";

interface ShotEditorWorkspaceProps {
  returnTo?: string;
  shotId: string;
}

const emptyDraft: ShotGenerationDraft = {
  prompt: "",
  cameraMotion: "固定镜头",
  advanced: { seed: "2468", resolution: "720p" },
  modelTierId: "balanced",
};

export function ShotEditorWorkspace({
  returnTo,
  shotId,
}: ShotEditorWorkspaceProps) {
  const {
    applyShotEdits,
    createTake,
    project,
    selectTake,
  } = useDemoProject();
  const [generationMessage, setGenerationMessage] = useState("");
  const shotIndex = project.shots.findIndex((shot) => shot.id === shotId);
  const shot = project.shots[shotIndex];
  const draftKey = shot ? `${shot.id}:${shot.activeTakeId ?? "no-take"}` : "missing-shot";
  const initialDraft = shot
    ? deriveShotGenerationDraft(project, shot)
    : emptyDraft;
  const [draftState, setDraftState] = useState<{
    key: string;
    value: ShotGenerationDraft;
  }>(() => ({
    key: draftKey,
    value: initialDraft,
  }));
  const draft = draftState.key === draftKey
    ? draftState.value
    : initialDraft;

  if (!shot) return null;

  const previousShot = project.shots[shotIndex - 1];
  const nextShot = project.shots[shotIndex + 1];
  const returnToQuery = returnTo
    ? `?returnTo=${encodeURIComponent(returnTo)}`
    : "";

  function handleCreateTake() {
    createTake(shotId, draft);
    setGenerationMessage("新版本已创建");
  }

  function handleSelectTake(takeId: string) {
    const selectedTake = shot?.takes.find((take) => take.id === takeId);
    if (selectedTake) {
      setDraftState({
        key: `${shotId}:${takeId}`,
        value: selectedTake.generationSnapshot,
      });
    }
    selectTake(shotId, takeId);
  }

  return (
    <div className={styles.editor}>
      <section aria-label="Take 预览" className={styles.stageColumn}>
        <TakeViewer
          onSelectTake={handleSelectTake}
          previewStatus={project.preview.status}
          shot={shot}
          shots={project.shots}
        />
      </section>

      <ReadonlyTimeline
        analysis={project.timelineAnalysis}
        currentShotId={shotId}
        shots={project.shots}
      />

      <aside className={styles.settingsColumn} aria-label="镜头设置">
        <header className={styles.editorHeader}>
          <Link className={styles.backLink} href={returnTo ?? "/projects/demo/storyboard"}>
            <ChevronLeft aria-hidden="true" size={16} />
            {returnTo ? "返回预览" : "返回故事板"}
          </Link>
          <div className={styles.titleRow}>
            <div>
              <span className={styles.eyebrow}>Shot editor</span>
              <h1>{`Scene ${String(shot.number).padStart(2, "0")} · ${shot.title}`}</h1>
            </div>
            <span className={styles.range}>{shot.range}</span>
          </div>
          <nav aria-label="前后镜头" className={styles.shotNav}>
            {previousShot ? (
              <Link href={`/projects/demo/storyboard/shots/${previousShot.id}${returnToQuery}`}>
                <ChevronLeft aria-hidden="true" size={15} />
                {`上一镜·Scene ${String(previousShot.number).padStart(2, "0")}`}
              </Link>
            ) : (
              <span />
            )}
            {nextShot ? (
              <Link href={`/projects/demo/storyboard/shots/${nextShot.id}${returnToQuery}`}>
                {`下一镜·Scene ${String(nextShot.number).padStart(2, "0")}`}
                <ChevronRight aria-hidden="true" size={15} />
              </Link>
            ) : null}
          </nav>
        </header>

        <div className={styles.actionBar}>
          <div>
            <span className={styles.localLabel}>草稿模式</span>
            <p>新版本将使用当前草稿创建。</p>
            {generationMessage ? (
              <p className={styles.generationStatus} role="status">
                {generationMessage}
              </p>
            ) : null}
          </div>
          <button className={styles.primaryAction} onClick={handleCreateTake} type="button">
            生成新版本
          </button>
        </div>

        <ShotSettingsPanel
          draft={draft}
          onApply={() =>
            applyShotEdits(shotId, {
              prompt: draft.prompt,
              cameraMotion: draft.cameraMotion,
              advancedSettings: draft.advanced,
              modelTierId: draft.modelTierId,
            })
          }
          onDraftChange={(value) => setDraftState({ key: draftKey, value })}
          shot={shot}
        />
      </aside>
    </div>
  );
}
