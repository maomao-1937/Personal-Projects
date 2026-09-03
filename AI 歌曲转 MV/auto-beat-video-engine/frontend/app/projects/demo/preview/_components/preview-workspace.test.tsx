import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoProject } from "../../_lib/fixture";
import { DemoProjectProvider } from "../../_components/demo-project-provider";
import { createTake } from "../../_lib/state";
import type { DemoProject, PreviewStatus, TimelineAnalysis } from "../../_lib/types";
import { ShotEditorWorkspace } from "../../storyboard/shots/[shotId]/_components/shot-editor-workspace";
import { ReadonlyTimeline } from "../../storyboard/shots/[shotId]/_components/readonly-timeline";
import PreviewPage from "../page";
import { PreviewTimeline } from "./preview-timeline";
import { PreviewWorkspace } from "./preview-workspace";

function projectWithPreview(status: PreviewStatus): DemoProject {
  return { ...demoProject, preview: { status } };
}

function renderPreview(project: DemoProject = demoProject, initialTime = 58) {
  return render(
    <DemoProjectProvider initialProject={project}>
      <PreviewWorkspace initialTime={initialTime} />
    </DemoProjectProvider>,
  );
}

describe("PreviewWorkspace", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("呈现 16:9 大 Stage、输出规格、唯一导出 CTA 与完整时间线层", () => {
    const { container } = renderPreview();

    expect(screen.getByRole("heading", { name: "预览" })).toBeVisible();
    expect(screen.getByLabelText("整片预览 Stage")).toHaveAttribute("data-aspect", "16:9");
    expect(screen.getByText("16:9")).toBeVisible();
    expect(screen.getByText("1920 × 1080")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "导出" })).toHaveLength(1);
    expect(screen.getByLabelText("视频轨")).toBeVisible();
    expect(screen.getByLabelText("音频轨")).toBeVisible();
    expect(screen.getByLabelText("Beat 标记")).toBeVisible();
    expect(screen.getByLabelText("段落标记")).toBeVisible();
    expect(screen.getByLabelText("歌词标记")).toBeVisible();
    expect(screen.getByLabelText("场景转场")).toBeVisible();

    const previews = container.querySelectorAll("[data-preview-src]");
    expect(previews).toHaveLength(8);
    previews.forEach((preview, index) => {
      const scene = String(index + 1).padStart(2, "0");
      expect(preview).toHaveAttribute(
        "data-preview-src",
        `/demo/after-rain/media/scene-${scene}-preview.mp4`,
      );
    });
  });

  it("替换同一 timelineAnalysis 时 Preview 与 Shot Editor 的全部分析层同步变化", () => {
    const firstAnalysis: TimelineAnalysis = {
      rulerTicks: [{ id: "tick-a", label: "A 刻度", timeSec: 16.5 }],
      waveformSamples: [{ amplitude: 30, timeSec: 16.5 }],
      beats: [{ id: "beat-a", timeSec: 16.5 }],
      sections: [{ id: "section-a", label: "A 段", startSec: 16.5, endSec: 49.5 }],
      lyrics: [{ id: "lyric-a", text: "A 句", timeSec: 49.5 }],
    };
    const secondAnalysis: TimelineAnalysis = {
      rulerTicks: [{ id: "tick-b", label: "B 刻度", timeSec: 33 }],
      waveformSamples: [{ amplitude: 18, timeSec: 33 }],
      beats: [{ id: "beat-b", timeSec: 33 }],
      sections: [{ id: "section-b", label: "B 段", startSec: 0, endSec: 16.5 }],
      lyrics: [{ id: "lyric-b", text: "B 句", timeSec: 16.5 }],
    };
    const renderPair = (analysis: TimelineAnalysis) => (
      <>
        <PreviewTimeline
          analysis={analysis}
          currentTime={0}
          onSelectShot={() => undefined}
          returnTo="/projects/demo/preview?t=0"
          shots={demoProject.shots}
        />
        <ReadonlyTimeline
          analysis={analysis}
          currentShotId="shot-01"
          shots={demoProject.shots}
        />
      </>
    );
    const { rerender } = render(renderPair(firstAnalysis));

    for (const timeline of [
      screen.getByLabelText("预览时间线"),
      screen.getByLabelText("只读时间线"),
    ]) {
      expect(timeline.querySelector('[data-ruler-time-sec="16.5"]')).toHaveStyle({ left: "25%" });
      expect(timeline.querySelector('[data-waveform-time-sec="16.5"]')).toHaveStyle({ left: "25%" });
      expect(timeline.querySelector('[data-beat-time-sec="16.5"]')).toHaveStyle({ left: "25%" });
      expect(timeline.querySelector('[data-section-id="section-a"]')).toHaveStyle({
        left: "25%",
        width: "50%",
      });
      expect(timeline.querySelector('[data-lyric-time-sec="49.5"]')).toHaveStyle({ left: "75%" });
    }

    rerender(renderPair(secondAnalysis));

    for (const timeline of [
      screen.getByLabelText("预览时间线"),
      screen.getByLabelText("只读时间线"),
    ]) {
      expect(timeline.querySelector('[data-ruler-time-sec="16.5"]')).not.toBeInTheDocument();
      expect(timeline.querySelector('[data-ruler-time-sec="33"]')).toHaveStyle({ left: "50%" });
      expect(timeline.querySelector('[data-waveform-time-sec="16.5"]')).not.toBeInTheDocument();
      expect(timeline.querySelector('[data-waveform-time-sec="33"]')).toHaveStyle({ left: "50%" });
      expect(timeline.querySelector('[data-beat-time-sec="16.5"]')).not.toBeInTheDocument();
      expect(timeline.querySelector('[data-beat-time-sec="33"]')).toHaveStyle({ left: "50%" });
      expect(timeline.querySelector('[data-section-id="section-a"]')).not.toBeInTheDocument();
      expect(timeline.querySelector('[data-section-id="section-b"]')).toHaveStyle({
        left: "0%",
        width: "25%",
      });
      expect(timeline.querySelector('[data-lyric-time-sec="16.5"]')).toHaveStyle({ left: "25%" });
    }
  });

  it("只挂载播放头所在可用场景的视频并从 t=0 初始化播放头", () => {
    const { container } = renderPreview(demoProject, 0);

    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(container.querySelector("video")).toHaveAttribute("preload", "metadata");
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "/demo/after-rain/media/scene-01-preview.mp4",
    );
    expect(screen.getByLabelText("播放头 00:00")).toHaveAttribute("data-time", "0");
  });

  it("缺失片段使用修复入口并在返回地址中保留播放头", () => {
    renderPreview();

    expect(screen.getByText("预览需要更新")).toBeVisible();
    expect(screen.queryByText("预览已就绪")).not.toBeInTheDocument();
    const repairLink = screen.getByRole("link", { name: /修复 Scene 06/ });
    expect(repairLink).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-06?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D58",
    );
    expect(repairLink).toHaveAttribute("data-missing", "true");
  });

  it("从 Preview 修复 Scene 06 后将播放头四舍五入到最多两位小数并准确返回", () => {
    const { unmount } = renderPreview(demoProject, 58.375);
    const repairHref = screen.getByRole("link", { name: /修复 Scene 06/ }).getAttribute("href");
    const returnTo = repairHref
      ? new URLSearchParams(repairHref.split("?")[1]).get("returnTo")
      : null;
    expect(returnTo).toBe("/projects/demo/preview?t=58.38");

    unmount();
    render(
      <DemoProjectProvider>
        <ShotEditorWorkspace
          returnTo={returnTo ?? undefined}
          shotId="shot-06"
        />
      </DemoProjectProvider>,
    );

    expect(screen.getByRole("link", { name: "返回预览" })).toHaveAttribute(
      "href",
      "/projects/demo/preview?t=58.38",
    );
  });

  it.each([
    ["stale", "预览需要更新"],
    ["building", "正在构建预览"],
    ["failed", "预览构建失败"],
  ] as const)("%s 状态不得出现预览已就绪", (status, expectedMessage) => {
    renderPreview(projectWithPreview(status));

    expect(screen.getByText(expectedMessage)).toBeVisible();
    expect(screen.queryByText("预览已就绪")).not.toBeInTheDocument();
  });

  it("仅在 Stage 自身聚焦时响应 Space 播放快捷键", () => {
    renderPreview(demoProject, 0);
    const stage = screen.getByLabelText("整片预览 Stage");

    fireEvent.keyDown(document.body, { key: " " });
    expect(stage).toHaveAttribute("data-playback", "paused");

    stage.focus();
    fireEvent.keyDown(stage, { key: " " });
    expect(stage).toHaveAttribute("data-playback", "playing");

    const exportButton = screen.getByRole("button", { name: "导出" });
    exportButton.focus();
    fireEvent.keyDown(exportButton, { key: " " });
    expect(stage).toHaveAttribute("data-playback", "playing");
  });

  it("用当前视频 timeupdate 按镜头时长推进全局播放头", () => {
    const { container } = renderPreview(demoProject, 0);
    const video = container.querySelector("video");
    if (!video) throw new Error("Expected active preview video");
    Object.defineProperty(video, "duration", { configurable: true, value: 2.5 });
    video.currentTime = 1.25;

    fireEvent.timeUpdate(video);

    expect(screen.getByLabelText("播放头 00:04")).toHaveAttribute("data-time", "4");
  });

  it("视频结束后跳过处理中 Artifact 并保持连续播放", async () => {
    const user = userEvent.setup();
    const { container } = renderPreview(demoProject, 0);
    await user.click(screen.getByRole("button", { name: "播放整片预览" }));
    fireEvent.ended(container.querySelector("video") as HTMLVideoElement);

    const stage = screen.getByLabelText("整片预览 Stage");
    expect(stage).toHaveAttribute("data-playback", "playing");
    expect(container.querySelectorAll("video[preload=metadata]")).toHaveLength(1);
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "/demo/after-rain/media/scene-04-preview.mp4",
    );
    expect(screen.getByLabelText("播放头 00:24")).toHaveAttribute("data-time", "24");
  });

  it("连续播放跳过失败与缺失 Artifact 并进入下一可用 Scene", async () => {
    const user = userEvent.setup();
    const projectWithScene07Available: DemoProject = {
      ...demoProject,
      shots: demoProject.shots.map((shot) =>
        shot.id === "shot-07" ? { ...shot, artifactStatus: "available" } : shot,
      ),
    };
    const { container } = renderPreview(projectWithScene07Available, 24);
    await user.click(screen.getByRole("button", { name: "播放整片预览" }));
    fireEvent.ended(container.querySelector("video") as HTMLVideoElement);

    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "/demo/after-rain/media/scene-07-preview.mp4",
    );
    expect(screen.getByLabelText("播放头 00:48")).toHaveAttribute("data-time", "48");
    expect(screen.getByLabelText("整片预览 Stage")).toHaveAttribute(
      "data-playback",
      "playing",
    );
  });

  it("播放头命中 Scene 06 时显示缺失占位与修复入口且不挂视频", () => {
    const { container } = renderPreview(demoProject, 40);

    expect(screen.getByLabelText("Scene 06 缺失片段")).toBeVisible();
    expect(screen.getByRole("link", { name: "修复 Scene 06" })).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-06?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D40",
    );
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("播放头命中 processing Artifact 时显示处理中占位且不提供修复入口", () => {
    const { container } = renderPreview(demoProject, 9);
    const stage = screen.getByLabelText("整片预览 Stage");

    expect(within(stage).getByLabelText("Scene 02 Artifact 处理中")).toBeVisible();
    expect(within(stage).queryByRole("link", { name: "修复 Scene 02" })).not.toBeInTheDocument();
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("Artifact 变为 available 后 Scene 06 占位消失且只挂载一个视频", () => {
    const repairedProject = createTake(demoProject, "shot-06", {
      prompt: "修复后的高架桥下",
      cameraMotion: "手持漂移",
      advanced: { seed: "9090", resolution: "1080p" },
      modelTierId: "quality",
    });
    const { container } = renderPreview(repairedProject, 40);

    expect(screen.queryByLabelText("Scene 06 缺失片段")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "修复 Scene 06" })).not.toBeInTheDocument();
    expect(container.querySelectorAll("video")).toHaveLength(1);
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "/demo/after-rain/media/scene-06-preview.mp4",
    );
  });

  it("即使 Preview 存储为 ready，任一 Artifact 不可用时仍派生为需要更新", () => {
    renderPreview(projectWithPreview("ready"), 0);

    expect(screen.getByText("预览需要更新")).toBeVisible();
    expect(screen.queryByText("预览已就绪")).not.toBeInTheDocument();
  });

  it("跨分钟时间码使用 mm:ss", () => {
    renderPreview(demoProject, 60);

    expect(screen.getByText("01:00 / 01:06")).toBeVisible();
    expect(screen.getByLabelText("播放头 01:00")).toHaveAttribute("data-time", "60");
  });

  it("受控导出配置实时更新摘要、确认后保存在 Preview 本地状态", async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("button", { name: "导出" }));

    const dialog = screen.getByRole("dialog", { name: "导出设置" });
    expect(dialog).toHaveAttribute("data-sheet-width", "360");
    expect(within(dialog).getByLabelText("格式")).toHaveValue("mp4");
    expect(within(dialog).getByLabelText("分辨率")).toHaveValue("1080p");
    expect(within(dialog).getByLabelText("字幕")).toBeChecked();
    expect(within(dialog).getByLabelText("平台预设")).toHaveValue("bilibili");

    await user.selectOptions(within(dialog).getByLabelText("格式"), "mov");
    await user.selectOptions(within(dialog).getByLabelText("分辨率"), "4k");
    await user.click(within(dialog).getByLabelText("字幕"));
    await user.selectOptions(within(dialog).getByLabelText("平台预设"), "youtube");
    const summary = within(dialog).getByLabelText("导出配置摘要");
    expect(summary).toHaveTextContent("MOV · ProRes");
    expect(summary).toHaveTextContent("3840 × 2160");
    expect(summary).toHaveTextContent("无字幕");
    expect(summary).toHaveTextContent("YouTube 1080p");

    await user.click(
      within(dialog).getByRole("button", { name: "保存导出设置" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("本地导出配置已更新");
    expect(screen.queryByRole("dialog", { name: "导出设置" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "导出" }));
    const reopenedDialog = screen.getByRole("dialog", { name: "导出设置" });
    expect(within(reopenedDialog).getByLabelText("格式")).toHaveValue("mov");
    expect(within(reopenedDialog).getByLabelText("分辨率")).toHaveValue("4k");
    expect(within(reopenedDialog).getByLabelText("字幕")).not.toBeChecked();
    expect(within(reopenedDialog).getByLabelText("平台预设")).toHaveValue("youtube");
  });
});

describe("PreviewPage", () => {
  it("把 t 查询参数传给 Preview 工作区", async () => {
    const page = await PreviewPage({ searchParams: Promise.resolve({ t: "58" }) });
    render(<DemoProjectProvider>{page}</DemoProjectProvider>);

    expect(screen.getByLabelText("播放头 00:58")).toHaveAttribute("data-time", "58");
  });
});
