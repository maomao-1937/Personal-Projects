'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Check, ImagePlus, LockKeyhole, ShieldCheck, Upload } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { createPortrait, getErrorMessage, uploadSelfie } from '@/lib/api';
import { useStyles } from '@/hooks/useStyles';
import { useAuth } from '@/stores/auth';

const styleStorageKey = (userId: string) => `ai-mirror:studio:${userId}:style-id`;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PROMPT_LENGTH = 500;
type UploadState = 'idle' | 'uploading' | 'uploaded' | 'error';

function StudioContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { styles, loading: stylesLoading, error: stylesError, retry } = useStyles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedId, setSelectedId] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [selfieRef, setSelfieRef] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  useEffect(() => {
    if (!user) return;
    setSelectedId(localStorage.getItem(styleStorageKey(user.id)) || '');
    setSelfieRef('');
    setUploadState('idle');
    localStorage.removeItem('ai-mirror:studio:style-id');
    localStorage.removeItem('ai-mirror:studio:selfie-ref');
    localStorage.removeItem('ai-mirror:create:style-id');
    localStorage.removeItem('ai-mirror:create:selfie-ref');
  }, [user]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const selectedStyle = useMemo(() => styles.find((style) => style.id === selectedId), [selectedId, styles]);
  const referenceStyle = selectedStyle?.isServerBacked ? selectedStyle : null;
  const featuredStyle = referenceStyle || styles[0];
  const showReference = !previewUrl || Boolean(referenceStyle);
  const uploadFile = useCallback(async (nextFile: File) => {
    setUploadError(''); setGenerateError('');
    if (!ALLOWED_TYPES.includes(nextFile.type)) { setUploadError('请选择 JPG、PNG 或 WebP 图片'); setUploadState('error'); return; }
    if (nextFile.size > MAX_BYTES) { setUploadError('图片超过 10MB，请压缩后再上传'); setUploadState('error'); return; }
    setFile(nextFile); setSelfieRef('');
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(nextFile); });
    setUploadState('uploading');
    try {
      const uploaded = await uploadSelfie(nextFile);
      setSelfieRef(uploaded.url); setUploadState('uploaded');
    } catch (reason) { setUploadError(getErrorMessage(reason, '上传失败，请重试')); setUploadState('error'); }
  }, []);
  const selectStyle = (id: string, serverBacked: boolean) => {
    if (!serverBacked) return;
    const nextId = selectedId === id ? '' : id;
    setSelectedId(nextId);
    if (user) {
      if (nextId) localStorage.setItem(styleStorageKey(user.id), nextId);
      else localStorage.removeItem(styleStorageKey(user.id));
    }
    setGenerateError('');
  };
  const hasCustomPrompt = Boolean(userPrompt.trim());
  const hasDirection = hasCustomPrompt || Boolean(selectedStyle?.isServerBacked);
  const generate = async () => {
    if (!hasDirection || !selfieRef || uploadState !== 'uploaded') return;
    setGenerating(true); setGenerateError('');
    try {
      const portrait = await createPortrait({ styleId: selectedStyle?.isServerBacked ? selectedStyle.id : undefined, selfieUrl: selfieRef, userPrompt });
      router.push(`/studio/tasks/${encodeURIComponent(portrait.id)}`);
    } catch (reason) { setGenerateError(getErrorMessage(reason, '创建任务失败，请稍后重试')); setGenerating(false); }
  };
  const handlePrimary = () => {
    if (uploadState !== 'uploaded' || !selfieRef) { inputRef.current?.click(); return; }
    if (!hasDirection) { document.getElementById('portrait-prompt')?.focus(); return; }
    void generate();
  };
  const step = uploadState !== 'uploaded' ? 1 : hasDirection ? 3 : 2;

  const stageImage = showReference ? featuredStyle?.previewImage || '/style-previews/zhichang.jpg' : previewUrl;
  const stageName = featuredStyle?.name || '职场写真';

  return (
    <main className="min-h-screen bg-[#f6f6f4] pb-28 pt-16 lg:pb-7">
      <div className="mx-auto w-[calc(100%-32px)] max-w-[1480px] pt-5 sm:w-[calc(100%-48px)]">
        <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
          <div><p className="text-[11px] font-semibold tracking-[0.18em] text-muted">AI 镜界 / 创作工作台</p><h1 className="display-title mt-2 text-[28px] sm:text-[34px]">创作一张属于你的写真</h1></div>
          <ol className="flex items-center gap-4 text-xs text-muted sm:gap-6" aria-label="创作步骤">{['上传自拍', '定画面', '看结果'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step === index + 1 ? 'font-semibold text-ink' : ''}><span className={step > index + 1 ? 'mr-1.5 text-success' : step === index + 1 ? 'mr-1.5 text-brand' : 'mr-1.5'}>{step > index + 1 ? '✓' : String(index + 1).padStart(2, '0')}</span>{label}</li>)}</ol>
        </header>
        <div className="overflow-hidden rounded-[18px] border border-[#e8e7e4] bg-white shadow-[0_14px_45px_rgba(18,18,18,0.055)] lg:grid lg:h-[min(760px,calc(100dvh-174px))] lg:min-h-[610px] lg:grid-cols-[minmax(0,1.52fr)_minmax(370px,0.78fr)]">
          <section className={dragActive ? 'flex min-h-[440px] flex-col border-2 border-brand bg-[#eae9e6] p-4 sm:min-h-[610px] sm:p-6 lg:min-h-0' : 'flex min-h-[440px] flex-col bg-[#eae9e6] p-4 sm:min-h-[610px] sm:p-6 lg:min-h-0'} aria-label="写真画布" onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); const dropped = event.dataTransfer.files[0]; if (dropped) void uploadFile(dropped); }}>
            <div className="flex items-center justify-between text-xs font-medium text-[#575753]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand" />写真画布</span><span aria-live="polite">{showReference ? referenceStyle ? '已选主题 · 效果示例' : '浏览主题 · 尚未选择' : '你的自拍 · 原始照片'}</span></div>
            <div className="my-4 flex min-h-0 flex-1 items-center justify-center">
              <figure className="relative h-[340px] w-[255px] overflow-hidden rounded-[14px] bg-[#242426] shadow-[0_24px_60px_rgba(20,20,20,0.18)] sm:h-[490px] sm:w-[368px] lg:aspect-[3/4] lg:h-full lg:max-h-[570px] lg:w-auto">
                <Image src={stageImage} alt={showReference ? stageName + '主题效果示例' : '已上传的自拍'} fill priority unoptimized={!showReference} sizes="(max-width:639px) 255px, (max-width:1023px) 368px, 440px" className={showReference ? 'object-cover' : 'object-contain'} />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 via-black/15 to-transparent px-4 pb-4 pt-16 text-white"><div><span className="block text-[11px] text-white/75">{showReference ? referenceStyle ? '已选主题预览' : '可选主题预览' : '创作原图'}</span><strong className="mt-0.5 block text-lg font-semibold">{showReference ? stageName : '你的自拍'}</strong></div><span className="rounded-md border border-white/55 px-2 py-1 text-[10px] font-medium">{showReference ? '效果示例' : '原始照片'}</span></figcaption>
              </figure>
            </div>
            <div className="flex min-h-14 items-center justify-between gap-3 border-t border-[#d6d5d1] pt-3">
              {previewUrl ? <div className="flex min-w-0 items-center gap-3"><div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#222]"><Image src={previewUrl} alt="" fill unoptimized sizes="44px" className="object-cover" /></div><div className="min-w-0"><p className="truncate text-xs font-semibold">{showReference ? '你的自拍已准备好' : '画布显示你的自拍'}</p><p className="mt-0.5 text-[11px] text-muted">{uploadState === 'uploaded' ? '将以这张照片生成' : uploadState === 'uploading' ? '正在上传照片' : '上传未完成'}</p></div></div> : <p className="text-xs leading-5 text-muted">{referenceStyle ? '主题已选好，上传自拍后即可创作。' : '先看风格，再上传自拍。当前样片尚未选为主题。'}</p>}
              <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 text-xs font-semibold text-ink underline decoration-[#aaa] underline-offset-4 hover:text-brand">{previewUrl ? '更换自拍' : '上传自拍'}</button>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-[#e8e7e4] bg-white lg:h-full lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 px-5 pt-5 sm:px-7 sm:pt-7 lg:overflow-y-auto">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold tracking-tight">创作设置</h2><Link href="/works" className="text-xs font-medium text-muted hover:text-ink">我的写真 →</Link></div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen) void uploadFile(chosen); event.currentTarget.value = ''; }} />
              <div className="mt-5">
                <div className="flex items-baseline justify-between"><h3 className="text-sm font-semibold">01 / 上传自拍</h3><span className="text-xs text-muted">JPG、PNG、WebP · ≤ 10MB</span></div>
                <button type="button" onClick={() => inputRef.current?.click()} className="mt-3 flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-dashed border-[#bcbcb7] bg-[#fafaf9] px-4 text-left transition-colors hover:border-brand hover:bg-[#fff7f6]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-ink shadow-sm">{previewUrl ? <ImagePlus size={20} aria-hidden="true" /> : <Upload size={20} aria-hidden="true" />}</span><span><strong className="block text-sm font-semibold">{previewUrl ? '更换这张自拍' : '选择一张自拍'}</strong><small className="mt-0.5 block text-xs text-muted">{previewUrl ? file?.name || '照片已选择' : '正脸清晰、光线自然，效果更稳定'}</small></span>{uploadState === 'uploaded' && <Check size={17} className="ml-auto text-success" aria-label="已上传" />}</button>
                {uploadState === 'uploading' && <p className="mt-2 text-xs text-muted" role="status">正在上传照片…</p>}
                {uploadState === 'error' && <p className="mt-2 text-xs text-signal" role="alert">{uploadError}{file && <button type="button" onClick={() => void uploadFile(file)} className="ml-2 font-semibold underline">重试</button>}</p>}
              </div>
              <div className="mt-6 border-t border-[#ededeb] pt-5"><div className="flex items-baseline justify-between gap-2"><label htmlFor="portrait-prompt" className="text-sm font-semibold">02 / 描述画面</label><span className="text-xs tabular-nums text-muted">{userPrompt.length}/{MAX_PROMPT_LENGTH}</span></div><textarea id="portrait-prompt" value={userPrompt} maxLength={MAX_PROMPT_LENGTH} rows={3} placeholder="例如：雨夜街头，黑色风衣，电影感侧光" aria-describedby="portrait-system-note" onChange={(event) => { setUserPrompt(event.target.value); setGenerateError(''); }} className="mt-3 min-h-[92px] w-full resize-y rounded-xl border border-[#dededb] bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors placeholder:text-[#918f8a] focus:border-brand focus:ring-2 focus:ring-[#c84b31]/15" /><p id="portrait-system-note" className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-muted"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />系统会补充人物一致性与画质约束。</p></div>
              <div className="mt-6 border-t border-[#ededeb] pt-5"><div className="flex items-baseline justify-between gap-2"><h3 className="text-sm font-semibold">03 / 选择写真主题</h3><span className="text-xs text-muted">可选</span></div><p className="mt-1 text-xs text-muted">像选样片一样挑风格；也可以只写描述。</p>
                {stylesLoading ? <div className="mt-4 grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-lg bg-[#eee]" />)}</div> : stylesError ? <p className="mt-4 text-sm text-signal" role="alert">主题暂时无法加载，可先用文字描述。<button type="button" onClick={retry} className="ml-2 font-semibold underline">重试</button></p> : <div className="mt-4 grid grid-cols-2 gap-3">{styles.map((style) => { const selected = style.id === selectedId; return <button key={style.id} type="button" disabled={!style.isServerBacked} aria-pressed={selected} onClick={() => selectStyle(style.id, style.isServerBacked)} className={selected ? 'group relative overflow-hidden rounded-[11px] border-[3px] border-brand text-left focus-visible:outline-brand' : 'group relative overflow-hidden rounded-[11px] border-[3px] border-transparent text-left hover:border-[#aaa] disabled:cursor-not-allowed disabled:opacity-50'}><div className="relative aspect-[3/4] bg-[#ddd]"><Image src={style.previewImage} alt={style.name + '主题效果示例'} fill sizes="(max-width:639px) 45vw, 190px" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-12 text-sm font-semibold text-white">{style.name}</span>{selected && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"><Check size={16} aria-hidden="true" /></span>}</div></button>; })}</div>}
                <p className="mt-3 text-[11px] text-muted">主题图片为效果示例，不是你的生成结果。</p>
              </div>
            </div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e7e4] bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgba(0,0,0,0.06)] lg:static lg:z-auto lg:shrink-0 lg:px-7 lg:py-5 lg:shadow-none">{generateError && <p className="mb-3 text-xs text-signal" role="alert">{generateError}</p>}<Button size="lg" fullWidth loading={generating} disabled={uploadState === 'uploading'} onClick={handlePrimary}>{generating ? '正在创建任务…' : uploadState === 'uploading' ? '正在上传自拍…' : uploadState !== 'uploaded' ? '上传自拍，开始创作' : !hasDirection ? '描述画面或选择主题' : '生成我的写真'}</Button><p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted"><LockKeyhole size={12} aria-hidden="true" />照片与结果仅当前账户可查看</p></div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function StudioPage() { return <ProtectedRoute><StudioContent /></ProtectedRoute>; }
