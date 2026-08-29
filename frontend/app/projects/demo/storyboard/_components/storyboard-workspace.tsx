import { AppHeader } from "./app-header";
import { AudioContextBar } from "./audio-context-bar";
import { ProjectProgress } from "./project-progress";
import { SceneNavigator } from "./scene-navigator";
import { workspaceFixture } from "../_lib/fixtures";

export function StoryboardWorkspace() {
  return (
    <div className="app-shell">
      <AppHeader />
      <ProjectProgress />
      <AudioContextBar />
      <main className="workspace-grid" id="main-content">
        <SceneNavigator
          scenes={workspaceFixture.scenes}
          selectedSceneId={workspaceFixture.selectedSceneId}
        />
        <section className="cut-canvas" aria-label="Cut 画布">
          <div className="canvas-heading">
            <div>
              <h1>霁虹街区 <span>00:42–01:18</span></h1>
              <p>剧情描述：繁华的霁虹街区，行人穿梭，光影交错，表现城市的活力与孤独感。</p>
            </div>
            <button type="button" className="primary-button">生成全部</button>
          </div>
          <div className="shell-placeholder" aria-hidden="true" />
        </section>
        <aside className="inspector-shell" aria-label="Cut 编辑">
          <h2>Cut 06</h2>
          <p>选中镜头后在此编辑。</p>
        </aside>
      </main>
    </div>
  );
}
