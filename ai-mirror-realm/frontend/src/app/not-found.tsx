import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* 404 数字 - 极简风格 */}
        <div className="relative mb-8">
          <h1 className="text-8xl md:text-9xl font-bold gradient-text tracking-tight">404</h1>
          <div className="absolute -top-2 -right-4 md:-right-8">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center rotate-12">
              <Sparkles size={20} className="text-white" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-3">页面走丢了</h2>
        <p className="text-text-dim text-sm mb-10 leading-relaxed">
          你寻找的页面似乎已经消失在镜中世界<br />
          让我们回到起点，重新出发
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-accent/30"
        >
          <ArrowLeft size={18} />
          返回首页
        </Link>
      </div>
    </div>
  );
}
