import type { Metadata } from "next";
import Link from "next/link";

import { WaterBackground } from "@/components/water-background";
import "./globals.css";

export const metadata: Metadata = {
  title: "ExplainBack｜把知识讲明白",
  description: "用费曼学习法发现知识盲点，并通过追问真正学会。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <WaterBackground />
        <header className="site-header">
          <div className="site-header__inner">
            <Link className="brand" href="/" aria-label="ExplainBack 首页">
              <span className="brand__mark" aria-hidden="true" />
              <span>ExplainBack</span>
            </Link>
            <nav className="site-nav" aria-label="主导航">
              <Link href="/#method">学习方法</Link>
              <Link href="/#recent">最近学习</Link>
              <Link className="nav-cta" href="/sessions/new">
                开始学习
                <span aria-hidden="true">↗</span>
              </Link>
            </nav>
          </div>
        </header>
        <div className="site-shell">{children}</div>
      </body>
    </html>
  );
}
