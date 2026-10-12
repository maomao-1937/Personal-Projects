import type { Metadata } from "next";

import { AuthExpiryListener } from "@/features/auth/auth-expiry-listener";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI 审讯室｜审问每个人，证据只认事实",
  description: "审问多名嫌疑人、核对证据、追问矛盾，并提交可被规则验证的结案判断。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <AuthExpiryListener />
        {children}
      </body>
    </html>
  );
}
