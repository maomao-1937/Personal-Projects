import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoProject } from "../../../../_lib/fixture";
import {
  DemoProjectProvider,
  useDemoProject,
} from "../../../../_components/demo-project-provider";
import { createTake, selectTake } from "../../../../_lib/state";
import type { ArtifactStatus, DemoProject, PreviewStatus } from "../../../../_lib/types";
import { StoryboardWorkspace } from "../../../_components/storyboard-workspace";
import ShotEditorPage from "../page";
import { ShotEditorWorkspace } from "./shot-editor-workspace";
import { ReadonlyTimeline } from "./readonly-timeline";

const navigation = vi.hoisted(() => ({ notFound: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: navigation.notFound,
  useRouter: () => ({ push: navigation.push }),
}));

function renderEditor(shotId = "shot-06", project: DemoProject = demoProject) {
  const shot = project.shots.find((item) => item.id === shotId);
  if (!shot) throw new Error(`Missing fixture shot: ${shotId}`);

  return render(
    <DemoProjectProvider initialProject={project}>
      <ShotEditorWorkspace shotId={shot.id} />
    </DemoProjectProvider>,
  );
}

function projectWithReadiness(
  previewStatus: PreviewStatus,
  artifactStatus: ArtifactStatus = "available",
): DemoProject {
  return {
    ...demoProject,
    preview: { status: previewStatus },
    shots: demoProject.shots.map((shot) => ({ ...shot, artifactStatus })),
  };
}

function ShotStateProbe() {
  const { project } = useDemoProject();
  const shot = project.shots.find((item) => item.id === "shot-01");

  return (
    <output aria-label="Provider 镜头 01">
      {shot
        ? [
            shot.prompt,
            shot.cameraMotion,
            shot.advancedSettings.seed,
            shot.advancedSettings.resolution,
            shot.modelTierId ?? "unset",
          ].join("|")
        : "missing"}
    </output>
  );
}

function SharedConsumersHarness() {
  const [editorMounted, setEditorMounted] = useState(true);

  return (
    <>
      <button onClick={() => setEditorMounted((current) => !current)} type="button">
        {editorMounted ? "离开镜头编辑器" : "重新进入镜头编辑器"}
      </button>
      <StoryboardWorkspace />
      {editorMounted ? <ShotEditorWorkspace shotId="shot-01" /> : null}
      <ShotStateProbe />
    </>
  );
}

function ReentryHarness({ shotId }: { shotId: string }) {
  const [editorMounted, setEditorMounted] = useState(true);

  return (
    <>
      <button onClick={() => setEditorMounted((current) => !current)} type="button">
        {editorMounted ? "离开当前镜头" : "重新进入当前镜头"}
      </button>
      {editorMounted ? <ShotEditorWorkspace shotId={shotId} /> : null}
    </>
  );
}

