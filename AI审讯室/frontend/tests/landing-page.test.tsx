import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "@/app/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

describe("LandingPage", () => {
  it("states the product loop and exposes one primary curated-case action", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: "AI 审讯室首页" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "审问每个人。证据只认事实。" })).toBeVisible();
    expect(screen.getByText("审问嫌疑人，核对证据，在 12 次提问内提交你的结案判断。")).toBeVisible();
    expect(screen.getByRole("button", { name: /进入精修案件/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /浏览案件库/ })).toHaveAttribute("href", "/cases");
    expect(screen.getByRole("article", { name: "当前主案卷" })).toBeVisible();
    expect(screen.getByText("3 名")).toBeVisible();
    expect(screen.getByText("12 次")).toBeVisible();
    expect(screen.queryByText("用 8 次提问")).not.toBeInTheDocument();
  });
});
