'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu, Sparkles, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/stores/auth';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const items = user
    ? [{ href: '/studio', label: '开始创作' }, { href: '/works', label: '我的写真' }]
    : [{ href: '/#examples', label: '效果示例' }];
  const isCurrent = (href: string) => pathname === href || (href === '/studio' && pathname.startsWith('/studio/'));

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-paper/90 shadow-[0_1px_0_rgba(23,22,18,0.02)] backdrop-blur-xl">
      <nav className="page-shell flex h-16 items-center justify-between" aria-label="主导航">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em]">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand text-white shadow-[0_5px_14px_rgba(200,75,49,0.22)]"><Sparkles size={17} aria-hidden="true" /></span>
          <span>AI 镜界</span><span className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-muted/70 sm:inline">portrait lab</span>
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined} className={`inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors ${isCurrent(item.href) ? 'bg-[#e7e3dd] text-ink' : 'text-muted hover:bg-[#eeebe6] hover:text-ink'}`}>
              {item.label}
            </Link>
          ))}
          {!loading && (user ? (
            <button type="button" onClick={() => void logout()} className="ml-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-[#eeebe6] hover:text-ink"><LogOut size={16} />退出</button>
          ) : (
            <Link href="/access" className="ml-2 inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(200,75,49,0.16)] transition-colors hover:bg-[#a83d27]">邀请码进入</Link>
          ))}
        </div>
        <button ref={menuButtonRef} type="button" aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[#eeebe6] sm:hidden">
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>
      {menuOpen && (
        <div id="mobile-navigation" className="border-t border-line bg-paper px-5 py-3 sm:hidden">
          {items.map((item) => <Link key={item.href} href={item.href} className="flex min-h-12 items-center border-b border-line text-sm font-medium">{item.label}</Link>)}
          {!loading && (user ? <button type="button" onClick={() => void logout()} className="flex min-h-12 w-full items-center gap-2 text-left text-sm text-muted"><LogOut size={16} />退出</button> : <Link href="/access" className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white shadow-[0_5px_14px_rgba(200,75,49,0.16)]">邀请码进入</Link>)}
        </div>
      )}
    </header>
  );
}
