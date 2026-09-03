"use client";

import { Download, Pause, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useDemoProject } from "../../_components/demo-project-provider";
import { derivePreviewReadiness } from "../../_lib/state";
import type { PreviewStatus, Shot } from "../../_lib/types";
import { ExportSheet, type ExportConfig } from "./export-sheet";
import {
  buildPreviewRepairHref,
  getNextAvailableShot,
  getShotStartTime,
  isPreviewShotMissing,
} from "./preview-fixture";
import { PreviewTimeline } from "./preview-timeline";
import styles from "./preview-workspace.module.css";

interface PreviewWorkspaceProps {
  initialTime?: number;
}

function getTimelineShot(shots: Shot[], time: number) {
  const totalDuration = shots.reduce((sum, shot) => sum + shot.durationSec, 0);
  const clampedTime = Math.min(Math.max(time, 0), Math.max(totalDuration - 0.001, 0));
  let elapsed = 0;

  for (const shot of shots) {
    const end = elapsed + shot.durationSec;
    if (clampedTime < end) return { shot, startTime: elapsed, time: clampedTime };
    elapsed = end;
  }

  return { shot: shots[0], startTime: 0, time: 0 };
}

function formatReturnTime(time: number) {
  return Number(time.toFixed(2)).toString();
}

const previewMessages: Record<PreviewStatus, string> = {
  building: "正在构建预览",
  failed: "预览构建失败",
  ready: "预览已就绪",
  stale: "预览需要更新",
};

