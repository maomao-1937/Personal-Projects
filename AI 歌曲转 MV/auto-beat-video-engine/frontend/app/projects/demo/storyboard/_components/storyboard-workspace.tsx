"use client";

import { Clapperboard } from "lucide-react";
import { useRef, useState } from "react";
import { useDemoProject } from "../../_components/demo-project-provider";
import type { Shot } from "../../_lib/types";
import { QuickEditSheet } from "./quick-edit-sheet";
import { StoryboardCard } from "./storyboard-card";
import { StoryboardControls } from "./storyboard-controls";
import styles from "./storyboard-workspace.module.css";

export function StoryboardWorkspace() {
  const { applyShotEdits, project, retryShot } = useDemoProject();
  const triggerRef = useRef<HTMLElement>(null);
  const [quickEditShotId, setQuickEditShotId] = useState<string | null>(null);
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [previewShotId, setPreviewShotId] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState("");
  const selectedModelTier = project.modelTiers.find(
    (tier) => tier.id === project.selectedModelTierId,
  ) ?? project.modelTiers[0];
  const quickEditShot = project.shots.find((shot) => shot.id === quickEditShotId) ?? null;
  const availableShotCount = project.shots.filter(
    (shot) => shot.artifactStatus === "available",
  ).length;
  const totalDuration = project.shots.reduce((total, shot) => total + shot.durationSec, 0);
  const durationLabel = `${String(Math.floor(totalDuration / 60)).padStart(2, "0")}:${String(totalDuration % 60).padStart(2, "0")}`;

  function openQuickEdit(shot: Shot, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setQuickEditShotId(shot.id);
    setQuickEditOpen(true);
  }

  function deactivatePreview(shotId: string) {
    setPreviewShotId((current) => (current === shotId ? null : current));
  }

  return (
    <div aria-label="故事板工作区" className={styles.workspace} role="region">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.kicker}>
            <Clapperboard aria-hidden="true" size={15} />
            Production board
          </span>
          <h1>故事板</h1>
          <p>将节奏拆成清晰镜头，先看画面，再决定哪些值得生成。</p>
        </div>
        <div aria-label={`${project.shots.length} 个镜头 · ${durationLabel}`} className={styles.shotCount}>
          <strong>{project.shots.length}</strong>
          <span>{`个镜头 · ${durationLabel}`}</span>
        </div>
      </header>

      <StoryboardControls
        generationTier={selectedModelTier}
        onGenerateAll={() => {
          if (!selectedModelTier) return;
          setGenerationMessage(
            `将处理 ${project.shots.length} 个镜头，${selectedModelTier.estimatedDuration}。`,
          );
        }}
        visualConcept={project.globalStyle}
      />
      {generationMessage ? (
        <p className={styles.generationStatus} role="status">
          {generationMessage}
        </p>
      ) : null}

      <section aria-label="镜头序列" className={styles.sequence}>
        <div className={styles.sequenceHeading}>
          <div>
            <span>镜头序列</span>
            <small>单击快速编辑 · 双击或 Enter 打开完整编辑器</small>
          </div>
          <span className={styles.readySummary}>{availableShotCount} 个画面已就绪</span>
        </div>
        <div aria-label="故事板网格" className={styles.grid} role="group">
          {project.shots.map((shot, index) => (
            <StoryboardCard
              key={shot.id}
              onActivatePreview={setPreviewShotId}
              onDeactivatePreview={deactivatePreview}
              onOpenQuickEdit={openQuickEdit}
              onRetry={retryShot}
              previewActive={previewShotId === shot.id}
              priority={index === 0}
              shot={shot}
            />
          ))}
        </div>
      </section>

      <QuickEditSheet
        onApply={applyShotEdits}
        onOpenChange={setQuickEditOpen}
        open={quickEditOpen}
        shot={quickEditShot}
        triggerRef={triggerRef}
      />
    </div>
  );
}
