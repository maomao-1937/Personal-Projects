"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function LoadingState({ label = "正在整理学习内容…" }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <span className="state-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  eyebrow,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="state-card state-card--empty">
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="button button--primary" href={actionHref}>
        {actionLabel}
      </Link>
    </div>
  );
}

export function ErrorState({
  title = "这一步没有完成",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-card state-card--error" role="alert">
      <span className="eyebrow">可恢复错误</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

