import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, LockKeyhole } from 'lucide-react';

const previews = [
  { src: '/style-previews/chaoku.jpg', label: '潮流街拍' },
  { src: '/style-previews/hunsha.jpg', label: '轻婚纱像' },
  { src: '/style-previews/xianxia.jpg', label: '仙侠氛围' },
  { src: '/style-previews/yishu.jpg', label: '艺术肖像' },
] as const;

const steps = [
  { title: '上传一张自拍', copy: '选择正脸清晰、光线自然的照片。' },
  { title: '说出想要的画面', copy: '自由描述，或选择一个可预览的主题。' },
  { title: '查看并下载结果', copy: '任务完成后，在同一处查看和保存写真。' },
] as const;

export default function HomePage() {
  return (
    <main className="pt-16">
      <section className="page-shell grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:py-20">
        <div className="max-w-xl">
          <h1 className="display-title max-w-[9em] text-[clamp(3rem,4.2vw,4.25rem)] leading-[1.08]">
            一张自拍，<br />拍出新的自己。
          </h1>
          <p className="mt-7 max-w-[30rem] text-base leading-8 text-muted sm:text-lg">
            从你熟悉的照片出发，描述一个画面，或挑选一个写真主题。创作、查看和下载，都在这里完成。
          </p>
          <Link href="/access?next=%2Fstudio" className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-[#a83d27] focus-visible:outline-white">
            使用邀请码开始 <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <div className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-5 text-xs leading-5 text-muted sm:text-sm">
            <span>一张自拍</span><span>描述或选主题</span><span>私人查看结果</span>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_86px] gap-2.5 sm:grid-cols-[minmax(0,1fr)_128px] sm:gap-4" aria-label="AI 写真效果示例">
          <figure className="relative min-h-[380px] overflow-hidden rounded-xl bg-stage sm:min-h-[540px]">
            <Image src="/style-previews/fugu.jpg" alt="复古电影风格 AI 写真示例" fill priority sizes="(max-width: 1023px) 75vw, 42vw" className="object-cover" />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-[#141517]/85 px-4 py-3 text-sm text-white sm:px-5">
              <span>复古电影</span><span className="text-xs text-white/70">效果示例</span>
            </figcaption>
          </figure>
          <div className="grid min-h-[380px] grid-rows-2 gap-2.5 sm:min-h-[540px] sm:gap-4">
            <figure className="relative overflow-hidden rounded-xl bg-stage">
              <Image src="/style-previews/zhichang.jpg" alt="职场写真效果示例" fill priority sizes="(max-width: 1023px) 23vw, 12vw" className="object-cover" />
              <figcaption className="sr-only">职场写真效果示例</figcaption>
            </figure>
            <figure className="relative overflow-hidden rounded-xl bg-stage">
              <Image src="/style-previews/guofeng.jpg" alt="国风写真效果示例" fill sizes="(max-width: 1023px) 23vw, 12vw" className="object-cover" />
              <figcaption className="sr-only">国风写真效果示例</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="examples" className="border-y border-line bg-paper py-16 sm:py-20">
        <div className="page-shell">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <h2 className="display-title max-w-xl text-3xl sm:text-4xl">先看看，你想拍成什么样。</h2>
            <p className="max-w-sm text-sm leading-6 text-muted">这些是主题效果示例。进入工作台后，你也可以不用主题，直接描述自己的想法。</p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:grid-cols-4 sm:gap-5">
            {previews.map((preview) => (
              <figure key={preview.src}>
                <div className="photo-frame aspect-[3/4]">
                  <Image src={preview.src} alt={`${preview.label} AI 写真效果示例`} fill sizes="(max-width: 639px) 50vw, 25vw" className="object-cover" />
                </div>
                <figcaption className="mt-3 text-sm font-medium">{preview.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell py-16 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <h2 className="display-title max-w-sm text-3xl sm:text-4xl">从自拍到写真，<br />只要三个动作。</h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted">照片、创作方向和结果在同一条路径里，不需要学习模型参数。</p>
          </div>
          <ol className="border-t border-line">
            {steps.map((step, index) => (
              <li key={step.title} className="grid gap-2 border-b border-line py-5 sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] sm:items-baseline sm:gap-4">
                <span className="text-sm font-medium tabular-nums text-brand">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-6 text-muted">{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-2 text-sm text-muted"><LockKeyhole size={16} aria-hidden="true" />照片与结果仅当前账户可查看</p>
          <Link href="/access?next=%2Fstudio" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand hover:text-[#a83d27]">进入创作空间 <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
  );
}
