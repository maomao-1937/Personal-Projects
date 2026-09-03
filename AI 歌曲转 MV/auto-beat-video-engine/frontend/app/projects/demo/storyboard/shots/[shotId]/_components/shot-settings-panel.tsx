import { useState } from "react";
import type { Shot, ShotGenerationDraft } from "../../../../_lib/types";
import styles from "./shot-editor.module.css";

const motionPresets = [
  "固定镜头",
  "缓慢推进",
  "缓慢拉远",
  "横向跟随",
  "后方跟随",
  "手持漂移",
] as const;

interface ShotSettingsPanelProps {
  draft: ShotGenerationDraft;
  shot: Shot;
  onApply: () => void;
  onDraftChange: (draft: ShotGenerationDraft) => void;
}

export function ShotSettingsPanel({
  draft,
  onApply,
  onDraftChange,
  shot,
}: ShotSettingsPanelProps) {
  const [applyMessage, setApplyMessage] = useState("");
  const availableMotionOptions = Array.from(
    new Set([...motionPresets, draft.cameraMotion]),
  );

  function handleDraftChange(nextDraft: ShotGenerationDraft) {
    setApplyMessage("");
    onDraftChange(nextDraft);
  }

  return (
    <div className={styles.settingsBody}>
      <section className={styles.formSection} aria-labelledby="reference-heading">
        <div className={styles.sectionHeading}>
          <div>
            <span>01</span>
            <h2 id="reference-heading">参考图</h2>
          </div>
          <small>16:9</small>
        </div>
        <picture className={styles.referenceImage}>
          <source
            srcSet={`${shot.poster.width400} 400w, ${shot.poster.width800} 800w, ${shot.poster.width1200} 1200w`}
            sizes="(max-width: 767px) 100vw, 520px"
          />
          <img
            alt={`${shot.title}参考图`}
            height="450"
            src={shot.poster.width800}
            width="800"
          />
        </picture>
        <div className={styles.unsupportedControl}>
          <button aria-describedby="reference-upload-note" disabled type="button">
            替换参考图
          </button>
          <small id="reference-upload-note">当前版本暂不支持上传参考图</small>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>02</span>
            <h2 id="prompt-heading">Prompt</h2>
          </div>
          <small>{draft.prompt.length} 字</small>
        </div>
        <label className={styles.srOnly} htmlFor="shot-prompt">
          Prompt
        </label>
        <textarea
          id="shot-prompt"
          onChange={(event) => handleDraftChange({ ...draft, prompt: event.target.value })}
          rows={5}
          value={draft.prompt}
        />
      </section>

      <fieldset className={styles.motionFieldset}>
        <legend>镜头运动</legend>
        <div className={styles.motionGrid}>
          {availableMotionOptions.map((motion) => (
            <label className={styles.motionOption} key={motion}>
              <input
                checked={draft.cameraMotion === motion}
                name="camera-motion"
                onChange={() => handleDraftChange({ ...draft, cameraMotion: motion })}
                type="radio"
              />
              <span>{motion}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <details className={styles.advancedSettings}>
        <summary>高级设置</summary>
        <div className={styles.advancedGrid}>
          <label>
            随机种子
            <input
              aria-label="随机种子"
              inputMode="numeric"
              onChange={(event) =>
                handleDraftChange({
                  ...draft,
                  advanced: { ...draft.advanced, seed: event.target.value },
                })
              }
              value={draft.advanced.seed}
            />
          </label>
          <label>
            输出分辨率
            <select
              aria-label="输出分辨率"
              onChange={(event) =>
                handleDraftChange({
                  ...draft,
                  advanced: {
                    ...draft.advanced,
                    resolution: event.target.value as ShotGenerationDraft["advanced"]["resolution"],
                  },
                })
              }
              value={draft.advanced.resolution}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
            </select>
          </label>
        </div>
      </details>

      <button
        className={styles.applySettings}
        onClick={() => {
          onApply();
          setApplyMessage("已应用到本地项目");
        }}
        type="button"
      >
        应用到本地项目
      </button>
      {applyMessage ? <p className={styles.applyMessage}>{applyMessage}</p> : null}
    </div>
  );
}
