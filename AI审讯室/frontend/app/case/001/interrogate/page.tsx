"use client";

import {
  ArrowRight,
  ChevronRight,
  Gavel,
  HeartHandshake,
  LoaderCircle,
  Search,
  Send,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusLabel } from "@/components/ui/status-label";
import { gameApi } from "@/features/game/api";
import {
  CaseSummary,
  DetectiveNotes,
  EvidenceList,
} from "@/features/game/components/case-materials";
import { MobileDrawer } from "@/features/game/components/mobile-drawer";
import { caseRoutes, reportRequirements, withSession } from "@/features/game/session";
import type { GameSession, Message, Tactic } from "@/features/game/types";
import { useGameData } from "@/features/game/use-game-data";

const TACTICS: Array<{
  id: Tactic;
  label: string;
  hint: string;
  icon: typeof Search;
}> = [
  { id: "calm", label: "平静追问", hint: "适合核对具体事实", icon: Search },
  { id: "empathy", label: "共情诱导", hint: "尝试触及人物软肋", icon: HeartHandshake },
  { id: "pressure", label: "施压质问", hint: "没有证据只会增加敌意", icon: Gavel },
];

const BAND_COPY = {
  calm: "镇定",
  guarded: "戒备",
  shaken: "动摇",
  breaking: "濒临崩溃",
};

const BAND_TONE = {
  calm: "neutral",
  guarded: "ineffective",
  shaken: "selected",
  breaking: "effective",
} as const;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createTurnRequestId() {
  const unique = window.crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `turn_${unique}`;
}

function MessageRow({ message, suspectName, optimistic = false }: { message: Message; suspectName: string; optimistic?: boolean }) {
  const isDetective = message.role === "detective";
  return (
    <article className={`message-row ${isDetective ? "message-row--detective" : "message-row--suspect"}${optimistic ? " message-row--optimistic" : ""}`}>
      <header>
        <span>{isDetective ? "侦探" : suspectName}</span>
        <span>{message.turn ? `回合 ${String(message.turn).padStart(2, "0")}` : "初始证词"}</span>
      </header>
      <p>{message.text}</p>
      {isDetective && (message.tactic || message.evidenceId) ? (
        <footer>
          {message.tactic ? <span>{TACTICS.find((item) => item.id === message.tactic)?.label}</span> : null}
          {message.evidenceId ? <span>出示 {message.evidenceId}</span> : null}
        </footer>
      ) : null}
    </article>
  );
}

