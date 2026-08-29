import type { Metadata } from "next";

import { AccessForm } from "@/features/auth/access-form";
import { safeNextPath } from "@/features/auth/constants";

export const metadata: Metadata = {
  title: "访问核验｜AI 审讯室",
  description: "验证访问令牌后进入 AI 审讯室。",
};

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const nextPath = safeNextPath((await searchParams).next);

  return (
    <main className="access-page">
      <header className="access-bar">
        <span className="wordmark" aria-label="AI 审讯室">
          <span>AI</span> 审讯室
        </span>
        <span className="mono-meta">CONTROLLED ACCESS</span>
      </header>

      <section className="access-stage" aria-labelledby="access-title">
        <aside className="access-seal" aria-hidden="true">
          <span>ENTRY</span>
          <strong>准入</strong>
          <small>AUTH / REQUIRED</small>
        </aside>
        <article className="access-card">
          <div className="access-card__meta">
            <span className="mono-id">INTERROGATION FACILITY</span>
            <span className="status-label status-label--ineffective">待核验</span>
          </div>
          <div className="access-card__copy">
            <p className="eyebrow eyebrow--ink">ACCESS CONTROL</p>
            <h1 id="access-title">出示访问凭据</h1>
            <p>输入唯一访问令牌，核验通过后进入审讯工作台。</p>
          </div>
          <AccessForm nextPath={nextPath} />
          <footer>
            <span>记录范围</span>
            <strong>案件进度与结案结果</strong>
          </footer>
        </article>
      </section>
    </main>
  );
}
