'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion } from 'framer-motion';
import { Check, ArrowLeft, Coins } from 'lucide-react';
import Image from 'next/image';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { useStyles } from '@/hooks/useStyles';

function StylesPageContent() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const { styles, categories, loading: loadingStyles, getGradient } = useStyles({
    fetchFromServer: true,
  });

  useEffect(() => {
    const selfieUrl = sessionStorage.getItem('selfieUrl');
    if (!selfieUrl) {
      router.push('/upload');
    }
  }, [router]);

  const filtered = activeCategory === '全部'
    ? styles
    : styles.filter((s) => s.category === activeCategory);

  const handleGenerate = async () => {
    if (!selected) return;
    const selfieUrl = sessionStorage.getItem('selfieUrl');
    if (!selfieUrl) {
      router.push('/upload');
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post('/portraits', {
        style_id: selected,
        selfie_url: selfieUrl,
      });
      router.push(`/result?id=${res.data.id}`);
    } catch (err: any) {
      setGenerating(false);
      alert(err.response?.data?.detail || '生成失败');
    }
  };

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">选择风格</h1>
            <p className="text-text-dim text-sm">选择你想要成为的样子</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-glow border border-accent/30">
              <Coins size={14} className="text-gold" />
              <span className="text-sm text-gold font-medium">{user?.credits ?? 0}</span>
            </div>
            <button
              onClick={() => router.push('/upload')}
              className="text-sm text-text-dim hover:text-text-primary transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              重选照片
            </button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory('全部')}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
              activeCategory === '全部'
                ? 'bg-accent text-white'
                : 'glass text-text-dim hover:text-text-primary'
            }`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-accent text-white'
                  : 'glass text-text-dim hover:text-text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Styles grid */}
        {loadingStyles ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl shimmer-bg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filtered.map((style, i) => (
              <motion.div
                key={style.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelected(style.id)}
                className={`group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer transition-all ${
                  selected === style.id ? 'ring-2 ring-accent scale-[1.02]' : 'hover:scale-[1.02]'
                }`}
              >
                {style.previewImage ? (
                  <Image
                    src={style.previewImage}
                    alt={style.name}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    quality={85}
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(style.category)}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <div className="text-xs text-accent-light mb-1">{style.category}</div>
                  <div className="text-base font-semibold">{style.name}</div>
                  <div className="text-xs text-text-dim mt-1 line-clamp-2">{style.description}</div>
                </div>
                {selected === style.id && (
                  <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Generate button */}
        <div className="mt-10 flex justify-center">
          <Button
            onClick={handleGenerate}
            disabled={!selected || generating}
            loading={generating}
            size="lg"
            className="px-10"
          >
            {generating ? '正在创建…' : selected ? '生成写真' : '请选择风格'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StylesPage() {
  return (
    <ProtectedRoute>
      <StylesPageContent />
    </ProtectedRoute>
  );
}
