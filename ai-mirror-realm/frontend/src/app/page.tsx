'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Camera, Wand2, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import api from '@/lib/api';
import { styleColors, styleByCategory } from '@/config/styles';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }),
};

export default function HomePage() {
  const [styles, setStyles] = useState<any[]>([]);

  useEffect(() => {
    api.get('/styles').then((res) => setStyles(res.data)).catch(() => {});
  }, []);

  const scrollToStyles = () => {
    document.getElementById('styles')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-accent/10 blur-3xl animate-glow" />
          <div className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full bg-pink-500/5 blur-3xl" />
        </div>

        <div className="relative z-10 text-center px-6 max-w-3xl">
          <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
            <span className="inline-block px-4 py-1.5 rounded-full glass text-sm text-accent-light mb-8">
              <Sparkles size={14} className="inline mr-1.5" />
              AI 驱动的个人写真工坊
            </span>
          </motion.div>

          <motion.h1
            custom={1} variants={fadeUp} initial="hidden" animate="visible"
            className="text-6xl md:text-7xl font-bold mb-6 leading-tight"
          >
            <span className="gradient-text">镜</span>见另一个自己
          </motion.h1>

          <motion.p
            custom={2} variants={fadeUp} initial="hidden" animate="visible"
            className="text-lg text-text-dim mb-10 leading-relaxed"
          >
            上传一张自拍，选择心仪风格<br />
            AI 为你生成专属艺术写真
          </motion.p>

          <motion.div
            custom={3} variants={fadeUp} initial="hidden" animate="visible"
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/register"
              className="group px-8 py-3.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-accent/30"
            >
              立即体验
              <ArrowRight size={18} className="inline ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={scrollToStyles}
              className="px-8 py-3.5 rounded-xl glass hover:bg-bg-tertiary text-text-primary font-medium transition-all"
            >
              浏览风格
            </button>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-text-dim"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown size={24} />
        </motion.div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-center mb-16"
          >
            三步生成你的专属写真
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Camera, title: '上传自拍', desc: '一张清晰的正脸照片即可' },
              { icon: Wand2, title: '选择风格', desc: '国风、婚纱、赛博朋克…' },
              { icon: ImageIcon, title: '获取写真', desc: 'AI 生成，秒级交付' },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass rounded-2xl p-8 text-center hover:border-accent/50 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
                  <step.icon size={24} className="text-accent-light" />
                </div>
                <div className="text-sm text-text-dim mb-2">Step {i + 1}</div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-text-dim">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Styles showcase */}
      <section id="styles" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-center mb-4"
          >
            风格画廊
          </motion.h2>
          <p className="text-center text-text-dim mb-16">选择你想要成为的样子</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {styles.map((style, i) => (
              <motion.div
                key={style.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer"
              >
                {styleByCategory[style.category]?.previewImage ? (
                  <Image
                    src={styleByCategory[style.category].previewImage}
                    alt={style.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    quality={85}
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${styleColors[style.category] || 'from-accent/20 to-bg-tertiary'}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-5">
                  <div className="text-xs text-accent-light mb-1">{style.category}</div>
                  <div className="text-lg font-semibold">{style.name}</div>
                  <div className="text-xs text-text-dim mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {style.description}
                  </div>
                </div>
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-accent/50 rounded-2xl transition-colors" />
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/styles"
              className="inline-flex items-center gap-2 text-accent-light hover:text-accent transition-colors"
            >
              查看全部风格
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center glass rounded-3xl p-12"
        >
          <h2 className="text-3xl font-bold mb-4">准备好遇见另一个自己了吗</h2>
          <p className="text-text-dim mb-8">注册即送 3 次免费生成额度</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-all hover:scale-105"
          >
            免费开始
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
