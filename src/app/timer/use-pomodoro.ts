"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  nextBreak,
  phaseMinutes,
  useTimerStore,
  type Phase,
} from "./timer-store";

type Status = "idle" | "running" | "paused";

/**
 * 计时核心。
 *
 * 关键点：不用「每秒减一」的计数器，而是记住这一段的 endAt 时间戳，
 * 每次 tick 用 endAt - Date.now() 反算剩余秒数。这样切标签页、
 * 息屏、浏览器降频 setInterval 都不会让时间跑偏。
 */
export function usePomodoro(
  onPhaseComplete: (phase: Phase, plannedMin: number, actualSec: number) => void,
) {
  const config = useTimerStore((s) => s.config);

  const [phase, setPhase] = useState<Phase>("WORK");
  const [status, setStatus] = useState<Status>("idle");
  /** 仅在 running / paused 时有意义；idle 时显示值由配置直接推导 */
  const [liveSec, setLiveSec] = useState(0);
  /** 本轮已完成的工作阶段数，用于决定长休息时机 */
  const [workDone, setWorkDone] = useState(0);

  const endAtRef = useRef<number | null>(null);
  const completeRef = useRef(onPhaseComplete);

  useEffect(() => {
    completeRef.current = onPhaseComplete;
  }, [onPhaseComplete]);

  const totalSec = phaseMinutes(phase, config) * 60;
  // 空闲时直接跟随配置，这样改设置立刻反映在表盘上，不需要副作用同步
  const remainingSec = status === "idle" ? totalSec : liveSec;

  const goToPhase = useCallback(
    (next: Phase, autoStart: boolean) => {
      const secs = phaseMinutes(next, config) * 60;
      setPhase(next);
      setLiveSec(secs);
      if (autoStart) {
        endAtRef.current = Date.now() + secs * 1000;
        setStatus("running");
      } else {
        endAtRef.current = null;
        setStatus("idle");
      }
    },
    [config],
  );

  // 阶段跑完：落库 + 自动推进到下一阶段（工作→休息，休息→工作）
  const finishPhase = useCallback(() => {
    const planned = phaseMinutes(phase, config);
    completeRef.current(phase, planned, planned * 60);

    if (phase === "WORK") {
      const done = workDone + 1;
      setWorkDone(done);
      goToPhase(nextBreak(done, config), true);
    } else {
      goToPhase("WORK", true);
    }
  }, [phase, config, workDone, goToPhase]);

  useEffect(() => {
    if (status !== "running") return;

    const tick = () => {
      const endAt = endAtRef.current;
      if (endAt === null) return;
      const left = Math.round((endAt - Date.now()) / 1000);
      if (left <= 0) {
        setLiveSec(0);
        finishPhase();
      } else {
        setLiveSec(left);
      }
    };

    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [status, finishPhase]);

  const start = useCallback(() => {
    setLiveSec(remainingSec);
    endAtRef.current = Date.now() + remainingSec * 1000;
    setStatus("running");
  }, [remainingSec]);

  const pause = useCallback(() => {
    const endAt = endAtRef.current;
    if (endAt !== null) {
      setLiveSec(Math.max(0, Math.round((endAt - Date.now()) / 1000)));
    }
    endAtRef.current = null;
    setStatus("paused");
  }, []);

  /** 放弃当前阶段：不落库，回到该阶段的起点 */
  const reset = useCallback(() => {
    goToPhase(phase, false);
  }, [goToPhase, phase]);

  /** 手动跳过当前阶段：同样不算完成，不落库 */
  const skip = useCallback(() => {
    if (phase === "WORK") {
      const done = workDone + 1;
      setWorkDone(done);
      goToPhase(nextBreak(done, config), false);
    } else {
      goToPhase("WORK", false);
    }
  }, [phase, workDone, config, goToPhase]);

  /** 整轮重来：计数归零，回到专注阶段 */
  const resetCycle = useCallback(() => {
    setWorkDone(0);
    goToPhase("WORK", false);
  }, [goToPhase]);

  return {
    phase,
    status,
    remainingSec,
    workDone,
    progress: totalSec > 0 ? 1 - remainingSec / totalSec : 0,
    start,
    pause,
    reset,
    skip,
    resetCycle,
  };
}
