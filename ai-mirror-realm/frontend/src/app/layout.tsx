import Providers from './providers';
import Navbar from '@/components/Navbar';
import PageTransition from '@/components/PageTransition';
import ErrorBoundary from '@/components/ErrorBoundary';
import './globals.css';

export const metadata = {
  title: 'AI 镜界 - 遇见另一个自己',
  description: '上传一张自拍，AI 为你生成专属艺术写真',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <div className="portal-bg" />
          <Navbar />
          <ErrorBoundary>
            <PageTransition>{children}</PageTransition>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
