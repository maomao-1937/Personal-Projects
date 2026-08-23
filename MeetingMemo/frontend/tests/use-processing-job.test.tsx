import { act, renderHook } from "@testing-library/react";

import { useProcessingJob, useProcessingJobs } from "@/hooks/use-processing-job";
import type { ProcessingJob } from "@/lib/types/api";

function job(status: ProcessingJob["status"]): ProcessingJob {
  return {
    id: "job-1",
    meeting_id: "meeting-1",
    job_type: "summary",
    status,
    attempts: status === "queued" ? 0 : 1,
    max_attempts: 3,
    error: null,
    created_at: "2026-08-23T02:31:00Z",
    updated_at: "2026-08-23T02:31:00Z",
  };
}

describe("useProcessingJob", () => {
  it("polls until a terminal state and then stops", async () => {
    vi.useFakeTimers();
    const getJob = vi
      .fn()
      .mockResolvedValueOnce(job("running"))
      .mockResolvedValueOnce(job("succeeded"));
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useProcessingJob({ getJob, onComplete, intervalMs: 1000 }),
    );

    act(() => result.current.start(job("queued")));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.job?.status).toBe("running");
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.job?.status).toBe("succeeded");
    expect(onComplete).toHaveBeenCalledWith(job("succeeded"));

    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(getJob).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("surfaces polling failures while retaining the active job for retry", async () => {
    vi.useFakeTimers();
    const getJob = vi.fn().mockRejectedValue(new Error("网络暂时不可用"));
    const { result } = renderHook(() =>
      useProcessingJob({ getJob, intervalMs: 1000 }),
    );

    act(() => result.current.start(job("queued")));
    await act(async () => vi.advanceTimersByTimeAsync(1000));

    expect(result.current.job?.status).toBe("queued");
    expect(result.current.pollingError).toBe("网络暂时不可用");
    vi.useRealTimers();
  });

  it("tracks multiple meetings and restores active jobs after a refresh", async () => {
    const stored = job("running");
    localStorage.setItem("meetingmemo.active-jobs.v1", JSON.stringify([stored]));
    const getJob = vi.fn().mockResolvedValue(stored);
    const { result } = renderHook(() =>
      useProcessingJobs({ getJob, intervalMs: 1000 }),
    );

    await act(async () => Promise.resolve());
    expect(result.current.jobs["meeting-1"]).toEqual(stored);

    act(() =>
      result.current.start({
        ...job("queued"),
        id: "job-2",
        meeting_id: "meeting-2",
      }),
    );
    expect(result.current.activeCount).toBe(2);
  });

  it("retries summary refresh before accepting a succeeded terminal state", async () => {
    vi.useFakeTimers();
    const getJob = vi.fn().mockResolvedValue(job("succeeded"));
    const onComplete = vi
      .fn()
      .mockRejectedValueOnce(new Error("摘要刷新失败"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() =>
      useProcessingJobs({ getJob, onComplete, intervalMs: 1000 }),
    );

    act(() => result.current.start(job("queued")));
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.jobs["meeting-1"].status).toBe("queued");
    expect(result.current.pollingErrors["meeting-1"]).toContain("摘要刷新失败");

    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.jobs["meeting-1"].status).toBe("succeeded");
    expect(onComplete).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
