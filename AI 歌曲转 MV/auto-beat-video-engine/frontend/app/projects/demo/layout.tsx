import type { ReactNode } from "react";
import { DemoProjectProvider } from "./_components/demo-project-provider";
import { DemoShell } from "./_components/demo-shell";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoProjectProvider>
      <DemoShell>{children}</DemoShell>
    </DemoProjectProvider>
  );
}
