import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileDrawer } from "@/features/game/components/mobile-drawer";

describe("MobileDrawer", () => {
  it("moves focus into the drawer, traps it, and restores the trigger", () => {
    render(
      <MobileDrawer
        caseContent={<button type="button">档案内容按钮</button>}
        evidenceContent={<p>证据内容</p>}
        notesContent={<p>笔记内容</p>}
      />,
    );

    const opener = screen.getByRole("button", { name: "档案" });
    fireEvent.click(opener);
    const close = screen.getByRole("button", { name: "关闭资料抽屉" });
    const contentButton = screen.getByRole("button", { name: "档案内容按钮" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(contentButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(opener).toHaveFocus();
  });
});
