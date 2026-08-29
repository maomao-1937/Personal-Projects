"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import { useState } from "react";
import { AppHeader } from "./app-header";
import { AudioContextBar } from "./audio-context-bar";
import { CutCard } from "./cut-card";
import { CutInspector } from "./cut-inspector";
import { PreviewStatusBar } from "./preview-status-bar";
import { ProjectProgress } from "./project-progress";
import { SceneNavigator } from "./scene-navigator";
import { workspaceFixture } from "../_lib/fixtures";
import { rebuildPreview, retryCut, saveCutDraft } from "../_lib/state";

const sceneCopy: Record<string, string> = {
  "scene-01": "雨声与灯光中，一辆末班车驶进站台，开启夜幕下的旅程。",
  "scene-02": "繁华的霁虹街区，行人穿梭，光影交错，表现城市的活力与孤独感。",
  "scene-03": "雨渐止，清晨的光从天台边缘升起，留下安静而开放的尾声。",
};

export function StoryboardWorkspace() {
  const [workspace, setWorkspace] = useState(() => workspaceFixture);
  const initialCut = workspaceFixture.cuts.find((cut) => cut.id === workspaceFixture.selectedCutId);
  const [draftPrompt, setDraftPrompt] = useState(() => initialCut?.prompt ?? "");
  const [savedMessage, setSavedMessage] = useState("");
  const [scenePanelOpen, setScenePanelOpen] = useState(true);
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(false);

  const selectedScene = workspace.scenes.find((scene) => scene.id === workspace.selectedSceneId);
  const sceneCuts = workspace.cuts.filter((cut) => cut.sceneId === workspace.selectedSceneId);
  const selectedCut = workspace.cuts.find((cut) => cut.id === workspace.selectedCutId);

  function selectScene(sceneId: string) {
    const firstCut = workspace.cuts.find((cut) => cut.sceneId === sceneId);
    setWorkspace((current) => ({
      ...current,
      selectedSceneId: sceneId,
      selectedCutId: firstCut?.id ?? "",
    }));
    setDraftPrompt(firstCut?.prompt ?? "");
    setSavedMessage("");
  }

  function selectCut(cutId: string) {
    const cut = workspace.cuts.find((item) => item.id === cutId);
    setWorkspace((current) => ({ ...current, selectedCutId: cutId }));
    setDraftPrompt(cut?.prompt ?? "");
    setSavedMessage("");
  }

  function handleRetry(cutId: string) {
    setWorkspace((current) => retryCut(current, cutId));
    setSavedMessage("");
  }

  function handleSave() {
    if (!selectedCut) return;
    setWorkspace((current) => saveCutDraft(current, selectedCut.id, { prompt: draftPrompt }));
    setSavedMessage("修改已保存到界面预览（未发送到服务端）");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主内容</a>
      <AppHeader />
      <ProjectProgress />
      <AudioContextBar />
      <div className="mobile-panel-toggles" aria-label="工作区面板控制">
        <button
          type="button"
          aria-controls="scene-panel"
          aria-expanded={scenePanelOpen}
          aria-label="展开或收起场景面板"
          onClick={() => setScenePanelOpen((open) => !open)}
        >
          <PanelLeft aria-hidden="true" size={18} />
          场景
        </button>
        <button
          type="button"
          aria-controls="inspector-panel"
          aria-expanded={inspectorPanelOpen}
          aria-label="展开或收起 Cut 编辑面板"
          onClick={() => setInspectorPanelOpen((open) => !open)}
        >
          <PanelRight aria-hidden="true" size={18} />
          Cut 编辑
        </button>
      </div>
      <main className="workspace-grid" id="main-content">
        <SceneNavigator
          scenes={workspace.scenes}
          selectedSceneId={workspace.selectedSceneId}
          open={scenePanelOpen}
          onSelectScene={selectScene}
        />
        <section className="cut-canvas" aria-label="Cut 画布">
          <div className="canvas-heading">
            <div>
              <h1>{selectedScene?.title ?? "场景"} <span>{selectedScene?.range}</span></h1>
              <p>剧情描述：{sceneCopy[workspace.selectedSceneId]}</p>
            </div>
            <button type="button" className="primary-button">生成全部</button>
          </div>
          {sceneCuts.length > 0 ? (
            <div className="cut-grid">
              {sceneCuts.map((cut) => (
                <CutCard
                  cut={cut}
                  key={cut.id}
                  selected={cut.id === workspace.selectedCutId}
                  onSelect={selectCut}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          ) : (
            <div className="empty-cuts">
              <strong>该场景暂无 Cut 预览</strong>
              <span>F1 仅为霁虹街区提供 4 个可交互镜头。</span>
            </div>
          )}
        </section>
        <CutInspector
          cut={selectedCut}
          draftPrompt={draftPrompt}
          savedMessage={savedMessage}
          open={inspectorPanelOpen}
          onDraftChange={setDraftPrompt}
          onSave={handleSave}
          onRetry={handleRetry}
        />
      </main>
      <PreviewStatusBar
        state={workspace}
        onRebuild={() => setWorkspace((current) => rebuildPreview(current))}
      />
    </div>
  );
}
