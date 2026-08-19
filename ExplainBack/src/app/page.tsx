import Link from "next/link";

import { EmptyState } from "@/components/ui-states";
import { getDatabase } from "@/server/db/client";
import { createSessionRepository } from "@/server/repositories/session-repository";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
});

export default function Home() {
  const sessions = createSessionRepository(getDatabase()).listRecent(6);

  return (
    <main id="main-content">
      <section className="hero section-wrap" aria-labelledby="hero-title">
        <div className="hero__copy">
          <span className="eyebrow eyebrow--pulse">Learn by explaining · AI 正在倾听</span>
          <h1 id="hero-title">
            让模糊的理解，
            <span>像水一样清楚。</span>
          </h1>
          <p className="hero__lead">
            把刚学过的知识讲给 AI 听。它不会抢着给答案，而会顺着你的解释追问，找到你真正没想清楚的地方。
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="/sessions/new">
              开始一次学习 <span aria-hidden="true">→</span>
            </Link>
            <a className="text-link" href="#method">
              看看它如何训练 <span aria-hidden="true">↘</span>
            </a>
          </div>
          <div className="ripple-hint">
            <span className="ripple-hint__icon" aria-hidden="true" />
            移动、停留或点击鼠标，观察水面尾波与涟漪
          </div>
        </div>

        <div className="hero-demo" aria-label="训练对话示例">
          <div className="orbit orbit--outer" aria-hidden="true" />
          <div className="orbit orbit--inner" aria-hidden="true" />
          <span className="concept-chip concept-chip--coral">外部知识</span>
          <span className="concept-chip concept-chip--mint">生成上下文</span>
          <span className="concept-chip concept-chip--blue">模型边界</span>
          <article className="listening-card glass-card">
            <header>
              <span className="listening-state">
                <span className="sound-wave" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                AI 正在听
              </span>
              <span>问题 1 / 4</span>
            </header>
            <h2>为什么加入外部资料，能够改善模型的回答？</h2>
            <p>先别看资料。请用你自己的话讲给我听。</p>
            <div className="demo-input">
              <span>从这里开始解释…</span>
              <i aria-hidden="true">↑</i>
            </div>
          </article>
        </div>
      </section>

      <section className="method section-wrap" id="method" aria-labelledby="method-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">不是问答工具，是理解训练</span>
            <h2 id="method-title">讲一遍，追一层，再讲明白。</h2>
          </div>
          <p>
            每轮只处理一个知识点、一个问题。状态由确定性规则推进，不让 AI 随意给你“已掌握”的错觉。
          </p>
        </div>
        <div className="method-grid">
          <article className="method-card method-card--sun">
            <span>01</span>
            <h3>学习资料可选</h3>
            <p>输入主题即可直练；粘贴资料后，AI 会严格据此拆解。</p>
          </article>
          <article className="method-card method-card--water">
            <span>02</span>
            <h3>先用自己的话讲</h3>
            <p>不翻资料开始解释。AI 识别已理解、遗漏和明确误解。</p>
          </article>
          <article className="method-card method-card--coral">
            <span>03</span>
            <h3>沿着漏洞再验证</h3>
            <p>逐级提示后必须重新讲；通过验证追问，才会标记为已掌握。</p>
          </article>
        </div>
      </section>

      <section className="recent section-wrap" id="recent" aria-labelledby="recent-title">
        <div className="section-heading section-heading--compact">
          <div>
            <span className="eyebrow">你的学习水位</span>
            <h2 id="recent-title">最近 Sessions</h2>
          </div>
          {sessions.length > 0 ? (
            <Link className="text-link" href="/sessions/new">
              新建学习 <span aria-hidden="true">＋</span>
            </Link>
          ) : null}
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            eyebrow="还没有学习记录"
            title="从一个想讲明白的主题开始"
            description="只需输入主题；也可粘贴 100 字以上的资料。"
            actionLabel="创建第一个 Session"
            actionHref="/sessions/new"
          />
        ) : (
          <div className="session-grid">
            {sessions.map((session) => (
              <Link
                className="session-card glass-card"
                href={`/sessions/${session.id}`}
                key={session.id}
              >
                <div className="session-card__meta">
                  <span>{dateFormatter.format(new Date(session.updatedAt))}</span>
                  <span className={`map-state map-state--${session.mapStatus}`}>
                    {mapStateLabel(session.mapStatus)}
                  </span>
                </div>
                <h3>{session.title}</h3>
                <div className="session-card__progress">
                  <span>
                    {session.masteredCount} / {session.conceptCount} 已掌握
                  </span>
                  <span aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function mapStateLabel(status: "processing" | "ready" | "failed") {
  if (status === "processing") return "生成中";
  if (status === "failed") return "可重试";
  return "学习地图已就绪";
}
