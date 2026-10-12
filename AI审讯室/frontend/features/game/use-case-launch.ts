"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { gameApi } from "./api";
import { caseRoutes, clearSessionId, storeSessionId, withSession } from "./session";

export type CaseLaunchState =
  | "IDLE"
  | "CEREMONY"
  | "GENERATING"
  | "LOCKING"
  | "COMPLETED"
  | "ERROR";

export type CaseLaunchCompletion = {
  caseId: string;
  sessionId: string;
};

export type UseCaseLaunchOptions = {
  introDurationMs?: number;
  lockedDurationMs?: number;
  onComplete?: (completion: CaseLaunchCompletion) => void | Promise<void>;
};

const PHASE_TEXT = ["正在检索档案...", "构建行为模型...", "核验证据链..."] as const;

const LEGACY_VISUAL_STATE: Record<CaseLaunchState, string> = {
  IDLE: "idle",
  CEREMONY: "intro",
  GENERATING: "generating",
  LOCKING: "locked",
  COMPLETED: "locked",
  ERROR: "error",
};

export function useCaseLaunch({
  introDurationMs = 0,
  lockedDurationMs = 0,
  onComplete,
}: UseCaseLaunchOptions = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState(0);
  const [lifecycleState, setLifecycleState] = useState<CaseLaunchState>("IDLE");
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const wait = useCallback((durationMs: number) => {
    if (durationMs <= 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        resolve();
      }, durationMs);
      timersRef.current.add(timer);
    });
  }, []);

  const clearPhaseTimers = useCallback((timers: number[]) => {
    timers.forEach((timer) => {
      window.clearTimeout(timer);
      timersRef.current.delete(timer);
    });
  }, []);

  const startPhaseTimers = useCallback(() => {
    return [8_000, 24_000].map((duration, index) => {
      const timer = window.setTimeout(() => {
        timersRef.current.delete(timer);
        if (mountedRef.current) setPhase(index + 1);
      }, duration);
      timersRef.current.add(timer);
      return timer;
    });
  }, []);

  const openCase = useCallback(
    async (caseId: string) => {
      const session = await gameApi.createSession(caseId);
      clearSessionId();
      storeSessionId(session.sessionId);
      if (mountedRef.current) setLifecycleState("LOCKING");
      await wait(lockedDurationMs);
      if (mountedRef.current) {
        setLifecycleState("COMPLETED");
        const completion = { caseId, sessionId: session.sessionId };
        if (onComplete) {
          await onComplete(completion);
        } else {
          router.push(withSession(caseRoutes(caseId).briefing, session.sessionId));
        }
      }
    },
    [lockedDurationMs, onComplete, router, wait],
  );

  const fail = useCallback((reason: unknown, fallbackMessage: string) => {
    if (!mountedRef.current) return;
    busyRef.current = false;
    setBusy(false);
    setError(reason instanceof Error ? reason.message : fallbackMessage);
    setLifecycleState("ERROR");
  }, []);

  const startGenerated = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPhase(0);
    setLifecycleState("CEREMONY");
    const phaseTimers = startPhaseTimers();
    let generationSettled = false;
    const generation = gameApi.generateCase().then(
      (value) => ({ ok: true as const, value }),
      (reason: unknown) => ({ ok: false as const, reason }),
    ).finally(() => {
      generationSettled = true;
    });

    try {
      await wait(introDurationMs);
      if (!generationSettled && mountedRef.current) setLifecycleState("GENERATING");
      const outcome = await generation;
      if (!outcome.ok) throw outcome.reason;
      await openCase(outcome.value.caseId);
    } catch (reason) {
      fail(reason, "案件档案暂时无法调取，请重试。");
    } finally {
      clearPhaseTimers(phaseTimers);
    }
  }, [clearPhaseTimers, fail, introDurationMs, openCase, startPhaseTimers, wait]);

  const startFallback = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setPhase(0);
    setLifecycleState("GENERATING");
    const phaseTimers = startPhaseTimers();
    try {
      const fallback = await gameApi.getFallbackCase();
      await openCase(fallback.caseId);
    } catch (reason) {
      fail(reason, "固定案件暂时无法调取，请重试。");
    } finally {
      clearPhaseTimers(phaseTimers);
    }
  }, [clearPhaseTimers, fail, openCase, startPhaseTimers]);

  return {
    busy,
    error,
    phaseText: PHASE_TEXT[phase],
    lifecycleState,
    visualState: LEGACY_VISUAL_STATE[lifecycleState],
    startGenerated,
    startFallback,
  };
}
