"use client";

import { useEffect, useState } from "react";

import { AccessGate } from "@/components/access-gate";
import { BrandMark } from "@/components/brand-mark";
import type { FeedbackPayload } from "@/components/feedback-control";
import { Workbench } from "@/components/workbench";
import {
  AccessStatus,
  AnalysisRequest,
  AnalysisResponse,
  ApiError,
  PublicConfig,
  api,
} from "@/lib/api";


const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  min_transcript_chars: 20,
  max_transcript_chars: 12_000,
  max_turns: 200,
  invite_usage_limit: 50,
  rubric_version: "qa-rubric-v1",
};


export function InspectorApp() {
  const [checking, setChecking] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<AnalysisResponse | null>(null);
  const [config, setConfig] = useState(DEFAULT_PUBLIC_CONFIG);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([api.getPublicConfig(), api.getAccessStatus()]).then(
      ([configResult, accessResult]) => {
        if (!active) return;
        if (configResult.status === "fulfilled") setConfig(configResult.value);
        if (accessResult.status === "fulfilled") {
          setAccess(accessResult.value);
        } else if (
          accessResult.reason instanceof ApiError &&
          accessResult.reason.status !== 401
        ) {
          setError(accessResult.reason.message);
        }
        setChecking(false);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  async function redeem(code: string) {
    setRedeeming(true);
    setError(null);
    try {
      const result = await api.redeemInvite(code);
      setAccess({ ...result, authenticated: true });
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError ? caught.message : "暂时无法验证邀请码，请稍后重试。",
      );
    } finally {
      setRedeeming(false);
    }
  }

  async function analyze(request: AnalysisRequest) {
    if (!access || analyzing || access.remaining_uses <= 0) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await api.analyze(request, {
        csrfToken: access.csrf_token,
        idempotencyKey: crypto.randomUUID(),
      });
      setReport(result);
      setAccess((current) =>
        current ? { ...current, remaining_uses: result.remaining_uses } : current,
      );
    } catch (caught: unknown) {
      if (caught instanceof ApiError && caught.status === 401) {
        setAccess(null);
        setError(caught.message);
        return;
      }
      setAnalysisError(
        caught instanceof ApiError ? caught.message : "这次质检没有完成，请稍后重试。",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  async function leave() {
    if (!access) return;
    try {
      await api.leaveAccess(access.csrf_token);
    } finally {
      setAccess(null);
      setReport(null);
      setAnalysisError(null);
    }
  }

  async function feedback(payload: FeedbackPayload) {
    if (!access || !report) return;
    await api.putFeedback(
      report.analysis_id,
      payload,
      access.csrf_token,
    );
  }

  if (checking) {
    return (
      <main className="boot-screen" id="main-content" aria-live="polite">
        <BrandMark />
        <span className="boot-line" aria-hidden="true" />
        <p>正在检查访问权限…</p>
      </main>
    );
  }

  if (!access) {
    return (
      <AccessGate
        busy={redeeming}
        error={error}
        onRedeem={redeem}
      />
    );
  }

  return (
    <Workbench
      access={access}
      analyzing={analyzing}
      config={config}
      error={analysisError}
      onAnalyze={analyze}
      onFeedback={feedback}
      onLeave={leave}
      report={report}
    />
  );
}
