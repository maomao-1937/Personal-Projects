import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { WorkspaceSheet } from "./workspace-sheet";

function SheetExample({
  onOpenChange = vi.fn(),
}: {
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button ref={triggerRef} type="button">
        打开镜头设置
      </button>
      <WorkspaceSheet
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          setOpen(nextOpen);
        }}
        open={open}
        side="right"
        title="镜头设置"
        triggerRef={triggerRef}
      >
        <button type="button">应用更改</button>
        <button type="button">重置设置</button>
      </WorkspaceSheet>
    </>
  );
}

describe("WorkspaceSheet", () => {
  it("exposes a labelled modal dialog and initially focuses its close control", () => {
    const triggerRef = createRef<HTMLButtonElement>();

    render(
      <>
        <button ref={triggerRef} type="button">
          打开镜头设置
        </button>
        <WorkspaceSheet
          onOpenChange={vi.fn()}
          open
          side="right"
          title="镜头设置"
          triggerRef={triggerRef}
        >
          <p>调整镜头参数。</p>
        </WorkspaceSheet>
      </>,
    );

    const dialog = screen.getByRole("dialog", { name: "镜头设置" });
    const heading = screen.getByRole("heading", { name: "镜头设置" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", heading.id);
    expect(screen.getByRole("button", { name: "关闭镜头设置" })).toHaveFocus();
  });

  it("keeps Tab and Shift + Tab within the sheet", async () => {
    const user = userEvent.setup();
    render(<SheetExample />);

    const closeButton = screen.getByRole("button", { name: "关闭镜头设置" });
    const applyButton = screen.getByRole("button", { name: "应用更改" });
    const resetButton = screen.getByRole("button", { name: "重置设置" });

    await user.tab();
    expect(applyButton).toHaveFocus();
    await user.tab();
    expect(resetButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(resetButton).toHaveFocus();
  });

  it("closes on Escape and restores focus to its trigger", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<SheetExample onOpenChange={onOpenChange} />);

    const trigger = screen.getByRole("button", { name: "打开镜头设置" });
    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(trigger).toHaveFocus();
  });

  it("closes when its backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<SheetExample onOpenChange={onOpenChange} />);

    await user.click(screen.getByTestId("workspace-sheet-backdrop"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("locks body scrolling while open and restores it when unmounted", () => {
    const triggerRef = createRef<HTMLElement>();
    document.body.style.overflow = "auto";

    const { unmount } = render(
      <WorkspaceSheet
        onOpenChange={vi.fn()}
        open
        side="bottom"
        title="镜头设置"
        triggerRef={triggerRef}
      >
        <p>调整镜头参数。</p>
      </WorkspaceSheet>,
    );

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
