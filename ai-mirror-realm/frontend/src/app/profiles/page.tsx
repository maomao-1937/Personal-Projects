'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PortraitShell } from '@/components/PortraitShell';
import { PortraitModal } from '@/components/PortraitModal';
import { ProfileEditor } from '@/components/ProfileEditor';
import { deleteProfile, getErrorMessage, getProfiles, selfiePreviewUrl, type FaceProfileRecord } from '@/lib/api';

function ProfilePhoto({ profile }: { profile: FaceProfileRecord }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const href = `/studio?create=1&profile=${encodeURIComponent(profile.id)}`;
  const photos = profile.selfie_urls?.length ? profile.selfie_urls : [profile.selfie_url];
  return <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#eee]">
    {failed ? <div className="flex h-full flex-col items-center justify-center gap-3 px-3 text-center text-[#666]">
      <AlertCircle size={23} aria-hidden="true" /><p className="text-xs leading-5">照片暂时无法显示</p>
      <button type="button" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-black underline underline-offset-4" onClick={() => { setAttempt((value) => value + 1); setFailed(false); }}><RefreshCw size={13} />重新加载</button>
    </div> : <Link href={href} aria-label={`使用${profile.name}创作写真`} className="block h-full focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-black">
      <div className={`grid h-full w-full gap-0.5 ${photos.length > 4 ? 'grid-cols-3 grid-rows-3' : photos.length > 1 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
        {photos.map((url, index) => <img key={`${attempt}-${index}`} src={selfiePreviewUrl(url)} alt={`${profile.name}的第 ${index + 1} 张照片`} loading="lazy" className="h-full min-h-0 w-full min-w-0 object-cover" onError={() => setFailed(true)} />)}
      </div>
    </Link>}
  </div>;
}

function ProfilesContent() {
  const [profiles, setProfiles] = useState<FaceProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<FaceProfileRecord | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FaceProfileRecord | null>(null);
  const [viewerProfile, setViewerProfile] = useState<FaceProfileRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const loadSequence = useRef(0);
  const deleteLock = useRef(false);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true); setError('');
    try { const items = await getProfiles(); if (sequence === loadSequence.current) setProfiles(items); }
    catch (reason) { if (sequence === loadSequence.current) setError(getErrorMessage(reason, '档案暂时无法读取，请重试')); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { loadSequence.current += 1; }; }, [load]);

  const closeEditor = useCallback(() => setEditor(null), []);
  const closeDelete = useCallback(() => { if (!deleteLock.current) { setDeleteTarget(null); setDeleteError(''); } }, []);
  const saved = (profile: FaceProfileRecord) => {
    setProfiles((current) => current.some((item) => item.id === profile.id) ? current.map((item) => item.id === profile.id ? profile : item) : [profile, ...current]);
    setNotice(editor === 'new' ? '档案已保存，可以开始创作。' : '档案名称已更新。');
    setEditor(null);
  };
  const remove = async () => {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true; setDeleting(true); setDeleteError('');
    try {
      await deleteProfile(deleteTarget.id);
      setProfiles((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null); setNotice('档案已删除，写真任务已保留。');
    } catch (reason) { setDeleteError(getErrorMessage(reason, '删除失败，请重试')); }
    finally { deleteLock.current = false; setDeleting(false); }
  };

  return <PortraitShell active="profiles">
    <section className="portrait-profile-center mx-auto w-full max-w-[1320px]">
      <div className="portrait-profile-heading mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">档案中心</h1><p className="mt-2 text-sm leading-6 text-[#666]">保存 4–9 张同一人的照片，选择档案即可制作写真。</p></div>
        <button type="button" disabled={loading} onClick={() => { setNotice(''); setEditor('new'); }} className="portrait-black-button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-black px-5 text-sm font-semibold text-[#ffe6da] disabled:opacity-40"><Plus size={17} aria-hidden="true" />新增面部档案</button>
      </div>
      {notice && <p className="mb-5 text-sm leading-6 text-[#555]" role="status">{notice}</p>}
      {loading ? <div className="portrait-profile-grid grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="status" aria-label="正在读取面部档案">{[0, 1, 2, 3].map((item) => <div key={item} className="aspect-[3/4] animate-pulse rounded-xl bg-[#eee]" />)}</div> : error ? <div className="flex min-h-[360px] flex-col items-center justify-center border-y border-[#eee] px-4 py-10 text-center">
        <AlertCircle size={26} className="text-[#888]" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold">暂时无法读取档案</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#666]" role="alert">{error}</p><button type="button" onClick={() => void load()} className="portrait-black-button mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-black px-6 text-sm font-semibold text-[#ffe6da]"><RefreshCw size={16} />重新加载</button>
      </div> : profiles.length === 0 ? <div className="flex min-h-[390px] flex-col items-center justify-center rounded-xl bg-[#fafafa] px-4 py-10 text-center">
        <UserRound size={36} strokeWidth={1.4} className="text-[#888]" aria-hidden="true" /><h2 className="mt-5 text-xl font-semibold">创建你的第一份面部档案</h2><p className="mt-3 max-w-sm text-sm leading-7 text-[#666]">上传 4–9 张清晰照片，包含正脸、不同表情和背景。给档案取名后，下次选择就能直接使用。</p><button type="button" onClick={() => setEditor('new')} className="portrait-black-button mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-black px-6 text-sm font-semibold text-[#ffe6da]"><ImagePlus size={17} aria-hidden="true" />上传照片，创建档案</button>
      </div> : <div className="portrait-profile-grid grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 xl:grid-cols-5">
        {profiles.map((profile) => <article key={profile.id} className="portrait-profile-card min-w-0">
          <ProfilePhoto profile={profile} />
          <h2 className="mt-3 truncate text-sm font-semibold" title={profile.name}>{profile.name}</h2>
          <p className="mt-1 text-xs text-[#888]">{profile.selfie_urls?.length || 1} 张照片</p>
          <button type="button" onClick={() => setViewerProfile(profile)} className="mt-1 min-h-11 text-left text-xs font-medium text-[#444] underline underline-offset-4 hover:text-black">查看全部原图</button>
          <div className="mt-1 flex flex-col gap-0 sm:flex-row sm:items-center sm:justify-between">
            <Link href={`/studio?create=1&profile=${encodeURIComponent(profile.id)}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-[#202020] hover:underline hover:underline-offset-4">开始创作<ArrowRight size={14} aria-hidden="true" /></Link>
            <div className="flex shrink-0 gap-0.5 self-end sm:self-auto"><button type="button" onClick={() => setEditor(profile)} aria-label={`重命名${profile.name}`} title="重命名" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#666] hover:bg-[#eee] hover:text-black"><Pencil size={15} aria-hidden="true" /></button><button type="button" onClick={() => { setDeleteTarget(profile); setDeleteError(''); }} aria-label={`删除${profile.name}`} title="删除档案" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#666] hover:bg-[#fff0e9] hover:text-[#b3261e]"><Trash2 size={15} aria-hidden="true" /></button></div>
          </div>
        </article>)}
      </div>}
    </section>
    {editor && <ProfileEditor profile={editor === 'new' ? undefined : editor} onClose={closeEditor} onSaved={saved} />}
    {viewerProfile && <PortraitModal title={`${viewerProfile.name} · 原图`} onClose={() => setViewerProfile(null)} wide>
      <div className="grid grid-cols-2 gap-3 px-5 pb-6 sm:grid-cols-3 sm:gap-4 sm:px-7">
        {(viewerProfile.selfie_urls?.length ? viewerProfile.selfie_urls : [viewerProfile.selfie_url]).map((url, index) => <figure key={`${url}-${index}`} className="min-w-0">
          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-[#f5f5f5]"><img src={selfiePreviewUrl(url)} alt={`${viewerProfile.name}的第 ${index + 1} 张原图`} className="max-h-full max-w-full object-contain" /></div>
          <figcaption className="mt-2 text-center text-xs text-[#666]">第 {index + 1} 张原图</figcaption>
        </figure>)}
      </div>
    </PortraitModal>}
    {deleteTarget && <PortraitModal title="删除面部档案？" onClose={closeDelete}>
      <div className="px-5 pb-6 sm:px-7"><p className="break-words text-sm leading-7 text-[#555]">将删除「{deleteTarget.name}」这份档案。正在生成的任务和已有写真会保留。</p>{deleteError && <p role="alert" className="mt-3 text-sm leading-6 text-[#b3261e]">{deleteError}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={closeDelete} className="min-h-11 rounded-lg border border-[#ddd] px-5 text-sm font-medium disabled:opacity-50">取消</button><button type="button" disabled={deleting} onClick={() => void remove()} className="portrait-black-button inline-flex min-h-11 items-center gap-2 rounded-lg bg-black px-5 text-sm font-semibold text-[#ffe6da] disabled:opacity-50">{deleting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}{deleting ? '正在删除…' : '删除档案'}</button></div></div>
    </PortraitModal>}
  </PortraitShell>;
}

export default function ProfilesPage() { return <ProtectedRoute><ProfilesContent /></ProtectedRoute>; }
