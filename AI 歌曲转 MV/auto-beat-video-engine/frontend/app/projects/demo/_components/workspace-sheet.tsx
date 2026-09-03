"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import styles from "./workspace-sheet.module.css";

interface WorkspaceSheetProps {
  open: boolean;
  title: string;
  side: "right" | "bottom" | "full";
  triggerRef: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  width?: number;
}

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function WorkspaceSheet({
  children,
  onOpenChange,
  open,
  side,
  title,
  triggerRef,
  width,
}: WorkspaceSheetProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-workspace-sheet-close]")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [open, triggerRef]);

  if (!open || typeof document === "undefined") return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelector),
    ).filter((element) => element.getAttribute("aria-hidden") !== "true");

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;
    const activeElement = document.activeElement;
    const focusIsInsideDialog = dialog.contains(activeElement);

    if (event.shiftKey && (!focusIsInsideDialog || activeElement === firstElement)) {
      event.preventDefault();
      lastElement.focus();
    }

    if (!event.shiftKey && (!focusIsInsideDialog || activeElement === lastElement)) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return createPortal(
    <div
      className={styles.backdrop}
      data-testid="workspace-sheet-backdrop"
      onClick={(event) => {
        if (event.currentTarget === event.target) onOpenChange(false);
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`${styles.sheet} ${styles[side]}`}
        data-sheet-width={width}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        style={width ? ({ width: `min(${width}px, 100vw)` } satisfies CSSProperties) : undefined}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          <button
            aria-label={`关闭${title}`}
            className={styles.closeButton}
            data-workspace-sheet-close
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className={styles.content}>{children}</div>
      </section>
    </div>,
    document.body,
  );
}
