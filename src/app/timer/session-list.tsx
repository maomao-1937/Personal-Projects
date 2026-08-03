"use client";

import { useTransition } from "react";
import { deleteSession } from "@/lib/actions/pomodoro";
import type { Phase } from "./timer-store";
import { PHASE_LABEL } from "./timer-store";

export type SessionRow = {
  id: string;
  phase: Phase;
  actualSec: number;
  finishedAt: string;
  taskTitle: string | null;
};

const PHASE_DOT: Record<Phase, string> = {
  WORK: "bg-red-500",
  SHORT_BREAK: "bg-emerald-500",
  LONG_BREAK: "bg-blue-500",
};

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        今天还没有完成的记录，跑完一段完整的沉淀就会出现在这里
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-black/[.06] dark:divide-white/[.08]">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
          <span className={`size-2 shrink-0 rounded-full ${PHASE_DOT[s.phase]}`} />
          <span className="w-16 shrink-0 text-zinc-600 dark:text-zinc-400">
            {PHASE_LABEL[s.phase]}
          </span>
          <span className="w-14 shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
            {Math.round(s.actualSec / 60)} 分
          </span>
          <span className="w-14 shrink-0 tabular-nums text-zinc-500">
            {s.finishedAt}
          </span>
          <span className="flex-1 truncate text-zinc-500">
            {s.taskTitle ?? "自由计时"}
          </span>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteSession(s.id);
              })
            }
            className="shrink-0 rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-red-600 disabled:opacity-40"
            aria-label="删除这条记录"
          >
            删除
          </button>
        </li>
      ))}
    </ul>
  );
}
