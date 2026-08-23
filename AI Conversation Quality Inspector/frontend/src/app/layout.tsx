import "@fontsource-variable/inter";
import "@fontsource-variable/inter-tight";
import type { Metadata, Viewport } from "next";

import "./globals.css";


export const metadata: Metadata = {
  title: "对话标尺｜AI 销售与客服质检",
  description: "把每个质检判断连回原对话证据。",
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf9",
};


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
