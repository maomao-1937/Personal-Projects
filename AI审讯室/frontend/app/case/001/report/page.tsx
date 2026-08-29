"use client";

import { ArrowLeft, ArrowRight, Check, FileCheck2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { gameApi } from "@/features/game/api";
import { caseRoutes, reportRequirements, withSession } from "@/features/game/session";
import type { CaseOption, ReportDraft } from "@/features/game/types";
import { useGameData } from "@/features/game/use-game-data";

const STEPS = ["真相判断", "关键证据", "动机与手法"];

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: CaseOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`report-option${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="mono-id">{option.id}</span>
      <strong>{option.label}</strong>
      <span className="choice-mark" aria-hidden="true">{selected ? <Check size={15} /> : null}</span>
    </button>
  );
}

export function ReportScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const routes = caseRoutes(caseId);
  const { caseData, session, setSession, loading, error, retry } = useGameData(caseId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ReportDraft>({
    verdictId: "",
    evidenceIds: [],
    motiveId: "",
    methodId: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.stage === "completed" && session.reportResult) {
      router.replace(withSession(routes.result, session.sessionId));
    }
  }, [router, routes.result, session]);

  const canContinue = useMemo(() => {
    if (step === 0) return Boolean(draft.verdictId);
    if (step === 1) return draft.evidenceIds.length > 0;
    return Boolean(draft.motiveId && draft.methodId);
  }, [draft, step]);

  if (loading) return <LoadingState label="正在展开结案报告…" />;
  if (error || !caseData || !session) return <ErrorState message={error ?? "结案资料不完整。"} onRetry={retry} />;

  if (session.stage === "completed" && session.reportResult) {
    return <LoadingState label="正在打开已封存的结案结果…" />;
  }

  const activeSession = session;

  const reportUnlocked = session.canSubmitReport || session.stage === "report_required";
  if (!reportUnlocked) {
    const missing = reportRequirements(session);
    return (
      <main className="report-page">
        <section className="report-locked-card">
          <LockKeyhole aria-hidden="true" size={28} />
          <p className="eyebrow">REPORT LOCKED</p>
          <h1>证据链尚未达到结案条件</h1>
          <p>完成以下条件后再提交报告：</p>
          <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul>
          <Button variant="dark" onClick={() => router.push(withSession(routes.interrogate, session.sessionId))}>
            <ArrowLeft aria-hidden="true" size={16} /> 返回审讯
          </Button>
        </section>
      </main>
    );
  }

  function toggleEvidence(id: string) {
    setDraft((current) => {
      if (current.evidenceIds.includes(id)) {
        return { ...current, evidenceIds: current.evidenceIds.filter((item) => item !== id) };
      }
      if (current.evidenceIds.length >= 3) return current;
      return { ...current, evidenceIds: [...current.evidenceIds, id] };
    });
  }

  async function submitReport() {
    setBusy(true);
    setSubmitError(null);
    try {
      const result = await gameApi.submitReport(activeSession.sessionId, draft);
      setSession({ ...activeSession, stage: "completed", reportResult: result });
      router.push(withSession(routes.result, activeSession.sessionId));
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "报告提交失败，请重试。");
      setConfirmOpen(false);
      setBusy(false);
    }
  }

  return (
    <main className="report-page">
      <header className="page-bar report-page__bar">
        <button
          type="button"
          className="back-link"
          onClick={() => router.push(withSession(routes.interrogate, session.sessionId))}
        >
          <ArrowLeft aria-hidden="true" size={16} /> 返回审讯
        </button>
        <span className="mono-meta">{caseData.caseCode} / FINAL REPORT</span>
      </header>

      <article className="report-card">
        <header className="report-header">
          <div><p className="eyebrow eyebrow--ink">DETECTIVE CONCLUSION</p><h1>结案报告</h1><p>{caseData.title} · 本报告由你主动提交</p></div>
          <div className="report-seal"><FileCheck2 aria-hidden="true" /><span>未封存</span></div>
        </header>

        <ol className="report-steps" aria-label="结案报告步骤">
          {STEPS.map((label, index) => (
            <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""}>
              <span>{String(index + 1).padStart(2, "0")}</span><b>{label}</b>
            </li>
          ))}
        </ol>

        <section className="report-step-panel">
          {step === 0 ? (
            <>
              <div className="report-question"><p className="section-number">STEP 01</p><h2>你认为事件的真实情况是什么？</h2><p>选择一个最符合现有证据的判断。</p></div>
              <div className="report-options">
                {caseData.truthOptions.map((option) => (
                  <OptionCard key={option.id} option={option} selected={draft.verdictId === option.id} onSelect={() => setDraft({ ...draft, verdictId: option.id })} />
                ))}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="report-question"><p className="section-number">STEP 02</p><h2>哪些证据构成关键证据链？</h2><p>从已发现证据中选择 1–3 条。只选事实，不选系统推断。</p></div>
              <div className="report-evidence-options">
                {session.evidence.map((evidence) => {
                  const selected = draft.evidenceIds.includes(evidence.id);
                  const blocked = !selected && draft.evidenceIds.length >= 3;
                  return (
                    <button key={evidence.id} type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} disabled={blocked} onClick={() => toggleEvidence(evidence.id)}>
                      <span className="mono-id">{evidence.id}</span><strong>{evidence.name}</strong><p>{evidence.description}</p><span>{selected ? "已列为关键证据" : blocked ? "最多选择 3 条" : "加入报告"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <div className="report-double-section">
              <section>
                <div className="report-question"><p className="section-number">STEP 03-A</p><h2>行为动机</h2><p>选择最能解释嫌疑人为什么行动的原因。</p></div>
                <div className="report-options report-options--compact">
                  {caseData.motiveOptions.map((option) => (
                    <OptionCard key={option.id} option={option} selected={draft.motiveId === option.id} onSelect={() => setDraft({ ...draft, motiveId: option.id })} />
                  ))}
                </div>
              </section>
              <section>
                <div className="report-question"><p className="section-number">STEP 03-B</p><h2>实施手法</h2><p>选择与时间线和物证最一致的手法。</p></div>
                <div className="report-options report-options--compact">
                  {caseData.methodOptions.map((option) => (
                    <OptionCard key={option.id} option={option} selected={draft.methodId === option.id} onSelect={() => setDraft({ ...draft, methodId: option.id })} />
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </section>

        <footer className="report-footer">
          <div><span className="mono-id">PROGRESS</span><strong>{step + 1} / 3</strong></div>
          <div className="report-actions">
            {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft aria-hidden="true" size={16} /> 上一步</Button> : null}
            {step < 2 ? (
              <Button variant="dark" disabled={!canContinue} onClick={() => setStep(step + 1)}>下一步 <ArrowRight aria-hidden="true" size={16} /></Button>
            ) : (
              <Button variant="dark" disabled={!canContinue} onClick={() => setConfirmOpen(true)}>核对并提交 <ArrowRight aria-hidden="true" size={16} /></Button>
            )}
          </div>
        </footer>
        {submitError ? <p className="report-submit-error field-error" role="alert">{submitError}</p> : null}
      </article>

      <ConfirmDialog
        open={confirmOpen}
        title="确认提交结案报告？"
        description="提交后本局报告不可修改。系统将只使用结构化选择与固定答案进行评分，嫌疑人的对话表现不会参与判分。"
        confirmLabel="确认结案"
        busy={busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void submitReport()}
      />
    </main>
  );
}

export default function ReportPage() {
  return <ReportScreen caseId="001" />;
}
