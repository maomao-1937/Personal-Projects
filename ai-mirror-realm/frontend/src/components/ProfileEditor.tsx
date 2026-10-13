'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { PortraitModal } from '@/components/PortraitModal';
import { createProfile, getErrorMessage, selfiePreviewUrl, updateProfile, uploadSelfie, type FaceProfileRecord } from '@/lib/api';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_PHOTOS = 4;
const MAX_PHOTOS = 9;
const GUIDES = [
  { label: '正脸自拍', image: '/meitu-upload-guides/full-face.png', description: '光线自然，脸部清晰无遮挡。' },
  { label: '多表情', image: '/meitu-upload-guides/expressions.png', description: '选择自然、微笑等不同表情。' },
  { label: '多背景', image: '/meitu-upload-guides/backgrounds.png', description: '搭配不同背景和拍摄角度。' },
];

type Photo = {
  id: number;
  file: File;
  preview: string;
  url?: string;
  state: 'queued' | 'uploading' | 'uploaded' | 'failed';
  error?: string;
};

export function ProfileEditor({ onClose, onSaved, profile }: {
  onClose: () => void;
  onSaved: (profile: FaceProfileRecord) => void;
  profile?: FaceProfileRecord;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const uploadLock = useRef(false);
  const saveLock = useRef(false);
  const composing = useRef(false);
  const nextId = useRef(0);
  const photosRef = useRef<Photo[]>([]);
  const [name, setName] = useState(profile?.name || '');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [nameError, setNameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [dragging, setDragging] = useState(false);
  const busy = uploading || saving;
  const uploadedCount = photos.filter((photo) => photo.state === 'uploaded' && photo.url).length;
  const ready = photos.length >= MIN_PHOTOS && photos.length <= MAX_PHOTOS && uploadedCount === photos.length;
  const failedCount = photos.filter((photo) => photo.state === 'failed').length;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.preview);
    };
  }, []);

  const replacePhotos = (items: Photo[]) => {
    photosRef.current = items;
    if (mounted.current) setPhotos(items);
  };
  const changePhoto = (id: number, changes: Partial<Photo>) => {
    replacePhotos(photosRef.current.map((photo) => photo.id === id ? { ...photo, ...changes } : photo));
  };
  const close = useCallback(() => {
    if (!uploadLock.current && !saveLock.current) onClose();
  }, [onClose]);

  const uploadPhotos = async (ids: number[]) => {
    if (!ids.length || uploadLock.current || saveLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setSaveError('');
    let cursor = 0;
    const worker = async () => {
      while (cursor < ids.length && mounted.current) {
        const id = ids[cursor++];
        const photo = photosRef.current.find((item) => item.id === id);
        if (!photo || photo.url) continue;
        changePhoto(id, { state: 'uploading', error: undefined });
        try {
          const result = await uploadSelfie(photo.file);
          if (mounted.current) changePhoto(id, { state: 'uploaded', url: result.url, error: undefined });
        } catch (reason) {
          if (mounted.current) changePhoto(id, { state: 'failed', error: getErrorMessage(reason, '上传失败，请重试') });
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker));
    } finally {
      uploadLock.current = false;
      if (mounted.current) setUploading(false);
    }
  };

  const addFiles = (files: File[]) => {
    if (!files.length || uploadLock.current || saveLock.current || profile) return;
    setPhotoError('');
    setSaveError('');
    if (photosRef.current.length + files.length > MAX_PHOTOS) {
      setPhotoError('最多上传 9 张照片，还可以添加 ' + (MAX_PHOTOS - photosRef.current.length) + ' 张。');
      return;
    }
    const valid: Photo[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        rejected.push(file.name + '：请选择 JPG、PNG 或 WebP 图片');
      } else if (file.size === 0 || file.size > MAX_BYTES) {
        rejected.push(file.name + (file.size === 0 ? '：文件没有内容' : '：超过 10MB，请压缩后上传'));
      } else {
        valid.push({ id: ++nextId.current, file, preview: URL.createObjectURL(file), state: 'queued' });
      }
    }
    if (rejected.length) setPhotoError(rejected.join('；'));
    if (!valid.length) return;
    replacePhotos([...photosRef.current, ...valid]);
    void uploadPhotos(valid.map((photo) => photo.id));
  };

  const removePhoto = (id: number) => {
    if (saveLock.current) return;
    const target = photosRef.current.find((photo) => photo.id === id);
    if (!target || target.state === 'queued' || target.state === 'uploading') return;
    URL.revokeObjectURL(target.preview);
    replacePhotos(photosRef.current.filter((photo) => photo.id !== id));
    setPhotoError('');
    setSaveError('');
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (composing.current || uploadLock.current || saveLock.current) return;
    const trimmed = name.trim();
    setNameError('');
    setSaveError('');
    if (!trimmed || Array.from(trimmed).length > 30) {
      setNameError('请输入 1–30 个字的档案名称');
      nameRef.current?.focus();
      return;
    }
    const items = photosRef.current;
    if (!profile && (items.length < MIN_PHOTOS || items.length > MAX_PHOTOS || items.some((photo) => !photo.url || photo.state !== 'uploaded'))) {
      setPhotoError('请上传 4–9 张照片，并完成所有照片的上传。');
      return;
    }
    saveLock.current = true;
    setSaving(true);
    try {
      const saved = profile
        ? await updateProfile(profile.id, trimmed)
        : await createProfile(trimmed, items.map((photo) => photo.url!));
      if (!mounted.current) return;
      onSaved(saved);
      onClose();
    } catch (reason) {
      if (mounted.current) setSaveError(getErrorMessage(reason, '档案保存失败，请重试'));
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  return <PortraitModal title={profile ? '重命名面部档案' : '创建面部档案'} onClose={close} wide={!profile}>
    <form className="portrait-profile-editor space-y-5 px-5 pb-6 sm:px-7" onSubmit={save} noValidate>
      {profile ? <div className="flex items-center gap-4 rounded-xl bg-[#f7f7f7] p-3">
        <img src={selfiePreviewUrl(profile.selfie_url)} alt="当前档案的自拍" className="h-24 w-[72px] shrink-0 rounded-lg object-cover" />
        <div><p className="text-sm leading-6 text-[#666]">修改档案名称，方便下次选择。</p><p className="mt-1 text-xs text-[#888]">{profile.selfie_urls?.length || 1} 张照片已保留</p></div>
      </div> : <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-7">
        <aside className="portrait-profile-guidance">
          <p className="mb-3 text-sm font-medium text-[#202020]">选择同一个人的清晰照片</p>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-4">
            {GUIDES.map((guide) => <figure key={guide.label} className="min-w-0 lg:flex lg:items-center lg:gap-3">
              <img src={guide.image} alt={guide.label + '选片示例'} className="h-auto w-full rounded-lg lg:w-[84px] lg:shrink-0" />
              <figcaption className="mt-2 text-center lg:mt-0 lg:text-left">
                <p className="text-xs font-medium text-[#202020] sm:text-sm">{guide.label}</p>
                <p className="mt-1 hidden text-xs leading-5 text-[#666] lg:block">{guide.description}</p>
              </figcaption>
            </figure>)}
          </div>
        </aside>
        <section aria-labelledby={inputId + '-photos'}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 id={inputId + '-photos'} className="text-base font-semibold">上传4–9张照片</h3>
            <span className="text-xs text-[#777]">每张最大 10MB</span>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" aria-label="选择 4–9 张档案照片" disabled={busy}
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              event.target.value = '';
              addFiles(selected);
            }} />
          <div className={'portrait-profile-dropzone rounded-xl border p-4 transition-colors sm:p-5 ' + (dragging ? 'border-black bg-[#ffe0cf]' : 'border-transparent bg-[#fff0e9]')}
            onDragOver={(event) => { event.preventDefault(); if (!busy && photos.length < MAX_PHOTOS) setDragging(true); }}
            onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}>
            {photos.length === 0 ? <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="flex min-h-[240px] w-full flex-col items-center justify-center rounded-lg px-2 text-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black lg:min-h-[350px]">
              <ImagePlus size={42} strokeWidth={1.3} className="text-[#b48d7b]" aria-hidden="true" />
              <span className="mt-5 text-base font-semibold text-[#5f493e]">点击上传照片</span>
              <span className="mt-2 text-xs leading-6 text-[#987562]">支持选择多张，或将照片拖到这里<br />JPG / PNG / WebP</span>
              <span className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-black px-6 text-sm font-medium text-[#ffe6da]"><Upload size={15} aria-hidden="true" />选择照片</span>
            </button> : <>
              <div className="portrait-profile-upload-grid grid grid-cols-3 gap-3">
                {photos.map((photo, index) => <div key={photo.id} className="min-w-0">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-[#eee]">
                    <img src={photo.preview} alt={'档案照片 ' + (index + 1)} className="h-full w-full object-cover" />
                    <button type="button" onClick={() => removePhoto(photo.id)} disabled={saving || photo.state === 'queued' || photo.state === 'uploading'} aria-label={'移除第 ' + (index + 1) + ' 张照片'} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-bl-lg bg-white/90 text-black focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-black disabled:opacity-30"><X size={16} aria-hidden="true" /></button>
                    {(photo.state === 'uploading' || photo.state === 'queued') && <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/60 px-1 py-2 text-xs text-white"><Loader2 size={13} className="animate-spin" aria-hidden="true" />{photo.state === 'uploading' ? '上传中' : '等待上传'}</div>}
                  </div>
                  {photo.state === 'failed' ? <div>
                    <p className="mt-1 break-words text-xs leading-5 text-[#b3261e]" role="alert">{photo.error}</p>
                    <button type="button" disabled={busy} onClick={() => void uploadPhotos([photo.id])} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-[#202020] underline underline-offset-4 disabled:opacity-40"><RefreshCw size={13} aria-hidden="true" />重试上传</button>
                  </div> : photo.state === 'uploaded' ? <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#705b50]"><Check size={12} aria-hidden="true" />已上传</p> : <p className="mt-2 text-xs text-[#987562]">第 {index + 1} 张</p>}
                </div>)}
              </div>
              {photos.length < MAX_PHOTOS && <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cdb4a6] px-4 text-sm font-medium text-[#5f493e] disabled:opacity-40"><ImagePlus size={16} aria-hidden="true" />继续添加照片</button>}
            </>}
          </div>
          <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-2 text-xs text-[#666]" aria-live="polite">
            {photos.length > 0 ? <span role="status">已上传 {uploadedCount} / {photos.length} 张{uploading ? '，上传中…' : ready ? '，可以保存档案' : photos.length < MIN_PHOTOS ? '，还需 ' + (MIN_PHOTOS - photos.length) + ' 张' : failedCount ? '，请重试或移除失败照片' : ''}</span> : <span>照片仅当前账户可用</span>}
            {!uploading && failedCount > 1 && <button type="button" disabled={saving} className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-black underline underline-offset-4" onClick={() => void uploadPhotos(photosRef.current.filter((photo) => photo.state === 'failed').map((photo) => photo.id))}><RefreshCw size={13} aria-hidden="true" />重试失败照片</button>}
          </div>
          {photoError && <p className="mt-1 break-words text-sm leading-6 text-[#b3261e]" role="alert">{photoError}</p>}
        </section>
      </div>}
      <div>
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium">档案名称</label>
        <input id={inputId} ref={nameRef} value={name} maxLength={30} autoComplete="off" placeholder="例如：我的面部档案" disabled={saving} required
          className={'min-h-12 w-full rounded-lg border bg-white px-3 text-sm text-[#202020] outline-none placeholder:text-[#777] focus:border-black focus:ring-1 focus:ring-black disabled:bg-[#f5f5f5] ' + (nameError ? 'border-[#b3261e]' : 'border-[#d8d8d8]')}
          aria-invalid={Boolean(nameError)} aria-describedby={inputId + (nameError ? '-error' : '-hint')}
          onChange={(event) => { setName(event.target.value); setNameError(''); setSaveError(''); }}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
          onKeyDown={(event) => { if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} />
        {nameError ? <p id={inputId + '-error'} className="mt-2 text-xs text-[#b3261e]" role="alert">{nameError}</p> : <p id={inputId + '-hint'} className="mt-2 text-xs text-[#666]">1–30 个字，可在档案中心修改。</p>}
      </div>
      {saveError && <p className="rounded-lg bg-[#fff0e9] px-3 py-2 text-sm leading-6 text-[#b3261e]" role="alert">{saveError}</p>}
      <div className="flex justify-end gap-3 border-t border-[#eee] pt-5">
        <button type="button" disabled={busy} onClick={close} className="min-h-11 rounded-lg border border-[#ddd] px-5 text-sm font-medium disabled:opacity-50">取消</button>
        <button type="submit" disabled={busy || (!profile && !ready)} className="portrait-black-button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-6 text-sm font-semibold text-[#ffe6da] disabled:cursor-not-allowed disabled:opacity-40">
          {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}{saving ? '正在保存…' : saveError ? '重试保存' : '保存档案'}
        </button>
      </div>
    </form>
  </PortraitModal>;
}