describe("ShotEditorWorkspace", () => {
  beforeEach(() => {
    navigation.notFound.mockReset();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("呈现镜头设置、参考图和唯一生成主操作，不显示价格信息", () => {
    renderEditor();

    expect(screen.getByRole("heading", { name: "Scene 06 · 高架桥下" })).toBeVisible();
    expect(screen.getByText("00:39–00:48")).toBeVisible();
    expect(screen.getByRole("link", { name: "上一镜·Scene 05" })).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-05",
    );
    expect(screen.getByRole("link", { name: "下一镜·Scene 07" })).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-07",
    );
    expect(screen.getByRole("img", { name: "高架桥下参考图" })).toHaveAttribute(
      "src",
      "/demo/after-rain/posters/scene-06-800.webp",
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "雨后高架桥下，短发女性深灰长风衣，三分之四背影，紫蓝城市夜色。",
    );

    const motionGroup = screen.getByRole("group", { name: "镜头运动" });
    expect(within(motionGroup).getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByText("高级设置")).toBeVisible();
    expect(screen.queryByLabelText(/生成模型|模型档位/)).not.toBeInTheDocument();
    expect(screen.queryByText(/¥|价格|成本|预计预算/)).not.toBeInTheDocument();
    const settingsPanel = screen.getByRole("complementary", { name: "镜头设置" });
    expect(screen.getAllByRole("button", { name: "生成新版本" })).toHaveLength(1);
    expect(
      within(settingsPanel).getByRole("button", { name: "生成新版本" }),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: /Take 预览/ })).queryByRole("button", {
        name: "生成新版本",
      }),
    ).not.toBeInTheDocument();
  });

  it.each(demoProject.shots.map((shot) => [shot.id, shot.cameraMotion] as const))(
    "%s 进入、应用并重进时始终选中当前运镜 %s",
    async (shotId, cameraMotion) => {
      const user = userEvent.setup();
      render(
        <DemoProjectProvider>
          <ReentryHarness shotId={shotId} />
        </DemoProjectProvider>,
      );

      expect(screen.getByRole("radio", { name: cameraMotion })).toBeChecked();
      expect(
        screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked),
      ).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "应用到本地项目" }));
      expect(screen.getByText("已应用到本地项目")).toBeVisible();
      await user.click(screen.getByRole("button", { name: "离开当前镜头" }));
      await user.click(screen.getByRole("button", { name: "重新进入当前镜头" }));

      expect(screen.getByRole("radio", { name: cameraMotion })).toBeChecked();
    },
  );

  it("移动优先 DOM 先呈现 Stage，再呈现主 CTA 与设置字段", () => {
    renderEditor("shot-01");

    const stageRegion = screen.getByRole("region", { name: "Take 预览" });
    const settings = screen.getByRole("complementary", { name: "镜头设置" });
    const primaryAction = screen.getByRole("button", { name: "生成新版本" });
    const prompt = screen.getByLabelText("Prompt");

    expect(stageRegion.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(primaryAction.compareDocumentPosition(prompt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("缺失 Artifact 的 Stage 不挂载视频，available Stage 只挂载一个", () => {
    const { container, unmount } = renderEditor();

    expect(screen.getByLabelText("只读时间线")).toBeVisible();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Scene 06 缺失可播放片段")).toBeVisible();
    expect(container.querySelector("video")).not.toBeInTheDocument();

    unmount();
    const available = renderEditor("shot-01").container;
    expect(available.querySelectorAll("video")).toHaveLength(1);
    expect(available.querySelector("video")).toHaveAttribute("preload", "metadata");
    expect(available.querySelector("video")).toHaveAttribute(
      "src",
      "/demo/after-rain/media/scene-01-preview.mp4",
    );
  });

  it("呈现完整 204px 只读时间线的四层轨道与节奏节点", () => {
    renderEditor();

    const timeline = screen.getByLabelText("只读时间线");
    expect(within(timeline).getByLabelText("时间标尺")).toBeVisible();
    expect(within(timeline).getByLabelText("镜头轨")).toBeVisible();
    expect(within(timeline).getByLabelText("音频波形")).toBeVisible();
    expect(within(timeline).getByLabelText("时间线工具栏")).toBeVisible();
    expect(within(timeline).getByLabelText("Beat 节点")).toBeVisible();
    expect(within(timeline).getByLabelText("段落节点")).toBeVisible();
    expect(within(timeline).getByLabelText("歌词节点")).toBeVisible();
    expect(timeline).toHaveAttribute("data-duration-seconds", "66");
    expect(timeline).toHaveTextContent("01:06");
    expect(within(timeline).queryByRole("slider")).not.toBeInTheDocument();
    expect(within(timeline).queryByText(/拖拽/)).not.toBeInTheDocument();
  });

  it("只从传入 analysis 渲染波形与节奏标记并随数据严格变化", () => {
    const firstAnalysis = {
      rulerTicks: [{ id: "tick-a", label: "A", timeSec: 0 }],
      waveformSamples: [
        { amplitude: 12, timeSec: 0 },
        { amplitude: 30, timeSec: 33 },
      ],
      beats: [{ id: "beat-a", timeSec: 16.5 }],
      sections: [{ id: "section-a", label: "A 段", startSec: 16.5, endSec: 49.5 }],
      lyrics: [{ id: "lyric-a", text: "A 句", timeSec: 49.5 }],
    };
    const secondAnalysis = {
      rulerTicks: [{ id: "tick-b", label: "B", timeSec: 33 }],
      waveformSamples: [{ amplitude: 24, timeSec: 16.5 }],
      beats: [{ id: "beat-b", timeSec: 33 }],
      sections: [{ id: "section-b", label: "B 段", startSec: 0, endSec: 16.5 }],
      lyrics: [{ id: "lyric-b", text: "B 句", timeSec: 16.5 }],
    };
    const { container, rerender } = render(
      <ReadonlyTimeline
        analysis={firstAnalysis}
        currentShotId="shot-01"
        shots={demoProject.shots}
      />,
    );

    expect(container.querySelectorAll("[data-waveform-time-sec]")).toHaveLength(2);
    expect(container.querySelector('[data-waveform-time-sec="33"]')).toHaveStyle({
      height: "30px",
      left: "50%",
    });
    expect(container.querySelector('[data-beat-time-sec="16.5"]')).toHaveStyle({ left: "25%" });
    expect(container.querySelector('[data-section-id="section-a"]')).toHaveStyle({
      left: "25%",
      width: "50%",
    });
    expect(container.querySelector('[data-lyric-time-sec="49.5"]')).toHaveStyle({ left: "75%" });
    expect(screen.getByText("A")).toBeVisible();
    expect(screen.getByText("A 段")).toBeVisible();

    rerender(
      <ReadonlyTimeline
        analysis={secondAnalysis}
        currentShotId="shot-01"
        shots={demoProject.shots}
      />,
    );

    expect(container.querySelectorAll("[data-waveform-time-sec]")).toHaveLength(1);
    expect(container.querySelector('[data-waveform-time-sec="33"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-beat-time-sec="16.5"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-beat-time-sec="33"]')).toHaveStyle({ left: "50%" });
    expect(screen.queryByText("A 段")).not.toBeInTheDocument();
    expect(screen.getByText("B 段")).toBeVisible();
  });

  it("标记百分比使用 timeSec 除以当前镜头总时长", () => {
    const analysis = {
      rulerTicks: [],
      waveformSamples: [],
      beats: [{ id: "beat-duration", timeSec: 23 }],
      sections: [{ id: "section-duration", label: "时长段", startSec: 23, endSec: 46 }],
      lyrics: [{ id: "lyric-duration", text: "时长句", timeSec: 46 }],
    };
    const longerShots = demoProject.shots.map((shot, index) =>
      index === 0 ? { ...shot, durationSec: 34 } : shot,
    );
    const { container, rerender } = render(
      <ReadonlyTimeline analysis={analysis} currentShotId="shot-01" shots={longerShots} />,
    );

    expect(container.querySelector('[data-beat-time-sec="23"]')).toHaveStyle({ left: "25%" });
    expect(container.querySelector('[data-section-id="section-duration"]')).toHaveStyle({
      left: "25%",
      width: "25%",
    });
    expect(container.querySelector('[data-lyric-time-sec="46"]')).toHaveStyle({ left: "50%" });

    rerender(
      <ReadonlyTimeline
        analysis={analysis}
        currentShotId="shot-01"
        shots={demoProject.shots}
      />,
    );
    expect(container.querySelector('[data-beat-time-sec="23"]')).toHaveStyle({
      left: "34.84848484848485%",
    });
  });

  it.each([
    ["ready", "available", "Ready"],
    ["ready", "missing", "Stale"],
    ["stale", "available", "Stale"],
    ["building", "available", "Building"],
    ["failed", "available", "Failed"],
  ] as const)(
    "Preview %s + %s Artifact 在 TakeViewer 显示 %s",
    (previewStatus, artifactStatus, expectedLabel) => {
      renderEditor("shot-01", projectWithReadiness(previewStatus, artifactStatus));

      expect(screen.getByLabelText("Preview 状态")).toHaveTextContent(expectedLabel);
      if (expectedLabel !== "Ready") {
        expect(screen.getByLabelText("Preview 状态")).not.toHaveTextContent("Ready");
      }
    },
  );

  it("Stage 聚焦时用 Space 切换播放态，左右键切换 Take", () => {
    const projectWithTwoTakes = selectTake(
      createTake(createTake(demoProject, "shot-06"), "shot-06"),
      "shot-06",
      "shot-06-take-01",
    );
    renderEditor("shot-06", projectWithTwoTakes);
    const stage = screen.getByLabelText("镜头预览 Stage");

    stage.focus();
    expect(stage).toHaveFocus();
    fireEvent.keyDown(stage, { key: " " });
    expect(stage).toHaveAttribute("data-playback", "playing");
    fireEvent.keyDown(stage, { key: " " });
    expect(stage).toHaveAttribute("data-playback", "paused");

    fireEvent.keyDown(stage, { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Take 02" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.keyDown(stage, { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: "Take 01" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("输入框内按 Space 与左右键不触发 Stage 快捷键", () => {
    renderEditor("shot-01");
    const stage = screen.getByLabelText("镜头预览 Stage");
    const prompt = screen.getByLabelText("Prompt");

    prompt.focus();
    fireEvent.keyDown(prompt, { key: " " });
    fireEvent.keyDown(prompt, { key: "ArrowRight" });

    expect(stage).toHaveAttribute("data-playback", "paused");
    expect(screen.getByRole("button", { name: "Take 01" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("已有 Take 从活动快照恢复初始草稿，不被全局档位或镜头冗余字段覆盖", async () => {
    const user = userEvent.setup();
    const projectWithDriftedFields: DemoProject = {
      ...demoProject,
      selectedModelTierId: "economy",
      shots: demoProject.shots.map((shot) =>
        shot.id === "shot-01"
          ? {
              ...shot,
              advancedSettings: { seed: "9999", resolution: "1080p" },
              cameraMotion: "手持漂移",
              modelTierId: "quality",
              prompt: "不应覆盖活动 Take 的漂移字段",
            }
          : shot,
      ),
    };

    renderEditor("shot-01", projectWithDriftedFields);

    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "雨后高架站台，短发女性穿深灰长风衣，紫蓝霓虹反射，电影感。",
    );
    expect(screen.getByRole("radio", { name: "缓慢推进" })).toBeChecked();
    expect(screen.getByLabelText("随机种子")).toHaveValue("2468");
    expect(screen.getByLabelText("输出分辨率")).toHaveValue("720p");
    expect(screen.queryByLabelText(/生成模型|模型档位/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Qwen|Wan|Kling|Vidu/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Take 01" }));
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "雨后高架站台，短发女性穿深灰长风衣，紫蓝霓虹反射，电影感。",
    );
  });

  it("生成新版本使用当前受控草稿并让缺失 Artifact 可播放", async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();

    const prompt = screen.getByLabelText("Prompt");
    await user.clear(prompt);
    await user.type(prompt, "高架桥下的手持跟拍新版本");
    await user.click(screen.getByRole("radio", { name: "手持漂移" }));
    await user.click(screen.getByText("高级设置"));
    await user.clear(screen.getByLabelText("随机种子"));
    await user.type(screen.getByLabelText("随机种子"), "9090");
    await user.selectOptions(screen.getByLabelText("输出分辨率"), "1080p");

    await user.click(screen.getByRole("button", { name: "生成新版本" }));

    expect(screen.getByRole("status")).toHaveTextContent("新版本已创建");
    expect(screen.getByRole("status")).not.toHaveTextContent(/Fixture|Local fixture|演示/);
    expect(screen.getByLabelText("Preview 状态")).toHaveTextContent("Stale");
    expect(screen.getByRole("button", { name: "Take 01" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByLabelText("Scene 06 缺失可播放片段")).not.toBeInTheDocument();
    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "高架桥下的手持跟拍新版本",
    );
    expect(screen.getByRole("radio", { name: "手持漂移" })).toBeChecked();
    expect(screen.getByLabelText("随机种子")).toHaveValue("9090");
    expect(screen.getByLabelText("输出分辨率")).toHaveValue("1080p");
    expect(screen.queryByLabelText(/生成模型|模型档位/)).not.toBeInTheDocument();
  });

  it("切换 Take 恢复该版本的 Prompt、运镜与高级设置快照", async () => {
    const user = userEvent.setup();
    renderEditor("shot-01");

    await user.clear(screen.getByLabelText("Prompt"));
    await user.type(screen.getByLabelText("Prompt"), "新的站台版本");
    await user.click(screen.getByRole("radio", { name: "手持漂移" }));
    await user.click(screen.getByText("高级设置"));
    await user.clear(screen.getByLabelText("随机种子"));
    await user.type(screen.getByLabelText("随机种子"), "1357");
    await user.selectOptions(screen.getByLabelText("输出分辨率"), "1080p");
    await user.click(screen.getByRole("button", { name: "生成新版本" }));

    await user.click(screen.getByRole("button", { name: "Take 01" }));
    expect(screen.getByRole("button", { name: "Take 01" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Take 02" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByLabelText("Prompt")).toHaveValue(
      "雨后高架站台，短发女性穿深灰长风衣，紫蓝霓虹反射，电影感。",
    );
    expect(screen.getByRole("radio", { name: "缓慢推进" })).toBeChecked();
    expect(screen.getByLabelText("随机种子")).toHaveValue("2468");
    expect(screen.getByLabelText("输出分辨率")).toHaveValue("720p");
    expect(screen.queryByLabelText(/生成模型|模型档位/)).not.toBeInTheDocument();
  });

  it("Prompt、运镜与高级设置在应用前隔离，应用后跨 Provider、Storyboard 与重新进入可见", async () => {
    const user = userEvent.setup();
    render(
      <DemoProjectProvider>
        <SharedConsumersHarness />
      </DemoProjectProvider>,
    );

    expect(screen.getByRole("button", { name: "替换参考图" })).toBeDisabled();
    expect(screen.getByText("当前版本暂不支持上传参考图")).toBeVisible();
    await user.clear(screen.getByLabelText("Prompt"));
    await user.type(screen.getByLabelText("Prompt"), "已应用的共享 Prompt");
    await user.click(screen.getByRole("radio", { name: "手持漂移" }));
    await user.click(screen.getByText("高级设置"));
    await user.clear(screen.getByLabelText("随机种子"));
    await user.type(screen.getByLabelText("随机种子"), "8080");
    await user.selectOptions(screen.getByLabelText("输出分辨率"), "1080p");

    expect(screen.getByLabelText("Provider 镜头 01")).toHaveTextContent(
      "雨后高架站台，短发女性穿深灰长风衣，紫蓝霓虹反射，电影感。|缓慢推进|2468|720p|unset",
    );
    expect(
      within(screen.getByRole("article", { name: /镜头 01/ })).getByText("缓慢推进"),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "应用到本地项目" }));
    expect(screen.getByText("已应用到本地项目")).toBeVisible();
    expect(screen.getByLabelText("Provider 镜头 01")).toHaveTextContent(
      "已应用的共享 Prompt|手持漂移|8080|1080p|balanced",
    );
    expect(
      within(screen.getByRole("article", { name: /镜头 01/ })).getByText("手持漂移"),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "离开镜头编辑器" }));
    await user.click(screen.getByRole("button", { name: "重新进入镜头编辑器" }));

    expect(screen.getByLabelText("Prompt")).toHaveValue("已应用的共享 Prompt");
    expect(screen.getByRole("radio", { name: "手持漂移" })).toBeChecked();
    expect(screen.getByLabelText("随机种子")).toHaveValue("8080");
    expect(screen.getByLabelText("输出分辨率")).toHaveValue("1080p");
    expect(screen.queryByLabelText(/生成模型|模型档位/)).not.toBeInTheDocument();
  });

  it("Shot Settings 任一草稿字段变化后清除已应用状态", async () => {
    const user = userEvent.setup();
    renderEditor("shot-01");
    const apply = screen.getByRole("button", { name: "应用到本地项目" });

    async function expectAppliedThenCleared(changeDraft: () => Promise<unknown>) {
      await user.click(apply);
      expect(screen.getByText("已应用到本地项目")).toBeVisible();
      await changeDraft();
      expect(screen.queryByText("已应用到本地项目")).not.toBeInTheDocument();
    }

    await expectAppliedThenCleared(() => user.type(screen.getByLabelText("Prompt"), "更新"));
    await expectAppliedThenCleared(() =>
      user.click(screen.getByRole("radio", { name: "固定镜头" })),
    );
    await user.click(screen.getByText("高级设置"));
    await expectAppliedThenCleared(() => user.type(screen.getByLabelText("随机种子"), "1"));
    await expectAppliedThenCleared(() =>
      user.selectOptions(screen.getByLabelText("输出分辨率"), "1080p"),
    );
  });
});

describe("ShotEditorPage", () => {
  it("为有效 shotId 传入 Fixture", async () => {
    const page = await ShotEditorPage({ params: Promise.resolve({ shotId: "shot-06" }) });
    render(<DemoProjectProvider>{page}</DemoProjectProvider>);

    expect(screen.getByRole("heading", { name: "Scene 06 · 高架桥下" })).toBeVisible();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("无效 shotId 调用 notFound", async () => {
    navigation.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    await expect(
      ShotEditorPage({ params: Promise.resolve({ shotId: "shot-99" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalledOnce();
  });

  it("仅接受 Preview 白名单 returnTo 并准确返回原播放头", async () => {
    const page = await ShotEditorPage({
      params: Promise.resolve({ shotId: "shot-06" }),
      searchParams: Promise.resolve({ returnTo: "/projects/demo/preview?t=58" }),
    });
    render(<DemoProjectProvider>{page}</DemoProjectProvider>);

    expect(screen.getByRole("link", { name: "返回预览" })).toHaveAttribute(
      "href",
      "/projects/demo/preview?t=58",
    );
    expect(screen.queryByRole("link", { name: "返回故事板" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "上一镜·Scene 05" })).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-05?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D58",
    );
    expect(screen.getByRole("link", { name: "下一镜·Scene 07" })).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-07?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D58",
    );
  });

  it.each([
    "https://evil.example/projects/demo/preview?t=58",
    "//evil.example/projects/demo/preview?t=58",
    "/projects/demo/preview?t=-1",
    "/projects/demo/preview?t=58&next=https://evil.example",
    "/projects/demo/storyboard",
  ])("拒绝不安全 returnTo：%s", async (returnTo) => {
    const page = await ShotEditorPage({
      params: Promise.resolve({ shotId: "shot-06" }),
      searchParams: Promise.resolve({ returnTo }),
    });
    render(<DemoProjectProvider>{page}</DemoProjectProvider>);

    expect(screen.getByRole("link", { name: "返回故事板" })).toHaveAttribute(
      "href",
      "/projects/demo/storyboard",
    );
    expect(screen.queryByRole("link", { name: "返回预览" })).not.toBeInTheDocument();
  });
});
