import Providers from './providers';
import Navbar from '@/components/Navbar';
import PageTransition from '@/components/PageTransition';
import ErrorBoundary from '@/components/ErrorBoundary';
import './globals.css';

export const metadata = {
  title: 'AI 镜界｜一张自拍，制作个人 AI 写真',
  description: '上传一张自拍，描述画面或选择写真主题，生成并下载属于你的 AI 写真。',
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
