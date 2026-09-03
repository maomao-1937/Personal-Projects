"use client";

import type { ReactNode } from "react";
import { Clapperboard, Eye, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./demo-shell.module.css";

type WorkspaceDestination = {
  href: string;
  label: string;
  icon: typeof Clapperboard;
};

const destinations: WorkspaceDestination[] = [
  { href: "/projects/demo/storyboard", label: "故事板", icon: Clapperboard },
  {
    href: "/projects/demo/storyboard/shots/shot-06",
    label: "镜头编辑",
    icon: Sparkles,
  },
  { href: "/projects/demo/preview", label: "预览", icon: Eye },
];

function isCurrentDestination(pathname: string, href: string) {
  if (href.endsWith("/storyboard")) {
    return pathname === href;
  }

  if (href.includes("/storyboard/shots/")) {
    return pathname.startsWith("/projects/demo/storyboard/shots/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DemoShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        跳到主内容
      </a>
      <nav className={styles.workspaceNav} aria-label="工作区">
        <Link className={styles.brand} href="/projects/demo/storyboard" aria-label="声画故事板">
          声
        </Link>
        <div className={styles.destinations}>
          {destinations.map(({ href, icon: Icon, label }) => {
            const isCurrent = isCurrentDestination(pathname, href);

            return (
              <Link
                aria-current={isCurrent ? "page" : undefined}
                className={styles.destination}
                href={href}
                key={href}
                title={label}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <header className={styles.topbar}>
        <div className={styles.projectName}>
          <span>项目</span>
          <strong>雨后失焦</strong>
        </div>
        <div className={styles.projectStatus}>
          <span className={styles.connection}>未连接服务</span>
          <span aria-label="本地账户 LX" className={styles.accountButton}>
            LX
          </span>
        </div>
      </header>
      <main className={styles.main} id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
