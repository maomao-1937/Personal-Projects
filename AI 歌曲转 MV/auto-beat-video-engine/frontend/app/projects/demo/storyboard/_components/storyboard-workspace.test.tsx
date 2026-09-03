import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoShell } from "../../_components/demo-shell";
import { DemoProjectProvider } from "../../_components/demo-project-provider";
import { demoProject } from "../../_lib/fixture";
import type { DemoProject } from "../../_lib/types";
import { QUICK_EDIT_CLICK_DELAY_MS } from "./storyboard-card";
import { StoryboardWorkspace } from "./storyboard-workspace";

const navigation = vi.hoisted(() => ({ push: vi.fn(), usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: navigation.usePathname,
  useRouter: () => ({ push: navigation.push }),
}));

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
}

function renderWorkspace(project: DemoProject = demoProject) {
  return render(
    <DemoProjectProvider initialProject={project}>
      <DemoShell>
        <StoryboardWorkspace />
      </DemoShell>
    </DemoProjectProvider>,
  );
}

function getShotCard(number: number) {
  return screen.getByRole("article", {
    name: new RegExp(`镜头 ${String(number).padStart(2, "0")}`),
  });
}

function getShotAction(number: number) {
  return within(getShotCard(number)).getByRole("link", {
    name: new RegExp(`编辑镜头 ${String(number).padStart(2, "0")}`),
  });
}

