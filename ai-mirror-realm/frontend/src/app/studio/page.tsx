'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, ImagePlus, LockKeyhole, ShieldCheck, Upload } from 'lucide-react';
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
  const step = uploadState !== 'uploaded' ? 1 : hasDirection ? 3 : 2;

  return (
    <main className="min-h-screen bg-stage pb-28 pt-16 lg:pb-10">
      <div className="page-shell py-8 sm:py-10">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="editorial-kicker text-[#f06a47]">AI 写真工作台</p><h1 className="display-title mt-2 text-4xl text-white sm:text-5xl">创建你的写真</h1></div>
          <ol className="flex items-center gap-2 text-xs font-medium text-white/55" aria-label="创作步骤">
            {['上传自拍', '描述或选主题', '开始生成'].map((label, index) => <li key={label} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${step === index + 1 ? 'bg-[#f2ddd7] text-brand' : step > index + 1 ? 'text-success' : ''}`}><span>{step > index + 1 ? '✓' : index + 1}</span>{label}</li>)}
          </ol>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-white/10 bg-paper shadow-card lg:grid lg:h-[680px] lg:grid-cols-[minmax(0,1.25fr)_440px]">
          <section className={`flex items-center justify-center bg-stage p-5 sm:p-8 lg:min-h-0 ${previewUrl ? 'min-h-[310px]' : 'min-h-[480px]'}`} aria-label="自拍预览">
            <div
              className={`relative flex h-full w-full max-w-[560px] items-center justify-center overflow-hidden rounded-2xl border ${previewUrl ? 'min-h-[280px]' : 'min-h-[430px]'} ${dragActive ? 'border-brand' : 'border-white/15'} bg-[#1d1e23]`}
              onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); const dropped = event.dataTransfer.files[0]; if (dropped) void uploadFile(dropped); }}
            >
              {previewUrl ? <Image src={previewUrl} alt="已上传自拍预览" fill unoptimized sizes="(max-width:1023px) 100vw, 55vw" className="object-contain" /> : (
                <button type="button" onClick={() => inputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center px-8 text-center text-white hover:bg-white/[0.03]"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><Upload size={25} /></div><span className="mt-5 text-lg font-semibold">上传一张自拍</span><span className="mt-2 max-w-xs text-sm leading-6 text-white/55">点击选择或拖放照片到这里<br />正脸、光线均匀、五官无遮挡效果更好</span><span className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm">选择照片</span></button>
              )}
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-line lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{uploadState === 'uploaded' ? '定义你的写真' : '先上传自拍'}</h2><p className="mt-1 text-sm text-muted">{uploadState === 'uploaded' ? '写下画面描述，也可以再选一个主题' : '支持 JPG、PNG、WebP，最大 10MB'}</p></div>{previewUrl && <Button variant="ghost" size="sm" leftIcon={<ImagePlus size={16} />} onClick={() => inputRef.current?.click()}>更换</Button>}</div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen) void uploadFile(chosen); event.currentTarget.value = ''; }} />

              {uploadState === 'uploading' && <div className="mt-6 rounded-xl bg-[#f1f1f4] p-4 text-sm text-muted" role="status">正在安全上传照片…</div>}
              {uploadState === 'error' && <div className="mt-6 rounded-xl bg-[#fff0f1] p-4 text-sm text-signal" role="alert"><AlertCircle size={17} className="mr-2 inline" />{uploadError}{file && <button type="button" onClick={() => void uploadFile(file)} className="ml-2 font-semibold underline">重试</button>}</div>}
              {uploadState !== 'uploaded' && uploadState !== 'uploading' && <div className="mt-8 space-y-4 border-t border-line pt-6"><p className="text-sm font-semibold">照片建议</p>{['使用单人正脸自拍', '保持光线均匀、五官清晰', '避免墨镜、口罩或大面积遮挡'].map((tip) => <div key={tip} className="flex items-center gap-3 text-sm text-muted"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf7f1] text-xs text-success">✓</span>{tip}</div>)}</div>}

              {uploadState === 'uploaded' && <>
                <div className="mt-7">
                  <div className="flex items-end justify-between gap-4"><label htmlFor="portrait-prompt" className="text-sm font-semibold">描述你想要的画面</label><span className="text-xs tabular-nums text-muted">{userPrompt.length}/{MAX_PROMPT_LENGTH}</span></div>
                  <textarea
                    id="portrait-prompt"
                    value={userPrompt}
                    maxLength={MAX_PROMPT_LENGTH}
                    rows={4}
                    placeholder="例如：雨夜街头，黑色风衣，电影感侧光"
                    aria-describedby="portrait-system-note"
                    onChange={(event) => { setUserPrompt(event.target.value); setGenerateError(''); }}
                    className="mt-2 min-h-28 w-full resize-y rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors placeholder:text-[#9a9ca3] focus:border-brand focus:ring-2 focus:ring-[#c84b31]/15"
                  />
                  <p id="portrait-system-note" className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" />系统会自动补充人物一致性、画质和安全约束。</p>
                </div>

                <div className="my-7 flex items-center gap-3 text-xs font-medium text-muted"><span className="h-px flex-1 bg-line" /><span>也可以选择一个主题</span><span className="h-px flex-1 bg-line" /></div>

                {stylesLoading ? <div className="grid grid-cols-2 gap-3">{[0,1,2,3].map((item) => <div key={item} className="aspect-[4/5] animate-pulse rounded-xl bg-[#ededf0]" />)}</div> : stylesError ? <div className="rounded-xl bg-[#fff0f1] p-4 text-sm text-signal">主题暂时无法加载，你仍可使用上方描述生成。<button type="button" onClick={retry} className="ml-2 font-semibold underline">重新连接</button></div> : (
                  <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
                    {styles.map((style) => {
                      const selected = style.id === selectedId;
                      return <button key={style.id} type="button" disabled={!style.isServerBacked} aria-pressed={selected} onClick={() => selectStyle(style.id, style.isServerBacked)} className={`group relative w-[148px] shrink-0 overflow-hidden rounded-xl border-2 text-left transition-colors lg:w-auto ${selected ? 'border-brand' : 'border-transparent hover:border-[#c8cad1]'} disabled:cursor-not-allowed disabled:opacity-50`}><div className="relative aspect-[4/5]"><Image src={style.previewImage} alt={`${style.name}主题效果`} fill sizes="220px" className="object-cover" /></div><div className="absolute inset-x-0 bottom-0 bg-black/65 px-3 py-2.5 text-sm font-medium text-white">{style.name}</div>{selected && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"><Check size={16} /></span>}</button>;
                    })}
                  </div>
                )}
              </>}
            </div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:p-7">
              {generateError && <p className="mb-4 rounded-lg bg-[#fff0f1] px-4 py-3 text-sm text-signal" role="alert">{generateError}</p>}
              <Button size="lg" fullWidth loading={generating} disabled={!hasDirection || uploadState !== 'uploaded' || !selfieRef} onClick={generate}>{generating ? '正在创建任务…' : uploadState !== 'uploaded' ? '先上传自拍' : !hasDirection ? '输入描述或选择主题' : '生成写真'}</Button>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted"><LockKeyhole size={13} />照片与结果仅自己可见</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function StudioPage() { return <ProtectedRoute><StudioContent /></ProtectedRoute>; }
