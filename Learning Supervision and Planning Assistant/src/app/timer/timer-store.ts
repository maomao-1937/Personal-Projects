import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Phase = "WORK" | "SHORT_BREAK" | "LONG_BREAK";

export type TimerConfig = {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  /** 每几个工作阶段后进入长休息 */
  longBreakEvery: number;
  soundOn: boolean;
  notifyOn: boolean;
};

export const DEFAULT_CONFIG: TimerConfig = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakEvery: 4,
  soundOn: true,
  notifyOn: true,
};

export const PHASE_LABEL: Record<Phase, string> = {
  WORK: "专注",
  SHORT_BREAK: "短休息",
  LONG_BREAK: "长休息",
};

type TimerState = {
  config: TimerConfig;
  /** 关联的任务 id，null 表示自由计时 */
  taskId: string | null;
  setConfig: (patch: Partial<TimerConfig>) => void;
  resetConfig: () => void;
  setTaskId: (taskId: string | null) => void;
};

/**
 * 只存「用户偏好」这类客户端瞬时/本地状态。
 * 已完成的番茄钟一律落库，不在这里留副本，避免和数据库对不上。
 */
export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      taskId: null,
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      resetConfig: () => set({ config: DEFAULT_CONFIG }),
      setTaskId: (taskId) => set({ taskId }),
    }),
    {
      name: "study-planner-timer",
      // taskId 不持久化：下次打开重新选，避免关联到已删除的任务
      partialize: (s) => ({ config: s.config }),
    },
  ),
);

export function phaseMinutes(phase: Phase, config: TimerConfig): number {
  if (phase === "WORK") return config.workMin;
  if (phase === "SHORT_BREAK") return config.shortBreakMin;
  return config.longBreakMin;
}

/** 给定「已完成的工作阶段数」，算出工作阶段结束后该进入哪种休息 */
export function nextBreak(finishedWorkCount: number, config: TimerConfig): Phase {
  const every = Math.max(1, config.longBreakEvery);
  return finishedWorkCount % every === 0 ? "LONG_BREAK" : "SHORT_BREAK";
}
