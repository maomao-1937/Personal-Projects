"use client";

import { ArrowRight, FilePlus2, LoaderCircle, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { gameApi } from "../api";
import { caseRoutes, clearSessionId, storeSessionId, withSession } from "../session";
import type { CaseListItem } from "../types";

const CURATED_FALLBACK: CaseListItem = {
  caseId: "refined-001-v2",
  caseCode: "IR-26-071",
  generationSource: "manual_fallback",
  title: "夜班档案",
  subtitle: "一份被改写的出入记录",
  time: "深夜",
  location: "封闭办公区",
  contentRating: "12+",
  summary: "三名相关人员给出了能够彼此印证、却无法同时成立的证词。",
  suspectCount: 3,
  evidenceCount: 6,
  difficulty: "标准",
  estimatedMinutes: 15,
};

function normalizeCases(payload: CaseListItem[] | { cases: CaseListItem[] }) {
  return Array.isArray(payload) ? payload : payload.cases;
}

export function CaseLibrary() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [theme, setTheme] = useState("");
  const [difficulty, setDifficulty] = useState<"standard" | "hard">("standard");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setCatalogError(null);
    try {
      const payload = await gameApi.listCases();
      const nextCases = normalizeCases(payload);
      setCases(nextCases.length ? nextCases : [CURATED_FALLBACK]);
    } catch (reason) {
      setCases([CURATED_FALLBACK]);
      setCatalogError(reason instanceof Error ? reason.message : "案件目录暂时无法更新。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const featured = useMemo(
    () => cases.find((item) => item.generationSource === "manual_fallback") ?? cases[0] ?? CURATED_FALLBACK,
    [cases],
  );
  const others = cases.filter((item) => item.caseId !== featured.caseId);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (generating) return;
    setGenerating(true);
    setGenerationError(null);
    try {
      const nextCase = await gameApi.generateCase({ prompt: theme.trim() || undefined, difficulty });
      const session = await gameApi.createSession(nextCase.caseId);
      clearSessionId();
      storeSessionId(session.sessionId);
      router.push(withSession(caseRoutes(nextCase.caseId).dossier, session.sessionId));
    } catch (reason) {
      setGenerationError(reason instanceof Error ? reason.message : "案件生成失败，请重试。");
      setGenerating(false);
    }
  }

  return (
    <div className="case-library">
      <section className="library-lead" aria-labelledby="library-title">
        <div><h1 id="library-title">选择一宗案件</h1><p>精修案件立即开始；自定义案件由 DeepSeek 生成，但结论仍由固定规则验证。</p></div>
        <div className="library-filter" aria-label="案件筛选状态"><Search aria-hidden="true" size={15} /> 全部案卷</div>
      </section>

      {catalogError ? <div className="inline-notice" role="status"><span>目录未同步，已显示本地精修首案。</span><button type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" size={14} />重新同步</button></div> : null}

      <section className="library-grid" aria-busy={loading}>
        <article className="library-featured">
          <header><span className="data-label">{featured.caseCode}</span><span>编辑精选</span></header>
          <div className="library-featured__copy"><h2>{featured.title}</h2><p>{featured.summary ?? featured.subtitle}</p></div>
          <dl>
            <div><dt>调查对象</dt><dd>{featured.suspectCount ?? 3} 名</dd></div>
            <div><dt>证据规模</dt><dd>{featured.evidenceCount ?? 6} 份</dd></div>
            <div><dt>预计时长</dt><dd>{featured.estimatedMinutes ?? 15} 分钟</dd></div>
          </dl>
          <Link className="button button--light" href={caseRoutes(featured.caseId).dossier}>查看案件档案 <ArrowRight aria-hidden="true" size={17} /></Link>
        </article>

        <form className="case-generator" onSubmit={generate}>
          <header><FilePlus2 aria-hidden="true" size={21} /><div><h2>生成自定义案件</h2><p>给出一个场景，其余交给案件生成器。</p></div></header>
          <label><span>案件场景</span><textarea value={theme} onChange={(event) => setTheme(event.target.value)} maxLength={500} rows={4} placeholder="例如：一座封闭美术馆在撤展前夜丢失了唯一的真迹……" disabled={generating} /></label>
          <fieldset disabled={generating}>
            <legend>调查难度</legend>
            <button type="button" aria-pressed={difficulty === "standard"} onClick={() => setDifficulty("standard")}>标准</button>
            <button type="button" aria-pressed={difficulty === "hard"} onClick={() => setDifficulty("hard")}>困难</button>
          </fieldset>
          <Button type="submit" variant="ghost" disabled={generating}>
            {generating ? <LoaderCircle className="button-spinner" aria-hidden="true" size={17} /> : <FilePlus2 aria-hidden="true" size={17} />}
            {generating ? "正在建立案件，可能需要 30–90 秒" : "生成并进入案件"}
          </Button>
          {generationError ? <p className="field-error" role="alert">{generationError}</p> : null}
        </form>
      </section>

      <section className="archive-list" aria-labelledby="archive-title">
        <div className="archive-list__heading"><h2 id="archive-title">其他案卷</h2><span>{others.length} 宗可用</span></div>
        {others.length ? others.map((item) => (
          <Link key={item.caseId} href={caseRoutes(item.caseId).dossier} className="archive-row">
            <span className="data-label">{item.caseCode}</span><strong>{item.title}</strong><span>{item.location}</span><span>{item.difficulty ?? "标准"}</span><ArrowRight aria-hidden="true" size={16} />
          </Link>
        )) : <p className="empty-state">更多精修案件正在归档。你现在可以直接进入主案，或生成一宗新案件。</p>}
      </section>
    </div>
  );
}
