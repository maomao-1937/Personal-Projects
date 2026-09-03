import { SlidersHorizontal, Sparkles, Video } from "lucide-react";
import { useRef, useState } from "react";
import { WorkspaceSheet } from "../../_components/workspace-sheet";
import type { ModelTier } from "../../_lib/types";
import styles from "./storyboard-workspace.module.css";

interface StoryboardControlsProps {
  generationTier?: ModelTier;
  visualConcept: string;
  onGenerateAll: () => void;
}

export function StoryboardControls({
  generationTier,
  onGenerateAll,
  visualConcept,
}: StoryboardControlsProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);

  function renderConcept() {
    return (
      <div className={styles.concept}>
        <span className={styles.conceptIcon} aria-hidden="true">
          <Sparkles size={18} strokeWidth={1.8} />
        </span>
        <div>
          <span className={styles.eyebrow}>视觉概念</span>
          <p>{visualConcept}</p>
        </div>
      </div>
    );
  }

  function renderGenerationControls() {
    return (
      <div className={styles.generationControls}>
        <div aria-label="生成参数" className={styles.generationMeta}>
          <span>{generationTier?.resolution}</span>
          <span>
            <Video aria-hidden="true" size={14} />
            {generationTier?.videoCoverage} 生成视频
          </span>
          <span>{generationTier?.consistency}一致性</span>
        </div>
        <button className={styles.generateButton} onClick={onGenerateAll} type="button">
          <Sparkles aria-hidden="true" size={17} />
          生成全部
        </button>
      </div>
    );
  }

  return (
    <>
      <section aria-label="全局生成控制" className={`${styles.controls} ${styles.desktopControls}`}>
        <div aria-label="视觉概念">{renderConcept()}</div>
        {renderGenerationControls()}
      </section>

      <section aria-label="全局生成摘要" className={styles.mobileControls}>
        <div>
          <span>全局生成</span>
          <strong>{generationTier?.resolution}</strong>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          ref={sheetTriggerRef}
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" size={16} />
          打开全局生成设置
        </button>
      </section>

      <WorkspaceSheet
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        side="bottom"
        title="全局生成设置"
        triggerRef={sheetTriggerRef}
      >
        <div className={styles.sheetGlobalControls}>
          {renderConcept()}
          {renderGenerationControls()}
        </div>
      </WorkspaceSheet>
    </>
  );
}
