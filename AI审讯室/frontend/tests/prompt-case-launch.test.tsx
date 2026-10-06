import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameApi } from "@/features/game/api";
import { CinematicCaseLaunch } from "@/features/game/components/cinematic-case-launch";
import { StartCaseButton } from "@/features/game/components/start-case-button";

const push = vi.fn();
const idea = "博物馆闭馆后，一幅展画被调包";
const label = "你想审讯什么样的案件？";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
function fillPrompt(text = idea) {
  fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value: text } });
}

describe("Player case composer", () => {
  beforeEach(() => {
    vi.useFakeTimers(); push.mockReset(); localStorage.clear();
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("disables empty, whitespace-only and overlong prompts", () => {
    vi.spyOn(gameApi, "generateCase");
    render(<CinematicCaseLaunch />);
    const button = screen.getByRole("button", { name: "生成案件" });
    expect(button).toBeDisabled();
    fillPrompt(" \n "); expect(button).toBeDisabled();
    fillPrompt("案".repeat(501)); expect(button).toBeDisabled();
    expect(screen.getByText("案件想法最多 500 字，请缩短后再生成。")).toBeVisible();
    fireEvent.submit(button.closest("form")!);
    expect(gameApi.generateCase).not.toHaveBeenCalled();
    fillPrompt("案".repeat(500)); expect(button).toBeEnabled();
  });

  it("offers three examples that fill the editable prompt without submitting", () => {
    vi.spyOn(gameApi, "generateCase"); render(<CinematicCaseLaunch />);
    const buttons = screen.getByRole("group", { name: "试试这些案件方向" }).querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      fireEvent.click(button);
      expect(screen.getByRole("textbox", { name: label })).toHaveValue(button.textContent);
    }
    expect(gameApi.generateCase).not.toHaveBeenCalled();
  });

  it("trims the prompt, locks duplicate submits and keeps truthful loading text", async () => {
    vi.spyOn(gameApi, "generateCase").mockReturnValue(new Promise(() => {}));
    render(<CinematicCaseLaunch />); fillPrompt(`  ${idea}\n`);
    const button = screen.getByRole("button", { name: "生成案件" });
    const textbox = screen.getByRole("textbox", { name: label });
    const examples = screen.getByRole("group", { name: "试试这些案件方向" });
    fireEvent.submit(button.closest("form")!); fireEvent.submit(button.closest("form")!);
    expect(gameApi.generateCase).toHaveBeenCalledExactlyOnceWith({ prompt: idea });
    expect(button).toBeDisabled(); expect(textbox).toBeDisabled();
    expect(examples.querySelectorAll("button:disabled")).toHaveLength(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(28_000); });
    expect(screen.getByRole("status")).toHaveTextContent("正在理解你的案件方向并生成案件");
    expect(screen.getByRole("status")).not.toHaveTextContent("核验证据链");
  });

  it("restores visible input and replays the intro when retrying with an edited idea", async () => {
    vi.spyOn(gameApi, "generateCase").mockRejectedValueOnce(new Error("新案件暂时无法生成"))
      .mockReturnValueOnce(new Promise(() => {}));
    const { container } = render(<CinematicCaseLaunch />); fillPrompt();
    fireEvent.click(screen.getByRole("button", { name: "生成案件" }));
    const composer = container.querySelector(".cinematic-copy") as HTMLElement;
    expect(composer.style.opacity).toBe("0");
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("新案件暂时无法生成");
    expect(screen.getByRole("textbox", { name: label })).toHaveValue(idea);
    expect(screen.getByRole("textbox", { name: label })).toBeEnabled();
    expect(composer).toBeVisible(); expect(composer.style.filter).toBe(""); expect(composer.style.transform).toBe("");
    fillPrompt("图书馆的珍贵手稿失踪了");
    fireEvent.click(screen.getByRole("button", { name: "重新生成案件" }));
    expect(gameApi.generateCase).toHaveBeenLastCalledWith({ prompt: "图书馆的珍贵手稿失踪了" });
    expect(composer.style.opacity).toBe("0"); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("returns the next-case button to the composer, preserving label and variant", () => {
    vi.spyOn(gameApi, "generateCase");
    render(<StartCaseButton label="生成下一案" variant="dark" />);
    const button = screen.getByRole("button", { name: "生成下一案" });
    expect(button).toHaveClass("button--dark"); fireEvent.click(button);
    expect(push).toHaveBeenCalledWith("/"); expect(gameApi.generateCase).not.toHaveBeenCalled();
  });

  it("describes explicit fixed-case loading as retrieval rather than prompt generation", async () => {
    vi.spyOn(gameApi, "generateCase").mockRejectedValue(new Error("生成失败"));
    vi.spyOn(gameApi, "getFallbackCase").mockReturnValue(new Promise(() => {}));
    render(<CinematicCaseLaunch />); fillPrompt();
    fireEvent.click(screen.getByRole("button", { name: "生成案件" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    fireEvent.click(screen.getByRole("button", { name: "改用精修固定案继续体验" }));
    expect(screen.getByRole("status")).toHaveTextContent("正在调取精修固定案件");
    expect(screen.getByRole("status")).not.toHaveTextContent("理解你的案件方向");
  });
});
