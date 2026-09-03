import { Pause, Play } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import type { PreviewStatus, Shot } from "../../../../_lib/types";
import { derivePreviewReadiness } from "../../../../_lib/state";
import styles from "./shot-editor.module.css";

interface TakeViewerProps {
  onSelectTake: (takeId: string) => void;
  previewStatus: PreviewStatus;
  shot: Shot;
  shots: Shot[];
}

const previewLabels: Record<PreviewStatus, string> = {
  building: "Building",
  failed: "Failed",
  ready: "Ready",
  stale: "Stale",
};

export function TakeViewer({ onSelectTake, previewStatus, shot, shots }: TakeViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const artifactAvailable = shot.artifactStatus === "available";
  const previewReadiness = derivePreviewReadiness(
    previewStatus,
    shots,
  );

  function togglePlayback() {
    if (!artifactAvailable) return;
    const video = videoRef.current;
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    if (!video) return;
    if (nextPlaying) {
      const playResult = video.play();
      void playResult?.catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }

  function selectAdjacentTake(direction: -1 | 1) {
    if (shot.takes.length < 2) return;
    const currentIndex = Math.max(
      0,
      shot.takes.findIndex((take) => take.id === shot.activeTakeId),
    );
    const nextIndex = (currentIndex + direction + shot.takes.length) % shot.takes.length;
    const nextTake = shot.takes[nextIndex];
    if (nextTake) onSelectTake(nextTake.id);
  }

  function handleStageKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;

    if (event.key === " ") {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      selectAdjacentTake(event.key === "ArrowLeft" ? -1 : 1);
    }
  }

  return (
    <section className={styles.viewer} aria-labelledby="viewer-heading">
      <div className={styles.viewerHeading}>
        <div>
          <span>Active take</span>
          <h2 id="viewer-heading">{shot.title}</h2>
        </div>
        <span className={styles.previewStatus} aria-label="Preview 状态">
          Preview {previewLabels[previewReadiness]}
        </span>
      </div>

      <div
        aria-label="镜头预览 Stage"
        className={styles.stage}
        data-playback={isPlaying ? "playing" : "paused"}
        onKeyDown={handleStageKeyDown}
        tabIndex={0}
      >
        {artifactAvailable ? (
          <>
            <video
              muted
              onEnded={() => setIsPlaying(false)}
              playsInline
              poster={shot.poster.width1200}
              preload="metadata"
              ref={videoRef}
              src={shot.previewVideo}
            />
            <button
              aria-label={isPlaying ? "暂停预览" : "播放预览"}
              className={styles.playButton}
              onClick={togglePlayback}
              type="button"
            >
              {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </button>
            <span className={styles.stageHint}>Space 播放 · ← → 切换 Take</span>
          </>
        ) : (
          <div
            aria-label={`Scene ${String(shot.number).padStart(2, "0")} 缺失可播放片段`}
            className={styles.unavailableStage}
          >
            <strong>{shot.artifactStatus === "processing" ? "Artifact 处理中" : "尚无可播放 Artifact"}</strong>
            <span>调整左侧草稿后，使用“生成新版本”创建片段。</span>
          </div>
        )}
      </div>

      <div className={styles.takeRail} aria-label="Take 版本">
        <span>Versions</span>
        <div>
          {shot.takes.length ? (
            shot.takes.map((take) => (
              <button
                aria-pressed={take.id === shot.activeTakeId}
                key={take.id}
                onClick={() => onSelectTake(take.id)}
                type="button"
              >
                {take.label}
              </button>
            ))
          ) : (
            <small>尚无 Take，可创建新版本</small>
          )}
        </div>
      </div>
    </section>
  );
}
