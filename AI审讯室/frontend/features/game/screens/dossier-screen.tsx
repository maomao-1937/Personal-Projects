"use client";

import { ArrowLeft, ArrowRight, Clock3, FileCheck2, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getSuspects } from "../case-data";
import { caseRoutes, withSession } from "../session";
import { useGameData } from "../use-game-data";
import { EvidenceCard } from "../components/evidence-card";
import { SuspectPortrait } from "../components/suspect-portrait";

export function DossierScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const routes = caseRoutes(caseId);
  const { caseData, session, loading, error, retry } = useGameData(caseId, { createIfMissing: true });

  if (loading) return <LoadingState label="正在建立案件档案…" />;
  if (error || !caseData || !session) return <ErrorState message={error ?? "案件数据不完整。"} onRetry={retry} />;

  const suspects = getSuspects(caseData);
  const initialEvidence = caseData.evidence.filter((evidence) => evidence.public).slice(0, 3);

  return (
    <main className="dossier-page">
      <header className="dossier-topbar"><Link href="/cases" className="back-link"><ArrowLeft aria-hidden="true" size={16} />案件库</Link><span className="data-label">{caseData.caseCode} · 调查档案</span></header>

      <article className="dossier-sheet">
        <header className="dossier-hero">
          <div className="dossier-hero__image" aria-hidden="true" /><div className="dossier-hero__scrim" aria-hidden="true" />
          <div className="dossier-hero__copy">
            <div className="dossier-meta"><span>{caseData.contentRating}</span><span>{caseData.generationSource === "llm" ? "AI 生成案件" : "精修案件"}</span></div>
            <h1>{caseData.title}</h1><p>{caseData.subtitle}</p>
            <dl><div><Clock3 aria-hidden="true" size={15} /><dt>案发时间</dt><dd>{caseData.time}</dd></div><div><MapPin aria-hidden="true" size={15} /><dt>案发地点</dt><dd>{caseData.location}</dd></div></dl>
          </div>
        </header>

        <section className="dossier-overview"><div><h2>案情摘要</h2><p>{caseData.summary}</p></div><ul aria-label="已知事实">{caseData.publicFacts.map((fact) => <li key={fact}><ShieldCheck aria-hidden="true" size={15} />{fact}</li>)}</ul></section>

        <section className="dossier-suspects" aria-labelledby="suspects-title">
          <div className="section-title"><div><UsersRound aria-hidden="true" size={18} /><h2 id="suspects-title">涉案人员</h2></div><span>{suspects.length} 名待审</span></div>
          <div className="suspect-dossier-grid">{suspects.map((suspect, index) => (
            <article key={suspect.id} className="suspect-dossier">
              <SuspectPortrait suspect={suspect} priority={index === 0} />
              <div className="suspect-dossier__identity"><span className="data-label">{suspect.id}</span><h3>{suspect.name}</h3><p>{suspect.role}{suspect.age ? ` · ${suspect.age} 岁` : ""}</p></div>
              <p className="suspect-dossier__public">{suspect.publicIdentity}</p><blockquote>“{suspect.initialStatement ?? "等待正式问询。"}”</blockquote>
            </article>
          ))}</div>
        </section>

        <section className="dossier-evidence" aria-labelledby="initial-evidence-title">
          <div className="section-title"><div><FileCheck2 aria-hidden="true" size={18} /><h2 id="initial-evidence-title">初始证据</h2></div><span>{initialEvidence.length} 份已公开</span></div>
          {initialEvidence.length ? <div className="briefing-evidence-grid">{initialEvidence.map((evidence) => <EvidenceCard key={evidence.id} evidence={evidence} state="public" selected={false} />)}</div> : <p className="empty-state">尚无公开物证。进入调查后，从证词中找到第一条可核实线索。</p>}
        </section>

        <footer className="dossier-start"><div><strong>调查目标</strong><p>切换嫌疑人核对口供，找出无法同时成立的事实，然后主动提交结案判断。</p></div><Button variant="light" onClick={() => router.push(withSession(routes.investigate, session.sessionId))}>进入调查工作台 <ArrowRight aria-hidden="true" size={17} /></Button></footer>
      </article>
      <div className="mobile-dossier-cta"><Button variant="light" onClick={() => router.push(withSession(routes.investigate, session.sessionId))}>进入调查工作台 <ArrowRight aria-hidden="true" size={17} /></Button></div>
    </main>
  );
}
