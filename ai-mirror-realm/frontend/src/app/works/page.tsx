'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Clock3, ImageIcon, RefreshCw } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { CUSTOM_STYLE_ID, getErrorMessage, getPortraits, type PortraitRecord } from '@/lib/api';
import { useStyles } from '@/hooks/useStyles';

type Filter = 'all' | 'completed' | 'processing' | 'failed';
const labels: Record<Filter, string> = { all: '全部', completed: '已完成', processing: '生成中', failed: '失败' };
const statusLabels: Record<PortraitRecord['status'], string> = { pending: '等待中', processing: '生成中', completed: '已完成', failed: '失败' };

function WorksContent() {
  const { styles } = useStyles();
  const [portraits, setPortraits] = useState<PortraitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setPortraits(await getPortraits()); } catch (reason) { setError(getErrorMessage(reason, '写真列表加载失败')); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({ all: portraits.length, completed: portraits.filter((item) => item.status === 'completed').length, processing: portraits.filter((item) => item.status === 'pending' || item.status === 'processing').length, failed: portraits.filter((item) => item.status === 'failed').length }), [portraits]);
  const filters = useMemo<Filter[]>(() => counts.failed ? ['all', 'completed', 'processing', 'failed'] : ['all', 'completed', 'processing'], [counts.failed]);
  const visible = useMemo(() => portraits.filter((portrait) => filter === 'all' || (filter === 'processing' ? portrait.status === 'pending' || portrait.status === 'processing' : portrait.status === filter)), [filter, portraits]);

  return (
    <main className="min-h-screen pt-16">
      <header className="relative overflow-hidden border-b border-white/10 bg-stage"><div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 opacity-35 lg:block"><Image src="/style-previews/chaoku.jpg" alt="" fill priority sizes="50vw" className="object-cover" /></div><div className="page-shell relative flex flex-col justify-between gap-6 py-12 sm:flex-row sm:items-end sm:py-16"><div><p className="editorial-kicker text-[#f06a47]">Personal gallery</p><h1 className="display-title mt-3 text-4xl text-white sm:text-5xl">我的写真</h1><p className="mt-4 max-w-md text-white/60">你的每一次创作，都会留在这里。</p></div><Link href="/studio" className="inline-flex min-h-12 w-fit items-center gap-2 rounded-xl bg-brand px-6 font-semibold text-white hover:bg-[#a83d27]">创建新写真 <ArrowRight size={18} /></Link></div></header>
      <div className="page-shell py-8 sm:py-10">
        <div className="flex gap-1 overflow-x-auto border-b border-line" aria-label="写真状态筛选">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium ${filter === item ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>{labels[item]} <span className="ml-1 tabular-nums">{counts[item]}</span></button>)}</div>
        {loading ? <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{[0,1,2,3].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-2xl bg-[#e9e9ed]" />)}</div> : error ? <EmptyState icon={<AlertCircle />} title="暂时无法读取写真" copy={error} action={<Button variant="outline" leftIcon={<RefreshCw size={17} />} onClick={() => void load()}>重新加载</Button>} /> : visible.length === 0 ? <EmptyState icon={<ImageIcon />} title={portraits.length ? `没有${labels[filter]}的写真` : '还没有写真'} copy={portraits.length ? '切换分类查看其他任务。' : '上传一张自拍，输入描述或选择主题，开始第一张写真。'} action={portraits.length ? <Button variant="outline" onClick={() => setFilter('all')}>查看全部</Button> : <Link href="/studio" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white">开始创作</Link>} /> : (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{visible.map((portrait) => {
            const style = styles.find((item) => item.id === portrait.style_id);
            const running = portrait.status === 'pending' || portrait.status === 'processing';
            const styleName = portrait.style_id === CUSTOM_STYLE_ID ? '自定义创作' : style?.name || '写真任务';
            return <Link key={portrait.id} href={`/studio/tasks/${encodeURIComponent(portrait.id)}`} className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"><div className="photo-frame aspect-[3/4] bg-[#e9e9ed]">{portrait.status === 'completed' && portrait.result_url ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={portrait.result_url} alt={`${styleName}写真`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : style?.previewImage ? <><Image src={style.previewImage} alt={`${style.name}主题预览`} fill sizes="(max-width:639px) 50vw, 25vw" className="object-cover opacity-45" /><div className="absolute inset-0 flex items-center justify-center bg-black/20">{running ? <Clock3 className="text-white" /> : <AlertCircle className="text-white" />}</div></> : <div className="flex h-full items-center justify-center">{running ? <Clock3 className="text-muted" /> : <AlertCircle className="text-signal" />}</div>}</div><div className="px-1 py-3"><div className="flex items-center justify-between gap-2"><p className="truncate font-medium">{styleName}</p><span className={`shrink-0 text-xs ${portrait.status === 'failed' ? 'text-signal' : portrait.status === 'completed' ? 'text-success' : 'text-brand'}`}>{statusLabels[portrait.status]}</span></div><p className="mt-1 text-xs text-muted">{new Date(portrait.created_at).toLocaleDateString('zh-CN')}</p></div></Link>;
          })}</div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ icon, title, copy, action }: { icon: React.ReactNode; title: string; copy: string; action: React.ReactNode }) { return <div className="mt-8 rounded-2xl border border-dashed border-line bg-paper px-6 py-16 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0f0f3] text-muted">{icon}</div><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-2 text-muted">{copy}</p><div className="mt-6">{action}</div></div>; }

export default function WorksPage() { return <ProtectedRoute><WorksContent /></ProtectedRoute>; }
