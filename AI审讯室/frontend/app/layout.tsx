import type { Metadata } from "next";

import { AuthExpiryListener } from "@/features/auth/auth-expiry-listener";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI 审讯室｜8 次提问，击穿一条谎言链",
  description: "固定真相、证据驱动、由你主动结案的网页审讯推理游戏。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AuthExpiryListener />
        {children}
      </body>
    </html>
  );
}
