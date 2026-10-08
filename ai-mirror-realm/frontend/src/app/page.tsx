import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check, LockKeyhole, Upload } from 'lucide-react';

const gallery = [
  { src: '/style-previews/fugu.jpg', label: '复古电影', className: 'col-span-7 row-span-2 min-h-[360px] sm:min-h-[500px]' },
  { src: '/style-previews/zhichang.jpg', label: '质感职场', className: 'col-span-5 min-h-[210px] sm:min-h-[242px]' },
  { src: '/style-previews/rixi.jpg', label: '自然日系', className: 'col-span-5 min-h-[210px] sm:min-h-[242px]' },
  { src: '/style-previews/guofeng.jpg', label: '东方国风', className: 'col-span-5 min-h-[150px] sm:col-span-4 sm:min-h-[180px]' },
  { src: '/style-previews/yishu.jpg', label: '艺术肖像', className: 'col-span-7 min-h-[150px] sm:col-span-8 sm:min-h-[180px]' },
];

const examples = [
  ['/style-previews/chaoku.jpg', '潮流街拍'],
  ['/style-previews/hunsha.jpg', '轻婚纱像'],
  ['/style-previews/xianxia.jpg', '仙侠氛围'],
  ['/style-previews/guofeng.jpg', '东方人像'],
] as const;

export default function HomePage() {
  return (
    <main className="pt-16">
      <section className="page-shell py-5 sm:py-8">
        <div className="relative overflow-hidden rounded-[28px] bg-stage text-white shadow-card sm:rounded-[32px]">
          <div className="grid min-h-[690px] lg:grid-cols-[0.82fr_1.18fr]">
            <div className="relative z-10 flex flex-col justify-between p-7 sm:p-10 lg:p-12">
              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                  <span className="text-brand">AI 镜界</span>
                  <span className="h-px w-8 bg-white/20" aria-hidden="true" />
                  <span>Private portrait lab</span>
                </div>
                <p className="mt-20 text-xs font-semibold uppercase tracking-[0.18em] text-brand sm:mt-24">把下一张写真，先在脑海里拍出来</p>
                <h1 className="display-title mt-5 max-w-[560px] text-[clamp(2.75rem,6vw,5.4rem)] leading-[0.98] text-white">
                  一张自拍，<br /><span className="text-brand">进入新的镜头。</span>
                </h1>
                <p className="mt-7 max-w-md text-base leading-7 text-white/65 sm:text-lg sm:leading-8">写下你想要的场景，或从主题里选一个方向。AI 会保留你的面孔，把画面完成。</p>
                <Link href="/access?next=%2Fstudio" className="mt-9 inline-flex min-h-13 items-center justify-center gap-3 rounded-xl bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-[#a83d27] focus-visible:outline-white sm:px-7">
                  使用邀请码开始 <ArrowRight size={18} />
                </Link>
                <p className="mt-4 text-xs text-white/40">仅限受邀用户 · 不需要训练模型 · 结果仅自己可见</p>
              </div>

              <div className="mt-16 grid max-w-md grid-cols-3 border-t border-white/15 pt-5">
                <div className="pr-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">01</p><p className="mt-2 text-sm text-white/80">上传自拍</p></div>
                <div className="border-l border-white/15 px-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">02</p><p className="mt-2 text-sm text-white/80">描述或选主题</p></div>
                <div className="border-l border-white/15 pl-3"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">03</p><p className="mt-2 text-sm text-white/80">生成并下载</p></div>
              </div>
            </div>

            <div className="relative p-3 pt-0 sm:p-5 sm:pt-0 lg:p-5 lg:pl-0">
              <div className="mb-3 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 sm:mb-4">
                <span>Sample wall</span>
                <span className="inline-flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-brand" /> local previews</span>
              </div>
              <div className="grid grid-cols-12 auto-rows-[minmax(0,1fr)] gap-3">
                {gallery.map((item, index) => (
                  <figure key={item.src} className={`group relative overflow-hidden rounded-2xl bg-[#222327] ${item.className}`}>
                    <Image src={item.src} alt={`${item.label} AI 写真示例`} fill priority={index < 3} sizes="(max-width: 639px) 50vw, (max-width: 1023px) 42vw, 24vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    <div className="absolute inset-x-0 bottom-0 bg-black/65 p-3 sm:p-4">
                      <figcaption className="flex items-center justify-between text-xs font-medium text-white/90"><span>{item.label}</span><ArrowUpRight size={14} className="text-white/60" aria-hidden="true" /></figcaption>
                    </div>
                  </figure>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="examples" className="border-y border-line bg-paper py-20 sm:py-24">
        <div className="page-shell">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="editorial-kicker text-brand">A direction to start from</p><h2 className="display-title mt-3 max-w-xl text-4xl sm:text-5xl">你的脸，适合很多种故事。</h2></div>
            <p className="max-w-xs text-sm leading-6 text-muted sm:text-right">主题只是快捷入口。你也可以用自己的话，描述想要的场景、服装和氛围。</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 sm:gap-5">
            {examples.map(([src, label], index) => (
              <figure key={src} className={index % 2 === 1 ? 'sm:translate-y-8' : undefined}>
                <div className="photo-frame aspect-[3/4] bg-[#dedbd4]"><Image src={src} alt={`${label} AI 写真示例`} fill sizes="(max-width: 639px) 50vw, 25vw" className="object-cover transition-transform duration-500 hover:scale-[1.03]" /></div>
                <figcaption className="mt-3 flex items-center justify-between text-sm font-medium"><span>{label}</span><span className="text-xs text-muted">0{index + 1}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <div><p className="editorial-kicker text-brand">A short path</p><h2 className="display-title mt-3 text-4xl sm:text-5xl">只保留真正有用的三步。</h2><p className="mt-5 max-w-sm text-muted">没有复杂参数，也不需要在模板目录里迷路。</p></div>
          <ol className="divide-y divide-line border-y border-line">
            {[[Upload, '上传自拍', '选择一张正脸、清晰、无遮挡的照片。'], [Check, '描述或选主题', '输入创作描述，或从示例中选择效果方向。'], [ArrowRight, '生成并下载', '等待真实任务完成，然后下载生成结果。']].map(([Icon, title, copy], index) => {
              const StepIcon = Icon as typeof Upload;
              return <li key={title as string} className="grid grid-cols-[44px_1fr] items-start gap-4 py-6 sm:grid-cols-[64px_1fr_1fr] sm:items-center"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f2ddd7] text-brand"><StepIcon size={18} /></span><div><p className="text-xs font-semibold text-muted">0{index + 1}</p><h3 className="mt-1 text-lg font-semibold">{title as string}</h3></div><p className="col-start-2 text-sm leading-6 text-muted sm:col-start-auto">{copy as string}</p></li>;
            })}
          </ol>
        </div>
        <div className="mt-16 flex flex-col items-start justify-between gap-5 border-t border-line pt-6 sm:flex-row sm:items-center"><p className="inline-flex items-center gap-2 text-sm text-muted"><LockKeyhole size={15} />你的作品只对自己可见</p><Link href="/access?next=%2Fstudio" className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-[#a83d27]">进入创作空间 <ArrowRight size={16} /></Link></div>
      </section>
    </main>
  );
}
