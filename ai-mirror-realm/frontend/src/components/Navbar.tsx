'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import { Sparkles, User, LogOut, Coins } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { href: '/', label: '首页' },
    { href: '/styles', label: '风格' },
  ];

  if (user) {
    navItems.push({ href: '/profile', label: '我的' });
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">AI 镜界</span>
        </Link>

        <div className="flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors ${
                pathname === item.href
                  ? 'text-accent-light'
                  : 'text-text-dim hover:text-text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {user ? (
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/recharge')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-glow border border-accent/30 hover:border-gold/50 hover:bg-gold/10 transition-colors"
                title="点击充值"
              >
                <Coins size={14} className="text-gold" />
                <span className="text-sm text-gold font-medium">{user.credits}</span>
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-sm text-text-dim hover:text-red-400 transition-colors"
              >
                <LogOut size={14} />
                退出
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm text-text-dim hover:text-text-primary transition-colors">
                登录
              </Link>
              <Link
                href="/register"
                className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-dark text-white text-sm font-medium transition-colors"
              >
                注册
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
