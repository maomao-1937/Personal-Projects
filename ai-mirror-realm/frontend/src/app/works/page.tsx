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
    <main className="min-h-screen bg-canvas pt-16">
      <header className="border-b border-line bg-paper">
        <div className="page-shell flex flex-col gap-5 py-9 sm:flex-row sm:items-end sm:justify-between sm:py-12">
          <div><h1 className="display-title text-3xl sm:text-4xl">我的写真</h1><p className="mt-3 text-sm leading-6 text-muted">已完成的结果与进行中的任务，都在这里。</p></div>
          <Link href="/studio" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-[#a83d27]">创建新写真 <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </header>
      <div className="page-shell py-7 sm:py-10">
        <div className="flex gap-1 overflow-x-auto border-b border-line" aria-label="写真状态筛选">
          {filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)} className={`min-h-11 shrink-0 border-b-2 px-4 text-sm font-medium transition-colors ${filter === item ? 'border-brand text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{labels[item]} <span className="ml-1 tabular-nums text-xs">{counts[item]}</span></button>)}
        </div>
        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" role="status" aria-label="正在读取写真">{[0,1,2,3].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-lg bg-[#e6e2dc]" />)}</div>
        ) : error ? (
          <EmptyState icon={<AlertCircle />} title="暂时无法读取写真" copy={error} action={<Button variant="outline" leftIcon={<RefreshCw size={17} />} onClick={() => void load()}>重新加载</Button>} />
        ) : visible.length === 0 ? (
          <EmptyState icon={<ImageIcon />} title={portraits.length ? `没有${labels[filter]}的写真` : '从第一张写真开始'} copy={portraits.length ? '切换分类查看其他任务。' : '上传一张自拍，再描述画面或选择主题。'} action={portraits.length ? <Button variant="outline" onClick={() => setFilter('all')}>查看全部</Button> : <Link href="/studio" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white">开始创作</Link>} />
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {visible.map((portrait) => {
              const style = styles.find((item) => item.id === portrait.style_id);
              const running = portrait.status === 'pending' || portrait.status === 'processing';
              const completed = portrait.status === 'completed' && portrait.result_url;
              const styleName = portrait.style_id === CUSTOM_STYLE_ID ? '自定义创作' : style?.name || '写真任务';
              return (
                <Link key={portrait.id} href={`/studio/tasks/${encodeURIComponent(portrait.id)}`} className="group block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-stage">
                    {completed ? <img src={portrait.result_url!} alt={`${styleName}写真结果`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : (
                      <div className="relative flex h-full flex-col items-center justify-center px-3 text-center text-white">
                        {running && style?.previewImage && <Image src={style.previewImage} alt="" fill sizes="(max-width:639px) 50vw, 25vw" className="object-cover opacity-20" />}
                        <div className="relative z-10">{running ? <Clock3 size={25} className="mx-auto" aria-hidden="true" /> : <AlertCircle size={25} className="mx-auto text-[#f2b0aa]" aria-hidden="true" />}<p className="mt-3 text-sm font-medium">{running ? '结果生成中' : '本次未完成'}</p><p className="mt-2 text-[11px] leading-4 text-white/70">{running && style?.previewImage ? '背景是主题参考' : '打开任务查看详情'}</p></div>
                      </div>
                    )}
                  </div>
                  <div className="pt-3"><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-medium">{styleName}</p><span className={`shrink-0 text-xs ${portrait.status === 'failed' ? 'text-signal' : completed ? 'text-success' : 'text-brand'}`}>{statusLabels[portrait.status]}</span></div><p className="mt-1 text-xs text-muted">{new Date(portrait.created_at).toLocaleDateString('zh-CN')}</p></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyState({ icon, title, copy, action }: { icon: React.ReactNode; title: string; copy: string; action: React.ReactNode }) {
  return <div className="state-panel mt-8"><div className="mx-auto flex h-10 w-10 items-center justify-center text-muted">{icon}</div><h2 className="mt-4 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-muted">{copy}</p><div className="mt-6">{action}</div></div>;
}

export default function WorksPage() { return <ProtectedRoute><WorksContent /></ProtectedRoute>; }
