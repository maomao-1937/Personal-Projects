"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <main className="page-wrap error-page" id="main-content">
      <div className="state-card state-card--error" role="alert">
        <span className="eyebrow">可以恢复</span>
        <h1>这一步没有顺利完成</h1>
        <p>你的已保存内容不会因为这个页面错误而丢失。可以重试，或返回上一层学习地图。</p>
        <div className="error-actions">
          <button className="button button--primary" type="button" onClick={reset}>
            重试当前操作
          </button>
          <button
            className="button button--soft"
            type="button"
            onClick={() => window.history.back()}
          >
            返回学习地图
          </button>
          <Link className="text-link" href="/">
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}

