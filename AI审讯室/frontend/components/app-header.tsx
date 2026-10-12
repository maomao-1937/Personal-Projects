import { Fingerprint } from "lucide-react";
import Link from "next/link";

import { AccessMenu } from "@/features/auth/access-menu";

export function AppHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`site-header${compact ? " site-header--compact" : ""}`}>
      <Link href="/" className="brand-mark" aria-label="AI 审讯室首页">
        <Fingerprint aria-hidden="true" size={21} />
        <span>AI 审讯室</span>
      </Link>
      <nav aria-label="主导航">
        <Link href="/cases">案件库</Link>
        {process.env.ACCESS_GATE_ENABLED === "true" ? <AccessMenu /> : null}
      </nav>
    </header>
  );
}
