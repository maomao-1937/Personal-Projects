'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';
import styles from './AccessShowcase.module.css';

const frames = [
  { src: '/style-previews/zhichang.jpg', label: '职场写真' },
  { src: '/style-previews/rixi.jpg', label: '日系写真' },
  { src: '/style-previews/hunsha.jpg', label: '轻婚纱像' },
] as const;

const FRAME_DURATION = 5600;

export function AccessShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (!sectionRef.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  const playing = !paused && !reducedMotion && inView && documentVisible;

  useEffect(() => {
    if (!playing) return;
    const timeout = window.setTimeout(() => setActiveIndex((index) => (index + 1) % frames.length), FRAME_DURATION);
    return () => window.clearTimeout(timeout);
  }, [activeIndex, cycle, playing]);

  const selectFrame = (index: number) => {
    setActiveIndex(index);
    setCycle((value) => value + 1);
  };

  return (
    <section ref={sectionRef} className={`relative h-56 shrink-0 overflow-hidden bg-stage text-white sm:h-72 lg:h-auto lg:min-h-[calc(100vh-64px)] ${!playing ? styles.stopped : ''}`} aria-label="动态写真效果示例">
      {frames.map((frame, index) => (
        <Image
          key={frame.src}
          src={frame.src}
          alt=""
          aria-hidden="true"
          fill
          priority={index === 0}
          loading={index === 0 ? undefined : 'eager'}
          sizes="(max-width: 1023px) 100vw, 50vw"
          className={`${styles.image} ${index === activeIndex ? styles.activeImage : ''}`}
        />
      ))}
      {!reducedMotion && (
        <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? '继续播放写真示例' : '暂停写真示例'} className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-lg bg-stage/70 text-white transition-colors hover:bg-stage/90 focus-visible:outline-white lg:right-10 lg:top-8 xl:right-16">
          {paused ? <Play size={16} fill="currentColor" aria-hidden="true" /> : <Pause size={16} fill="currentColor" aria-hidden="true" />}
        </button>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#141517] via-[#141517]/70 to-transparent px-5 pb-5 pt-16 lg:px-10 lg:pb-10 lg:pt-24 xl:px-16">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-xs text-white/85" aria-live="off">{frames[activeIndex].label} · 效果示例</p>
          <div className="flex shrink-0 items-center gap-0.5" aria-label="选择写真效果示例">
            {frames.map((frame, index) => (
              <button
                key={frame.src}
                type="button"
                aria-label={`查看${frame.label}示例`}
                aria-pressed={index === activeIndex}
                onClick={() => selectFrame(index)}
                className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-white/15 focus-visible:outline-white"
              >
                <span className="relative h-0.5 w-6 overflow-hidden rounded-full bg-white/45">
                  {index === activeIndex && <span key={`${activeIndex}-${cycle}-${playing}`} className={`${styles.progress} ${playing ? styles.progressPlaying : ''}`} />}
                </span>
              </button>
            ))}
          </div>
        </div>
        <h1 className="display-title mt-4 hidden whitespace-nowrap text-[clamp(1.875rem,2.8vw,2.5rem)] lg:block">从熟悉的自拍，走进新的画面。</h1>
      </div>
    </section>
  );
}
