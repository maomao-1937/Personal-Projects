import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "@/app/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

describe("LandingPage", () => {
  it("keeps only the product identity, cinematic scene and access control", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: "AI 审讯室首页" })).toBeVisible();
    expect(screen.getByRole("region", { name: "AI 嫌疑人案件生成场景" })).toBeVisible();
    expect(screen.getByLabelText(
      "用 8 次提问，审讯一个会撒谎、却无法改写真相的 AI 嫌疑人。",
    )).toBeVisible();
    expect(screen.getByRole("button", { name: "生成案件" })).toBeVisible();
    expect(screen.getByRole("button", { name: "退出" })).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(2);

    expect(screen.queryByText("CASE SYSTEM / 12+")).not.toBeInTheDocument();
    expect(screen.queryByText("INTERROGATION READY")).not.toBeInTheDocument();
    expect(screen.queryByText("CASE-001")).not.toBeInTheDocument();
    expect(screen.queryByText("EVIDENCE")).not.toBeInTheDocument();
    expect(screen.queryByText("三步完成一次审讯")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SYSTEM|VERSION|CASE-/i)).not.toBeInTheDocument();
  });
});
