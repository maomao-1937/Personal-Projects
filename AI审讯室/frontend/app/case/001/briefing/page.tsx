"use client";

import { ArrowRight, Clock3, MapPin, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { EvidenceCard } from "@/features/game/components/evidence-card";
import { caseRoutes, withSession } from "@/features/game/session";
import { useGameData } from "@/features/game/use-game-data";

export function BriefingScreen({ caseId }: { caseId: string }) {
  const router = useRouter();
  const routes = caseRoutes(caseId);
  const { caseData, session, loading, error, retry } = useGameData(caseId, { createIfMissing: true });

  if (loading) return <LoadingState />;
  if (error || !caseData || !session) return <ErrorState message={error ?? "案件数据不完整。"} onRetry={retry} />;

  return (
    <main className="dossier-page">
      <header className="page-bar">
        <Link href="/" className="wordmark"><span>AI</span> 审讯室</Link>
        <span className="mono-meta">档案权限 / 临时侦探</span>
      </header>
      <article className="dossier-card">
        <div className="case-stamp" aria-label={`案件编号 ${caseData.caseCode}`}>{caseData.caseCode}</div>
        <header className="dossier-header">
          <div>
            <p className="eyebrow eyebrow--ink">NIGHT DUTY INCIDENT</p>
            <h1>{caseData.title}</h1>
            <p>{caseData.subtitle}</p>
          </div>
          <span className="classification">{caseData.contentRating}</span>
        </header>

        <div className="dossier-facts">
          <div><Clock3 aria-hidden="true" /><span>时间</span><strong>{caseData.time}</strong></div>
          <div><MapPin aria-hidden="true" /><span>地点</span><strong>{caseData.location}</strong></div>
        </div>

        <section className="dossier-section dossier-section--lead">
          <p className="section-number">01 / 事件概要</p>
          <p className="dossier-summary">{caseData.summary}</p>
        </section>

        <div className="dossier-grid">
          <section className="dossier-section">
            <p className="section-number">02 / 核心嫌疑人</p>
            <div className="suspect-file">
              <div className="suspect-monogram"><UserRound aria-hidden="true" /></div>
              <div><h2>{caseData.suspect.name}</h2><p>{caseData.suspect.role}，{caseData.suspect.age} 岁</p><small>{caseData.suspect.publicIdentity}</small></div>
            </div>
            <blockquote><span>初始证词</span>“{caseData.initialStatement}”</blockquote>
          </section>
          <section className="dossier-section">
            <p className="section-number">03 / 玩家任务</p>
            <ul className="task-list">
              <li><ShieldCheck aria-hidden="true" />判断嫌疑人的真实行为</li>
              <li><ShieldCheck aria-hidden="true" />确认行为背后的动机</li>
              <li><ShieldCheck aria-hidden="true" />还原进入现场的手法</li>
              <li><ShieldCheck aria-hidden="true" />选出至多 3 条关键证据</li>
            </ul>
          </section>
        </div>

        <section className="dossier-section">
          <div className="section-heading-row section-heading-row--ink">
            <p className="section-number">04 / 公开证据</p>
            <span className="mono-id">{caseData.evidence.length} FILES</span>
          </div>
          <div className="briefing-evidence-grid">
            {caseData.evidence.map((evidence) => (
              <EvidenceCard key={evidence.id} evidence={evidence} state="public" selected={false} />
            ))}
          </div>
        </section>

        <footer className="dossier-footer">
          <p><b>审讯规则：</b>最多 8 回合。嫌疑人的承认不会自动结案。</p>
          <Button
            variant="dark"
            onClick={() => router.push(withSession(routes.interrogate, session.sessionId))}
          >
            开始审讯 <ArrowRight aria-hidden="true" size={17} />
          </Button>
        </footer>
      </article>
    </main>
  );
}

export default function BriefingPage() {
  return <BriefingScreen caseId="001" />;
}