export function InterrogateScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const routes = caseRoutes(caseId);
  const { caseData, session, setSession, loading, error, retry } = useGameData(caseId);
  const [tactic, setTactic] = useState<Tactic>("calm");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [turnError, setTurnError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Message | null>(null);
  const [retryRequest, setRetryRequest] = useState<{ id: string; signature: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = logRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [busy, optimistic, session?.messages.length]);

  useEffect(() => {
    if (session?.stage === "report_required") {
      router.replace(withSession(routes.report, session.sessionId));
    }
  }, [router, routes.report, session?.sessionId, session?.stage]);

  const missing = useMemo(() => (session ? reportRequirements(session) : []), [session]);
  const canOpenReport = Boolean(session && (session.canSubmitReport || session.stage === "report_required"));

  function toggleEvidence(id: string) {
    if (busy) return;
    setSelectedEvidenceId((current) => (current === id ? null : id));
  }

  function goToReport() {
    if (!session || !canOpenReport) return;
    router.push(withSession(routes.report, session.sessionId));
  }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault();
    if (!session || busy || session.turnCount >= 8) return;
    const clean = question.trim();
    if (!clean) {
      setTurnError("请输入 1–200 个字符的问题。");
      return;
    }
    const requestSignature = JSON.stringify({ message: clean, tactic, evidenceId: selectedEvidenceId });
    const requestId = retryRequest?.signature === requestSignature
      ? retryRequest.id
      : createTurnRequestId();

    setBusy(true);
    setTurnError(null);
    setFeedback(null);
    setOptimistic({
      id: "optimistic-question",
      role: "detective",
      text: clean,
      turn: session.turnCount + 1,
      tactic,
      evidenceId: selectedEvidenceId,
      evidenceEffect: "none",
      createdAt: new Date().toISOString(),
    });

    try {
      const [result] = await Promise.all([
        gameApi.submitTurn(session.sessionId, {
          message: clean,
          tactic,
          evidenceId: selectedEvidenceId,
          requestId,
        }),
        wait(650),
      ]);
      setSession(result as GameSession);
      setQuestion("");
      setSelectedEvidenceId(null);
      setRetryRequest(null);
      setOptimistic(null);
      if (result.evidenceEffect === "effective") {
        setFeedback("证据与当前问题形成有效对质，新的矛盾已记录。");
      } else if (result.evidenceEffect === "used_ineffective") {
        setFeedback("这条证据与当前问题没有形成有效关联。");
      } else if (result.isRepeated) {
        setFeedback("最近两回合已经问过同一问题，本回合未产生新进展。");
      } else if (result.invalidPressure) {
        setFeedback("没有证据的施压没有击穿防线，嫌疑人的敌意上升了。");
      } else if (result.newEvidenceIds.length) {
        setFeedback(`新证据 ${result.newEvidenceIds.join("、")} 已加入档案。`);
      }
    } catch (reason) {
      setOptimistic(null);
      setRetryRequest({ id: requestId, signature: requestSignature });
      setTurnError(reason instanceof Error ? reason.message : "问题发送失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="正在恢复审讯记录…" />;
  if (error || !caseData || !session) return <ErrorState message={error ?? "审讯记录不完整。"} onRetry={retry} />;

  const selectedEvidence = session.evidence.find((item) => item.id === selectedEvidenceId);
  const caseContent = <CaseSummary caseData={caseData} />;
  const evidenceContent = (
    <EvidenceList session={session} selectedId={selectedEvidenceId} onSelect={toggleEvidence} disabled={busy} />
  );
  const notesContent = <DetectiveNotes session={session} />;

  return (
    <main className="interrogation-page">
      <header className="workbench-topbar">
        <div className="workbench-title">
          <span className="mono-id">{caseData.caseCode}</span>
          <div><strong>{caseData.title}</strong><small>{caseData.subtitle}</small></div>
        </div>
        <div className="workbench-state">
          <span className="turn-counter">回合 <b>{String(session.turnCount).padStart(2, "0")}</b>/08</span>
          <StatusLabel tone={BAND_TONE[session.defenseBand]}>{BAND_COPY[session.defenseBand]}</StatusLabel>
          <div className="report-gate">
            <Button variant="ghost" onClick={goToReport} disabled={!canOpenReport}>
              提交结案 <ArrowRight aria-hidden="true" size={15} />
            </Button>
            {!canOpenReport ? <span>{missing.join(" · ")}</span> : null}
          </div>
        </div>
      </header>

      <div className="workbench">
        <aside className="case-sidebar" aria-label="案件资料">
          {caseContent}
          {evidenceContent}
          {notesContent}
        </aside>

        <section className="interrogation-panel">
          <header className="suspect-header">
            <div className="suspect-badge">{caseData.suspect.name.slice(0, 1)}</div>
            <div><p className="eyebrow">SUSPECT / S01</p><h1>{caseData.suspect.name}</h1><span>{caseData.suspect.role} · {caseData.suspect.demeanor}</span></div>
            <StatusLabel tone={BAND_TONE[session.defenseBand]}>心理状态：{BAND_COPY[session.defenseBand]}</StatusLabel>
          </header>

          <div className="conversation-log" ref={logRef} aria-live="polite" aria-label="审讯对话记录">
            {session.messages.map((message) => <MessageRow key={message.id} message={message} suspectName={caseData.suspect.name} />)}
            {optimistic ? <MessageRow message={optimistic} suspectName={caseData.suspect.name} optimistic /> : null}
            {busy ? (
              <div className="thinking-row" role="status">
                <LoaderCircle aria-hidden="true" size={16} />
                嫌疑人正在整理措辞…
              </div>
            ) : null}
          </div>

          <div className="interrogation-controls">
            {feedback ? <div className="turn-feedback" role="status">{feedback}</div> : null}
            <MobileDrawer caseContent={caseContent} evidenceContent={evidenceContent} notesContent={notesContent} />
            <form onSubmit={submitQuestion}>
              <fieldset className="tactic-fieldset" disabled={busy}>
                <legend>选择审讯策略</legend>
                <div className="tactic-row">
                  {TACTICS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={tactic === item.id}
                      className={tactic === item.id ? "is-active" : ""}
                      title={item.hint}
                      onClick={() => setTactic(item.id)}
                    >
                      <item.icon aria-hidden="true" size={15} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              {selectedEvidence ? (
                <div className="selected-evidence-chip">
                  <span>本轮出示</span><b>{selectedEvidence.id} · {selectedEvidence.name}</b>
                  <button type="button" aria-label="取消选择证据" onClick={() => setSelectedEvidenceId(null)} disabled={busy}>
                    <X aria-hidden="true" size={15} />
                  </button>
                </div>
              ) : null}

              <label className="question-input">
                <span className="sr-only">向嫌疑人提问</span>
                <textarea
                  value={question}
                  maxLength={200}
                  rows={2}
                  placeholder="输入你的问题。尝试把一条证据和一个具体矛盾放在一起…"
                  disabled={busy || session.turnCount >= 8}
                  onChange={(event) => setQuestion(event.target.value)}
                />
                <span className="character-count">{question.length}/200</span>
                <button
                  type="submit"
                  aria-label={busy ? "正在等待嫌疑人回答" : "发送问题"}
                  disabled={busy || !question.trim() || session.turnCount >= 8}
                >
                  {busy ? <LoaderCircle aria-hidden="true" size={18} /> : <Send aria-hidden="true" size={18} />}
                </button>
              </label>
              {turnError ? <p className="field-error" role="alert">{turnError}</p> : null}
              <div className="prompt-hints" aria-label="提问句式提示">
                <span>句式提示</span>
                {["请解释这个时间点。", "这和你的上一句话矛盾吗？"].map((hint) => (
                  <button key={hint} type="button" disabled={busy} onClick={() => setQuestion(hint)}>
                    {hint}<ChevronRight aria-hidden="true" size={12} />
                  </button>
                ))}
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function InterrogatePage() {
  return <InterrogateScreen caseId="001" />;
}
