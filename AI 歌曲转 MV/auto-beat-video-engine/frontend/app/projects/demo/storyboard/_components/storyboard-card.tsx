import { Clock3, Film, MoveRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { FocusEvent, MouseEvent } from "react";
import type { Shot, ShotStatus } from "../../_lib/types";
import styles from "./storyboard-workspace.module.css";

interface StoryboardCardProps {
  previewActive: boolean;
  priority: boolean;
  shot: Shot;
  onActivatePreview: (shotId: string) => void;
  onDeactivatePreview: (shotId: string) => void;
  onOpenQuickEdit: (shot: Shot, trigger: HTMLElement) => void;
  onRetry: (shotId: string) => void;
}

const statusLabel: Record<Exclude<ShotStatus, "failed_retryable">, string> = {
  draft: "待生成",
  queued: "排队中",
  running: "生成中",
  succeeded: "已生成",
};

export const QUICK_EDIT_CLICK_DELAY_MS = 400;

function shotNumber(shot: Shot) {
  return String(shot.number).padStart(2, "0");
}

export function StoryboardCard({
  onActivatePreview,
  onDeactivatePreview,
  onOpenQuickEdit,
  onRetry,
  previewActive,
  priority,
  shot,
}: StoryboardCardProps) {
  const number = shotNumber(shot);
  const clickTimerRef = useRef<number | null>(null);
  const cardTitleId = `shot-title-${shot.id}`;
  const sceneLabelId = `shot-label-${shot.id}`;
  const responsiveSizes = "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 152px) / 2), (max-width: 1279px) calc((100vw - 168px) / 3), (max-width: 1599px) calc((100vw - 176px) / 4), 358px";

  useEffect(
    () => () => {
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    },
    [],
  );

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const requestsNativeNavigation = window.innerWidth < 768
      || event.detail === 0
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey;

    if (requestsNativeNavigation) {
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }

    if (event.detail > 1) {
      if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }

    event.preventDefault();
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    const trigger = event.currentTarget;
    clickTimerRef.current = window.setTimeout(() => {
      onOpenQuickEdit(shot, trigger);
      clickTimerRef.current = null;
    }, QUICK_EDIT_CLICK_DELAY_MS);
  }

  function handleDoubleClick() {
    if (window.innerWidth < 768) return;
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      onDeactivatePreview(shot.id);
    }
  }

  return (
    <article
      aria-labelledby={`${sceneLabelId} ${cardTitleId}`}
      className={styles.card}
    >
      <span className={styles.srOnly} id={sceneLabelId}>{`镜头 ${number} ·`}</span>
      <span className={styles.srOnly} id={`interaction-${shot.id}`}>
        单击快速编辑；双击或按 Enter 打开完整编辑器
      </span>
      <div
        aria-label={`镜头 ${number} 媒体`}
        className={styles.media}
        style={{ aspectRatio: "16 / 9" }}
      >
        <picture>
          <source
            sizes={responsiveSizes}
            srcSet={`${shot.poster.width400} 400w, ${shot.poster.width800} 800w, ${shot.poster.width1200} 1200w`}
          />
          <img
            alt={shot.title}
            decoding={priority ? "sync" : "async"}
            fetchPriority={priority ? "high" : "auto"}
            height={450}
            loading={priority ? "eager" : "lazy"}
            sizes={responsiveSizes}
            src={shot.poster.width800}
            width={800}
          />
        </picture>

        {previewActive && shot.artifactStatus === "available" ? (
          <video
            aria-label={`${shot.title}静音预览`}
            autoPlay
            className={styles.preview}
            loop
            muted
            playsInline
            poster={shot.poster.width800}
            preload="metadata"
            src={shot.previewVideo}
          />
        ) : null}

        <div className={styles.mediaShade} aria-hidden="true" />

        {shot.status !== "failed_retryable" ? (
          <span className={`${styles.status} ${styles[shot.status]}`}>
            <span aria-hidden="true" />
            {statusLabel[shot.status]}
          </span>
        ) : null}

        {shot.overridesGlobalStyle ? (
          <span className={styles.override}>
            <span
              aria-label="已覆盖全局风格标记"
              className={styles.overrideDot}
              data-color="purple"
              role="img"
            />
            已覆盖全局风格
          </span>
        ) : null}

        {shot.status === "running" ? (
          <div className={styles.progressWrap}>
            <div className={styles.progressCopy}>
              <span>生成画面</span>
              <strong>{shot.progress ?? 0}%</strong>
            </div>
            <div
              aria-label={`镜头 ${number} 生成进度`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={shot.progress ?? 0}
              className={styles.progress}
              role="progressbar"
            >
              <span style={{ width: `${shot.progress ?? 0}%` }} />
            </div>
          </div>
        ) : null}

        <span className={styles.openHint}>
          打开
          <MoveRight aria-hidden="true" size={14} />
        </span>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>
          <span className={styles.number}>{number}</span>
          <div>
            <h2 id={cardTitleId}>{shot.title}</h2>
            <p>{shot.description}</p>
          </div>
        </div>
        <div className={styles.cardMeta}>
          <span>
            <Clock3 aria-hidden="true" size={13} />
            {shot.range}
          </span>
          <span>
            <Film aria-hidden="true" size={13} />
            {shot.cameraMotion}
          </span>
          <span>{shot.durationSec}s</span>
        </div>
      </div>

      <Link
        aria-describedby={`interaction-${shot.id}`}
        aria-label={`编辑镜头 ${number} · ${shot.title}`}
        className={styles.cardLink}
        href={`/projects/demo/storyboard/shots/${shot.id}`}
        onBlur={handleBlur}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onFocus={() => onActivatePreview(shot.id)}
        onMouseEnter={() => onActivatePreview(shot.id)}
        onMouseLeave={() => onDeactivatePreview(shot.id)}
      />

      {shot.status === "failed_retryable" ? (
        <div className={styles.errorBar} role="alert">
          <span aria-hidden="true">!</span>
          <p>{shot.error}</p>
          <button aria-label={`重试 Scene ${number}`} onClick={() => onRetry(shot.id)} type="button">
            重试
          </button>
        </div>
      ) : null}
    </article>
  );
}
