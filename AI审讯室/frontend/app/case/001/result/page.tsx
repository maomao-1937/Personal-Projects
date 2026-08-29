"use client";

import { Check, Clipboard, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StartCaseButton } from "@/features/game/components/start-case-button";
import { gameApi } from "@/features/game/api";
import { buildShareText, caseRoutes, clearSessionId, storeSessionId, withSession } from "@/features/game/session";
import { useGameData } from "@/features/game/use-game-data";

const GRADE_COPY = {
  S: "审讯专家",
  A: "高级侦探",
  B: "合格侦探",
  C: "证据不足",
  D: "审讯失控",
};

const BREAKDOWN_LABELS = {
  truth: ["真相", 35],
  motive: ["动机", 20],
  method: ["手法", 20],
  evidence: ["证据", 20],
  efficiency: ["效率", 5],
} as const;

export function ResultScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const routes = caseRoutes(caseId);
  const { caseData, session, loading, error, retry } = useGameData(caseId);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);

  if (loading) return <LoadingState label="正在核验结案报告…" />;
  if (error || !caseData || !session) return <ErrorState message={error ?? "结果资料不完整。"} onRetry={retry} />;
  const result = session.reportResult;
  if (!result) {
    return <ErrorState message="这局尚未提交结案报告。请返回审讯并完成报告。" onRetry={() => router.push(withSession(routes.interrogate, session.sessionId))} />;
  }

  const shareText = buildShareText({
    caseTitle: caseData.title,
    grade: result.grade,
    score: result.totalScore,
    turnCount: result.stats.turnCount,
  });

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }

  async function restart() {
    setRestarting(true);
    setRestartError(null);
    clearSessionId();
    try {
      const nextSession = await gameApi.createSession(caseId);
      storeSessionId(nextSession.sessionId);
      router.push(withSession(routes.briefing, nextSession.sessionId));
    } catch (reason) {
      setRestarting(false);
      setRestartError(reason instanceof Error ? reason.message : "新审讯记录创建失败，请重试。");
    }
  }

  return (
    <main className="result-page">
      <header className="page-bar result-page__bar">
        <Link href="/" className="wordmark"><span>AI</span> 审讯室</Link>
        <span className="mono-meta">{caseData.caseCode} / CASE CLOSED</span>
      </header>

      <article className="result-report">
        <header className="result-score-header">
          <div><p className="eyebrow eyebrow--ink">FINAL ASSESSMENT</p><h1>{caseData.title} · 结案复盘</h1><p>固定答案校验完成，完整真相已解封。</p></div>
          <div className="score-lockup"><span>{result.grade}</span><strong>{result.totalScore}</strong><small>/ 100 · {GRADE_COPY[result.grade]}</small></div>
        </header>

        <section className="score-breakdown" aria-label="五项得分">
          {Object.entries(BREAKDOWN_LABELS).map(([key, [label, max]]) => {
            const score = result.breakdown[key as keyof typeof result.breakdown];
            return <div key={key}><span>{label}</span><strong>{score}</strong><small>/ {max}</small><div><i style={{ width: `${(score / max) * 100}%` }} /></div></div>;
          })}
        </section>

        <div className="conclusion-compare">
          <section><p className="section-number">YOUR CONCLUSION / 玩家结论</p><dl>{Object.entries(result.playerConclusion).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>
          <section><p className="section-number">SEALED TRUTH / 真实结论</p><dl><div><dt>真相</dt><dd>{result.trueConclusion.verdict}</dd></div><div><dt>动机</dt><dd>{result.trueConclusion.motive}</dd></div><div><dt>手法</dt><dd>{result.trueConclusion.method}</dd></div></dl></section>
        </div>

        <section className="truth-section">
          <p className="section-number">FULL TRUTH / 完整真相</p>
          <h2>真相时间线</h2>
          <p className="truth-summary">{result.truthSummary}</p>
          <ol className="truth-timeline">{result.truthTimeline.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span><p>{item}</p></li>)}</ol>
        </section>

        <div className="contradiction-grid">
          <section><p className="section-number">HIT / 已命中矛盾</p>{result.hitContradictions.length ? <ul>{result.hitContradictions.map((item) => <li key={item.id}><Check aria-hidden="true" size={16} /><span><b>{item.id}</b>{item.claim}</span></li>)}</ul> : <p>本局没有有效击中矛盾。</p>}</section>
          <section><p className="section-number">MISSED / 漏掉的矛盾</p>{result.missedContradictions.length ? <ul>{result.missedContradictions.map((item) => <li key={item.id}><X aria-hidden="true" size={16} /><span><b>{item.id}</b>{item.claim}</span></li>)}</ul> : <p>完整谎言链已经击穿。</p>}</section>
        </div>

        <section className="result-stats" aria-label="本局统计">
          <div><span>回合数</span><strong>{result.stats.turnCount}</strong><small>/ 8</small></div>
          <div><span>有效证据</span><strong>{result.stats.effectiveEvidenceCount}</strong><small>次</small></div>
          <div><span>无效施压</span><strong>{result.stats.invalidPressureCount}</strong><small>次</small></div>
        </section>

        <footer className="result-actions">
          <div>
            <Button variant="dark" onClick={() => void copyShare()}><Clipboard aria-hidden="true" size={16} />{copyState === "copied" ? "已复制无剧透文案" : "复制无剧透分享文案"}</Button>
            <Button variant="ghost" onClick={() => void restart()} disabled={restarting}><RotateCcw aria-hidden="true" size={16} />{restarting ? "正在重建档案…" : "重新审讯"}</Button>
            <StartCaseButton label="生成下一案" variant="dark" />
          </div>
          {copyState === "manual" ? <label className="manual-copy"><span>浏览器未授权剪贴板，请手动复制：</span><textarea readOnly value={shareText} /></label> : null}
          {restartError ? <p className="field-error" role="alert">{restartError}</p> : null}
        </footer>
      </article>
    </main>
  );
}

export default function ResultPage() {
  return <ResultScreen caseId="001" />;
}
