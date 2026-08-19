"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type {
  PracticeAttempt,
  TrainingView,
} from "@/server/repositories/training-repository";

export type TrainingPanelTraining = TrainingView;

interface TrainingPanelProps {
  initialTraining: TrainingPanelTraining;
  session: { id: string; title: string };
  nextConcept: { id: string; title: string } | null;
}

interface ApiErrorPayload {
  error?: { code?: string; message?: string; resourceId?: string };
}

interface FailedRequest {
  clientRequestId: string;
  attemptId?: string;
  answer: string;
}

const stageLabels = {
  initial_explanation: "首次解释",
  validation_probe: "验证追问",
  targeted_probe: "针对性追问",
  support: "分级提示",
  retest: "重新解释",
  complete: "本轮完成",
} as const;

export function TrainingPanel({
  initialTraining,
  session,
  nextConcept,
}: TrainingPanelProps) {
  const router = useRouter();
  const latestAttempt = initialTraining.attempts.at(-1);
  const recoverableAttempt =
    latestAttempt?.processingStatus === "failed" &&
    latestAttempt.errorMessage === "AI 判断失败，请重试" &&
    latestAttempt.conceptVersion === initialTraining.concept.stateVersion
      ? latestAttempt
      : undefined;
  const [training, setTraining] = useState(initialTraining);
  const [answer, setAnswer] = useState(recoverableAttempt?.userAnswer ?? "");
  const shouldStart = ["not_started", "needs_review"].includes(
    initialTraining.concept.status,
  );
  const [requesting, setRequesting] = useState<
    "start" | "submit" | "support" | "abandon" | null
  >(shouldStart ? "start" : null);
  const [error, setError] = useState<string | null>(
    recoverableAttempt?.errorMessage ?? null,
  );
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(
    recoverableAttempt
      ? {
          clientRequestId: recoverableAttempt.clientRequestId,
          attemptId: recoverableAttempt.id,
          answer: recoverableAttempt.userAnswer,
        }
      : null,
  );

  useEffect(() => {
    if (!shouldStart) return;
    let active = true;

    void fetch(`/api/concepts/${initialTraining.concept.id}/start`, {
      method: "POST",
    })
      .then(async (response) => {
        const payload = (await response.json()) as ApiErrorPayload & {
          data?: TrainingPanelTraining;
        };
        if (!response.ok || !payload.data) {
          throw new Error(payload.error?.message ?? "开始训练失败，请重试");
        }
        if (active) setTraining(payload.data);
      })
      .catch((startError: unknown) => {
        if (active)
          setError(
            startError instanceof Error ? startError.message : "开始训练失败，请重试",
          );
      })
      .finally(() => {
        if (active) setRequesting(null);
      });

    return () => {
      active = false;
    };
  }, [initialTraining.concept.id, shouldStart]);

  const lastCompletedAttempt = useMemo(
    () =>
      [...training.attempts]
        .reverse()
        .find((attempt) => attempt.processingStatus === "completed"),
    [training.attempts],
  );

  const submit = async (retry = false) => {
    const cleanAnswer = answer.trim();
    if (cleanAnswer.length < 2) {
      setError("请至少写 2 个字符，再提交你的解释");
      return;
    }

    const activeRequest: FailedRequest = retry && failedRequest
      ? failedRequest
      : {
          clientRequestId: crypto.randomUUID(),
          answer: cleanAnswer,
        };
    setRequesting("submit");
    setError(null);

    try {
      const response = await fetch(
        `/api/concepts/${training.concept.id}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientRequestId: activeRequest.clientRequestId,
            userAnswer: activeRequest.answer,
            ...(activeRequest.attemptId
              ? { retryAttemptId: activeRequest.attemptId }
              : {}),
          }),
        },
      );
      const payload = (await response.json()) as ApiErrorPayload & {
        data?: {
          attempt: PracticeAttempt;
          training: TrainingPanelTraining;
        };
      };

      if (!response.ok) {
        if (payload.error?.code === "CONFLICT") {
          setFailedRequest(null);
          setError(payload.error.message ?? "训练进度已更新，请刷新后继续");
          window.location.reload();
          return;
        }
        setFailedRequest({
          ...activeRequest,
          attemptId: payload.error?.resourceId ?? activeRequest.attemptId,
        });
        setError(payload.error?.message ?? "判断失败，你的回答仍保留在这里");
        return;
      }
      if (!payload.data) {
        setError("服务返回内容不完整，请稍后重试");
        return;
      }
      if (payload.data.attempt.processingStatus !== "completed") {
        setFailedRequest({
          ...activeRequest,
          attemptId: payload.data.attempt.id,
        });
        setError(
          payload.data.attempt.processingStatus === "pending"
            ? "这次判断仍在处理中，请稍后重试"
            : payload.data.attempt.errorMessage ?? "这次判断需要重试",
        );
        return;
      }

      setTraining(payload.data.training);
      setAnswer("");
      setFailedRequest(null);
    } catch {
      setFailedRequest(activeRequest);
      setError("网络连接中断。回答仍在输入框中，可使用同一请求重试");
    } finally {
      setRequesting(null);
    }
  };

  const requestSupport = async () => {
    setRequesting("support");
    setError(null);
    try {
      const response = await fetch(
        `/api/concepts/${training.concept.id}/support`,
        { method: "POST" },
      );
      const payload = (await response.json()) as ApiErrorPayload & {
        data?: TrainingPanelTraining;
      };
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "提示生成失败，请稍后再试");
        return;
      }
      setTraining(payload.data);
    } catch {
      setError("网络连接失败，请稍后再试");
    } finally {
      setRequesting(null);
    }
  };

  const abandon = async () => {
    setRequesting("abandon");
    setError(null);
    try {
      const response = await fetch(
        `/api/concepts/${training.concept.id}/abandon`,
        { method: "POST" },
      );
      if (!response.ok) {
        const payload = (await response.json()) as ApiErrorPayload;
        setError(payload.error?.message ?? "暂时无法结束训练");
        return;
      }
      router.push(`/sessions/${session.id}`);
      router.refresh();
    } catch {
      setError("网络连接失败，请稍后再试");
    } finally {
      setRequesting(null);
    }
  };

  const restart = async () => {
    setRequesting("start");
    setError(null);
    try {
      const response = await fetch(`/api/concepts/${training.concept.id}/start`, {
        method: "POST",
      });
      const payload = (await response.json()) as ApiErrorPayload & {
        data?: TrainingPanelTraining;
      };
      if (!response.ok || !payload.data) {
        setError(payload.error?.message ?? "重新训练启动失败，请稍后再试");
        return;
      }
      setTraining(payload.data);
      setAnswer("");
      setFailedRequest(null);
    } catch {
      setError("网络连接失败，请稍后再试");
    } finally {
      setRequesting(null);
    }
  };

  if (training.concept.trainingStage === "complete") {
    return (
      <TrainingResult
        training={training}
        session={session}
        nextConcept={nextConcept}
        onRestart={() => void restart()}
        restarting={requesting === "start"}
        error={error}
      />
    );
  }

  const showSupport = ["targeted_probe", "support"].includes(
    training.concept.trainingStage,
  );
  const isRetest = training.concept.trainingStage === "retest";

  return (
    <div className="training-layout">
      <section className="training-main glass-card">
        <header className="training-main__header">
          <span className="stage-chip">
            {stageLabels[training.concept.trainingStage]}
          </span>
          <span>{training.attempts.length} 次回答</span>
        </header>

        {isRetest ? (
          <div className="retest-banner">
            <strong>现在请重新完整解释</strong>
            <span>不要照抄提示，把概念重新组织成你自己的话。</span>
          </div>
        ) : null}

        {training.concept.currentSupportContent ? (
          <div className="support-card">
            <span>Level {training.concept.supportLevel} 支持</span>
            <p>{training.concept.currentSupportContent}</p>
          </div>
        ) : null}

        <div className="current-question" data-testid="current-question">
          <span className="eyebrow">AI 的当前问题</span>
          <h2>{training.concept.currentQuestion}</h2>
          <p>先别查现成答案。把你的思路、因果关系和例子都讲出来。</p>
        </div>

        <div className="answer-field">
          <label htmlFor="training-answer">你的解释</label>
          <textarea
            id="training-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="像讲给一个第一次接触这个概念的人那样说明…"
            disabled={requesting !== null}
          />
          <div className="answer-field__footer">
            <span>{answer.length.toLocaleString("zh-CN")} / 8,000</span>
            <button
              className="button button--primary"
              type="button"
              onClick={() => void submit(false)}
              disabled={requesting !== null}
            >
              {requesting === "submit"
                ? "AI 正在判断…"
                : isRetest
                  ? "提交重新解释"
                  : "提交解释"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="form-alert" role="alert">
            <span>{error}</span>
            {failedRequest ? (
              <button
                type="button"
                onClick={() => void submit(true)}
                disabled={requesting !== null}
              >
                重试这次判断
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="training-actions">
          {showSupport ? (
            <button
              className="button button--soft"
              type="button"
              onClick={() => void requestSupport()}
              disabled={requesting !== null || training.concept.supportLevel >= 3}
            >
              {supportButtonLabel(training.concept.supportLevel)}
            </button>
          ) : (
            <span className="training-actions__note">答完后，AI 会给一个验证或针对性问题。</span>
          )}
          <button
            className="button button--ghost"
            type="button"
            onClick={() => void abandon()}
            disabled={requesting !== null}
          >
            暂停，稍后复习
          </button>
        </div>
      </section>

      <aside className="training-aside">
        <div className="training-context glass-card">
          <span className="eyebrow">当前知识点</span>
          <h1>{training.concept.title}</h1>
          <p>{training.concept.description}</p>
          <Link href={`/sessions/${session.id}`}>← 返回学习地图</Link>
        </div>
        {lastCompletedAttempt ? (
          <AssessmentFeedback attempt={lastCompletedAttempt} />
        ) : (
          <div className="feedback-empty glass-card">
            <span>先讲一遍</span>
            <p>提交后，这里会整理你已经理解、仍有遗漏和可能误解的地方。</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function AssessmentFeedback({ attempt }: { attempt: PracticeAttempt }) {
  return (
    <div className="feedback-card glass-card" aria-label="本次判断结果">
      <FeedbackGroup
        className="feedback-group--good"
        title="已经理解"
        items={attempt.understoodPoints}
      />
      <FeedbackGroup
        className="feedback-group--missing"
        title="还需想清楚"
        items={attempt.missingPoints}
      />
      <FeedbackGroup
        className="feedback-group--wrong"
        title="存在误解"
        items={attempt.misconceptions}
      />
    </div>
  );
}

function FeedbackGroup({
  title,
  items,
  className,
}: {
  title: string;
  items: string[];
  className: string;
}) {
  return (
    <section className={`feedback-group ${className}`}>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>本轮暂未发现</p>
      )}
    </section>
  );
}

function TrainingResult({
  training,
  session,
  nextConcept,
  onRestart,
  restarting,
  error,
}: {
  training: TrainingPanelTraining;
  session: { id: string; title: string };
  nextConcept: { id: string; title: string } | null;
  onRestart: () => void;
  restarting: boolean;
  error: string | null;
}) {
  const mastered = training.concept.status === "mastered";
  const understood = Array.from(
    new Set(training.attempts.flatMap((attempt) => attempt.understoodPoints)),
  );

  return (
    <section className={`training-result training-result--${training.concept.status}`}>
      <div className="result-hero glass-card">
        <span className="result-orbit" aria-hidden="true" />
        <span className="eyebrow">{mastered ? "验证通过" : "本轮完成"}</span>
        <h2>
          {mastered ? "这个知识点已经讲明白了" : "先停在这里，稍后回来复习"}
        </h2>
        <p>
          {mastered
            ? "你不仅给出了答案，还通过了额外追问。"
            : "这次重测仍有关键点不够清楚，历史回答和漏洞已经保留。"}
        </p>
      </div>

      <div className="result-grid">
        <ResultList title="已经说清楚" items={understood} empty="等待更多有效解释" />
        <ResultList
          title="已修复漏洞"
          items={training.resolvedGaps.map((gap) => gap.description)}
          empty="本轮没有需要修复的漏洞"
        />
        <ResultList
          title="仍需复习"
          items={training.openGaps.map((gap) => gap.description)}
          empty="没有未解决漏洞"
        />
      </div>

      <div className="result-actions glass-card">
        <Link className="button button--soft" href={`/sessions/${session.id}`}>
          返回学习地图
        </Link>
        {mastered && nextConcept ? (
          <Link
            className="button button--primary"
            href={`/sessions/${session.id}/concepts/${nextConcept.id}`}
            aria-label={`继续学习 ${nextConcept.title}`}
          >
            继续：{nextConcept.title} →
          </Link>
        ) : null}
        {mastered ? (
          <button
            className="button button--ghost"
            type="button"
            onClick={onRestart}
            disabled={restarting}
          >
            {restarting ? "正在重新开始…" : "重新训练本知识点"}
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="form-alert" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}

function ResultList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <article className="result-list glass-card">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </article>
  );
}

function supportButtonLabel(level: number) {
  if (level === 0) return "给我一个提示 · Level 1";
  if (level === 1) return "再具体一点 · Level 2";
  return "给我核心解释 · Level 3";
}