export function PreviewWorkspace({ initialTime = 0 }: PreviewWorkspaceProps) {
  const { project } = useDemoProject();
  const initialSelection = getTimelineShot(project.shots, initialTime);
  const [currentTime, setCurrentTime] = useState(initialSelection.time);
  const [activeShotId, setActiveShotId] = useState(initialSelection.shot?.id ?? "");
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: "mp4",
    resolution: "1080p",
    captions: true,
    platform: "bilibili",
  });
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeShot = project.shots.find((shot) => shot.id === activeShotId) ?? project.shots[0];
  const activeShotStart = activeShot
    ? getShotStartTime(project.shots, activeShot.id)
    : 0;
  const activeShotMissing = activeShot ? isPreviewShotMissing(activeShot) : false;
  const activeShotProcessing = activeShot?.artifactStatus === "processing";
  const activeShotRepairable = activeShot
    ? activeShot.artifactStatus === "missing" || activeShot.artifactStatus === "failed"
    : false;
  const returnTo = `/projects/demo/preview?t=${formatReturnTime(currentTime)}`;
  const previewReadiness = derivePreviewReadiness(
    project.preview.status,
    project.shots,
  );
  const statusMessage = previewMessages[previewReadiness];

  useEffect(() => {
    if (!isPlaying) return;
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => setIsPlaying(false));
  }, [activeShotId, isPlaying]);

  function togglePlayback() {
    const nextPlaying = !isPlaying;

    if (nextPlaying && activeShot && activeShotMissing) {
      const nextShot = getNextAvailableShot(project.shots, activeShot.id);
      if (!nextShot) return;
      setActiveShotId(nextShot.id);
      setCurrentTime(getShotStartTime(project.shots, nextShot.id));
      setIsPlaying(true);
      return;
    }

    setIsPlaying(nextPlaying);
    if (!nextPlaying) videoRef.current?.pause();
  }

  function handleStageKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || event.key !== " ") return;
    event.preventDefault();
    togglePlayback();
  }

  function selectShot(shotId: string, startTime: number) {
    setActiveShotId(shotId);
    setCurrentTime(startTime);
    setIsPlaying(false);
  }

  function handleTimeUpdate(video: HTMLVideoElement) {
    if (!activeShot || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const progress = Math.min(Math.max(video.currentTime / video.duration, 0), 1);
    setCurrentTime(activeShotStart + progress * activeShot.durationSec);
  }

  function handleEnded() {
    if (!activeShot) return;
    const nextShot = getNextAvailableShot(project.shots, activeShot.id);

    if (!nextShot) {
      setCurrentTime(
        project.shots.reduce((total, shot) => total + shot.durationSec, 0),
      );
      setIsPlaying(false);
      return;
    }

    setActiveShotId(nextShot.id);
    setCurrentTime(getShotStartTime(project.shots, nextShot.id));
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Storyboard › Preview</span>
          <h1>预览</h1>
          <p>检查完整节奏、缺失片段与平台输出配置。</p>
        </div>
        <div className={styles.outputControls} aria-label="输出规格">
          <span><small>画幅</small><strong>16:9</strong></span>
          <span><small>分辨率</small><strong>1920 × 1080</strong></span>
          <button
            className={styles.exportButton}
            onClick={() => setExportOpen(true)}
            ref={exportTriggerRef}
            type="button"
          >
            <Download aria-hidden="true" size={16} />
            导出
          </button>
        </div>
      </header>

      <section className={styles.previewArea}>
        <div className={styles.stageFrame}>
          <div className={styles.stageMeta}>
            <div>
              <span className={styles.liveDot} aria-hidden="true" />
              <strong>{activeShot ? `Scene ${String(activeShot.number).padStart(2, "0")}` : "Preview"}</strong>
              <span>{activeShot?.title}</span>
            </div>
            <span className={statusMessage === "预览已就绪" ? styles.readyStatus : styles.staleStatus}>
              {statusMessage === "预览需要更新" ? <RefreshCw aria-hidden="true" size={13} /> : null}
              {statusMessage}
            </span>
          </div>

          <div
            aria-label="整片预览 Stage"
            className={styles.stage}
            data-aspect="16:9"
            data-playback={isPlaying ? "playing" : "paused"}
            onKeyDown={handleStageKeyDown}
            tabIndex={0}
          >
            {activeShot && !activeShotMissing ? (
              <video
                key={activeShot.id}
                muted
                onEnded={handleEnded}
                onLoadedMetadata={(event) => {
                  if (!Number.isFinite(event.currentTarget.duration)) return;
                  const offset = Math.max(currentTime - activeShotStart, 0);
                  event.currentTarget.currentTime =
                    (offset / activeShot.durationSec) * event.currentTarget.duration;
                }}
                onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget)}
                playsInline
                poster={activeShot.poster.width1200}
                preload="metadata"
                ref={videoRef}
                src={activeShot.previewVideo}
              />
            ) : activeShot ? (
              <div
                aria-label={activeShotProcessing
                  ? `Scene ${String(activeShot.number).padStart(2, "0")} Artifact 处理中`
                  : `Scene ${String(activeShot.number).padStart(2, "0")} 缺失片段`}
                className={styles.missingStage}
              >
                <RefreshCw aria-hidden="true" size={22} />
                <strong>
                  {activeShotProcessing
                    ? `Scene ${String(activeShot.number).padStart(2, "0")} Artifact 处理中`
                    : `Scene ${String(activeShot.number).padStart(2, "0")} 缺少可播放片段`}
                </strong>
                <span>
                  {activeShotProcessing
                    ? "生成完成后即可继续检查整片节奏。"
                    : "修复镜头后再继续检查整片节奏。"}
                </span>
                {activeShotRepairable ? (
                  <Link href={buildPreviewRepairHref(activeShot.id, returnTo)}>
                    {`修复 Scene ${String(activeShot.number).padStart(2, "0")}`}
                  </Link>
                ) : null}
              </div>
            ) : null}
            {!activeShotMissing ? (
              <>
                <button
                  aria-label={isPlaying ? "暂停整片预览" : "播放整片预览"}
                  className={styles.playButton}
                  onClick={togglePlayback}
                  type="button"
                >
                  {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
                <span className={styles.stageHint}>Space 播放 / 暂停</span>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <PreviewTimeline
        analysis={project.timelineAnalysis}
        currentTime={currentTime}
        onSelectShot={selectShot}
        returnTo={returnTo}
        shots={project.shots}
      />

      {exportMessage ? <p className={styles.exportMessage} role="status">{exportMessage}</p> : null}
      <ExportSheet
        config={exportConfig}
        onConfigChange={setExportConfig}
        onConfirm={() => setExportMessage("本地导出配置已更新")}
        onOpenChange={setExportOpen}
        open={exportOpen}
        triggerRef={exportTriggerRef}
      />
    </div>
  );
}
