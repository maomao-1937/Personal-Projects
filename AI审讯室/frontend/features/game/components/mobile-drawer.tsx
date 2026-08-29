"use client";

import { BookOpen, FileStack, NotebookPen, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type DrawerTab = "case" | "evidence" | "notes";

const TABS: Array<{ id: DrawerTab; label: string; icon: typeof BookOpen }> = [
  { id: "case", label: "档案", icon: BookOpen },
  { id: "evidence", label: "证据", icon: FileStack },
  { id: "notes", label: "笔记", icon: NotebookPen },
];

export function MobileDrawer({
  caseContent,
  evidenceContent,
  notesContent,
}: {
  caseContent: ReactNode;
  evidenceContent: ReactNode;
  notesContent: ReactNode;
}) {
  const [tab, setTab] = useState<DrawerTab | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!tab) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTab(null);
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [tab]);

  const content = tab === "case" ? caseContent : tab === "evidence" ? evidenceContent : notesContent;

  return (
    <>
      <nav className="mobile-tool-tabs" aria-label="审讯资料">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-expanded={tab === item.id}
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setTab(item.id);
            }}
          >
            <item.icon aria-hidden="true" size={17} />
            {item.label}
          </button>
        ))}
      </nav>
      {tab ? (
        <div className="drawer-backdrop" role="presentation" onMouseDown={() => setTab(null)}>
          <section
            ref={drawerRef}
            aria-label={`${TABS.find((item) => item.id === tab)?.label}抽屉`}
            aria-modal="true"
            className="mobile-drawer"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <p className="eyebrow">CASE MATERIAL</p>
              <button ref={closeRef} type="button" aria-label="关闭资料抽屉" onClick={() => setTab(null)}>
                <X aria-hidden="true" size={20} />
              </button>
            </header>
            <div className="mobile-drawer__content">{content}</div>
          </section>
        </div>
      ) : null}
    </>
  );
}