function dispatchGuardedNavigationClick(action: HTMLElement, init: MouseEventInit) {
  let componentPreventedDefault: boolean | undefined;
  document.addEventListener(
    "click",
    (event) => {
      componentPreventedDefault = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  action.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
  return componentPreventedDefault;
}

describe("StoryboardWorkspace", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.usePathname.mockReturnValue("/projects/demo/storyboard");
    setViewportWidth(1280);
  });

  it("呈现媒体优先的页面结构并移除旧工作区", () => {
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "故事板" })).toBeVisible();
    expect(screen.getByLabelText("视觉概念")).toBeVisible();
    expect(screen.getByRole("button", { name: "生成全部" })).toBeEnabled();
    expect(screen.queryByText(/¥|价格|成本|预计预算/)).not.toBeInTheDocument();
    const generationParameters = screen.getByLabelText("生成参数");
    expect(generationParameters).toHaveTextContent("720p");
    expect(generationParameters).toHaveTextContent("约 60% 生成视频");
    expect(generationParameters).toHaveTextContent("中高一致性");
    expect(screen.queryByLabelText(/生成模型|模型档位/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Qwen|Wan|Kling|Vidu/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("音频波形")).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Cut 编辑" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Preview 状态")).not.toBeInTheDocument();
  });

  it("生成全部反馈仅说明镜头数和预计耗时", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "生成全部" }));

    expect(screen.getByRole("status")).toHaveTextContent("8 个镜头");
    expect(screen.getByRole("status")).toHaveTextContent("约 8–12 分钟");
    expect(screen.getByRole("status")).not.toHaveTextContent(/模型|档位|Qwen|Wan|Kling|Vidu/);
    expect(screen.getByRole("status")).not.toHaveTextContent(/Fixture|Local fixture|演示|¥|价格|成本|预计预算/);
  });

  it("展示默认生成参数且不暴露模型选择或路线", () => {
    renderWorkspace();
    const summary = screen.getByLabelText("生成参数");

    expect(summary).not.toHaveTextContent(/¥|价格|成本|预计预算/);
    expect(summary).toHaveTextContent("720p");
    expect(summary).toHaveTextContent("约 60% 生成视频");
    expect(summary).toHaveTextContent("中高一致性");
    expect(summary).not.toHaveTextContent(/模型|档位|Qwen|Wan|Kling|Vidu/);
  });

  it("用八组真实响应式海报呈现 16:9 镜头媒体", () => {
    const { container } = renderWorkspace();

    expect(screen.getAllByRole("article")).toHaveLength(8);
    expect(container.querySelectorAll("picture")).toHaveLength(8);
    expect(container.querySelectorAll("picture > img")).toHaveLength(8);

    const firstCard = getShotCard(1);
    const firstAction = getShotAction(1);
    const firstMedia = within(firstCard).getByLabelText("镜头 01 媒体");
    const image = within(firstMedia).getByRole("img", { name: "雨夜站台" });
    const source = firstMedia.querySelector("source");

    expect(firstMedia).toHaveStyle({ aspectRatio: "16 / 9" });
    expect(image).toHaveAttribute("src", "/demo/after-rain/posters/scene-01-800.webp");
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).toHaveAttribute(
      "sizes",
      "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc((100vw - 152px) / 2), (max-width: 1279px) calc((100vw - 168px) / 3), (max-width: 1599px) calc((100vw - 176px) / 4), 358px",
    );
    expect(within(getShotCard(2)).getByRole("img")).toHaveAttribute("loading", "lazy");
    expect(source).toHaveAttribute(
      "srcset",
      "/demo/after-rain/posters/scene-01-400.webp 400w, /demo/after-rain/posters/scene-01-800.webp 800w, /demo/after-rain/posters/scene-01-1200.webp 1200w",
    );
    expect(firstCard).not.toHaveAttribute("tabindex");
    expect(firstAction).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-01",
    );
    expect(firstAction).toHaveAccessibleDescription(
      "单击快速编辑；双击或按 Enter 打开完整编辑器",
    );
  });

  it("让合法 Link 覆盖整卡交互而不包裹 picture、标题或描述", () => {
    renderWorkspace();

    const firstCard = getShotCard(1);
    const action = getShotAction(1);

    expect(action.tagName).toBe("A");
    expect(action.querySelector("picture, h2, p")).toBeNull();
    expect(within(firstCard).getByRole("heading", { name: "雨夜站台" })).toBeVisible();
    expect(within(firstCard).getByText(demoProject.shots[0]?.description ?? "")).toBeVisible();
  });

  it("从镜头数据派生总时长与就绪数量", () => {
    const project: DemoProject = {
      ...demoProject,
      shots: demoProject.shots.map((shot, index) =>
        index === 0 ? { ...shot, durationSec: 12 } : shot,
      ),
    };

    renderWorkspace(project);

    expect(screen.getByLabelText("8 个镜头 · 01:10")).toBeVisible();
    expect(screen.getByText("2 个画面已就绪")).toBeVisible();
  });

  it("将运行、失败和 Override 作为画面层状态表达", () => {
    renderWorkspace();

    const runningCard = getShotCard(3);
    expect(within(runningCard).getByRole("progressbar", { name: "镜头 03 生成进度" })).toHaveAttribute(
      "aria-valuenow",
      "54",
    );

    const failedCard = getShotCard(5);
    const failedMedia = within(failedCard).getByLabelText("镜头 05 媒体");
    expect(within(failedMedia).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(failedCard).getByRole("alert")).toHaveTextContent(
      "服务暂时不可用，可重新生成。",
    );

    const overrideCard = getShotCard(7);
    expect(within(overrideCard).getByText("已覆盖全局风格")).toBeVisible();
    expect(within(overrideCard).getByLabelText("已覆盖全局风格标记")).toHaveAttribute(
      "data-color",
      "purple",
    );
  });

  it("在桌面单击打开 Quick Edit，Escape 关闭后恢复焦点", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const card = getShotAction(1);

    await user.click(card);
    expect(
      await screen.findByRole("dialog", { name: "快速编辑 · 镜头 01" }),
    ).toBeVisible();
    expect(screen.getByLabelText("画面描述")).toHaveValue(
      "雨后高架站台，短发女性穿深灰长风衣，紫蓝霓虹反射，电影感。",
    );

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card).toHaveFocus();
  });

  it("桌面单击延迟打开 Quick Edit，第二击保留 Link 导航语义", () => {
    vi.useFakeTimers();
    try {
      renderWorkspace();
      const action = getShotAction(2);

      const firstClick = new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
      action.dispatchEvent(firstClick);
      expect(firstClick.defaultPrevented).toBe(true);
      vi.advanceTimersByTime(250);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      expect(dispatchGuardedNavigationClick(action, { detail: 2 })).toBe(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("在小于 768px 时单击直接进入 Shot Editor", async () => {
    setViewportWidth(767);
    renderWorkspace();

    const action = getShotAction(6);
    expect(dispatchGuardedNavigationClick(action, { detail: 1 })).toBe(false);
    expect(action).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-06",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["Meta", { metaKey: true }],
    ["Ctrl", { ctrlKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["非左键", { button: 1 }],
  ])("%s + 桌面单击完全放行 Link 原生导航", (_label, modifiers) => {
    vi.useFakeTimers();
    try {
      renderWorkspace();
      const action = getShotAction(3);

      expect(
        dispatchGuardedNavigationClick(action, { detail: 1, ...modifiers }),
      ).toBe(false);
      vi.advanceTimersByTime(QUICK_EDIT_CLICK_DELAY_MS + 1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("只在 hover 或 focus 时挂载一段 muted preview", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspace();
    const firstCard = getShotAction(1);
    const secondCard = getShotAction(2);

    expect(container.querySelectorAll("video")).toHaveLength(0);

    await user.hover(firstCard);
    expect(container.querySelectorAll("video")).toHaveLength(1);
    const video = container.querySelector("video");
    expect(video).toHaveProperty("muted", true);
    expect(video).toHaveAttribute(
      "src",
      "/demo/after-rain/media/scene-01-preview.mp4",
    );
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "metadata");

    await user.hover(secondCard);
    expect(container.querySelectorAll("video")).toHaveLength(0);

    await user.unhover(secondCard);
    expect(container.querySelectorAll("video")).toHaveLength(0);

    fireEvent.focus(firstCard);
    expect(container.querySelectorAll("video")).toHaveLength(1);
    fireEvent.blur(firstCard);
    expect(container.querySelectorAll("video")).toHaveLength(0);
  });

  it("仅为 available Artifact 挂载 hover 预览并动态汇总就绪画面", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkspace();

    expect(screen.getByText("2 个画面已就绪")).toBeVisible();
    await user.hover(getShotAction(5));
    expect(container.querySelector("video")).not.toBeInTheDocument();
    await user.hover(getShotAction(6));
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("快速编辑使用受控草稿并明确应用到共享本地项目", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(getShotAction(1));
    const prompt = await screen.findByLabelText("画面描述");
    await user.clear(prompt);
    await user.type(prompt, "更近的雨夜站台特写");
    await user.selectOptions(screen.getByLabelText("镜头运动"), "手持漂移");
    await user.click(screen.getByRole("button", { name: "应用到本地项目" }));
    expect(screen.getByText("已应用到本地项目")).toBeVisible();

    await user.keyboard("{Escape}");
    await user.click(getShotAction(1));
    expect(await screen.findByLabelText("画面描述")).toHaveValue(
      "更近的雨夜站台特写",
    );
    expect(screen.getByLabelText("镜头运动")).toHaveValue("手持漂移");
  });

  it("Quick Edit 任一草稿字段变化后清除已应用状态", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(getShotAction(1));
    const apply = await screen.findByRole("button", { name: "应用到本地项目" });
    await user.click(apply);
    expect(screen.getByText("已应用到本地项目")).toBeVisible();

    await user.type(screen.getByLabelText("画面描述"), "更新");
    expect(screen.queryByText("已应用到本地项目")).not.toBeInTheDocument();
    await user.click(apply);
    expect(screen.getByText("已应用到本地项目")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("镜头运动"), "固定镜头");
    expect(screen.queryByText("已应用到本地项目")).not.toBeInTheDocument();
  });

  it("重试只将目标失败镜头转为处理中", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const succeededCard = getShotCard(4);
    const failedCard = getShotCard(5);

    expect(within(succeededCard).getByText("已生成")).toBeVisible();
    await user.click(within(failedCard).getByRole("button", { name: "重试 Scene 05" }));

    expect(within(failedCard).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(failedCard).getByText("排队中")).toBeVisible();
    expect(within(succeededCard).getByText("已生成")).toBeVisible();
  });

  it("切换镜头时将 Quick Edit 的镜头运动重置为所选镜头值", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(getShotAction(1));
    const firstMotion = await screen.findByLabelText("镜头运动");
    await user.selectOptions(firstMotion, "固定镜头");
    expect(firstMotion).toHaveValue("固定镜头");
    await user.keyboard("{Escape}");

    await user.click(getShotAction(2));
    expect(await screen.findByLabelText("镜头运动")).toHaveValue("横向跟随");
  });

  it("提供窄屏全局生成摘要并使用共享 Sheet 展开完整控制", async () => {
    setViewportWidth(390);
    const user = userEvent.setup();
    renderWorkspace();

    const summary = screen.getByLabelText("全局生成摘要");
    expect(summary).toHaveTextContent("720p");
    expect(summary).not.toHaveTextContent(/¥|价格|成本|预计预算/);

    await user.click(within(summary).getByRole("button", { name: "打开全局生成设置" }));

    const dialog = screen.getByRole("dialog", { name: "全局生成设置" });
    expect(within(dialog).queryByLabelText(/生成模型|模型档位/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "生成全部" })).toBeEnabled();
  });
});
