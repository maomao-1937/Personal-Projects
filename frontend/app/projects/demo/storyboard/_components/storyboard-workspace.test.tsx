import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { StoryboardWorkspace } from "./storyboard-workspace";

describe("StoryboardWorkspace shell", () => {
  it("renders the approved project, progress, audio, and scene hierarchy", () => {
    render(<StoryboardWorkspace />);

    expect(screen.getByRole("banner")).toHaveTextContent("声画");
    expect(screen.getByLabelText("项目进度")).toHaveTextContent("镜头");
    expect(screen.getByLabelText("音频波形")).toHaveTextContent("BPM 124");
    expect(screen.getByRole("navigation", { name: "场景" })).toHaveTextContent(
      "霁虹街区",
    );
  });

  it("selects scenes and cuts using stable local preview state", async () => {
    const user = userEvent.setup();
    render(<StoryboardWorkspace />);

    await user.click(screen.getByRole("button", { name: /选择场景 01/ }));
    expect(screen.getByRole("heading", { name: /雨夜车站/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /选择场景 02/ }));
    await user.click(screen.getByRole("button", { name: /选择 Cut 06/ }));
    expect(screen.getByRole("complementary", { name: "Cut 编辑" })).toHaveTextContent(
      "生成失败",
    );
  });

  it("retries only Cut 06 and preserves succeeded Cut 04", async () => {
    const user = userEvent.setup();
    render(<StoryboardWorkspace />);

    await user.click(screen.getByRole("button", { name: "重试 Cut 06" }));

    expect(screen.getByTestId("cut-cut-06")).toHaveTextContent("排队中");
    expect(screen.getByTestId("cut-cut-04")).toHaveTextContent("已完成");
  });

  it("saves a local draft, marks Preview stale, and starts a local rebuild", async () => {
    const user = userEvent.setup();
    render(<StoryboardWorkspace />);

    await user.clear(screen.getByLabelText("视频提示词"));
    await user.type(screen.getByLabelText("视频提示词"), "新的镜头提示词");
    await user.click(screen.getByRole("button", { name: "保存修改" }));

    expect(screen.getByRole("status")).toHaveTextContent("修改已保存到界面预览");
    expect(screen.getByText("预览需要更新")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重新构建预览" }));
    expect(screen.getByText("预览构建中")).toBeInTheDocument();
  });
});
