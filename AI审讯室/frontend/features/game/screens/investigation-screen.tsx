"use client";

import { ArrowRight, BookOpenText, FileSearch, Gavel, HeartHandshake, LoaderCircle, Search, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusLabel } from "@/components/ui/status-label";
import { gameApi } from "../api";
import { getActiveSuspect, getDefenseBand, getSuspects } from "../case-data";
import { MobileDrawer } from "../components/mobile-drawer";
import { SuspectPortrait } from "../components/suspect-portrait";
import { caseRoutes, reportRequirements, withSession } from "../session";
import type { DefenseBand, GameSession, Message, PublicCase, Tactic } from "../types";
import { useGameData } from "../use-game-data";

const TACTICS: Array<{ id: Tactic; label: string; hint: string; icon: typeof Search }> = [
  { id: "calm", label: "核对", hint: "核对具体事实与时间点", icon: Search },
  { id: "empathy", label: "共情", hint: "降低戒备，追问人物动机", icon: HeartHandshake },
  { id: "pressure", label: "施压", hint: "配合证据质问矛盾", icon: Gavel },
];

const BAND_COPY: Record<DefenseBand, string> = { calm: "镇定", guarded: "戒备", shaken: "动摇", breaking: "濒临崩溃" };
const BAND_TONE: Record<DefenseBand, "neutral" | "ineffective" | "selected" | "effective"> = { calm: "neutral", guarded: "ineffective", shaken: "selected", breaking: "effective" };

function createTurnRequestId() {
  const unique = window.crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `turn_${unique}`;
}

function MessageRow({ message, suspectName, optimistic = false }: { message: Message; suspectName: string; optimistic?: boolean }) {
  if (message.role === "system") return <div className="system-ruling"><span>规则记录</span><p>{message.text}</p></div>;
  const isDetective = message.role === "detective";
  return (
    <article data-turn={message.turn || undefined} className={`transcript-entry transcript-entry--${isDetective ? "detective" : "suspect"}${optimistic ? " is-pending" : ""}`}>
      <header><strong>{isDetective ? "调查员" : suspectName}</strong><span>{message.turn ? `第 ${String(message.turn).padStart(2, "0")} 次提问` : "初始证词"}</span></header>
      <p>{message.text}</p>
      {isDetective && (message.tactic || message.evidenceId) ? <footer>{message.tactic ? <span>{TACTICS.find((item) => item.id === message.tactic)?.label}</span> : null}{message.evidenceId ? <span>出示 {message.evidenceId}</span> : null}</footer> : null}
    </article>
  );
}

function EvidencePanel({ session, selectedId, onSelect, disabled }: { session: GameSession; selectedId: string | null; onSelect: (id: string) => void; disabled: boolean }) {
  return (
    <div className="workbench-resource-list">
      {session.evidence.length ? session.evidence.map((evidence) => {
        const selected = selectedId === evidence.id;
        const effective = session.effectiveEvidenceIds.includes(evidence.id);
        return <button key={evidence.id} type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} disabled={disabled} onClick={() => onSelect(evidence.id)}><span className="data-label">{evidence.id}</span><strong>{evidence.name}</strong><p>{evidence.description}</p><small>{effective ? "已命中矛盾" : selected ? "本轮将出示" : evidence.source}</small></button>;
      }) : <p className="empty-state">暂未发现可出示的证据。先核对每个人的时间线。</p>}
    </div>
  );
}

