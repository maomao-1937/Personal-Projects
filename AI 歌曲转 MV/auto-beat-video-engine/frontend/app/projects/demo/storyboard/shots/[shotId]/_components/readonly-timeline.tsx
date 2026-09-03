import Image from "next/image";
import type { Shot, TimelineAnalysis } from "../../../../_lib/types";
import styles from "./shot-editor.module.css";

interface ReadonlyTimelineProps {
  analysis: TimelineAnalysis;
  currentShotId: string;
  shots: Shot[];
}

function positionPercent(timeSec: number, durationSec: number) {
  return `${(timeSec / durationSec) * 100}%`;
}

export function ReadonlyTimeline({
  analysis,
  currentShotId,
  shots,
}: ReadonlyTimelineProps) {
  const durationSeconds = shots.reduce((total, shot) => total + shot.durationSec, 0);
  const durationLabel = `${String(Math.floor(durationSeconds / 60)).padStart(2, "0")}:${String(durationSeconds % 60).padStart(2, "0")}`;

  return (
    <section
      aria-label="只读时间线"
      className={styles.timeline}
      data-duration-seconds={durationSeconds}
    >
      <div aria-label="时间标尺" className={styles.timelineRuler}>
        {analysis.rulerTicks.map((tick) => (
          <span
            data-ruler-time-sec={tick.timeSec}
            key={tick.id}
            style={{ left: positionPercent(tick.timeSec, durationSeconds) }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div aria-label="镜头轨" className={styles.timelineTrack} role="group">
        {shots.map((shot) => (
          <article
            aria-current={shot.id === currentShotId ? "true" : undefined}
            className={styles.timelineShot}
            key={shot.id}
            style={{ flexBasis: `${(shot.durationSec / durationSeconds) * 100}%` }}
          >
            <Image
              alt=""
              height={72}
              loading="lazy"
              sizes="(max-width: 767px) 96px, 12vw"
              src={shot.poster.width400}
              width={128}
            />
            <div>
              <strong>{String(shot.number).padStart(2, "0")}</strong>
              <span>{shot.durationSec}s</span>
            </div>
          </article>
        ))}
      </div>
      <div aria-label="音频波形" className={styles.timelineAudio}>
        <div aria-hidden="true" className={styles.waveform}>
          {analysis.waveformSamples.map((sample) => (
            <i
              data-waveform-time-sec={sample.timeSec}
              key={sample.timeSec}
              style={{
                height: `${sample.amplitude}px`,
                left: positionPercent(sample.timeSec, durationSeconds),
              }}
            />
          ))}
        </div>
        <div aria-label="Beat 节点" className={styles.beatNodes} role="group">
          {analysis.beats.map((beat) => (
            <i
              data-beat-time-sec={beat.timeSec}
              key={beat.id}
              style={{ left: positionPercent(beat.timeSec, durationSeconds) }}
            />
          ))}
        </div>
        <div aria-label="段落节点" className={styles.sectionNodes} role="group">
          {analysis.sections.map((section) => (
            <span
              data-section-id={section.id}
              key={section.id}
              style={{
                left: positionPercent(section.startSec, durationSeconds),
                width: positionPercent(section.endSec - section.startSec, durationSeconds),
              }}
            >
              {section.label}
            </span>
          ))}
        </div>
        <div aria-label="歌词节点" className={styles.lyricNodes} role="group">
          {analysis.lyrics.map((lyric) => (
            <span
              aria-label={`歌词：${lyric.text}`}
              data-lyric-time-sec={lyric.timeSec}
              key={lyric.id}
              role="img"
              style={{ left: positionPercent(lyric.timeSec, durationSeconds) }}
            />
          ))}
        </div>
      </div>
      <footer aria-label="时间线工具栏" className={styles.timelineToolbar}>
        <div>
          <span>Timeline</span>
          <strong>只读·节奏参考</strong>
        </div>
        <time>{durationLabel}</time>
      </footer>
    </section>
  );
}
