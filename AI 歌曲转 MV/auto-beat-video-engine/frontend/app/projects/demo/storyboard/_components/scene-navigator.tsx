import { Check, CircleDashed, Clock3, Plus } from "lucide-react";
import type { Scene } from "../_lib/types";

const sceneStatus = {
  succeeded: { label: "已完成", icon: Check },
  partial: { label: "部分成功", icon: CircleDashed },
  queued: { label: "待生成", icon: Clock3 },
} as const;

interface SceneNavigatorProps {
  scenes: Scene[];
  selectedSceneId: string;
  open: boolean;
  onSelectScene: (sceneId: string) => void;
}

export function SceneNavigator({ scenes, selectedSceneId, open, onSelectScene }: SceneNavigatorProps) {
  return (
    <nav className={`scene-nav ${open ? "is-panel-open" : ""}`} aria-label="场景" id="scene-panel">
      <div className="panel-heading">
        <h2>场景</h2>
        <button type="button" className="icon-button" aria-label="添加场景">
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="scene-list">
        {scenes.map((scene) => {
          const status = sceneStatus[scene.status];
          const StatusIcon = status.icon;
          return (
            <button
              type="button"
              aria-label={`选择场景 ${String(scene.number).padStart(2, "0")} ${scene.title}`}
              aria-pressed={scene.id === selectedSceneId}
              className={`scene-item ${scene.id === selectedSceneId ? "is-selected" : ""}`}
              key={scene.id}
              onClick={() => onSelectScene(scene.id)}
            >
              <span className="scene-main">
                <strong><span className="scene-number">{String(scene.number).padStart(2, "0")}</span>{scene.title}</strong>
                <span>{scene.range}<small>{scene.cutCount} 镜头</small></span>
              </span>
              <span className={`scene-state state-${scene.status}`}>
                <StatusIcon aria-hidden="true" size={18} />
                {status.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