function BriefPanel({ caseData }: { caseData: PublicCase }) {
  return <div className="workbench-brief"><h3>{caseData.title}</h3><p>{caseData.summary}</p><dl><div><dt>时间</dt><dd>{caseData.time}</dd></div><div><dt>地点</dt><dd>{caseData.location}</dd></div></dl><ul>{caseData.publicFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>;
}

function TimelinePanel({ caseData, session }: { caseData: PublicCase; session: GameSession }) {
  const timelineClaims = session.claims.filter((claim) => claim.kind === "timeline" || claim.kind === "contradiction");
  return <ol className="case-timeline">{caseData.publicFacts.map((fact, index) => <li key={fact}><span>{String(index + 1).padStart(2, "0")}</span><p>{fact}</p></li>)}{timelineClaims.map((claim) => <li key={`${claim.id}-${claim.turn}`} className={claim.kind === "contradiction" ? "is-contradiction" : ""}><span>T{String(claim.turn).padStart(2, "0")}</span><p>{claim.text}<small>{claim.source}</small></p></li>)}</ol>;
}

export function InvestigationScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const routes = caseRoutes(caseId);
  const { caseData, session, setSession, loading, error, retry } = useGameData(caseId);
  const [activeSuspectId, setActiveSuspectId] = useState<string | null>(null);
  const [resourceTab, setResourceTab] = useState<"evidence" | "brief" | "timeline">("evidence");
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
    const log = logRef.current;
    if (!log || !session) return;
    const suspectId = activeSuspectId ?? session.activeSuspectId;
    const relevant = session.messages.filter((message) => !message.suspectId || message.suspectId === suspectId);
    const lastTurn = Math.max(0, ...relevant.map((message) => message.turn));
    const frame = window.requestAnimationFrame(() => {
      const start = log.querySelector<HTMLElement>(`[data-turn="${lastTurn}"]`);
      if (start) {
        const nextTop = log.scrollTop + start.getBoundingClientRect().top - log.getBoundingClientRect().top - 18;
        log.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      }
      else log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy, optimistic, session, activeSuspectId]);

  useEffect(() => {
    if (session?.stage === "report_required") router.replace(withSession(routes.report, session.sessionId));
  }, [router, routes.report, session?.sessionId, session?.stage]);

  const missing = useMemo(() => (session ? reportRequirements(session) : []), [session]);
  const canOpenReport = Boolean(session && (session.canSubmitReport || session.stage === "report_required"));

  if (loading) return <LoadingState label="正在恢复调查记录…" />;
  if (error || !caseData || !session) return <ErrorState message={error ?? "调查记录不完整。"} onRetry={retry} />;

  const suspects = getSuspects(caseData);
  const activeSession = session;
  const resolvedActiveSuspectId = activeSuspectId ?? session.activeSuspectId ?? suspects[0]?.id ?? null;
  const activeSuspect = getActiveSuspect(caseData, resolvedActiveSuspectId);
  const activeBand = getDefenseBand(session, activeSuspect.id);
  const maxTurns = session.maxTurns ?? 12;
  const selectedEvidence = session.evidence.find((item) => item.id === selectedEvidenceId);
  const visibleMessages = session.messages.filter((message) => !message.suspectId || message.suspectId === activeSuspect.id);
  const timelinePanel = <TimelinePanel caseData={caseData} session={session} />;
  const evidencePanel = <EvidencePanel session={session} selectedId={selectedEvidenceId} onSelect={toggleEvidence} disabled={busy} />;
  const briefPanel = <BriefPanel caseData={caseData} />;

  function toggleEvidence(id: string) { if (!busy) setSelectedEvidenceId((current) => current === id ? null : id); }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault();
    if (busy || activeSession.turnCount >= maxTurns) return;
    const clean = question.trim();
    if (!clean) { setTurnError("先写下一个具体问题。"); return; }
    const requestSignature = JSON.stringify({ message: clean, tactic, evidenceId: selectedEvidenceId, suspectId: activeSuspect.id });
    const requestId = retryRequest?.signature === requestSignature ? retryRequest.id : createTurnRequestId();
    setBusy(true); setTurnError(null); setFeedback(null);
    setOptimistic({ id: "optimistic-question", role: "detective", text: clean, turn: activeSession.turnCount + 1, suspectId: activeSuspect.id, tactic, evidenceId: selectedEvidenceId, evidenceEffect: "none", createdAt: new Date().toISOString() });
    try {
      const result = await gameApi.submitTurn(activeSession.sessionId, { message: clean, tactic, evidenceId: selectedEvidenceId, requestId, suspectId: activeSuspect.id });
      setSession(result); setQuestion(""); setSelectedEvidenceId(null); setRetryRequest(null); setOptimistic(null);
      if (result.evidenceEffect === "effective") setFeedback("证据与证词形成有效对质，矛盾已写入案件记录。");
      else if (result.evidenceEffect === "used_ineffective") setFeedback("这条证据与当前问题没有形成直接关联。");
      else if (result.isRepeated) setFeedback("相同问题没有带来新信息。换一个事实点继续核对。");
      else if (result.invalidPressure) setFeedback("缺少证据支撑的施压提高了对方的敌意。");
      else if (result.newEvidenceIds.length) setFeedback(`新证据 ${result.newEvidenceIds.join("、")} 已归档。`);
    } catch (reason) {
      setOptimistic(null); setRetryRequest({ id: requestId, signature: requestSignature }); setTurnError(reason instanceof Error ? reason.message : "问题发送失败，请重试。");
    } finally { setBusy(false); }
  }

  return (
    <main className="investigation-page">
      <header className="investigation-topbar">
        <div><span className="data-label">{caseData.caseCode}</span><strong>{caseData.title}</strong></div>
        <div className="investigation-progress"><span>已提问 <b>{session.turnCount}</b> / {maxTurns}</span><span>已发现 <b>{session.evidence.length}</b> / {caseData.evidenceCount ?? caseData.evidence.length}</span><span className="mobile-report-hint">{canOpenReport ? "已满足结案条件" : missing.join(" · ")}</span></div>
        <div className="report-gate"><Button variant="ghost" onClick={() => router.push(withSession(routes.report, session.sessionId))} disabled={!canOpenReport}>提交结案 <ArrowRight aria-hidden="true" size={15} /></Button>{!canOpenReport ? <span>{missing.join(" · ")}</span> : null}</div>
      </header>

      <nav className="mobile-suspect-strip" aria-label="选择审讯对象">{suspects.map((suspect) => <button key={suspect.id} type="button" aria-pressed={suspect.id === activeSuspect.id} onClick={() => setActiveSuspectId(suspect.id)}><SuspectPortrait suspect={suspect} /><span><strong>{suspect.name}</strong><small>{BAND_COPY[getDefenseBand(session, suspect.id)]}</small></span></button>)}</nav>

      <div className="investigation-grid">
        <aside className="suspect-rail" aria-label="嫌疑人列表">
          <header><span>审讯对象</span><small>{suspects.length} 人</small></header>
          <div>{suspects.map((suspect) => {
            const band = getDefenseBand(session, suspect.id);
            const unresolved = session.claims.filter((claim) => claim.suspectId === suspect.id && claim.kind !== "contradiction").length;
            return <button key={suspect.id} type="button" className={suspect.id === activeSuspect.id ? "is-active" : ""} aria-pressed={suspect.id === activeSuspect.id} onClick={() => setActiveSuspectId(suspect.id)}><SuspectPortrait suspect={suspect} /><span><strong>{suspect.name}</strong><small>{suspect.role}</small><em>{BAND_COPY[band]}{unresolved ? ` · ${unresolved} 条待核` : ""}</em></span></button>;
          })}</div>
          <footer><BookOpenText aria-hidden="true" size={15} /><span>切换人物不会丢失各自审讯记录。</span></footer>
        </aside>

        <section className="transcript-panel">
          <header className="interviewee-header"><SuspectPortrait suspect={activeSuspect} priority /><div><span className="data-label">当前审讯 · {activeSuspect.id}</span><h1>{activeSuspect.name}</h1><p>{activeSuspect.role} · {activeSuspect.demeanor}</p></div><StatusLabel tone={BAND_TONE[activeBand]}>{BAND_COPY[activeBand]}</StatusLabel></header>
          <div className="transcript-log" ref={logRef} aria-live="polite">
            {visibleMessages.length ? visibleMessages.map((message) => <MessageRow key={message.id} message={message} suspectName={activeSuspect.name} />) : <div className="transcript-empty"><p>还没有正式问询记录。</p><blockquote>“{activeSuspect.initialStatement ?? "我会配合调查。"}”</blockquote><span>从时间、地点或与其他人的关系开始核对。</span></div>}
            {optimistic ? <MessageRow message={optimistic} suspectName={activeSuspect.name} optimistic /> : null}
            {busy ? <div className="thinking-row" role="status"><LoaderCircle aria-hidden="true" size={16} />{activeSuspect.name} 正在回答…</div> : null}
          </div>

          <div className="question-dock">
            {feedback ? <div className="turn-feedback" role="status">{feedback}</div> : null}
            <MobileDrawer caseContent={briefPanel} evidenceContent={evidencePanel} notesContent={timelinePanel} timelineContent={timelinePanel} />
            <form onSubmit={submitQuestion}>
              <div className="interrogation-tools"><span>询问方式</span>{TACTICS.map((item) => <button key={item.id} type="button" aria-pressed={tactic === item.id} title={item.hint} onClick={() => setTactic(item.id)} disabled={busy}><item.icon aria-hidden="true" size={14} />{item.label}</button>)}</div>
              {selectedEvidence ? <div className="attached-evidence"><FileSearch aria-hidden="true" size={15} /><span>正在出示</span><strong>{selectedEvidence.id} · {selectedEvidence.name}</strong><button type="button" aria-label="取消出示证据" onClick={() => setSelectedEvidenceId(null)} disabled={busy}><X aria-hidden="true" size={15} /></button></div> : null}
              <label className="question-compose"><span className="sr-only">向当前嫌疑人提问</span><textarea value={question} maxLength={200} rows={2} placeholder={`向${activeSuspect.name}提问，最好指向一个具体时间点或证据…`} disabled={busy || session.turnCount >= maxTurns} onChange={(event) => setQuestion(event.target.value)} /><span>{question.length}/200</span><button type="submit" aria-label="发送问题" disabled={busy || !question.trim() || session.turnCount >= maxTurns}>{busy ? <LoaderCircle aria-hidden="true" size={18} /> : <Send aria-hidden="true" size={18} />}</button></label>
              {turnError ? <p className="field-error" role="alert">{turnError}</p> : null}
              {session.turnCount >= maxTurns ? <p className="input-explanation">提问额度已用尽，请提交结案报告。</p> : null}
            </form>
          </div>
        </section>

        <aside className="resource-rail" aria-label="调查资料">
          <nav>{(["evidence", "brief", "timeline"] as const).map((tab) => <button key={tab} type="button" aria-pressed={resourceTab === tab} onClick={() => setResourceTab(tab)}>{tab === "evidence" ? "证据" : tab === "brief" ? "案情" : "时间线"}</button>)}</nav>
          <div className="resource-rail__content">{resourceTab === "evidence" ? evidencePanel : resourceTab === "brief" ? briefPanel : timelinePanel}</div>
        </aside>
      </div>
    </main>
  );
}
