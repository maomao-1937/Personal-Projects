import type { FormEvent, RefObject } from "react";
import { WorkspaceSheet } from "../../_components/workspace-sheet";
import styles from "./preview-workspace.module.css";

export interface ExportConfig {
  format: "mp4" | "mov" | "webm";
  resolution: "720p" | "1080p" | "4k";
  captions: boolean;
  platform: "bilibili" | "youtube" | "archive";
}

interface ExportSheetProps {
  config: ExportConfig;
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  onConfigChange: (config: ExportConfig) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const formatLabels: Record<ExportConfig["format"], string> = {
  mp4: "MP4 · H.264",
  mov: "MOV · ProRes",
  webm: "WebM · VP9",
};

const resolutionLabels: Record<ExportConfig["resolution"], string> = {
  "720p": "1280 × 720",
  "1080p": "1920 × 1080",
  "4k": "3840 × 2160",
};

const platformLabels: Record<ExportConfig["platform"], string> = {
  bilibili: "Bilibili 横屏",
  youtube: "YouTube 1080p",
  archive: "高质量归档",
};

export function ExportSheet({
  config,
  onConfigChange,
  onConfirm,
  onOpenChange,
  open,
  triggerRef,
}: ExportSheetProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm();
    onOpenChange(false);
  }

  return (
    <WorkspaceSheet
      onOpenChange={onOpenChange}
      open={open}
      side="right"
      title="导出设置"
      triggerRef={triggerRef}
      width={360}
    >
      <form className={styles.exportForm} data-export-sheet onSubmit={handleSubmit}>
        <p className={styles.exportIntro}>
          配置导出格式、分辨率、字幕与平台预设。
        </p>

        <label>
          <span>格式</span>
          <select
            name="format"
            onChange={(event) =>
              onConfigChange({ ...config, format: event.target.value as ExportConfig["format"] })
            }
            value={config.format}
          >
            <option value="mp4">MP4 · H.264</option>
            <option value="mov">MOV · ProRes</option>
            <option value="webm">WebM · VP9</option>
          </select>
        </label>

        <label>
          <span>分辨率</span>
          <select
            name="resolution"
            onChange={(event) =>
              onConfigChange({
                ...config,
                resolution: event.target.value as ExportConfig["resolution"],
              })
            }
            value={config.resolution}
          >
            <option value="1080p">1920 × 1080</option>
            <option value="720p">1280 × 720</option>
            <option value="4k">3840 × 2160</option>
          </select>
        </label>

        <label className={styles.checkboxField}>
          <input
            checked={config.captions}
            name="captions"
            onChange={(event) => onConfigChange({ ...config, captions: event.target.checked })}
            type="checkbox"
          />
          <span>字幕</span>
        </label>

        <label>
          <span>平台预设</span>
          <select
            name="platform"
            onChange={(event) =>
              onConfigChange({
                ...config,
                platform: event.target.value as ExportConfig["platform"],
              })
            }
            value={config.platform}
          >
            <option value="bilibili">Bilibili 横屏</option>
            <option value="youtube">YouTube 1080p</option>
            <option value="archive">高质量归档</option>
          </select>
        </label>

        <div aria-label="导出配置摘要" className={styles.exportSummary}>
          <span>预计规格</span>
          <strong>{formatLabels[config.format]}</strong>
          <strong>{resolutionLabels[config.resolution]}</strong>
          <strong>{config.captions ? "内嵌字幕" : "无字幕"}</strong>
          <strong>{platformLabels[config.platform]}</strong>
        </div>

        <button className={styles.confirmExport} type="submit">
          保存导出设置
        </button>
      </form>
    </WorkspaceSheet>
  );
}
