"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ProcessingJob } from "@/lib/types/api";

const activeStates = new Set(["queued", "running"]);
const storageKey = "meetingmemo.active-jobs.v1";

interface UseProcessingJobOptions {
  getJob: (jobId: string) => Promise<ProcessingJob>;
  onComplete?: (job: ProcessingJob) => void | Promise<void>;
  intervalMs?: number;
}

type JobMap = Record<string, ProcessingJob>;
type ErrorMap = Record<string, string>;

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "无法获取处理进度，正在重试";
}

function readStoredJobs(): JobMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(stored)) return {};
    return Object.fromEntries(
      stored
        .filter(
          (item): item is ProcessingJob =>
            typeof item === "object" &&
            item !== null &&
            "id" in item &&
            "meeting_id" in item &&
            "status" in item &&
            activeStates.has(String(item.status)),
        )
        .map((item) => [item.meeting_id, item]),
    );
  } catch {
    return {};
  }
}

export function useProcessingJobs({
  getJob,
  onComplete,
  intervalMs = 1500,
}: UseProcessingJobOptions) {
  const [jobs, setJobs] = useState<JobMap>({});
  const [pollingErrors, setPollingErrors] = useState<ErrorMap>({});
  const getJobRef = useRef(getJob);
  const onCompleteRef = useRef(onComplete);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getJobRef.current = getJob;
    onCompleteRef.current = onComplete;
  }, [getJob, onComplete]);

  useEffect(() => {
    setJobs(readStoredJobs());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const activeJobs = Object.values(jobs).filter((item) => activeStates.has(item.status));
    window.localStorage.setItem(storageKey, JSON.stringify(activeJobs));
  }, [hydrated, jobs]);

  const start = useCallback((nextJob: ProcessingJob) => {
    setJobs((current) => ({ ...current, [nextJob.meeting_id]: nextJob }));
    setPollingErrors((current) => {
      const next = { ...current };
      delete next[nextJob.meeting_id];
      return next;
    });
  }, []);

  const clear = useCallback((meetingId?: string) => {
    if (!meetingId) {
      window.localStorage.removeItem(storageKey);
      setJobs({});
      setPollingErrors({});
      return;
    }
    setJobs((current) => {
      const next = { ...current };
      delete next[meetingId];
      return next;
    });
    setPollingErrors((current) => {
      const next = { ...current };
      delete next[meetingId];
      return next;
    });
  }, []);

  useEffect(() => {
    const activeJobs = Object.values(jobs).filter((item) => activeStates.has(item.status));
    if (!activeJobs.length) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      if (!active) return;
      if (document.visibilityState === "hidden") {
        setJobs((current) => ({ ...current }));
        return;
      }

      await Promise.all(
        activeJobs.map(async (currentJob) => {
          try {
            const next = await getJobRef.current(currentJob.id);
            if (!active) return;
            if (next.status === "succeeded") {
              try {
                await onCompleteRef.current?.(next);
              } catch (cause) {
                if (!active) return;
                setPollingErrors((current) => ({
                  ...current,
                  [next.meeting_id]: `摘要已生成，但刷新失败：${errorMessage(cause)}`,
                }));
                setJobs((current) => ({ ...current }));
                return;
              }
            }
            setJobs((current) => ({ ...current, [next.meeting_id]: next }));
            setPollingErrors((current) => {
              const updated = { ...current };
              delete updated[next.meeting_id];
              return updated;
            });
          } catch (cause) {
            if (!active) return;
            setPollingErrors((current) => ({
              ...current,
              [currentJob.meeting_id]: errorMessage(cause),
            }));
            setJobs((current) => ({ ...current }));
          }
        }),
      );
    }, intervalMs);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [intervalMs, jobs]);

  return {
    jobs,
    start,
    clear,
    pollingErrors,
    activeCount: Object.values(jobs).filter((item) => activeStates.has(item.status)).length,
  };
}

export function useProcessingJob({
  getJob,
  onComplete,
  intervalMs = 1500,
}: UseProcessingJobOptions) {
  const multiple = useProcessingJobs({ getJob, onComplete, intervalMs });
  const job = Object.values(multiple.jobs)[0] ?? null;
  return {
    job,
    start: multiple.start,
    clear: () => multiple.clear(job?.meeting_id),
    pollingError: job ? multiple.pollingErrors[job.meeting_id] ?? null : null,
  };
}
