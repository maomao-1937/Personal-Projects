'use client';
/* eslint-disable @next/next/no-img-element */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ChevronRight, ImagePlus, Loader2, Plus, Search, Sparkles, Upload, X } from 'lucide-react';
import { PortraitShell } from '@/components/PortraitShell';
import { PortraitModal } from '@/components/PortraitModal';
import { ProfileEditor } from '@/components/ProfileEditor';
import { useStyles, type MergedStyle } from '@/hooks/useStyles';
import { useAuth } from '@/stores/auth';
import { createPortrait, getErrorMessage, getPortrait, getProfiles, selfiePreviewUrl, uploadSelfie, type FaceProfileRecord } from '@/lib/api';
import { shouldSubmitPrompt } from '@/lib/promptKeyboard';
import catalog from '../../../public/meitu-templates/catalog.json';

type Category = 'hot' | 'career' | 'women' | 'men' | 'children';
type Draft = { selfieRef: string; selfieRefs: string[]; fileName: string; prompt: string; styleId: string; category: Category; query: string };
const emptyDraft: Draft = { selfieRef: '', selfieRefs: [], fileName: '', prompt: '', styleId: '', category: 'hot', query: '' };
const draftKey = (id: string) => `ai-mirror:draft:${id}`;

function StudioContent() {
  const router = useRouter(); const params = useSearchParams(); const { user } = useAuth();
  const { styles, loading, error, retry } = useStyles();
  const [draft, setDraft] = useState<Draft>(emptyDraft); const [hydrated, setHydrated] = useState(false);
  const [profiles, setProfiles] = useState<FaceProfileRecord[]>([]); const [profileError, setProfileError] = useState('');
  const [profileEditor, setProfileEditor] = useState(false); const [pickerOpen, setPickerOpen] = useState(false); const [helpOpen, setHelpOpen] = useState(false);
  const [uploading, setUploading] = useState(false); const [restoring, setRestoring] = useState(false); const [uploadError, setUploadError] = useState('');
  const [submitError, setSubmitError] = useState(''); const [generating, setGenerating] = useState(false); const [dragging, setDragging] = useState(false); const [preview, setPreview] = useState('');
  const inputRef = useRef<HTMLInputElement>(null); const promptRef = useRef<HTMLTextAreaElement>(null);
  const uploadSequence = useRef(0); const inFlight = useRef(false);
  const createMode = params.get('create') === '1'; const sourceTask = params.get('sourceTask'); const profileId = params.get('profile');
  const initialStyle = params.get('style');
  const selected = styles.find((s) => s.id === draft.styleId);
  const patch = useCallback((values: Partial<Draft>) => setDraft((d) => ({ ...d, ...values })), []);
  const refreshProfiles = useCallback(async () => { try { setProfiles(await getProfiles()); setProfileError(''); } catch (reason) { setProfileError(getErrorMessage(reason, '档案读取失败，请重试')); } }, []);
  useEffect(() => { if (user?.id) void refreshProfiles(); else setProfiles([]); }, [refreshProfiles, user?.id]);
  useEffect(() => {
    if (!user?.id) { setDraft(emptyDraft); setPreview(''); setHydrated(false); return; }
    try { const saved = sessionStorage.getItem(draftKey(user.id)); if (saved) setDraft({ ...emptyDraft, ...JSON.parse(saved) }); } catch { sessionStorage.removeItem(draftKey(user.id)); }
    if (initialStyle) patch({ styleId: initialStyle });
    setHydrated(true);
  }, [user?.id, initialStyle, patch]);
  useEffect(() => { if (hydrated && user?.id) sessionStorage.setItem(draftKey(user.id), JSON.stringify(draft)); }, [draft, hydrated, user?.id]);
  useEffect(() => {
    if (!sourceTask || !hydrated) return;
    let active = true; setRestoring(true);
    getPortrait(sourceTask).then((task) => { if (active) { patch({ selfieRef: task.selfie_url || '', selfieRefs: task.selfie_urls || (task.selfie_url ? [task.selfie_url] : []), fileName: '上次使用的照片', styleId: task.style_id, prompt: task.user_prompt || '' }); setPreview(''); } }).catch((reason) => { if (active) setSubmitError(getErrorMessage(reason, '上次的创作暂时无法恢复')); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [sourceTask, hydrated, patch]);
  useEffect(() => { const profile = profiles.find((p) => p.id === profileId); if (profile) { patch({ selfieRef: profile.selfie_url, selfieRefs: profile.selfie_urls || [profile.selfie_url], fileName: profile.name }); setPreview(''); } }, [profileId, profiles, patch]);
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);
  const photo = preview || (draft.selfieRef ? selfiePreviewUrl(draft.selfieRef) : '');
  const ready = Boolean(draft.selfieRef) && !uploading && !restoring;
  const activeProfile = profiles.find((p) => p.selfie_url === draft.selfieRef);
  const changeStage = (create: boolean) => { if (create && !user) { router.push('/access?next=%2Fstudio%3Fcreate%3D1'); return; } router.push(create ? '/studio?create=1' : '/studio', { scroll: false }); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const chooseStyle = (style: MergedStyle) => { if (!user) { router.push(`/access?next=${encodeURIComponent(`/studio?create=1&style=${style.id}`)}`); return; } patch({ styleId: style.id }); setSubmitError(''); setPickerOpen(false); changeStage(true); };
  const chooseProfile = (profile: FaceProfileRecord) => { uploadSequence.current += 1; setPreview(''); setUploading(false); setUploadError(''); setSubmitError(''); patch({ selfieRef: profile.selfie_url, selfieRefs: profile.selfie_urls || [profile.selfie_url], fileName: profile.name }); };
  const closeProfileEditor = useCallback(() => setProfileEditor(false), []); const closePicker = useCallback(() => setPickerOpen(false), []); const closeHelp = useCallback(() => setHelpOpen(false), []);
  const uploaded = async (file: File) => {
    if (!user) { router.push('/access?next=%2Fstudio%3Fcreate%3D1'); return; }
    setUploadError(''); setSubmitError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setUploadError('请选择 JPG、PNG 或 WebP 图片'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('照片超过 10MB，请压缩后重试'); return; }
    const sequence = ++uploadSequence.current; setUploading(true); setPreview(URL.createObjectURL(file)); patch({ selfieRef: '', selfieRefs: [], fileName: file.name });
    try { const result = await uploadSelfie(file); if (sequence === uploadSequence.current) patch({ selfieRef: result.url, selfieRefs: [result.url] }); }
    catch (reason) { if (sequence === uploadSequence.current) setUploadError(getErrorMessage(reason, '上传失败，请重新选择照片')); }
    finally { if (sequence === uploadSequence.current) setUploading(false); }
  };
  const generate = async () => {
    if (inFlight.current) return;
    if (!ready) { setSubmitError(uploading ? '照片正在上传，请稍候' : '请先上传照片或选择面部档案'); return; }
    if (!selected && !draft.prompt.trim()) { setSubmitError('请选择写真主题，或描述想要的画面'); promptRef.current?.focus(); return; }
    inFlight.current = true; setGenerating(true); setSubmitError('');
    try { const task = await createPortrait({ selfieUrl: draft.selfieRef, selfieUrls: draft.selfieRefs.length ? draft.selfieRefs : [draft.selfieRef], styleId: selected?.id, userPrompt: draft.prompt }); router.push(`/studio/tasks/${encodeURIComponent(task.id)}`); }
    catch (reason) { setSubmitError(getErrorMessage(reason, '提交失败，请重试')); inFlight.current = false; setGenerating(false); }
  };
  const filtered = useMemo(() => {
    const term = draft.query.trim().toLowerCase(); if (term) return styles.filter((s) => s.name.toLowerCase().includes(term));
    const group = catalog.source_categories.find((c) => c.key === draft.category); const byImage = new Map(styles.map((s) => [s.previewImage, s]));
    return (group?.preview_urls || []).map((url) => byImage.get(url)).filter((s): s is MergedStyle => Boolean(s));
  }, [draft.category, draft.query, styles]);
  const featured = ['昭和樱花梦', '白西装Ⅱ', '经典证件照🌟'].map((name) => styles.find((s) => s.name === name)).filter((s): s is MergedStyle => Boolean(s));
  const profilePanel = <><button type="button" className="portrait-black-button w-full" onClick={() => { if (user) setProfileEditor(true); else router.push("/access?next=%2Fstudio"); }}><Plus size={22} />新增面部档案</button>{profileError && <p className="mt-4 text-xs text-red-700" role="alert">{profileError}<button className="ml-2 underline" onClick={() => void refreshProfiles()}>重试</button></p>}<div className="portrait-profile-list">{profiles.map((profile) => <button key={profile.id} type="button" aria-pressed={profile.selfie_url === draft.selfieRef} onClick={() => chooseProfile(profile)} className={`portrait-profile-option ${profile.selfie_url === draft.selfieRef ? 'is-selected' : ''}`}><img src={selfiePreviewUrl(profile.selfie_url)} alt={`${profile.name}原图`} /><span>{profile.name}</span>{profile.selfie_url === draft.selfieRef && <Check size={16} />}</button>)}{!profiles.length && !profileError && <div className="portrait-profile-empty"><ImagePlus size={34} strokeWidth={1.3} /><p>创建你的面部档案</p><span>照片保存后，可以重复使用</span></div>}</div><Link href="/profiles" className="portrait-manage-profiles">管理我的档案<ChevronRight size={15} /></Link></>;
  return <PortraitShell active="home" profilePanel={profilePanel}>
    <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="选择自拍照片" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploaded(file); e.target.value = ''; }} />
    {!createMode ? <>
      <div className="portrait-banner"><div><h1>AI 写真</h1><p>海量专业主题写真，拍出不同的你。</p><button type="button" onClick={() => { patch({ styleId: '' }); changeStage(true); }}>自由描述，制作写真<ChevronRight size={16} /></button></div><div className="portrait-banner-photos" aria-hidden="true">{featured.map((style, i) => <div key={style.id}><img src={style.previewImage} alt="" /><span>{['氛围感', '形象照', '证件照'][i]}</span></div>)}</div></div>
      <div className="portrait-gallery-toolbar"><div className="portrait-kind-tabs"><button type="button" aria-pressed className="is-selected">主题写真</button><button type="button" onClick={() => { patch({ styleId: '' }); changeStage(true); }}>概念写真</button></div><button type="button" className="portrait-help" onClick={() => setHelpOpen(true)} aria-label="查看写真使用说明">?</button></div>
      <div className="portrait-category-row"><div className="portrait-category-tabs" role="tablist" aria-label="写真分类">{catalog.source_categories.map((category) => <button key={category.key} type="button" role="tab" aria-selected={draft.category === category.key && !draft.query} onClick={() => patch({ category: category.key as Category, query: '' })}>{category.label}</button>)}</div><label className="portrait-search"><Search size={16} /><input value={draft.query} onChange={(e) => patch({ query: e.target.value })} aria-label="搜索写真主题" placeholder="搜索主题" />{draft.query && <button type="button" onClick={() => patch({ query: '' })} aria-label="清空搜索"><X size={14} /></button>}</label></div>
      {loading ? <div className="portrait-template-grid" role="status" aria-label="正在加载写真主题">{Array.from({ length: 10 }, (_, i) => <div key={i} className="portrait-template-skeleton" />)}</div> : error ? <div className="portrait-empty-state" role="alert"><p>{error}</p><button type="button" className="portrait-black-button" onClick={retry}>重新加载</button></div> : filtered.length ? <div className="portrait-template-grid">{filtered.map((style, i) => <button type="button" key={`${style.id}-${i}`} className="portrait-template" onClick={() => chooseStyle(style)} aria-label={`选择${style.name}写真主题`}><div><img src={style.previewImage} alt={`${style.name}效果示例`} loading={i < 10 ? 'eager' : 'lazy'} /><span>制作同款<ChevronRight size={15} /></span></div><p>{style.name}</p></button>)}</div> : <div className="portrait-empty-state"><p>没有找到这个主题</p><button type="button" className="portrait-black-button" onClick={() => patch({ query: '' })}>查看主题写真</button></div>}
      <p className="portrait-gallery-note">样片展示妆造与场景，生成结果以你的照片为基础。</p>
    </> : <>
      <button type="button" className="portrait-back" onClick={() => changeStage(false)}><ArrowLeft size={17} />返回主题写真</button>
      <div className="portrait-create-layout"><section className="portrait-selected-template" aria-label="写真效果示例">{selected ? <><img src={selected.previewImage} alt={`${selected.name}效果示例`} /><div><h1>{selected.name}</h1><span>主题效果示例</span></div></> : <div className="portrait-concept-preview">{photo ? <img src={photo} alt="当前自拍原图" /> : <><Sparkles size={40} strokeWidth={1.2} /><h1>概念写真</h1><p>用文字描述你想要的画面</p></>}<span>{photo ? '自拍原图 · 尚未生成' : '从一张照片开始'}</span></div>}</section>
        <form className="portrait-creation-form" onSubmit={(e) => { e.preventDefault(); void generate(); }}><div className="portrait-form-title"><h2>制作你的写真</h2><button type="button" onClick={() => setHelpOpen(true)}>照片要求</button></div>
          <label className="portrait-field-label">面部档案<span>{draft.selfieRefs.length > 1 ? `已选择 ${draft.selfieRefs.length} 张档案照片` : '选择档案或上传一张照片'}</span></label><div className={`portrait-upload ${dragging ? 'is-dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) void uploaded(file); }}><button type="button" onClick={() => inputRef.current?.click()} disabled={generating || uploading} className="portrait-upload-button">{photo ? <img src={photo} alt="已选择的自拍原图" /> : <Upload size={28} strokeWidth={1.4} />}<span><strong>{uploading ? '正在上传…' : restoring ? '正在恢复上次创作…' : photo ? activeProfile?.name || draft.fileName || '已上传照片' : '上传图片'}</strong><small>{photo ? draft.selfieRefs.length > 1 ? `${draft.selfieRefs.length} 张照片将一起用于制作 · 点击更换` : '点击更换照片' : '正面、单人、光影自然，JPG / PNG / WebP · 10MB以内'}</small></span>{ready && <Check size={19} />}</button></div>
          {profiles.length > 0 && <select className="portrait-profile-select" aria-label="选择已有档案" disabled={generating} value={activeProfile?.id || ''} onChange={(e) => { const profile = profiles.find((p) => p.id === e.target.value); if (profile) chooseProfile(profile); }}><option value="">选择已有面部档案</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select>}
          {uploadError && <p className="portrait-inline-error" role="alert">{uploadError}<button type="button" onClick={() => inputRef.current?.click()}>重新上传</button></p>}
          <div className="portrait-direction-row"><label className="portrait-field-label">写真主题</label><button type="button" onClick={() => setPickerOpen(true)} disabled={generating}>更换主题<ChevronRight size={14} /></button></div><div className="portrait-current-style">{selected ? <><img src={selected.previewImage} alt="" /><span>{selected.name}</span><button type="button" disabled={generating} onClick={() => patch({ styleId: '' })} aria-label="清除主题"><X size={16} /></button></> : <><Sparkles size={19} /><span>概念写真 · 自由描述</span></>}</div>
          <label className="portrait-field-label" htmlFor="portrait-prompt">描述画面<span>可补充主题细节</span></label><div className="portrait-prompt-box"><textarea ref={promptRef} id="portrait-prompt" value={draft.prompt} maxLength={500} disabled={generating} rows={4} placeholder="描述服装、场景、光线，例如：海边日落，白色连衣裙，温柔的电影感光线" onChange={(e) => { patch({ prompt: e.target.value }); setSubmitError(''); }} onKeyDown={(e) => { if (shouldSubmitPrompt({ key: e.key, shiftKey: e.shiftKey, repeat: e.repeat, isComposing: e.nativeEvent.isComposing, keyCode: e.nativeEvent.keyCode })) { e.preventDefault(); void generate(); } }} /><div><span>Enter 生成 · Shift + Enter 换行</span><span>{draft.prompt.length}/500</span></div></div>{submitError && <p className="portrait-inline-error" role="alert">{submitError}</p>}
          <div className="portrait-generate-actions"><button type="submit" className="portrait-black-button" disabled={uploading || generating || restoring}>{generating || uploading || restoring ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}{generating ? '正在提交制作…' : uploading ? '照片上传中…' : '生成写真'}</button><p>保留你的面部特征，参考所选样片的妆造与场景。</p></div>
        </form></div>
    </>}
    {profileEditor && <ProfileEditor onClose={closeProfileEditor} onSaved={(profile) => { setProfiles((list) => [profile, ...list]); chooseProfile(profile); setProfileEditor(false); }} />}
    {pickerOpen && <PortraitModal title="选择写真主题" onClose={closePicker} wide><div className="portrait-picker-grid">{styles.map((style) => <button type="button" key={style.id} onClick={() => chooseStyle(style)} aria-pressed={draft.styleId === style.id}><img src={style.previewImage} alt={`${style.name}效果示例`} loading="lazy" /><span>{style.name}</span></button>)}</div></PortraitModal>}
    {helpOpen && <PortraitModal title="照片要求与制作说明" onClose={closeHelp}><div className="portrait-help-content"><h3>照片满足这些要求，效果更理想</h3><p>正面、胸像或半身像、单人、光影自然、画质清晰。</p><p>尽量避免多人、遮挡过多、过度仰拍或俯拍。</p><h3>如何制作</h3><p>选择写真主题或自由描述，选择面部档案或上传一张自拍，然后生成。完成后在任务列表查看与保存。</p><h3>键盘操作</h3><p>输入框中按 Enter 生成，Shift + Enter 换行。中文输入法确认选字时不会提交。</p><button type="button" className="portrait-black-button w-full" onClick={closeHelp}>知道了</button></div></PortraitModal>}
  </PortraitShell>;
}

export default function StudioPage() { return <Suspense fallback={<div className="portrait-page-loading">正在打开写真工作台…</div>}><StudioContent /></Suspense>; }
