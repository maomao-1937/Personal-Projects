"use client";

import { useCallback, useEffect, useState } from "react";

import { gameApi, AppError } from "./api";
import { getSessionId, storeSessionId } from "./session";
import type { GameSession, PublicCase } from "./types";

export function useGameData(
  caseId: string,
  { createIfMissing = false }: { createIfMissing?: boolean } = {},
) {
  const [caseData, setCaseData] = useState<PublicCase | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentSessionId = getSessionId(window.location.search);
      const casePromise = gameApi.getCase(caseId);
      let sessionPromise: Promise<GameSession>;
      if (currentSessionId) {
        sessionPromise = gameApi.getSession(currentSessionId).catch((reason: unknown) => {
          if (createIfMissing && reason instanceof AppError && reason.code === "SESSION_NOT_FOUND") {
            return gameApi.createSession(caseId);
          }
          throw reason;
        });
      } else if (createIfMissing) {
        sessionPromise = gameApi.createSession(caseId);
      } else {
        throw new AppError("SESSION_REQUIRED", "请先从免费案件入口开始一局审讯。", 400);
      }
      const [nextCase, nextSession] = await Promise.all([casePromise, sessionPromise]);
      if (nextSession.caseId !== caseId) {
        throw new AppError("CASE_SESSION_MISMATCH", "这份审讯记录属于另一宗案件，请重新进入。", 409);
      }
      storeSessionId(nextSession.sessionId);
      setCaseData(nextCase);
      setSession(nextSession);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "案件资料暂时无法读取。请重试。");
    } finally {
      setLoading(false);
    }
  }, [caseId, createIfMissing]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  return { caseData, session, setSession, loading, error, retry: load };
}
