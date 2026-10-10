'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Check, Download, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { CUSTOM_STYLE_ID, deletePortrait, downloadProtectedImage, getErrorMessage, getPortrait, getPortraitStatus, isNotFoundError, type PortraitRecord } from '@/lib/api';
import { useStyles } from '@/hooks/useStyles';
import { useAuth } from '@/stores/auth';

const styleStorageKey = (userId: string) => `ai-mirror:studio:${userId}:style-id`;
type LoadError = 'not-found' | 'network' | null;

function TaskContent() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;
  const router = useRouter();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { styles } = useStyles();
  const [task, setTask] = useState<PortraitRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fail = (reason: unknown) => { if (!active || controller.signal.aborted) return; setLoadError(isNotFoundError(reason) ? 'not-found' : 'network'); setLoading(false); };
    const poll = async () => {
      try {
        const status = await getPortraitStatus(taskId, controller.signal);
        if (!active) return;
        setTask((current) => current ? { ...current, ...status } : status);
        if (status.status === 'pending' || status.status === 'processing') timer = setTimeout(() => void poll(), 2500);
      } catch (reason) { fail(reason); }
    };
    setLoading(true); setLoadError(null);
    getPortrait(taskId).then((portrait) => { if (!active) return; setTask(portrait); setLoading(false); if (portrait.status === 'pending' || portrait.status === 'processing') void poll(); }).catch(fail);
    return () => { active = false; controller.abort(); if (timer) clearTimeout(timer); };
  }, [refreshKey, taskId]);

  const style = useMemo(() => styles.find((item) => item.id === task?.style_id), [styles, task?.style_id]);
  const styleName = task?.style_id === CUSTOM_STYLE_ID ? '自定义创作' : style?.name || '所选主题';
  const download = async () => {
    if (!task?.result_url) return;
    setDownloading(true);
    try { await downloadProtectedImage(task.result_url, `AI镜界-${task.id.slice(0, 8)}`); }
    catch (reason) { showToast('error', getErrorMessage(reason, '下载失败，请稍后重试')); }
    finally { setDownloading(false); }
  };
  const again = () => { if (task && user && task.style_id !== CUSTOM_STYLE_ID) localStorage.setItem(styleStorageKey(user.id), task.style_id); router.push('/studio'); };
  const remove = async () => {
    if (!task || !window.confirm('删除后无法恢复，确定删除这张写真吗？')) return;
    setDeleting(true);
    try { await deletePortrait(task.id); showToast('success', '写真已删除'); router.replace('/works'); }
    catch (reason) { showToast('error', getErrorMessage(reason, '删除失败，请稍后重试')); setDeleting(false); }
  };

  if (loading) return <FullState icon={<Loader2 className="animate-spin" />} title="正在读取写真任务" copy="正在同步最新状态…" />;
  if (loadError === 'not-found') return <FullState icon={<AlertCircle />} title="没有找到这个任务" copy="任务可能已删除，或不属于当前账户。" action={<Link href="/works" className="inline-flex min-h-12 items-center rounded-xl bg-brand px-6 font-medium text-white">返回我的写真</Link>} />;
  if (loadError === 'network') return <FullState icon={<AlertCircle />} title="暂时无法读取任务" copy="网络连接失败，任务本身不会丢失。" action={<Button onClick={() => setRefreshKey((key) => key + 1)}>重新连接</Button>} />;
  if (!task) return <FullState icon={<AlertCircle />} title="任务信息不完整" copy="请从我的写真重新进入。" action={<Link href="/works">返回我的写真</Link>} />;

  const running = task.status === 'pending' || task.status === 'processing';
  const completed = task.status === 'completed' && task.result_url;
  return (
    <main className="min-h-screen bg-canvas pb-24 pt-16 lg:pb-12">
      <div className="page-shell py-7 sm:py-10">
        <div className="flex items-end justify-between gap-4">
          <div><h1 className="display-title text-3xl sm:text-4xl">{completed ? '你的写真' : running ? '正在生成写真' : '这次生成未完成'}</h1><p className="mt-2 text-sm text-muted">从创作方向到最终结果，都可以在这里查看。</p></div>
          <Link href="/works" className="hidden min-h-11 items-center text-sm font-medium text-muted hover:text-ink sm:inline-flex">返回我的写真</Link>
        </div>
        <div className="studio-workspace mt-6 overflow-hidden rounded-xl bg-paper lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
          <section className="darkroom-surface flex min-h-[430px] flex-col p-4 sm:min-h-[570px] sm:p-6 lg:h-full lg:min-h-0" aria-label="写真结果">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 text-xs">
              <span className="font-medium text-white/80">{completed ? '生成结果' : running ? '制作中' : '任务未完成'}</span>
              <span className="text-white/55">AI 镜界 · 私人写真</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center py-4">
              {completed ? (
                <div className="photo-mat relative flex h-[320px] w-full max-w-[560px] items-center justify-center overflow-hidden sm:h-[470px] lg:h-full">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={task.result_url!} alt="生成完成的 AI 写真" className="h-full w-full object-contain" /></div>
              ) : running ? (
                <div className="photo-mat relative flex h-[320px] w-full max-w-[560px] flex-col items-center justify-center overflow-hidden px-6 text-center sm:h-[470px] lg:h-full">
                  {style?.previewImage && <Image src={style.previewImage} alt="" fill sizes="(max-width:1023px) 100vw, 55vw" className="object-cover opacity-20" />}
                  <div className="relative z-10 text-white"><Loader2 size={30} className="mx-auto animate-spin" aria-hidden="true" /><p className="mt-5 text-lg font-semibold">正在制作你的写真</p><p className="mt-2 text-sm text-white/70">主题图片仅供参考，结果尚未生成。</p></div>
                </div>
              ) : (
                <div className="photo-mat flex h-[320px] w-full max-w-[560px] flex-col items-center justify-center px-6 text-center sm:h-[470px] lg:h-full"><AlertCircle size={32} className="text-[#f2b0aa]" aria-hidden="true" /><p className="mt-5 text-lg font-semibold">没有生成结果</p><p className="mt-2 max-w-xs text-sm leading-6 text-white/70">这条任务记录已保留。可以重新上传照片，再试一次。</p></div>
              )}
            </div>
            <p className="border-t border-white/10 pt-4 text-xs leading-5 text-white/65">{completed ? '这是本次任务的实际生成结果。' : running ? '页面会自动更新状态；你也可以稍后从「我的写真」返回。' : '这次没有生成图片，你可以返回工作台重新尝试。'}</p>
          </section>
          <aside className="flex min-h-0 flex-col justify-between border-t border-line p-5 sm:p-7 lg:h-full lg:border-l lg:border-t-0">
            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <p className={`inline-flex items-center gap-2 text-sm font-medium ${completed ? 'text-success' : running ? 'text-brand' : 'text-signal'}`}>{completed ? <Check size={17} aria-hidden="true" /> : running ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <AlertCircle size={17} aria-hidden="true" />}{completed ? '生成完成' : running ? '正在生成' : '生成失败'}</p>
              <h2 className="display-title mt-5 text-3xl">{completed ? '可以下载了' : running ? '结果还在路上' : '重新制作一张'}</h2>
              <p className="mt-4 text-sm leading-7 text-muted">{completed ? '写真已经保存在你的作品中，可以直接下载。' : running ? '无需停留在此页。完成后，这条任务会在我的写真中更新。' : '本次任务没有完成。返回工作台重新上传自拍并选择创作方向。'}</p>
              <dl className="mt-8 divide-y divide-line border-y border-line text-sm"><div className="flex justify-between gap-4 py-4"><dt className="text-muted">创作方向</dt><dd className="text-right font-medium">{styleName}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-muted">创建时间</dt><dd className="text-right">{new Date(task.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd></div></dl>
            </div>
            <div className="mt-10 grid shrink-0 gap-3 lg:mt-0 lg:pt-4">
              {completed && <Button size="lg" fullWidth loading={downloading} leftIcon={<Download size={18} />} onClick={download}>下载写真</Button>}
              {running && <Button variant="outline" size="lg" fullWidth leftIcon={<RefreshCw size={18} />} onClick={() => setRefreshKey((key) => key + 1)}>刷新状态</Button>}
              {!running && <Button variant={completed ? 'outline' : 'primary'} size="lg" fullWidth leftIcon={<RefreshCw size={18} />} onClick={again}>{completed ? '再做一张' : '重新制作'}</Button>}
              <Link href="/works" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-muted hover:text-ink">返回我的写真</Link>
              {!running && <Button variant="ghost" size="sm" fullWidth loading={deleting} leftIcon={<Trash2 size={16} />} className="text-muted" onClick={remove}>删除这条记录</Button>}
            </div>
          </aside>
        </div>
      </div>
      {completed && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden"><Button size="lg" fullWidth loading={downloading} leftIcon={<Download size={18} />} onClick={download}>下载写真</Button></div>}
    </main>
  );
}

function FullState({ icon, title, copy, action }: { icon: React.ReactNode; title: string; copy: string; action?: React.ReactNode }) {
  return <main className="page-shell flex min-h-screen items-center justify-center pt-16"><div className="w-full max-w-xl border-y border-line py-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center text-muted">{icon}</div><h1 className="display-title mt-5 text-3xl">{title}</h1><p className="mt-4 text-muted">{copy}</p>{action && <div className="mt-7">{action}</div>}</div></main>;
}

export default function TaskPage() { return <ProtectedRoute><TaskContent /></ProtectedRoute>; }
