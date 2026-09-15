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
    <main className="min-h-screen bg-stage pb-24 pt-16 lg:pb-0">
      <div className="page-shell py-8 sm:py-10">
        <div className="mb-6 flex items-center justify-between gap-4"><div><p className="editorial-kicker text-[#f06a47]">Portrait task</p><h1 className="mt-2 text-2xl font-semibold text-white">{completed ? '你的写真已生成' : running ? '正在生成写真' : '这次没有生成完成'}</h1></div><Link href="/works" className="text-sm font-medium text-white/60 hover:text-white">我的写真</Link></div>
        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-paper shadow-card lg:grid lg:h-[680px] lg:grid-cols-[minmax(0,1.25fr)_420px]">
          <section className="flex min-h-[500px] items-center justify-center bg-stage p-5 sm:p-8">
            {completed ? (
              <div className="relative h-full min-h-[460px] w-full max-w-[580px] overflow-hidden rounded-2xl bg-[#1d1e23]">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={task.result_url!} alt="生成完成的 AI 写真" className="h-full w-full object-contain" /></div>
            ) : style?.previewImage ? (
              <div className="relative h-full min-h-[460px] w-full max-w-[580px] overflow-hidden rounded-2xl bg-[#1d1e23]"><Image src={style.previewImage} alt={`${style.name}主题预览`} fill sizes="(max-width:1023px) 100vw, 55vw" className="object-cover opacity-35" /><div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center text-white">{running ? <Loader2 size={34} className="animate-spin" /> : <AlertCircle size={34} />}<p className="mt-6 text-xl font-semibold">{running ? 'AI 正在制作你的写真' : '生成没有完成'}</p><p className="mt-2 max-w-sm text-sm leading-6 text-white/60">{running ? '通常需要一点时间，你可以离开此页，任务会继续进行。' : '自拍不会公开展示；重新上传后即可再次生成。'}</p></div></div>
            ) : <div className="text-center text-white">{running ? <Loader2 size={34} className="mx-auto animate-spin" /> : <AlertCircle size={34} className="mx-auto" />}<p className="mt-5">{running ? 'AI 正在制作你的写真' : '生成没有完成'}</p></div>}
          </section>

          <aside className="flex flex-col justify-between border-t border-line p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div>
              <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${completed ? 'bg-[#e3f1ea] text-success' : running ? 'bg-[#f2ddd7] text-brand' : 'bg-[#fae4e5] text-signal'}`}>{completed ? <Check size={16} /> : running ? <Loader2 size={16} className="animate-spin" /> : <AlertCircle size={16} />}{completed ? '生成完成' : running ? '生成中' : '生成失败'}</div>
              <h2 className="display-title mt-6 text-4xl">{completed ? '写真已就绪' : running ? '稍等片刻' : '重新上传再试'}</h2>
              <p className="mt-4 leading-7 text-muted">{completed ? `已按「${styleName}」完成，可以直接下载。` : running ? '完成后页面会自动更新。你也可以去我的写真，稍后再回来查看。' : '这次任务没有完成。重新上传一张自拍后即可再次生成。'}</p>
              <dl className="mt-8 divide-y divide-line border-y border-line text-sm"><div className="flex justify-between py-4"><dt className="text-muted">创作方向</dt><dd className="font-medium">{styleName}</dd></div><div className="flex justify-between py-4"><dt className="text-muted">创建时间</dt><dd>{new Date(task.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd></div></dl>
            </div>
            <div className="mt-10 grid gap-3">
              {completed && <Button size="lg" fullWidth loading={downloading} leftIcon={<Download size={18} />} onClick={download}>下载写真</Button>}
              {running && <Button variant="outline" size="lg" fullWidth leftIcon={<RefreshCw size={18} />} onClick={() => setRefreshKey((key) => key + 1)}>刷新状态</Button>}
              <Button variant={completed ? 'outline' : 'primary'} size="lg" fullWidth leftIcon={<RefreshCw size={18} />} onClick={again}>{completed ? '再做一张' : '重新上传自拍'}</Button>
              <Link href="/studio" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-muted hover:text-ink">调整创作方向</Link>
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
  return <main className="page-shell flex min-h-screen items-center justify-center pt-16"><div className="w-full max-w-xl rounded-2xl border border-line bg-paper p-10 text-center shadow-card"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0f0f3] text-muted">{icon}</div><h1 className="display-title mt-6 text-4xl">{title}</h1><p className="mt-4 text-muted">{copy}</p>{action && <div className="mt-7">{action}</div>}</div></main>;
}

export default function TaskPage() { return <ProtectedRoute><TaskContent /></ProtectedRoute>; }
