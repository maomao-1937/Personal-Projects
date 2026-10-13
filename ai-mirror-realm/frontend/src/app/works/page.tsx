'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Check, ChevronDown, ChevronUp, Download, ImageIcon, Loader2, Maximize2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PortraitShell } from '@/components/PortraitShell';
import { useToast } from '@/contexts/ToastContext';
import { useStyles } from '@/hooks/useStyles';
import { CUSTOM_STYLE_ID, deletePortrait, downloadProtectedImage, getErrorMessage, getPortraits, getProfiles, getSelfiePreview, type FaceProfileRecord, type PortraitRecord } from '@/lib/api';

type Filter = 'all' | 'completed' | 'processing' | 'failed';
const filterLabels: Record<Filter, string> = { all: '全部任务', completed: '已完成', processing: '生成中', failed: '生成失败' };
const isRunning = (task: PortraitRecord) => task.status === 'pending' || task.status === 'processing';
const sourcePhotos = (task: PortraitRecord) => task.selfie_urls?.length ? task.selfie_urls : task.selfie_url ? [task.selfie_url] : [];
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45';
const primaryClass = `${buttonClass} bg-[#171717] text-[#f9dbca] hover:bg-[#333333]`;
const secondaryClass = `${buttonClass} border border-[#e5e5e5] bg-white text-[#333333] hover:bg-[#f7f7f7]`;

