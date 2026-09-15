import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="mb-5 font-mono text-sm tracking-[0.24em] text-muted">ERROR 404</p>

        <h1 className="display-title mb-4 text-5xl sm:text-6xl">页面走丢了</h1>
        <p className="text-text-dim text-sm mb-10 leading-relaxed">
          这里没有找到你要看的内容。返回首页，或重新浏览写真模板。
        </p>

        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ink px-7 py-3 text-sm font-medium text-paper transition-colors hover:bg-accent-light"
        >
          <ArrowLeft size={18} />
          返回首页
        </Link>
      </div>
    </div>
  );
}
