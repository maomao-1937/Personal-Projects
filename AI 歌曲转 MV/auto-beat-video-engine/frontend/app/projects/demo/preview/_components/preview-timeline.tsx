import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { Shot, TimelineAnalysis } from "../../_lib/types";
import { buildPreviewRepairHref, getShotStartTime, isPreviewShotMissing } from "./preview-fixture";
import styles from "./preview-workspace.module.css";

interface PreviewTimelineProps {
  analysis: TimelineAnalysis;
  currentTime: number;
  onSelectShot: (shotId: string, startTime: number) => void;
  returnTo: string;
  shots: Shot[];
}

function formatTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function positionStyle(time: number, totalDuration: number): CSSProperties {
  return { left: `${(time / totalDuration) * 100}%` };
}

export function PreviewTimeline({
  analysis,
  currentTime,
  onSelectShot,
  returnTo,
  shots,
}: PreviewTimelineProps) {
  const totalDuration = shots.reduce((sum, shot) => sum + shot.durationSec, 0);

  return (
    <section aria-label="预览时间线" className={styles.timeline}>
      <header className={styles.timelineHeader}>
        <div>
          <strong>整片时间线</strong>
          <span>只读 · 点击片段检查</span>
        </div>
        <time dateTime={`PT${Math.floor(currentTime)}S`}>{`${formatTime(currentTime)} / ${formatTime(totalDuration)}`}</time>
      </header>

      <div className={styles.timelineCanvas}>
        <div className={styles.ruler} aria-hidden="true">
          {analysis.rulerTicks.map((tick) => (
            <span
              data-ruler-time-sec={tick.timeSec}
              key={tick.id}
              style={positionStyle(tick.timeSec, totalDuration)}
            >
              {tick.label}
            </span>
          ))}
        </div>

        <div className={`${styles.track} ${styles.videoTrack}`} aria-label="视频轨">
          <span className={styles.trackLabel}>视频</span>
          <div className={styles.clipRail}>
            {shots.map((shot) => {
              const startTime = getShotStartTime(shots, shot.id);
              const width = `${(shot.durationSec / totalDuration) * 100}%`;
              const sceneLabel = `Scene ${String(shot.number).padStart(2, "0")}`;
              const commonProps = {
                className: `${styles.videoClip} ${isPreviewShotMissing(shot) ? styles.missingClip : ""}`,
                "data-artifact-status": shot.artifactStatus,
                "data-preview-src": shot.previewVideo,
                style: { width },
              };

              if (shot.artifactStatus === "missing" || shot.artifactStatus === "failed") {
                return (
                  <Link
                    key={shot.id}
                    {...commonProps}
                    data-missing="true"
                    href={buildPreviewRepairHref(shot.id, returnTo)}
                  >
                    <strong>{sceneLabel}</strong>
                    <span>{`修复 ${sceneLabel}`}</span>
                  </Link>
                );
              }

              if (shot.artifactStatus === "processing") {
                return (
                  <span key={shot.id} {...commonProps} aria-label={`${sceneLabel} Artifact 处理中`}>
                    <strong>{sceneLabel}</strong>
                    <span>处理中</span>
                  </span>
                );
              }

              return (
                <button
                  key={shot.id}
                  {...commonProps}
                  aria-label={`检查 ${sceneLabel}`}
                  onClick={() => onSelectShot(shot.id, startTime)}
                  type="button"
                >
                  <Image alt="" fill sizes="160px" src={shot.poster.width400} />
                  <span>{sceneLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`${styles.track} ${styles.audioTrack}`} aria-label="音频轨">
          <span className={styles.trackLabel}>音频</span>
          <div className={styles.waveform} aria-hidden="true">
            {analysis.waveformSamples.map((sample) => (
              <i
                data-waveform-time-sec={sample.timeSec}
                key={sample.timeSec}
                style={{
                  ...positionStyle(sample.timeSec, totalDuration),
                  height: `${sample.amplitude}px`,
                }}
              />
            ))}
          </div>
        </div>

        <div className={styles.markerLayer} aria-label="Beat 标记">
          <span className={styles.trackLabel}>Beat</span>
          <div>
            {analysis.beats.map((beat) => (
              <i
                aria-hidden="true"
                data-beat-time-sec={beat.timeSec}
                key={beat.id}
                style={positionStyle(beat.timeSec, totalDuration)}
              />
            ))}
          </div>
        </div>

        <div className={styles.markerLayer} aria-label="段落标记">
          <span className={styles.trackLabel}>段落</span>
          <div>
            {analysis.sections.map((section) => (
              <span
                data-section-id={section.id}
                key={section.id}
                style={{
                  ...positionStyle(section.startSec, totalDuration),
                  width: `${((section.endSec - section.startSec) / totalDuration) * 100}%`,
                }}
              >
                {section.label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.markerLayer} aria-label="歌词标记">
          <span className={styles.trackLabel}>歌词</span>
          <div>
            {analysis.lyrics.map((lyric) => (
              <span
                data-lyric-time-sec={lyric.timeSec}
                key={lyric.id}
                style={positionStyle(lyric.timeSec, totalDuration)}
              >
                {lyric.text}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.markerLayer} aria-label="场景转场">
          <span className={styles.trackLabel}>转场</span>
          <div>
            {shots.slice(0, -1).map((shot, index) => {
              const time = shots.slice(0, index + 1).reduce((sum, item) => sum + item.durationSec, 0);
              return (
                <i
                  aria-label={`${shot.title} 后淡化`}
                  key={shot.id}
                  role="img"
                  style={positionStyle(time, totalDuration)}
                />
              );
            })}
          </div>
        </div>

        <div
          aria-label={`播放头 ${formatTime(currentTime)}`}
          className={styles.playhead}
          data-time={currentTime}
          role="img"
          style={positionStyle(currentTime, totalDuration)}
        >
          <span />
        </div>
      </div>
    </section>
  );
}