function formatDate(value: string) {
  const timestamp = value.trim();
  const date = new Date(/(?:z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  if (Number.isNaN(date.getTime())) return '时间暂不可用';
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function WorksContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const { styles } = useStyles();
  const [tasks, setTasks] = useState<PortraitRecord[]>([]);
  const [profiles, setProfiles] = useState<FaceProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(10);
  const [preview, setPreview] = useState<{ task: PortraitRecord; original: boolean } | null>(null);
  const [deleteTask, setDeleteTask] = useState<PortraitRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const mounted = useRef(true);
  const hasRunning = tasks.some(isRunning);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true); else setRefreshing(true);
    try {
      const data = await getPortraits();
      if (mounted.current) { setTasks(data); setError(''); }
    } catch (reason) {
      if (mounted.current) setError(getErrorMessage(reason, '任务列表暂时无法读取，请重新加载。'));
    } finally {
      if (mounted.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load(true);
    return () => { mounted.current = false; };
  }, [load]);

  useEffect(() => {
    let active = true;
    getProfiles().then((data) => { if (active) setProfiles(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hasRunning) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    const poll = async () => {
      if (!active || busy || document.hidden) return;
      busy = true;
      try {
        const data = await getPortraits();
        if (active) { setTasks(data); setError(''); }
      } catch (reason) {
        if (active) setError(getErrorMessage(reason, '状态更新暂时中断，任务仍在继续。'));
      } finally {
        busy = false;
        if (active && !document.hidden) timer = setTimeout(() => void poll(), 5000);
      }
    };
    const onVisibility = () => {
      if (timer) clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    timer = setTimeout(() => void poll(), 5000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [hasRunning]);

  const counts = useMemo(() => ({
    all: tasks.length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    processing: tasks.filter(isRunning).length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  }), [tasks]);
  const filtered = useMemo(() => [...tasks]
    .filter((task) => filter === 'all' || (filter === 'processing' ? isRunning(task) : task.status === filter))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [tasks, filter]);
  const nameOf = (task: PortraitRecord) => task.style_id === CUSTOM_STYLE_ID ? '自由创作' : styles.find((style) => style.id === task.style_id)?.name || task.style_name || '写真创作';
  const recreate = (task: PortraitRecord) => router.push(`/studio?create=1&sourceTask=${encodeURIComponent(task.id)}`);
  const save = async (task: PortraitRecord) => {
    if (!task.result_url || savingId) return;
    setSavingId(task.id);
    try { await downloadProtectedImage(task.result_url, `${nameOf(task)}-${task.id.slice(0, 8)}`); showToast('success', '已开始下载写真'); }
    catch (reason) { showToast('error', getErrorMessage(reason, '保存失败，请再试一次。')); }
    finally { setSavingId(null); }
  };
  const remove = async () => {
    if (!deleteTask || deleting) return;
    setDeleting(true);
    try {
      await deletePortrait(deleteTask.id);
      setTasks((current) => current.filter((task) => task.id !== deleteTask.id));
      setDeleteTask(null);
      showToast('success', '任务已删除');
    } catch (reason) { showToast('error', getErrorMessage(reason, '删除失败，请再试一次。')); }
    finally { setDeleting(false); }
  };

  return (
    <PortraitShell active="tasks">
      <div className="mx-auto min-w-0 max-w-[1400px] px-4 py-6 text-[#222222] sm:px-8 sm:py-8 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[24px] font-semibold tracking-tight sm:text-[28px]">任务列表</h1>
          <Link href="/studio?create=1" className={primaryClass}><Plus size={17} aria-hidden="true" />制作写真</Link>
        </header>
        <div className="mt-6 flex items-center justify-between gap-3 border-b border-[#e2e2e2]">
          <div className="flex min-w-0 gap-5 overflow-x-auto" aria-label="筛选任务">
            {(['all', 'completed', 'processing', 'failed'] as Filter[]).map((item) => (
              <button key={item} type="button" aria-pressed={filter === item} onClick={() => { setFilter(item); setLimit(10); }} className={`min-h-12 shrink-0 border-b-2 text-sm transition-colors ${filter === item ? 'border-[#222222] font-semibold text-[#222222]' : 'border-transparent text-[#707070] hover:text-[#222222]'}`}>
                {filterLabels[item]}<span className="ml-1.5 text-xs tabular-nums">{counts[item]}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} disabled={refreshing || loading} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 text-sm text-[#666666] disabled:opacity-45" aria-label="刷新任务列表"><RefreshCw size={16} className={refreshing ? 'motion-safe:animate-spin' : ''} aria-hidden="true" /><span className="hidden sm:inline">刷新</span></button>
        </div>
        {error && !loading && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 text-sm text-[#a42d2d]"><span>{error}</span><button type="button" onClick={() => void load()} disabled={refreshing} className="min-h-11 font-medium underline underline-offset-4 disabled:opacity-45">重新加载</button></div>}
        {loading ? (
          <div role="status" className="flex min-h-[360px] flex-col items-center justify-center gap-4 text-[#737373]"><Loader2 size={24} className="motion-safe:animate-spin" aria-hidden="true" /><p className="text-sm">正在读取任务…</p></div>
        ) : filtered.length === 0 ? (
          <EmptyState title={tasks.length ? `暂无${filterLabels[filter]}的任务` : '还没有写真任务'} copy={tasks.length ? '可以切换分类查看其他任务。' : '选择喜欢的主题，上传照片开始制作。'} action={tasks.length ? <button type="button" className={secondaryClass} onClick={() => setFilter('all')}>查看全部任务</button> : <Link href="/studio" className={primaryClass}>去选写真主题<ArrowRight size={16} aria-hidden="true" /></Link>} />
        ) : (
          <div className="mt-5 space-y-4">
            {filtered.slice(0, limit).map((task) => {
              const running = isRunning(task);
              const completed = task.status === 'completed' && Boolean(task.result_url);
              const name = nameOf(task);
              const photos = sourcePhotos(task);
              const profileName = task.profile_name || profiles.find((profile) => profile.selfie_url === task.selfie_url)?.name || '本次上传照片';
              return (
                <article key={task.id} className="rounded-xl bg-white px-4 py-5 sm:px-6" aria-labelledby={`task-${task.id}`}>
                  <div className="flex items-start justify-between gap-4 border-b border-[#f0f0f0] pb-4">
                    <div className="min-w-0"><h2 id={`task-${task.id}`} className="break-words text-base font-semibold">{name}</h2><p className="mt-1 text-xs tabular-nums text-[#707070]">创建时间：{formatDate(task.created_at)}</p></div>
                    <p className={`flex shrink-0 items-center gap-1.5 text-xs sm:text-sm ${running ? 'text-[#755447]' : task.status === 'failed' ? 'text-[#ad3636]' : 'text-[#477257]'}`} role="status">
                      {running ? <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden="true" /> : completed ? <Check size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
                      {running ? task.status === 'pending' ? '等待生成' : '生成中' : completed ? '已完成' : '生成失败'}
                    </p>
                  </div>
                  <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:gap-7">
                    {completed ? (
                      <button type="button" onClick={() => setPreview({ task, original: false })} className="group relative block aspect-[3/4] w-[160px] shrink-0 overflow-hidden rounded-xl bg-[#f5f5f5] sm:w-[180px]" aria-label={`查看${name}大图`}>
                        <img src={task.result_url!} alt={`${name}生成结果`} className="h-full w-full object-contain" />
                        <span className="absolute inset-x-0 bottom-0 flex min-h-10 items-center justify-center gap-1.5 bg-black/65 text-xs text-white sm:translate-y-full sm:transition-transform sm:group-hover:translate-y-0 sm:group-focus-visible:translate-y-0"><Maximize2 size={13} aria-hidden="true" />查看大图</span>
                      </button>
                    ) : (
                      <div className="flex aspect-[3/4] w-[160px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#f5f5f5] px-4 text-center sm:w-[180px]">
                        {running ? <Loader2 size={24} className="motion-safe:animate-spin text-[#858585]" aria-hidden="true" /> : <AlertCircle size={24} className="text-[#a6a6a6]" aria-hidden="true" />}
                        <p className="mt-3 text-sm font-medium text-[#555555]">{running ? '写真制作中' : '生成失败'}</p><p className="mt-2 text-xs leading-5 text-[#707070]">{running ? '完成后自动更新' : '本次没有生成图片'}</p>
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-5">
                      <div>
                        <dl className="grid gap-2 text-sm leading-6"><div className="flex gap-3"><dt className="w-16 shrink-0 text-[#707070]">档案名称</dt><dd className="break-words">{profileName}</dd></div><div className="flex gap-3"><dt className="w-16 shrink-0 text-[#707070]">上传照片</dt><dd>{photos.length} 张</dd></div><div className="flex gap-3"><dt className="w-16 shrink-0 text-[#707070]">主题名称</dt><dd className="break-words">{name}</dd></div></dl>
                        {task.user_prompt && <p className="mt-3 max-w-[65ch] whitespace-pre-wrap break-words text-sm leading-6 text-[#666666]">{task.user_prompt}</p>}
                        {running && <p className="mt-3 text-sm leading-6 text-[#707070]">可以离开此页，稍后从任务列表查看结果。</p>}
                        {task.status === 'failed' && <p className="mt-3 text-sm leading-6 text-[#707070]">{task.error_message || '制作未完成，请重新尝试。'}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {completed && <><button type="button" onClick={() => setPreview({ task, original: false })} className={secondaryClass}><Maximize2 size={15} aria-hidden="true" />查看大图</button><button type="button" onClick={() => void save(task)} disabled={savingId !== null} className={primaryClass}>{savingId === task.id ? <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}保存</button></>}
                        {photos.length > 0 && <button type="button" onClick={() => setPreview({ task, original: true })} className={secondaryClass}>原图{photos.length > 1 ? `（${photos.length} 张）` : ''}</button>}
                        {!running && <button type="button" onClick={() => recreate(task)} className={completed ? secondaryClass : primaryClass}><RefreshCw size={15} aria-hidden="true" />{completed ? '重新制作' : '重试'}</button>}
                        <Link href={`/studio/tasks/${encodeURIComponent(task.id)}`} className={`${buttonClass} text-[#666666] hover:bg-[#f5f5f5]`}>任务详情<ArrowRight size={15} aria-hidden="true" /></Link>
                        {!running && <button type="button" onClick={() => setDeleteTask(task)} className="ml-auto flex min-h-11 min-w-11 items-center justify-center text-[#888888] transition-colors hover:text-[#ad3636]" aria-label={`删除${name}任务`}><Trash2 size={17} aria-hidden="true" /></button>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {filtered.length > 10 && <div className="flex justify-center gap-3 pt-3"><button type="button" onClick={() => setLimit(limit < filtered.length ? limit + 10 : 10)} className={secondaryClass}>{limit < filtered.length ? <><ChevronDown size={16} aria-hidden="true" />点击查看更多</> : <><ChevronUp size={16} aria-hidden="true" />收起</>}</button></div>}
          </div>
        )}
      </div>
      {preview && <PictureDialog task={preview.task} title={nameOf(preview.task)} originalOnly={preview.original} saving={savingId === preview.task.id} onSave={() => void save(preview.task)} onClose={() => setPreview(null)} />}
      {deleteTask && <DeleteDialog title={nameOf(deleteTask)} busy={deleting} onCancel={() => setDeleteTask(null)} onConfirm={() => void remove()} />}
    </PortraitShell>
  );
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action: ReactNode }) {
  return <div className="flex min-h-[420px] flex-col items-center justify-center px-4 text-center"><ImageIcon size={36} className="text-[#b0b0b0]" aria-hidden="true" /><h2 className="mt-5 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#707070]">{copy}</p><div className="mt-6">{action}</div></div>;
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
  return { source, error, reload: () => setRetry((current) => current + 1) };
}

function PictureDialog({ task, title, originalOnly, saving, onSave, onClose }: { task: PortraitRecord; title: string; originalOnly: boolean; saving: boolean; onSave: () => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [compare, setCompare] = useState(originalOnly);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = sourcePhotos(task);
  const original = useOriginalPhoto(photos[photoIndex], compare);
  useEffect(() => {
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialogRef} aria-labelledby="picture-dialog-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[1040px] overflow-y-auto rounded-xl bg-white p-0 text-[#222222] backdrop:bg-black/55">
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

export default function WorksPage() { return <ProtectedRoute><WorksContent /></ProtectedRoute>; }
