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
    <main className="min-h-screen bg-canvas pb-28 pt-16 lg:pb-12">
      <div className="page-shell py-7 sm:py-10">
        <div className="flex items-end justify-between gap-4">
          <div><h1 className="display-title text-3xl sm:text-4xl">创建写真</h1><p className="mt-2 text-sm text-muted">一张自拍，一个想法，完成一张属于你的写真。</p></div>
          <Link href="/works" className="hidden min-h-11 items-center text-sm font-medium text-muted hover:text-ink sm:inline-flex">我的写真</Link>
        </div>
        <ol className="mt-6 grid grid-cols-3 border-y border-line text-xs sm:text-sm" aria-label="创作步骤">
          {['上传自拍', '定画面', '生成写真'].map((label, index) => (
            <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={`flex min-h-14 items-center gap-2 border-r border-line px-2 last:border-r-0 sm:px-4 ${step === index + 1 ? 'font-semibold text-ink' : step > index + 1 ? 'text-success' : 'text-muted'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${step === index + 1 ? 'bg-brand text-white' : step > index + 1 ? 'bg-[#e4f0e9] text-success' : 'bg-[#e8e5df] text-muted'}`}>{step > index + 1 ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        <div className="studio-workspace mt-6 overflow-hidden rounded-xl bg-paper lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.85fr)]">
          <section className="darkroom-surface flex min-h-[365px] flex-col p-4 sm:min-h-[570px] sm:p-6 lg:h-full lg:min-h-0" aria-label="本次创作预览">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 text-xs">
              <span className="font-medium text-white/80">{uploadState === 'uploaded' && previewUrl && referenceStyle ? '本次创作方向' : '原始照片'}</span>
              <span className={uploadState === 'uploaded' ? 'text-[#a8d7c0]' : uploadState === 'error' ? 'text-[#f2b0aa]' : 'text-white/55'}>{uploadState === 'uploaded' ? '已上传' : uploadState === 'uploading' ? '正在上传' : uploadState === 'error' ? '上传未完成' : '等待上传'}</span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center py-4">
              {uploadState === 'uploaded' && previewUrl && referenceStyle ? (
                <div className="grid w-full max-w-[680px] grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-2 sm:gap-4" aria-label="自拍与主题参考对照">
                  <figure className="min-w-0">
                    <div className="photo-mat relative aspect-[3/4] overflow-hidden"><Image src={previewUrl} alt="已上传的自拍" fill unoptimized sizes="(max-width:1023px) 42vw, 24vw" className="object-contain" /></div>
                    <figcaption className="mt-3 truncate text-center text-xs text-white/75">你的自拍</figcaption>
                  </figure>
                  <ArrowRight size={18} className="text-white/45" aria-hidden="true" />
                  <figure className="min-w-0">
                    <div className="photo-mat relative aspect-[3/4] overflow-hidden"><Image src={referenceStyle.previewImage} alt={`${referenceStyle.name}主题效果示例`} fill sizes="(max-width:1023px) 42vw, 24vw" className="object-cover" /><span className="absolute bottom-2 left-2 rounded bg-black/75 px-2 py-1 text-[11px] font-medium text-white">效果示例</span></div>
                    <figcaption className="mt-3 truncate text-center text-xs text-white/75">{referenceStyle.name}</figcaption>
                  </figure>
                </div>
              ) : (
              <div
                className={`photo-mat relative flex h-[260px] w-full max-w-[560px] items-center justify-center overflow-hidden sm:h-[470px] lg:h-full ${dragActive ? '!border-brand' : ''}`}
                onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(event) => { event.preventDefault(); setDragActive(false); const dropped = event.dataTransfer.files[0]; if (dropped) void uploadFile(dropped); }}
              >
                {previewUrl ? <Image src={previewUrl} alt="已选择的自拍预览" fill unoptimized sizes="(max-width:1023px) 100vw, 55vw" className="object-contain" /> : (
                  <button type="button" onClick={() => inputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center px-6 text-center text-white transition-colors hover:bg-white/[0.03]">
                    <Upload size={28} strokeWidth={1.5} aria-hidden="true" />
                    <span className="mt-5 text-lg font-semibold">上传一张自拍</span>
                    <span className="mt-2 max-w-xs text-sm leading-6 text-white/65">点击选择照片，也可以拖放到这里</span>
                    <span className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-medium">选择照片</span>
                  </button>
                )}
              </div>
              )}
            </div>
            <p className="border-t border-white/10 pt-4 text-xs leading-5 text-white/65">{uploadState === 'uploaded' && previewUrl && referenceStyle ? '右侧是主题效果示例，仅用于说明画面方向；生成结果会在下一步显示。' : previewUrl ? '这张照片将作为本次创作的输入。' : '建议使用单人正脸、光线均匀且五官清晰的照片。'}</p>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-line lg:h-full lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 p-5 sm:p-7 lg:overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="text-xl font-semibold">{uploadState === 'uploaded' ? '定义画面' : '准备照片'}</h2><p className="mt-2 text-sm leading-6 text-muted">{uploadState === 'uploaded' ? '写下想法，或从主题预览中选一个方向。' : '支持 JPG、PNG、WebP，最大 10MB。'}</p></div>
                {previewUrl && <Button variant="ghost" size="sm" className="shrink-0 whitespace-nowrap" leftIcon={<ImagePlus size={16} />} onClick={() => inputRef.current?.click()}>更换照片</Button>}
              </div>
              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const chosen = event.target.files?.[0]; if (chosen) void uploadFile(chosen); event.currentTarget.value = ''; }} />

              {uploadState === 'uploading' && <p className="mt-6 border-t border-line pt-5 text-sm text-muted" role="status">正在上传照片，请稍候…</p>}
              {uploadState === 'error' && <div className="mt-6 rounded-lg bg-[#fff0f1] p-4 text-sm text-signal" role="alert"><AlertCircle size={17} className="mr-2 inline" />{uploadError}{file && <button type="button" onClick={() => void uploadFile(file)} className="ml-2 font-semibold underline">重试上传</button>}</div>}
              {uploadState !== 'uploaded' && uploadState !== 'uploading' && (
                <>
                  <div className="mt-8 border-t border-line pt-5">
                    <h3 className="text-sm font-semibold">选照片时留意</h3>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                      <li>单人正脸，五官没有被遮挡</li>
                      <li>光线均匀，画面清晰</li>
                      <li>避免墨镜、口罩和过度滤镜</li>
                    </ul>
                  </div>
                  {styles.length > 0 && <div className="mt-8 border-t border-line pt-5"><p className="text-sm font-semibold">上传后可以选择主题</p><div className="mt-4 grid grid-cols-3 gap-2">{styles.slice(0, 3).map((style) => <figure key={style.id}><div className="photo-frame aspect-[3/4]"><Image src={style.previewImage} alt={`${style.name}主题效果示例`} fill sizes="120px" className="object-cover" /></div><figcaption className="mt-2 truncate text-xs text-muted">{style.name}</figcaption></figure>)}</div><p className="mt-3 text-xs text-muted">以上为主题效果示例，并非你的生成结果。</p></div>}
                </>
              )}

              {uploadState === 'uploaded' && <>
                <div className="mt-7 border-t border-line pt-6">
                  <div className="flex items-end justify-between gap-4"><label htmlFor="portrait-prompt" className="text-sm font-semibold">描述你想要的画面</label><span className="text-xs tabular-nums text-muted">{userPrompt.length}/{MAX_PROMPT_LENGTH}</span></div>
                  <textarea
                    id="portrait-prompt"
                    value={userPrompt}
                    maxLength={MAX_PROMPT_LENGTH}
                    rows={4}
                    placeholder="例如：雨夜街头，黑色风衣，电影感侧光"
                    aria-describedby="portrait-system-note"
                    onChange={(event) => { setUserPrompt(event.target.value); setGenerateError(''); }}
                    className="mt-3 min-h-28 w-full resize-y rounded-lg border border-line bg-paper px-4 py-3 text-sm leading-6 text-ink outline-none transition-colors placeholder:text-[#75716c] focus:border-brand focus:ring-2 focus:ring-[#c84b31]/15"
                  />
                  <p id="portrait-system-note" className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />系统会补充人物一致性、画质和安全约束。</p>
                </div>
                <div className="mt-8 border-t border-line pt-6">
                  <h3 className="text-sm font-semibold">选择主题 <span className="font-normal text-muted">（可选）</span></h3>
                  <p className="mt-1 text-xs leading-5 text-muted">可以只用文字描述，也可以同时选一个主题。</p>
                  {stylesLoading ? <div className="mt-4 grid grid-cols-2 gap-3">{[0,1,2,3].map((item) => <div key={item} className="aspect-[4/5] animate-pulse rounded-lg bg-[#e8e5df]" />)}</div> : stylesError ? <div className="mt-4 rounded-lg bg-[#fff0f1] p-4 text-sm text-signal">主题暂时无法加载，仍可使用文字描述生成。<button type="button" onClick={retry} className="ml-2 font-semibold underline">重新连接</button></div> : (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {styles.map((style) => {
                        const selected = style.id === selectedId;
                        return <button key={style.id} type="button" disabled={!style.isServerBacked} aria-pressed={selected} onClick={() => selectStyle(style.id, style.isServerBacked)} className={`group overflow-hidden rounded-lg border-2 text-left transition-colors ${selected ? 'border-brand' : 'border-transparent hover:border-[#bdb7af]'} disabled:cursor-not-allowed disabled:opacity-50`}><div className="photo-frame aspect-[4/5] rounded-none"><Image src={style.previewImage} alt={`${style.name}主题效果示例`} fill sizes="220px" className="object-cover" />{selected && <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"><Check size={16} aria-hidden="true" /></span>}</div><span className="block bg-paper px-2 py-2 text-sm font-medium">{style.name}</span></button>;
                      })}
                    </div>
                  )}
                  {selectedStyle?.isServerBacked && <p className="mt-4 text-xs leading-5 text-muted">已选择「{selectedStyle.name}」；{hasCustomPrompt ? '生成时会与你的文字描述合并。' : '它将作为这次创作的画面方向。'}</p>}
                </div>
              </>}
            </div>
            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:static lg:z-auto lg:shrink-0 lg:p-7">
              {generateError && <p className="mb-4 rounded-lg bg-[#fff0f1] px-4 py-3 text-sm text-signal" role="alert">{generateError}</p>}
              <Button size="lg" fullWidth loading={generating} disabled={!hasDirection || uploadState !== 'uploaded' || !selfieRef} onClick={generate}>{generating ? '正在创建任务…' : uploadState !== 'uploaded' ? '先上传自拍' : !hasDirection ? '输入描述或选择主题' : '生成写真'}</Button>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted"><LockKeyhole size={13} aria-hidden="true" />照片与结果仅当前账户可查看</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function StudioPage() { return <ProtectedRoute><StudioContent /></ProtectedRoute>; }
