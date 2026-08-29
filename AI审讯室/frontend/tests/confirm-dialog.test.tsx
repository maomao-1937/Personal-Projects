import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  it("has an accessible name and supports Escape", () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        title="确认提交结案报告？"
        description="提交后不可修改。"
        confirmLabel="确认结案"
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("dialog", { name: "确认提交结案报告？" })).toBeVisible();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps focus and restores it to the opener", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>打开报告确认</button>
          <ConfirmDialog
            open={open}
            title="确认提交结案报告？"
            description="提交后不可修改。"
            confirmLabel="确认结案"
            onConfirm={vi.fn()}
            onClose={() => setOpen(false)}
          />
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "打开报告确认" });
    opener.focus();
    fireEvent.click(opener);
    const cancel = screen.getByRole("button", { name: "返回检查" });
    const confirm = screen.getByRole("button", { name: "确认结案" });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(opener).toHaveFocus();
  });
});
