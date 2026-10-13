'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Check, Download, Loader2, Maximize2, RefreshCw, Trash2, X } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PortraitShell } from '@/components/PortraitShell';
import { useToast } from '@/contexts/ToastContext';
import { useStyles } from '@/hooks/useStyles';
import { CUSTOM_STYLE_ID, deletePortrait, downloadProtectedImage, getErrorMessage, getPortrait, getPortraitStatus, getProfiles, getSelfiePreview, isNotFoundError, selfiePreviewUrl, type FaceProfileRecord, type PortraitRecord } from '@/lib/api';

type LoadError = 'not-found' | 'network' | null;
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';
const primaryClass = `${buttonClass} bg-[#171717] text-[#f9dbca] hover:bg-[#333333]`;
const secondaryClass = `${buttonClass} border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#f7f7f7]`;
const runningStatus = (status: PortraitRecord['status']) => status === 'pending' || status === 'processing';
const sourcePhotos = (task: PortraitRecord) => task.selfie_urls?.length ? task.selfie_urls : task.selfie_url ? [task.selfie_url] : [];

function formatDate(value: string) {
  const timestamp = value.trim();
  const date = new Date(/(?:z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  if (Number.isNaN(date.getTime())) return '时间暂不可用';
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function TaskContent() {
  const { id: taskId } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const { styles } = useStyles();
  const [task, setTask] = useState<PortraitRecord | null>(null);
  const [profiles, setProfiles] = useState<FaceProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<LoadError>(null);
  const [pollError, setPollError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<'result' | 'original' | null>(null);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);

  useEffect(() => {
    let active = true;
    getProfiles().then((data) => { if (active) setProfiles(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let latestStatus: PortraitRecord['status'] | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    const controller = new AbortController();
    setRefreshing(true); setLoadError(null); setPollError('');
    const schedule = () => {
      if (active && !document.hidden && latestStatus && runningStatus(latestStatus)) timer = setTimeout(() => void poll(), 2500);
    };
    const poll = async () => {
      if (!active || busy || document.hidden || !latestStatus || !runningStatus(latestStatus)) return;
      busy = true;
      try {
        const status = await getPortraitStatus(taskId, controller.signal);
        if (!active) return;
        latestStatus = status.status;
        setTask((current) => current ? { ...current, ...status } : current);
        setPollError('');
      } catch (reason) {
        if (!active || controller.signal.aborted) return;
        if (isNotFoundError(reason)) { setLoadError('not-found'); latestStatus = undefined; }
        else setPollError('状态更新暂时中断，正在重新连接。任务仍在继续。');
      } finally { busy = false; schedule(); }
    };
    const visibility = () => {
      if (timer) clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    getPortrait(taskId).then((data) => {
      if (!active) return;
      setTask(data); latestStatus = data.status; setLoading(false); setRefreshing(false); schedule();
    }).catch((reason) => {
      if (active) { setLoadError(isNotFoundError(reason) ? 'not-found' : 'network'); setLoading(false); setRefreshing(false); }
    });
    document.addEventListener('visibilitychange', visibility);
    return () => { active = false; controller.abort(); if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [refreshKey, taskId]);

  const theme = useMemo(() => styles.find((style) => style.id === task?.style_id), [styles, task?.style_id]);
  const name = task?.style_id === CUSTOM_STYLE_ID ? '自由创作' : theme?.name || task?.style_name || '写真创作';
  const save = async () => {
    if (!task?.result_url || downloading) return;
    setDownloading(true);
    try { await downloadProtectedImage(task.result_url, `${name}-${task.id.slice(0, 8)}`); showToast('success', '已开始下载写真'); }
    catch (reason) { showToast('error', getErrorMessage(reason, '保存失败，请再试一次。')); }
    finally { setDownloading(false); }
  };
  const recreate = () => { if (task) router.push(`/studio?create=1&sourceTask=${encodeURIComponent(task.id)}`); };
  const remove = async () => {
    if (!task || deleting) return;
    setDeleting(true);
    try { await deletePortrait(task.id); showToast('success', '任务已删除'); router.replace('/works'); }
    catch (reason) { showToast('error', getErrorMessage(reason, '删除失败，请再试一次。')); setDeleting(false); }
  };

  if (loading || (refreshing && !task)) return <FullState icon={<Loader2 className="motion-safe:animate-spin" />} title="正在读取任务" copy="正在同步写真状态…" />;
  if (loadError === 'not-found') return <FullState icon={<AlertCircle />} title="没有找到这条任务" copy="任务可能已删除，请返回列表查看其他写真。" action={<Link href="/works" className={primaryClass}>返回任务列表</Link>} />;
  if (loadError === 'network') return <FullState icon={<AlertCircle />} title="暂时无法读取任务" copy="请检查网络连接后重新加载，已提交的任务不会丢失。" action={<button type="button" onClick={() => setRefreshKey((value) => value + 1)} className={primaryClass} disabled={refreshing}><RefreshCw size={16} aria-hidden="true" />重新加载</button>} />;
  if (!task) return <FullState icon={<AlertCircle />} title="任务信息不完整" copy="请从任务列表重新进入。" action={<Link href="/works" className={primaryClass}>返回任务列表</Link>} />;

  const running = runningStatus(task.status);
  const completed = task.status === 'completed' && Boolean(task.result_url);
  const photos = sourcePhotos(task);
  const profileName = task.profile_name || profiles.find((profile) => profile.selfie_url === task.selfie_url)?.name || '本次上传照片';
  return (
    <PortraitShell active="tasks">
      <div className="mx-auto min-w-0 max-w-[1400px] px-4 py-6 text-[#222222] sm:px-8 sm:py-8 lg:px-10">
        <Link href="/works" className="inline-flex min-h-11 items-center gap-2 text-sm text-[#707070] transition-colors hover:text-[#222222]"><ArrowLeft size={17} aria-hidden="true" />任务列表</Link>
        <header className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <h1 className="break-words text-[24px] font-semibold tracking-tight sm:text-[28px]">{name}</h1>
          <div className={`flex flex-wrap items-center gap-3 ${completed ? 'w-full justify-between sm:w-auto sm:justify-end' : ''}`}>
            <p role="status" className={`inline-flex items-center gap-2 text-sm ${running ? 'text-[#755447]' : completed ? 'text-[#477257]' : 'text-[#ad3636]'}`}>{running ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : completed ? <Check size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}{running ? task.status === 'pending' ? '等待生成' : '生成中' : completed ? '已完成' : '生成失败'}</p>
            {completed && <button type="button" onClick={() => void save()} disabled={downloading} className={`${primaryClass} min-h-12`}>{downloading ? <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}保存写真</button>}
          </div>
        </header>
        {pollError && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm text-[#895443]"><p>{pollError}</p><button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={refreshing} className="min-h-11 font-medium underline underline-offset-4 disabled:opacity-45">立即重连</button></div>}
        <div className="mt-6 overflow-hidden rounded-xl bg-white lg:grid lg:items-start lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="写真结果" className={completed ? 'self-start p-4 sm:p-6' : 'flex min-h-[430px] flex-col p-4 sm:min-h-[580px] sm:p-6'}>
            {completed ? (
              <button type="button" onClick={() => setPreview('result')} className="group relative flex h-[min(48dvh,440px)] w-full items-center justify-center overflow-hidden rounded-xl bg-[#f5f5f5] p-3 sm:h-[min(60dvh,560px)]" aria-label="查看生成结果大图">
                <img src={task.result_url!} alt={`${name}生成结果`} className="h-full w-full object-contain" />
                <span className="absolute bottom-4 right-4 flex min-h-11 items-center gap-2 rounded-lg bg-white/95 px-4 text-sm text-[#333333] transition-colors group-hover:bg-white"><Maximize2 size={16} aria-hidden="true" />查看大图</span>
              </button>
            ) : (
              <div className="flex min-h-[350px] flex-1 flex-col items-center justify-center rounded-xl bg-[#f5f5f5] px-5 text-center sm:min-h-[500px]">
                {running ? <Loader2 size={30} className="motion-safe:animate-spin text-[#858585]" aria-hidden="true" /> : <AlertCircle size={30} className="text-[#a6a6a6]" aria-hidden="true" />}
                <h2 className="mt-5 text-lg font-semibold">{running ? '正在制作你的写真' : '本次没有生成图片'}</h2><p className="mt-3 max-w-[35ch] text-sm leading-7 text-[#707070]">{running ? '结果完成后会自动显示。可以离开此页，稍后从任务列表回来查看。' : task.error_message || '制作未完成。重新制作会保留本次照片和创作方向。'}</p>
                {running && <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={refreshing} className={`${secondaryClass} mt-5`}>{refreshing ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}刷新状态</button>}
                {!running && <button type="button" onClick={recreate} className={`${primaryClass} mt-5`}><RefreshCw size={16} aria-hidden="true" />重新制作</button>}
              </div>
            )}
            <p className="mt-3 text-center text-xs text-[#707070]">{completed ? '本次任务的实际生成结果' : running ? '结果尚未生成' : '生成失败，未产生结果图'}</p>
          </section>
          <aside className="flex min-w-0 flex-col border-t border-[#f0f0f0] p-5 sm:p-6 lg:border-l lg:border-t-0">
            <h2 className="text-base font-semibold">任务信息</h2>
            <dl className="mt-5 space-y-4 text-sm leading-6"><div><dt className="text-xs text-[#707070]">档案名称</dt><dd className="mt-1 break-words">{profileName}</dd></div><div><dt className="text-xs text-[#707070]">上传照片</dt><dd className="mt-1">{photos.length} 张</dd></div><div><dt className="text-xs text-[#707070]">主题名称</dt><dd className="mt-1 break-words">{name}</dd></div><div><dt className="text-xs text-[#707070]">创建时间</dt><dd className="mt-1 tabular-nums">{formatDate(task.created_at)}</dd></div>{task.completed_at && <div><dt className="text-xs text-[#707070]">完成时间</dt><dd className="mt-1 tabular-nums">{formatDate(task.completed_at)}</dd></div>}{task.user_prompt && <div><dt className="text-xs text-[#707070]">创作描述</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-7">{task.user_prompt}</dd></div>}</dl>
            {photos.length > 0 && <div className="mt-6 border-t border-[#f0f0f0] pt-5"><h3 className="text-xs text-[#707070]">原图（{photos.length} 张）</h3><div className="mt-3 grid grid-cols-4 gap-2" aria-label="本次上传的全部原图">{photos.map((url, index) => <OriginalPhotoButton key={`${url}-${index}`} url={url} index={index} onOpen={() => { setPreviewPhotoIndex(index); setPreview('original'); }} />)}</div></div>}
            <div className="mt-8 flex flex-col gap-3 lg:mt-auto lg:pt-8">
              {!running && <button type="button" onClick={recreate} className={`${completed ? secondaryClass : primaryClass} min-h-12`}><RefreshCw size={17} aria-hidden="true" />{completed ? '重新制作' : '重试'}</button>}
              <Link href="/works" className={`${buttonClass} text-[#707070] hover:bg-[#f5f5f5]`}>返回任务列表</Link>
              {!running && <button type="button" onClick={() => setDeleteOpen(true)} className={`${buttonClass} text-[#888888] hover:bg-[#fff3f3] hover:text-[#ad3636]`}><Trash2 size={16} aria-hidden="true" />删除任务</button>}
            </div>
          </aside>
        </div>
      </div>
      {preview && <PictureDialog task={task} title={name} originalOnly={preview === 'original'} initialPhotoIndex={previewPhotoIndex} saving={downloading} onSave={() => void save()} onClose={() => setPreview(null)} />}
      {deleteOpen && <DeleteDialog title={name} busy={deleting} onCancel={() => setDeleteOpen(false)} onConfirm={() => void remove()} />}
    </PortraitShell>
  );
}

function FullState({ icon, title, copy, action }: { icon: ReactNode; title: string; copy: string; action?: ReactNode }) {
  return <PortraitShell active="tasks"><div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-5 text-center text-[#222222]"><div className="text-[#999999]">{icon}</div><h1 className="mt-5 text-xl font-semibold">{title}</h1><p className="mt-3 max-w-[42ch] text-sm leading-7 text-[#707070]">{copy}</p>{action && <div className="mt-6">{action}</div>}</div></PortraitShell>;
}

function OriginalPhotoButton({ url, index, onOpen }: { url: string; index: number; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" onClick={onOpen} className="group min-w-0 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black" aria-label={`查看第 ${index + 1} 张上传原图`}>
    <span className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-[#f5f5f5]">{failed ? <span className="px-1 text-[10px] leading-4 text-[#707070]">点击查看原图</span> : <img src={selfiePreviewUrl(url)} alt="" loading="lazy" onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />}</span>
    <span className="mt-1 block text-xs text-[#707070] group-hover:text-black">第 {index + 1} 张</span>
  </button>;
}

function useOriginalPhoto(url: string | undefined, enabled: boolean) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled || !url) return;
    let active = true;
    let objectUrl = '';
    setSource(''); setError('');
    getSelfiePreview(url).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
    }).catch((reason) => { if (active) setError(getErrorMessage(reason, '原图暂时无法读取。')); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [enabled, retry, url]);
  return { source, error, reload: () => setRetry((value) => value + 1) };
}

function PictureDialog({ task, title, originalOnly, initialPhotoIndex, saving, onSave, onClose }: { task: PortraitRecord; title: string; originalOnly: boolean; initialPhotoIndex: number; saving: boolean; onSave: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [compare, setCompare] = useState(originalOnly);
  const [photoIndex, setPhotoIndex] = useState(initialPhotoIndex);
  const photos = sourcePhotos(task);
  const original = useOriginalPhoto(photos[photoIndex], compare);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} aria-labelledby="picture-dialog-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[1040px] overflow-y-auto rounded-xl bg-white p-0 text-[#222222] backdrop:bg-black/55">
    <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6"><h2 id="picture-dialog-title" className="min-w-0 truncate text-base font-semibold">{title}{originalOnly ? ' · 原图' : ''}</h2><button type="button" onClick={onClose} autoFocus className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#666666] hover:bg-[#f5f5f5]" aria-label="关闭大图"><X size={21} aria-hidden="true" /></button></div>
    <div className={`grid gap-4 bg-[#f5f5f5] p-4 sm:p-6 ${compare && !originalOnly && task.result_url ? 'sm:grid-cols-2' : ''}`}>
      {compare && <figure className="min-w-0"><div className="flex min-h-[260px] items-center justify-center sm:h-[min(60dvh,600px)]">{original.source ? <img src={original.source} alt="本次上传的原图" className="max-h-[55dvh] w-full object-contain sm:max-h-full" /> : original.error ? <div role="alert" className="px-4 text-center text-sm text-[#707070]"><p>{original.error}</p><button type="button" onClick={original.reload} className="mt-3 min-h-11 underline">重新加载原图</button></div> : <Loader2 className="motion-safe:animate-spin text-[#888888]" aria-label="正在加载原图" />}</div><figcaption className="mt-3 text-center text-sm text-[#666666]">原图</figcaption></figure>}
      {!originalOnly && task.result_url && <figure className="min-w-0"><div className="flex min-h-[260px] items-center justify-center sm:h-[min(60dvh,600px)]"><img src={task.result_url} alt={`${title}生成结果大图`} className="max-h-[55dvh] w-full object-contain sm:max-h-full" /></div><figcaption className="mt-3 text-center text-sm text-[#666666]">生成结果</figcaption></figure>}
    </div>
    <div className="flex flex-wrap justify-end gap-2 px-4 py-4 sm:px-6">{compare && photos.length > 1 && <div className="mr-auto flex flex-wrap gap-1" aria-label="选择上传照片">{photos.map((_, index) => <button key={index} type="button" aria-pressed={photoIndex === index} onClick={() => setPhotoIndex(index)} className={`${buttonClass} ${photoIndex === index ? 'bg-[#eeeeee] text-[#222222]' : 'text-[#707070] hover:bg-[#f5f5f5]'}`}>第 {index + 1} 张</button>)}</div>}{!originalOnly && photos.length > 0 && <button type="button" aria-pressed={compare} onClick={() => setCompare((value) => !value)} className={secondaryClass}>{compare ? '收起原图' : '原图对照'}</button>}{!originalOnly && task.result_url && <button type="button" onClick={onSave} disabled={saving} className={primaryClass}>{saving ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}保存</button>}</div>
  </dialog>;
}

function DeleteDialog({ title, busy, onCancel, onConfirm }: { title: string; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} aria-labelledby="delete-task-title" onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={onCancel} className="m-auto w-[calc(100%-32px)] max-w-[420px] rounded-xl bg-white p-6 text-[#222222] backdrop:bg-black/45"><h2 id="delete-task-title" className="text-lg font-semibold">删除这条任务？</h2><p className="mt-3 break-words text-sm leading-6 text-[#707070]">“{title}”的任务和生成结果将从列表移除，删除后无法恢复。</p><div className="mt-6 flex justify-end gap-3"><button type="button" autoFocus onClick={onCancel} disabled={busy} className={secondaryClass}>取消</button><button type="button" onClick={onConfirm} disabled={busy} className={`${buttonClass} bg-[#ad3636] text-white hover:bg-[#912a2a]`}>{busy && <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />}确认删除</button></div></dialog>;
}

export default function TaskPage() { return <ProtectedRoute><TaskContent /></ProtectedRoute>; }
