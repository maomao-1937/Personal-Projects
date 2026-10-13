'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Aperture, LogOut, Menu, X } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/stores/auth';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dark = searchParams.get('variant') === 'xingtu' && (pathname === '/studio' || pathname.startsWith('/studio/') || pathname === '/works');
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
    ? [{ href: dark ? '/studio?variant=xingtu' : '/studio?variant=meitu', label: '开始创作' }, { href: dark ? '/works?variant=xingtu' : '/works?variant=meitu', label: '我的写真' }]
    : [{ href: '/#examples', label: '效果示例' }];
  const isCurrent = (href: string) => pathname === href.split('?')[0] || (href.startsWith('/studio') && pathname.startsWith('/studio/'));
  const handleLogout = () => {
    if (user && !user.email && !user.phone && !window.confirm('退出后，这个邀请码无法再次使用。再次进入需要新邀请码，且无法找回当前作品。确定退出吗？')) return;
    void logout();
  };

  if (pathname === '/studio' || pathname.startsWith('/studio/') || pathname === '/works' || pathname === '/profiles' || pathname === '/access') return null;

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b ${dark ? 'border-white/10 bg-[#1b1d1e] text-white' : 'border-line bg-paper'}`}>
      <nav className="page-shell flex h-16 items-center justify-between" aria-label="主导航">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em]">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${dark ? 'bg-[#d0ff44] text-[#1b1d1e]' : 'bg-stage text-[#fffdf9]'}`}><Aperture size={18} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>AI 镜界</span><span className={`hidden border-l pl-3 text-xs font-normal tracking-normal sm:inline ${dark ? 'border-white/15 text-white/45' : 'border-line text-muted'}`}>私人写真工作台</span>
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          {items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined} className={`inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-medium transition-colors ${dark ? isCurrent(item.href) ? 'bg-[#323636] text-[#d0ff44]' : 'text-white/55 hover:bg-white/10 hover:text-white' : isCurrent(item.href) ? 'bg-[#e7e3dd] text-ink' : 'text-muted hover:bg-[#eeebe6] hover:text-ink'}`}>
              {item.label}
            </Link>
          ))}
          {!loading && (user ? (
            <button type="button" onClick={handleLogout} className={`ml-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm ${dark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-[#eeebe6] hover:text-ink'}`}><LogOut size={16} />退出</button>
          ) : (
            <Link href="/access" className="ml-2 inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-[#a83d27]">邀请码进入</Link>
          ))}
        </div>
        <button ref={menuButtonRef} type="button" aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((open) => !open)} className={`inline-flex h-11 w-11 items-center justify-center rounded-lg sm:hidden ${dark ? 'hover:bg-white/10' : 'hover:bg-[#eeebe6]'}`}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>
      {menuOpen && (
        <div id="mobile-navigation" className={`border-t px-5 py-3 sm:hidden ${dark ? 'border-white/10 bg-[#1b1d1e]' : 'border-line bg-paper'}`}>
          {items.map((item) => <Link key={item.href} href={item.href} className={`flex min-h-12 items-center border-b text-sm font-medium ${dark ? 'border-white/10' : 'border-line'}`}>{item.label}</Link>)}
          {!loading && (user ? <button type="button" onClick={handleLogout} className={`flex min-h-12 w-full items-center gap-2 text-left text-sm ${dark ? 'text-white/55' : 'text-muted'}`}><LogOut size={16} />退出</button> : <Link href="/access" className="mt-3 flex min-h-11 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">邀请码进入</Link>)}
        </div>
      )}
    </header>
  );
}
