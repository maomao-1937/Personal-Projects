'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/stores/auth';
import ProtectedRoute from '@/components/ProtectedRoute';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, Loader2, Sparkles, AlertCircle, Share2 } from 'lucide-react';
import api from '@/lib/api';

function ResultPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const portraitId = searchParams.get('id');

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!portraitId || !user) return;

    abortControllerRef.current = new AbortController();

    const poll = async () => {
      try {
        const res = await api.get(`/portraits/${portraitId}/status`, {
          signal: abortControllerRef.current?.signal,
        });
        setTask(res.data);
        if (res.data.status === 'pending' || res.data.status === 'processing') {
          pollTimeoutRef.current = setTimeout(poll, 2000);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return;
        }
        setLoading(false);
      }
    };

    poll();

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [portraitId, user]);

  const status = task?.status;
  const isProcessing = status === 'pending' || status === 'processing';

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              {/* Animated mirror portal */}
              <div className="relative w-40 h-40 mb-8">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-accent/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-accent/50"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                />
                <div className="absolute inset-0 rounded-full bg-accent/10 flex items-center justify-center">
                  <Sparkles size={40} className="text-accent-light animate-pulse" />
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-3">
                {status === 'pending' ? '准备中…' : '正在生成你的写真…'}
              </h2>
              <p className="text-text-dim text-sm mb-6">AI 正在施展魔法，请稍候</p>

              {/* Progress dots */}
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-accent"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {status === 'completed' && task?.result_url && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <h1 className="text-3xl font-bold mb-2">写真已就绪</h1>
              <p className="text-text-dim text-sm mb-8">另一个你已从镜中走来</p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative max-w-sm mx-auto aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl shadow-accent/10"
              >
                <Image
                  src={task.result_url}
                  alt="AI 写真"
                  fill
                  sizes="(max-width: 768px) 100vw, 384px"
                  quality={90}
                  priority
                  className="object-cover"
                />
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 backdrop-blur text-xs text-white flex items-center gap-1">
                  <Sparkles size={12} className="text-accent-light" />
                  AI 镜界
                </div>
              </motion.div>

              <div className="mt-8 flex items-center justify-center gap-3">
                <a
                  href={task.result_url}
                  download
                  className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  下载
                </a>
                <button
                  onClick={() => router.push('/styles')}
                  className="px-6 py-3 rounded-xl glass hover:bg-bg-tertiary text-text-primary font-medium transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  再来一张
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: 'AI 镜界', text: '看看我的 AI 写真！', url: task.result_url });
                    } else {
                      navigator.clipboard.writeText(window.location.origin + task.result_url);
                      alert('链接已复制');
                    }
                  }}
                  className="px-6 py-3 rounded-xl glass hover:bg-bg-tertiary text-text-primary font-medium transition-colors flex items-center gap-2"
                >
                  <Share2 size={16} />
                  分享
                </button>
              </div>
            </motion.div>
          )}

          {status === 'failed' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={28} className="text-red-400" />
              </div>
              <h2 className="text-2xl font-bold mb-3">生成失败</h2>
              <p className="text-text-dim text-sm mb-8">{task?.error_message || '请稍后重试'}</p>
              <button
                onClick={() => router.push('/styles')}
                className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-colors"
              >
                重新选择
              </button>
            </motion.div>
          )}

          {!task && loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-20"
            >
              <Loader2 size={32} className="animate-spin text-accent" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <ProtectedRoute>
      <ResultPageContent />
    </ProtectedRoute>
  );
}
