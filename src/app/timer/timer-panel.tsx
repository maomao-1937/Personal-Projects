"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { logSession } from "@/lib/actions/pomodoro";
import { usePomodoro } from "./use-pomodoro";
import { PHASE_LABEL, useTimerStore, type Phase } from "./timer-store";
import { ensureNotifyPermission, notify, playChime, unlockAudio } from "./alert";
import { ConfigPanel } from "./config-panel";

export type TaskOption = { id: string; title: string };

const RING = 120;
const STROKE = 10;
const CIRCUMFERENCE = 2 * Math.PI * RING;

const PHASE_COLOR: Record<Phase, string> = {
  WORK: "#ef4444",
  SHORT_BREAK: "#10b981",
  LONG_BREAK: "#3b82f6",
};

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerPanel({ tasks }: { tasks: TaskOption[] }) {
  const router = useRouter();
  const config = useTimerStore((s) => s.config);
  const taskId = useTimerStore((s) => s.taskId);
  const setTaskId = useTimerStore((s) => s.setTaskId);
  const [logError, setLogError] = useState<string | null>(null);

  const handleComplete = useCallback(
    (phase: Phase, plannedMin: number, actualSec: number) => {
      if (config.soundOn) {
        playChime(phase === "WORK" ? "work-end" : "break-end");
      }
      if (config.notifyOn) {
        notify(
          phase === "WORK" ? "专注结束" : "休息结束",
          phase === "WORK" ? "起来走两步，休息一下" : "回来继续下一段沉淀",
        );
      }

      void logSession({
        phase,
        plannedMin,
        actualSec,
        taskId: phase === "WORK" ? taskId : null,
      }).then((res) => {
        if (res.ok) {
          setLogError(null);
          router.refresh();
        } else {
          setLogError(res.error ?? "记录失败");
        }
      });
    },
    [config.soundOn, config.notifyOn, taskId, router],
  );

  const timer = usePomodoro(handleComplete);
  const running = timer.status === "running";

  // 标签页标题跟着倒计时走，切到别的标签也能看到剩余时间
  useEffect(() => {
    const base = "沉淀 · 学习监督规划助手";
    document.title = running
      ? `${formatClock(timer.remainingSec)} ${PHASE_LABEL[timer.phase]} · 沉淀`
      : base;
    return () => {
      document.title = base;
    };
  }, [running, timer.remainingSec, timer.phase]);

  // 运行中离开页面前提醒一下，避免手滑关掉丢掉这一段
  useEffect(() => {
    if (!running) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [running]);

  const handleStart = async () => {
    unlockAudio();
    if (config.notifyOn) await ensureNotifyPermission();
    timer.start();
  };

  const color = PHASE_COLOR[timer.phase];
  const dashOffset = CIRCUMFERENCE * (1 - timer.progress);
  const every = Math.max(1, config.longBreakEvery);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-sm font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {PHASE_LABEL[timer.phase]}
          </span>
          <span className="text-sm text-zinc-500">
            第 {(timer.workDone % every) + (timer.phase === "WORK" ? 1 : 0) || every} / {every} 轮
          </span>
        </div>

        <div className="relative">
          <svg
            width={(RING + STROKE) * 2}
            height={(RING + STROKE) * 2}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={RING + STROKE}
              cy={RING + STROKE}
              r={RING}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-zinc-200 dark:stroke-zinc-800"
            />
            <motion.circle
              cx={RING + STROKE}
              cy={RING + STROKE}
              r={RING}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.3, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={timer.phase}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="font-mono text-5xl font-semibold tabular-nums text-black dark:text-zinc-50"
              role="timer"
              aria-live="off"
            >
              {formatClock(timer.remainingSec)}
            </motion.span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {running ? (
            <button
              onClick={timer.pause}
              className="rounded-lg bg-black px-6 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              暂停
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="rounded-lg bg-black px-6 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              {timer.status === "paused" ? "继续" : "开始"}
            </button>
          )}
          <button
            onClick={timer.reset}
            className="rounded-lg border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145]"
          >
            重置本段
          </button>
          <button
            onClick={timer.skip}
            className="rounded-lg border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145]"
          >
            跳过
          </button>
          <button
            onClick={timer.resetCycle}
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:underline"
          >
            整轮重来
          </button>
        </div>

        <p className="text-center text-xs text-zinc-500">
          只有完整跑完的阶段才会记入统计，重置和跳过都不会留下记录
        </p>
        {logError && <p className="text-sm text-red-600">{logError}</p>}
      </div>

      <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
        <label
          htmlFor="task-picker"
          className="text-sm font-medium text-black dark:text-zinc-50"
        >
          本次专注的任务
        </label>
        <select
          id="task-picker"
          value={taskId ?? ""}
          onChange={(e) => setTaskId(e.target.value || null)}
          className="mt-2 w-full rounded-lg border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-zinc-900"
        >
          <option value="">自由计时（不关联任务）</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-zinc-500">
          {tasks.length === 0
            ? "还没有未完成的任务，先去任务管理里加几个"
            : "只在专注阶段记录关联，休息阶段不算到任务上"}
        </p>
      </div>

      <ConfigPanel disabled={running} />
    </div>
  );
}
