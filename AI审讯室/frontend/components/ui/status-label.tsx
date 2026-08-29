import type { ReactNode } from "react";

export function StatusLabel({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "selected" | "effective" | "ineffective" | "error";
}) {
  return <span className={`status-label status-label--${tone}`}>{children}</span>;
}

