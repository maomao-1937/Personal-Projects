'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, ImagePlus, Search, Sparkles } from 'lucide-react';
import { StylePreview } from '@/components/StylePreview';
import type { MergedStyle } from '@/hooks/useStyles';

type Variant = 'meitu' | 'xingtu';
type Category = '热门' | '全部' | '证件职业' | '女性写真' | '男性写真' | '儿童写真' | '创意写真';
const CATEGORIES: Category[] = ['热门', '全部', '证件职业', '女性写真', '男性写真', '儿童写真', '创意写真'];

function groupOf(style: MergedStyle): Category {
  const category = style.category as Category;
  return CATEGORIES.includes(category) ? category : '创意写真';
}

const firstNames = ['经典证件照', '白西装形象照', '黑西装肖像', '香槟西装照', '昭和樱花梦', '韩系清透', '港风红裙', '白纱婚礼', '霓虹雨夜', '黑白男生肖像'];

interface CatalogViewProps {
  variant: Variant;
  styles: MergedStyle[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  onSelect: (id: string) => void;
  onFreeCreate: () => void;
}

export function CatalogView({ variant, styles, loading, error, retry, onSelect, onFreeCreate }: CatalogViewProps) {
  const [category, setCategory] = useState<Category>('热门');
  const [query, setQuery] = useState('');
  const dark = variant === 'xingtu';
  const available = useMemo(() => [...styles].sort((a, b) => {
    const aRank = firstNames.indexOf(a.name);
    const bRank = firstNames.indexOf(b.name);
    if (aRank !== -1 || bRank !== -1) return (aRank === -1 ? 100 : aRank) - (bRank === -1 ? 100 : bRank);
    return a.sortOrder - b.sortOrder;
  }), [styles]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term) return available.filter((style) => `${style.name} ${style.description} ${style.category}`.toLowerCase().includes(term));
    if (category === '热门') return available.filter((style) => firstNames.includes(style.name));
    if (category === '全部') return available;
    return available.filter((style) => groupOf(style) === category);
  }, [available, category, query]);
  const featured = [0, 4, 8].map((index) => available[index]).filter(Boolean);

  const select = (style: MergedStyle) => { if (style.isServerBacked) onSelect(style.id); };
  const categories = (
    <div className={`catalog-tabs flex gap-1 overflow-x-auto border-b ${dark ? 'border-white/10' : 'border-[#e9e8e8]'}`} role="tablist" aria-label="写真分类">
      {CATEGORIES.map((item) => <button
        key={item} type="button" role="tab" aria-selected={category === item}
        onClick={() => { setCategory(item); setQuery(''); }}
        className={`min-h-12 shrink-0 border-b-[3px] px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-3px] ${dark ? category === item ? 'border-[#d0ff44] text-[#eaffab]' : 'border-transparent text-white/55 hover:text-white' : category === item ? 'border-[#e54c5b] text-[#222]' : 'border-transparent text-[#717171] hover:text-[#222]'}`}
      >{item}</button>)}
    </div>
  );

  const grid = loading ? (
    <div role="status" aria-label="正在加载写真主题" className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }, (_, index) => <div key={index} className={`aspect-[3/4] animate-pulse rounded-md ${dark ? 'bg-white/10' : 'bg-[#ecebec]'}`} />)}
    </div>
  ) : error ? (
    <div role="alert" className={`py-20 text-center text-sm ${dark ? 'text-white/60' : 'text-[#666]'}`}>
      <p>写真主题暂时无法加载。</p><button type="button" onClick={retry} className={`mt-4 min-h-11 px-5 font-semibold underline underline-offset-4 ${dark ? 'text-[#d0ff44]' : 'text-[#d94154]'}`}>重新加载</button>
    </div>
  ) : visible.length ? (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5" aria-live="polite">
      {visible.map((style) => <button
        key={style.id} type="button" disabled={!style.isServerBacked} onClick={() => select(style)}
        className={`group min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-55 ${dark ? 'focus-visible:outline-[#d0ff44]' : 'focus-visible:outline-[#e54c5b]'}`}
        aria-label={`选择${style.name}写真主题`}
      >
        <span className={`relative block aspect-[3/4] overflow-hidden rounded-md ${dark ? 'bg-[#282b2b]' : 'bg-[#e9e7e7]'}`}>
          <StylePreview src={style.previewImage} alt={`${style.name}效果示例`} sizes="(max-width:639px) 45vw, (max-width:1279px) 24vw, 200px" className="object-cover transition-transform duration-300 group-hover:scale-[1.035]" />
          <span className={`absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${dark ? 'bg-[#d0ff44] text-[#202222]' : 'bg-[#ed4b5e] text-white'}`}><ArrowRight size={17} aria-hidden="true" /></span>
        </span>
        <span className={`mt-2.5 block truncate text-sm font-semibold ${dark ? 'text-white' : 'text-[#242424]'}`}>{style.name}</span>
        <span className={`mt-0.5 block truncate text-xs ${dark ? 'text-white/45' : 'text-[#838383]'}`}>{style.description}</span>
      </button>)}
    </div>
  ) : (
    <div className={`py-20 text-center text-sm ${dark ? 'text-white/60' : 'text-[#777]'}`}>
      <p>没有找到匹配的写真主题</p><button type="button" onClick={() => { setQuery(''); setCategory('全部'); }} className={`mt-4 min-h-11 font-semibold underline underline-offset-4 ${dark ? 'text-[#d0ff44]' : 'text-[#d94154]'}`}>查看全部主题</button>
    </div>
  );

  if (dark) return (
    <section className="overflow-hidden rounded-[18px] border border-[#393c3b] bg-[#1b1d1e] text-white" aria-label="醒图式写真效果库">
      <div className="relative min-h-[238px] overflow-hidden border-b border-white/10 bg-[#222626] sm:min-h-[330px]">
        <div className="absolute inset-0 flex justify-end gap-2 opacity-60 sm:gap-4" aria-hidden="true">
          {featured.map((style, index) => <div key={style.id} className={`relative h-full w-1/3 max-w-[220px] overflow-hidden ${index === 1 ? 'translate-y-8' : index === 2 ? '-translate-y-8' : ''}`}><StylePreview src={style.previewImage} alt="" sizes="220px" className="object-cover" /></div>)}
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#202323] via-[#202323]/95 to-transparent" />
        <div className="relative z-10 flex min-h-[238px] max-w-[650px] flex-col justify-center px-6 py-5 sm:min-h-[330px] sm:px-10 sm:py-9">
          <p className="text-xs font-semibold tracking-[0.2em] text-[#d0ff44]">AI PORTRAIT STUDIO</p>
          <h2 className="mt-3 max-w-sm text-[27px] font-semibold leading-tight sm:mt-4 sm:text-[43px]">用一张照片，打开所有灵感</h2>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/70 sm:mt-4">挑选写真效果，导入自拍，再写下你想补充的画面。</p>
          <button type="button" onClick={onFreeCreate} className="mt-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-md bg-[#d0ff44] px-5 text-sm font-semibold text-[#1a1d17] transition-colors hover:bg-[#e2ff87] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d0ff44] sm:mt-6">自由创作 <ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      </div>
      <div className="px-4 pb-10 pt-5 sm:px-8 sm:pt-7 lg:px-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold text-[#d0ff44]">探索效果</p><h3 className="mt-1 text-2xl font-semibold">AI 写真效果</h3></div><label className="flex min-h-11 w-full items-center gap-2 rounded-md border border-white/15 bg-[#292d2d] px-3 text-white/45 sm:w-[240px]"><Search size={17} aria-hidden="true" /><span className="sr-only">搜索写真主题</span><input value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value.trim()) setCategory('全部'); }} placeholder="搜索写真效果" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40" /></label></div>
        {categories}
        <div className="mb-5 mt-5 flex items-center justify-between gap-3"><p className="text-xs text-white/50">{loading ? '正在加载' : `共 ${visible.length} 款效果 · 样片仅供参考`}</p><Link href="/works?variant=xingtu" className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-white/70 hover:text-[#d0ff44]">我的写真 <ChevronRight size={15} aria-hidden="true" /></Link></div>
        {grid}
      </div>
    </section>
  );

  return (
    <section className="overflow-hidden rounded-[12px] border border-[#e6e5e7] bg-white text-[#242424]" aria-label="美图式写真画廊">
      <div className="lg:grid lg:grid-cols-[176px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#ededee] bg-white px-3 py-6 lg:block">
          <p className="px-3 text-xs font-semibold tracking-widest text-[#aaa]">AI 写真</p>
          <p className="mt-5 flex min-h-11 items-center gap-2 rounded-md bg-[#fff1f2] px-3 text-sm font-semibold text-[#d94154]"><Sparkles size={18} aria-hidden="true" />写真首页</p>
          <Link href="/works" className="mt-1 flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-[#666] hover:bg-[#f8f8f9]"><ImagePlus size={18} aria-hidden="true" />我的写真</Link>
          <div className="mt-8 border-t border-[#eee] px-3 pt-5"><p className="text-xs leading-5 text-[#999]">选择样片后上传自拍，即可创作你的版本。</p></div>
        </aside>
        <div className="min-w-0 bg-[#f8f8fa] px-4 pb-10 pt-5 sm:px-7 lg:px-9">
          <div className="relative min-h-[174px] overflow-hidden rounded-[10px] bg-[#f8e5e6] sm:min-h-[226px]">
            <div className="absolute inset-y-0 right-0 flex w-[58%] justify-end gap-1 opacity-90" aria-hidden="true">{featured.map((style, index) => <div key={style.id} className={`relative h-full w-[33%] min-w-[75px] overflow-hidden ${index === 1 ? 'translate-y-7' : ''}`}><StylePreview src={style.previewImage} alt="" sizes="180px" className="object-cover" /></div>)}</div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#f9e7e8] via-[#f9e7e8]/95 to-transparent" />
            <div className="relative flex min-h-[174px] max-w-[540px] flex-col justify-center px-4 py-4 sm:min-h-[226px] sm:px-9 sm:py-6"><p className="text-xs font-semibold tracking-widest text-[#d34e5e]">AI 写真主题馆</p><h2 className="mt-1 max-w-[220px] text-[21px] font-semibold leading-tight sm:mt-2 sm:max-w-none sm:text-[32px]">喜欢的写真，拍成你的样子</h2><p className="mt-1 max-w-[220px] text-xs leading-5 text-[#696069] sm:mt-2 sm:max-w-xs sm:text-sm">从样片找到想要的画面，上传自拍生成专属写真。</p><button type="button" onClick={onFreeCreate} className="mt-3 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-md bg-[#e94f61] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#d33d51] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e94f61] sm:mt-4">自由创作 <ChevronRight size={15} aria-hidden="true" /></button></div>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 sm:mt-7"><div><p className="text-xs font-semibold text-[#e04759]">主题写真</p><h3 className="mt-1 text-[21px] font-semibold sm:text-[23px]">发现你的写真风格</h3></div><label className="flex min-h-11 w-full items-center gap-2 rounded-md border border-[#dfdfe2] bg-white px-3 text-[#888] sm:w-[225px]"><Search size={17} aria-hidden="true" /><span className="sr-only">搜索写真主题</span><input value={query} onChange={(event) => { setQuery(event.target.value); if (event.target.value.trim()) setCategory('全部'); }} placeholder="搜索写真主题" className="w-full bg-transparent text-sm text-[#333] outline-none placeholder:text-[#999]" /></label></div>
          <div className="mt-2 sm:mt-4">{categories}</div>
          <div className="mb-3 mt-2 flex items-center justify-between gap-3 sm:mb-5 sm:mt-4"><p className="text-xs text-[#999]">{loading ? '正在加载' : `共 ${visible.length} 款主题 · 图片为效果示例`}</p><button type="button" onClick={onFreeCreate} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-semibold text-[#d94154] hover:underline"><span className="sm:hidden">自由描述</span><span className="hidden sm:inline">没有喜欢的？自由描述</span><ChevronRight size={15} aria-hidden="true" /></button></div>
          {grid}
        </div>
      </div>
    </section>
  );
}
