'use client';

import type { RefObject } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, ImagePlus, LockKeyhole, PenLine, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StylePreview } from '@/components/StylePreview';
import type { MergedStyle } from '@/hooks/useStyles';

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'error';

interface XingtuStudioProps {
  styles: MergedStyle[];
  stylesLoading: boolean;
  stylesError: string | null;
  retry: () => void;
  selectedId: string;
  selectedStyle?: MergedStyle;
  commitStyle: (id: string) => void;
  openPicker: () => void;
  inputRef: RefObject<HTMLInputElement>;
  promptRef: RefObject<HTMLTextAreaElement>;
  pickerTriggerRef: RefObject<HTMLButtonElement>;
  previewUrl: string;
  file: File | null;
  uploadState: UploadState;
  uploadError: string;
  photoReady: boolean;
  hasDirection: boolean;
  userPrompt: string;
  setUserPrompt: (value: string) => void;
  generating: boolean;
  generateError: string;
  handlePrimary: () => void;
  uploadFile: (file: File) => Promise<void>;
  dragActive: boolean;
  setDragActive: (active: boolean) => void;
}

export function XingtuStudio({
  styles, stylesLoading, stylesError, retry, selectedId, selectedStyle, commitStyle, openPicker,
  inputRef, promptRef, pickerTriggerRef, previewUrl, file, uploadState, uploadError, photoReady,
  hasDirection, userPrompt, setUserPrompt, generating, generateError, handlePrimary, uploadFile,
  dragActive, setDragActive,
}: XingtuStudioProps) {
  const openPhoto = () => inputRef.current?.click();
  const focusPrompt = () => {
    promptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    promptRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#3d4140] bg-[#1b1d1e] shadow-[0_24px_70px_rgba(0,0,0,0.22)]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-[#1d1f20] px-4 text-white sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><span className="h-2 w-2 rounded-full bg-[#c8fb2c]" /><strong className="truncate text-sm font-semibold">写真编辑台</strong><span className="hidden border-l border-white/15 pl-3 text-xs text-white/45 sm:inline">单张自拍 · 单张结果</span></div>
        <Link href="/works?variant=xingtu" className="shrink-0 text-xs font-medium text-white/65 hover:text-[#d8ff74]">我的写真 <span aria-hidden="true">↗</span></Link>
      </div>

      <div className="lg:grid lg:h-[min(650px,calc(100dvh-260px))] lg:min-h-[520px] lg:grid-cols-[72px_minmax(0,1fr)_370px]">
        <nav aria-label="编辑操作" className="flex items-center justify-center gap-2 border-b border-white/10 bg-[#222425] px-3 py-2 text-white lg:flex-col lg:justify-start lg:gap-3 lg:border-b-0 lg:border-r lg:pt-6">
          <button type="button" onClick={openPhoto} className="flex min-h-12 min-w-20 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#c8fb2c] lg:min-w-12" aria-label="上传或更换照片"><ImagePlus size={20} aria-hidden="true" />照片</button>
          <button type="button" onClick={openPicker} className="flex min-h-12 min-w-20 flex-col items-center justify-center gap-1 rounded-lg bg-[#c8fb2c]/10 text-[11px] text-[#d8ff74] transition-colors hover:bg-[#c8fb2c]/20 focus-visible:outline-2 focus-visible:outline-[#c8fb2c] lg:min-w-12" aria-label="浏览写真效果"><Sparkles size={20} aria-hidden="true" />效果</button>
          <button type="button" onClick={focusPrompt} className="flex min-h-12 min-w-20 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-[#c8fb2c] lg:min-w-12" aria-label="描述画面"><PenLine size={20} aria-hidden="true" />描述</button>
        </nav>

        <section
          aria-label="自拍编辑画布"
          className={`flex min-h-[500px] min-w-0 flex-col bg-[#131516] px-4 py-4 text-white sm:min-h-[630px] sm:px-6 lg:min-h-0 ${dragActive ? 'ring-2 ring-inset ring-[#c8fb2c]' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }}
          onDrop={(event) => { event.preventDefault(); setDragActive(false); const dropped = event.dataTransfer.files[0]; if (dropped) void uploadFile(dropped); }}
        >
          <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-white/55"><span>画布 / {previewUrl ? '原始照片' : '等待照片'}</span><span>{selectedStyle ? `当前效果：${selectedStyle.name}` : '尚未选择效果'}</span></div>
          <div className="flex min-h-0 flex-1 items-center justify-center py-4">
            {previewUrl ? (
              <figure className="relative h-[330px] w-[248px] overflow-hidden rounded-[8px] bg-[#282b2c] shadow-[0_24px_48px_rgba(0,0,0,0.3)] sm:h-[440px] sm:w-[330px] lg:h-[min(410px,calc(100dvh-470px))] lg:min-h-[320px] lg:w-auto lg:aspect-[3/4]">
                <Image src={previewUrl} alt="已上传的自拍原图" fill unoptimized sizes="(max-width:639px) 248px, (max-width:1023px) 330px, 380px" className="object-contain" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-12 text-xs text-white">你的自拍 · 原始照片</figcaption>
              </figure>
            ) : (
              <button type="button" onClick={openPhoto} className="group flex min-h-[290px] w-full max-w-[580px] flex-col items-center justify-center rounded-[10px] border border-dashed border-[#626766] bg-[#202324] px-5 text-center transition-colors hover:border-[#c8fb2c] hover:bg-[#272b2b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c8fb2c] sm:min-h-[380px]">
                <span className="flex h-14 w-14 items-center justify-center rounded-[10px] border border-[#c8fb2c]/45 bg-[#c8fb2c]/10 text-[#d5ff68]"><Upload size={25} aria-hidden="true" /></span>
                <strong className="mt-5 text-xl font-semibold">导入一张自拍</strong>
                <span className="mt-2 text-sm text-white/55">点击选择，或拖到画布里</span>
                <span className="mt-6 text-xs text-white/40">JPG、PNG、WebP · 不超过 10MB</span>
              </button>
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-xs font-semibold text-white/85">写真效果 <span className="font-normal text-white/40">· 样片仅供参考</span></h3><button type="button" onClick={openPicker} className="text-xs font-medium text-[#d8ff74] hover:underline">查看全部 {stylesLoading ? '' : styles.filter((style) => style.isServerBacked).length} 款</button></div>
            {stylesLoading ? <div className="flex gap-2" role="status" aria-label="正在加载写真效果">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-[82px] w-[65px] shrink-0 animate-pulse rounded-md bg-white/10" />)}</div> : stylesError ? <p className="py-3 text-xs text-white/55">效果暂时无法加载，可在右侧直接写画面描述。</p> : <div className="flex gap-2 overflow-x-auto pb-1" aria-label="快速选择写真效果">{styles.map((style) => <button key={style.id} type="button" disabled={!style.isServerBacked} aria-pressed={selectedId === style.id} onClick={() => commitStyle(selectedId === style.id ? '' : style.id)} className={`group min-w-[68px] max-w-[68px] shrink-0 rounded-[7px] p-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#c8fb2c] disabled:opacity-45 ${selectedId === style.id ? 'bg-[#c8fb2c] text-[#151515]' : 'bg-[#26292a] text-white/75 hover:bg-[#353a39]'}`}><span className="relative block aspect-[3/4] overflow-hidden rounded-[4px] bg-[#333]"><StylePreview src={style.previewImage} alt={`${style.name}主题效果示例`} fill sizes="68px" className="object-cover" /></span><span className="mt-1 block truncate text-[10px] font-medium">{style.name}</span></button>)}</div>}
          </div>
          <div className="mt-3 flex min-h-8 items-center justify-between gap-3 border-t border-white/10 pt-2 text-[11px] text-white/55"><span role="status" aria-live="polite">{uploadState === 'uploading' ? '正在上传照片…' : photoReady ? '照片已准备好' : uploadState === 'error' ? '照片尚未上传成功' : '原图只用于你的这次创作'}</span>{previewUrl && <button type="button" onClick={openPhoto} className="shrink-0 text-white/80 underline underline-offset-4 hover:text-[#d8ff74]">更换照片</button>}</div>
        </section>

        <aside className="flex min-h-0 flex-col border-t border-white/10 bg-[#242728] text-white lg:border-l lg:border-t-0">
          <div className="flex-1 px-5 pb-5 pt-6 sm:px-7 lg:min-h-0 lg:overflow-y-auto">
            <p className="text-[11px] font-semibold tracking-[0.15em] text-[#c8fb2c]">创作控制</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-tight">把自拍变成写真</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">保留你的原图，选一个效果或描述想要的画面。</p>

            <div className="mt-6 border-t border-white/10 pt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">01 照片</h3><span className={`text-xs ${photoReady ? 'text-[#c8fb2c]' : 'text-white/45'}`}>{photoReady ? '已导入' : uploadState === 'uploading' ? '上传中' : '待导入'}</span></div><button type="button" onClick={openPhoto} className="mt-3 flex min-h-[65px] w-full items-center gap-3 rounded-[9px] border border-white/15 bg-[#2e3132] px-3 text-left transition-colors hover:border-[#c8fb2c]/70"><span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#424647] text-[#c8fb2c]">{previewUrl ? <Image src={previewUrl} alt="" fill unoptimized sizes="44px" className="object-cover" /> : <ImagePlus size={20} aria-hidden="true" />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{previewUrl ? file?.name || '已选择照片' : '选择一张自拍'}</strong><span className="mt-0.5 block text-xs text-white/45">{previewUrl ? '点击更换原图' : '正面、清晰、单人照片'}</span></span>{photoReady ? <Check size={17} className="text-[#c8fb2c]" aria-hidden="true" /> : <ChevronRight size={17} className="text-white/45" aria-hidden="true" />}</button>{uploadError && <p role="alert" className="mt-2 text-xs leading-5 text-[#ff9e91]">{uploadError}{file && uploadState === 'error' && <button type="button" onClick={() => void uploadFile(file)} className="ml-2 font-semibold underline">重试</button>}</p>}</div>

            <div className="mt-5 border-t border-white/10 pt-5"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">02 写真效果</h3><span className="text-xs text-white/45">可选</span></div><button ref={pickerTriggerRef} type="button" onClick={openPicker} aria-haspopup="dialog" className="mt-3 flex min-h-[70px] w-full items-center gap-3 rounded-[9px] border border-white/15 bg-[#2e3132] px-3 text-left transition-colors hover:border-[#c8fb2c]/70"><span className="relative h-12 w-10 shrink-0 overflow-hidden rounded-[5px] bg-[#414547]">{selectedStyle ? <StylePreview src={selectedStyle.previewImage} alt="" fill sizes="40px" className="object-cover" /> : <span className="flex h-full w-full items-center justify-center text-[#c8fb2c]"><Sparkles size={20} aria-hidden="true" /></span>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-semibold">{selectedStyle ? selectedStyle.name : '挑选写真效果'}</strong><span className="mt-0.5 block truncate text-xs text-white/45">{selectedStyle ? '已选择 · 效果示例' : '从画布下方直接点选'}</span></span><ChevronRight size={17} className="shrink-0 text-[#c8fb2c]" aria-hidden="true" /></button>{stylesError && <p role="alert" className="mt-2 text-xs text-[#ff9e91]">效果暂时无法加载。<button type="button" onClick={retry} className="ml-1 underline">重试</button></p>}</div>

            <div className="mt-5 border-t border-white/10 pt-5"><div className="flex items-center justify-between"><label htmlFor="portrait-prompt" className="text-sm font-semibold">03 画面描述</label><span className="text-xs tabular-nums text-white/45">{userPrompt.length}/500</span></div><textarea ref={promptRef} id="portrait-prompt" value={userPrompt} maxLength={500} rows={4} placeholder="例如：雨夜街头，黑色风衣，电影感侧光" onChange={(event) => setUserPrompt(event.target.value)} className="mt-3 min-h-[110px] w-full resize-y rounded-[9px] border border-white/20 bg-[#181a1b] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/35 focus:border-[#c8fb2c] focus:ring-2 focus:ring-[#c8fb2c]/20" /><p className="mt-2 text-xs leading-5 text-white/45">可单独使用描述，也可补充所选效果的细节。</p></div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#242728] p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-12px_35px_rgba(0,0,0,0.22)] lg:static lg:z-auto lg:shrink-0 lg:px-7 lg:py-5 lg:shadow-none">
            {generateError && <p role="alert" className="mb-3 text-xs text-[#ff9e91]">{generateError}</p>}
            <Button size="lg" fullWidth loading={generating} disabled={uploadState === 'uploading'} rightIcon={photoReady && hasDirection ? <ArrowRight size={18} aria-hidden="true" /> : undefined} onClick={handlePrimary} className="bg-[#c8fb2c] text-[#151715] hover:bg-[#d8ff74] active:bg-[#b4e21d] focus-visible:ring-[#c8fb2c]">{generating ? '正在创建任务…' : uploadState === 'uploading' ? '正在上传照片…' : !photoReady ? '导入自拍，开始创作' : !hasDirection ? '写下画面描述' : '生成我的写真'}</Button>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-white/40"><LockKeyhole size={12} aria-hidden="true" />照片与结果仅当前账户可查看</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
