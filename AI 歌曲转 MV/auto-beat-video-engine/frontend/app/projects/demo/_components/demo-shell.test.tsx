import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoShell } from "./demo-shell";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

describe("DemoShell", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/projects/demo/storyboard");
  });

  it("renders the three workspace destinations with the current destination announced", () => {
    render(
      <DemoShell>
        <p>工作区内容</p>
      </DemoShell>,
    );

    expect(screen.getByRole("link", { name: "故事板" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "镜头编辑" })).toHaveAttribute(
      "href",
      "/projects/demo/storyboard/shots/shot-06",
    );
    expect(screen.getByRole("link", { name: "预览" })).toHaveAttribute(
      "href",
      "/projects/demo/preview",
    );
    expect(screen.getByRole("link", { name: "跳到主内容" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.queryByText(/Fixture/)).not.toBeInTheDocument();
    expect(screen.getByText("未连接服务")).toBeVisible();
    expect(screen.queryByRole("button", { name: "打开账户菜单" })).not.toBeInTheDocument();
    expect(screen.getByText("LX")).toHaveAttribute("aria-label", "本地账户 LX");
  });

  it("窄屏不隐藏首个连接状态，并保留状态圆点样式", () => {
    render(
      <DemoShell>
        <p>工作区内容</p>
      </DemoShell>,
    );

    const connection = screen.getByText("未连接服务");
    const stylesheet = readFileSync(
      join(process.cwd(), "app/projects/demo/_components/demo-shell.module.css"),
      "utf8",
    );

    expect(connection.parentElement?.firstElementChild).toBe(connection);
    expect(stylesheet).not.toMatch(/\.projectStatus > span:first-child\s*\{\s*display:\s*none;/);
    expect(stylesheet).toMatch(/\.connection::before\s*\{/);
  });

  it.each([
    "/projects/demo/storyboard/shots/shot-01",
    "/projects/demo/storyboard/shots/shot-06",
    "/projects/demo/storyboard/shots/shot-08",
  ])("在任意镜头编辑路由 %s 标记镜头编辑为当前工作区", (pathname) => {
    usePathname.mockReturnValue(pathname);

    render(
      <DemoShell>
        <p>镜头编辑内容</p>
      </DemoShell>,
    );

    expect(screen.getByRole("link", { name: "镜头编辑" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "故事板" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
