import Link from "next/link";
import { startOfDay, endOfDay, format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { TimerPanel } from "./timer-panel";
import { SessionList, type SessionRow } from "./session-list";
import type { Phase } from "./timer-store";

export default async function TimerPage() {
  const now = new Date();

  const [tasks, sessions] = await Promise.all([
    // 只列未完成的任务，已完成的没必要再挂番茄钟
    prisma.task.findMany({
      where: { completed: false },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true },
    }),
    prisma.pomodoroSession.findMany({
      where: { finishedAt: { gte: startOfDay(now), lte: endOfDay(now) } },
      orderBy: { finishedAt: "desc" },
      select: {
        id: true,
        phase: true,
        plannedSec: true,
        finishedAt: true,
        task: { select: { title: true } },
      },
    }),
  ]);

  const rows: SessionRow[] = sessions.map((s) => ({
    id: s.id,
    phase: s.phase as Phase,
    plannedSec: s.plannedSec,
    finishedAt: format(s.finishedAt, "HH:mm"),
    taskTitle: s.task?.title ?? null,
  }));

  const workSessions = sessions.filter((s) => s.phase === "WORK");
  const focusMin = Math.round(
    workSessions.reduce((sum, s) => sum + s.plannedSec, 0) / 60,
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            沉淀
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            今天完成 {workSessions.length} 次沉淀 · 专注 {focusMin} 分钟
          </p>
        </div>
        <Link
          href="/tasks"
          className="shrink-0 text-sm text-zinc-500 hover:underline"
        >
          去任务管理 →
        </Link>
      </div>

      <TimerPanel tasks={tasks} />

      <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
        <h2 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">
          今日记录
        </h2>
        <SessionList sessions={rows} />
      </div>
    </div>
  );
}
