'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Aperture, ChevronLeft, ChevronRight, ClipboardList, Home, LogOut, UserRound, UsersRound } from 'lucide-react';
import { useAuth } from '@/stores/auth';

export function PortraitShell({ active, profilePanel, children }: { active: 'home' | 'profiles' | 'tasks'; profilePanel?: ReactNode; hideProfilePanel?: boolean; children: ReactNode }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const links = [{ key: 'home', label: '首页', href: '/studio', icon: Home }, { key: 'profiles', label: '档案中心', href: '/profiles', icon: UsersRound }, { key: 'tasks', label: '任务列表', href: '/works', icon: ClipboardList }];
  const exit = () => {
    if (!window.confirm('退出后再次进入需要有效邀请码。确定退出当前账户吗？')) return;
    Object.keys(sessionStorage).filter((key) => key.startsWith('ai-mirror:draft:')).forEach((key) => sessionStorage.removeItem(key));
    void logout();
  };
  return <div className="portrait-app">
    <header className="portrait-header">
      <Link href="/studio" className="portrait-logo"><span><Aperture size={25} strokeWidth={1.7} /></span><strong>AI 镜界<span className="hidden sm:inline"> · AI 写真</span></strong></Link>
      <div className="relative flex items-center gap-3">
        <Link href="/works" className="portrait-header-link"><ClipboardList size={15} />我的写真</Link>
        {user ? <button type="button" className="portrait-black-button portrait-account" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><UserRound size={15} /><span>{user.nickname || '我的账户'}</span></button> : <Link href="/access" className="portrait-black-button portrait-account">邀请码进入</Link>}
        {accountOpen && <div className="portrait-account-menu"><p>照片和写真仅当前账户可见</p><button type="button" onClick={exit}><LogOut size={15} />退出账户</button></div>}
      </div>
    </header>
    <nav className="portrait-navigation" aria-label="写真导航">{links.map(({ key, label, href, icon: Icon }) => <Link key={key} href={href} aria-current={active === key ? 'page' : undefined} className={active === key ? 'is-current' : ''}><Icon size={24} strokeWidth={1.8} fill={key === 'home' && active === key ? 'currentColor' : 'none'} /><span>{label}</span></Link>)}</nav>
    <div className={`portrait-layout ${profilePanel ? 'with-profiles' : ''} ${collapsed ? 'profiles-collapsed' : ''}`}>
      {profilePanel && <aside className="portrait-profile-panel" aria-label="面部档案">{profilePanel}</aside>}
      {profilePanel && <button type="button" className="portrait-panel-toggle" aria-label={collapsed ? '展开档案栏' : '收起档案栏'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>}
      <main className="portrait-main">{children}</main>
    </div>
  </div>;
}
