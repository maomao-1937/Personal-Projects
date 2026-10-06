import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gameApi } from "@/features/game/api";
import { StartCaseButton } from "@/features/game/components/start-case-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("StartCaseButton", () => {
  afterEach(() => { vi.restoreAllMocks(); push.mockReset(); });

  it("opens the composer without generating a random case", () => {
    vi.spyOn(gameApi, "generateCase");
    render(<StartCaseButton />);
    fireEvent.click(screen.getByRole("button", { name: "开始免费案件" }));
    expect(push).toHaveBeenCalledWith("/");
    expect(gameApi.generateCase).not.toHaveBeenCalled();
  });

  it("preserves custom labels and styles for the next-case entry", () => {
    render(<StartCaseButton label="生成下一案" variant="dark" />);
    const button = screen.getByRole("button", { name: "生成下一案" });
    expect(button).toHaveClass("button--dark");
    fireEvent.click(button);
    expect(push).toHaveBeenCalledWith("/");
  });
});
