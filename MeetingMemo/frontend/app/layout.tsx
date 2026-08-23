import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/lora/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "MeetingMemo — 会议摘要工作台",
  description: "把会议转写整理成可核对、可编辑、可导出的结构化摘要。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
