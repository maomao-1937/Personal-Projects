import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-wrap error-page" id="main-content">
      <div className="state-card">
        <span className="eyebrow">404 · 没有找到</span>
        <h1>这份学习内容可能已被移动</h1>
        <p>检查链接是否完整，或回到首页继续最近一次学习。</p>
        <div className="error-actions">
          <Link className="button button--primary" href="/">
            返回首页
          </Link>
          <Link className="button button--soft" href="/sessions/new">
            新建学习
          </Link>
        </div>
      </div>
    </main>
  );
}

