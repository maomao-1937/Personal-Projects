'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Upload, X, Check, Loader2, Camera, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

function UploadPageContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith('image/')) {
      setError('请上传图片文件');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过 10MB');
      return;
    }
    setError('');
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/uploads/selfie', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelfieUrl(res.data.url);
    } catch (err: any) {
      setError(err.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleNext = () => {
    if (selfieUrl) {
      sessionStorage.setItem('selfieUrl', selfieUrl);
      router.push('/styles');
    }
  };

  const handleRemove = () => {
    setFile(null);
    setPreview('');
    setSelfieUrl('');
  };

  return (
    <div className="pt-24 pb-20 px-6 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-3xl font-bold mb-3">上传你的照片</h1>
          <p className="text-text-dim text-sm">一张清晰的正脸自拍，光线充足效果更佳</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!preview ? (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput')?.click()}
              className={`relative aspect-[3/4] max-w-xs mx-auto rounded-3xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center gap-4 ${
                dragOver
                  ? 'border-accent bg-accent/5 scale-[1.02]'
                  : 'border-[var(--border)] hover:border-accent/50 bg-bg-secondary/50'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
                <Upload size={28} className="text-accent-light" />
              </div>
              <div className="text-center">
                <p className="text-text-primary font-medium mb-1">点击或拖拽上传</p>
                <p className="text-xs text-text-dim">JPG / PNG / WebP · 最大 10MB</p>
              </div>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xs mx-auto"
            >
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden">
                <Image
                  src={preview}
                  alt="预览图片"
                  fill
                  sizes="(max-width: 768px) 100vw, 384px"
                  quality={85}
                  className="object-cover"
                />
                <button
                  onClick={handleRemove}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
                {selfieUrl && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur">
                    <Check size={14} className="text-green-400" />
                    <span className="text-xs text-white">上传成功</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-400 justify-center">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          {!selfieUrl && file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  上传中…
                </>
              ) : (
                <>
                  <Camera size={16} />
                  确认上传
                </>
              )}
            </button>
          )}
          {selfieUrl && (
            <button
              onClick={handleNext}
              className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-dark text-white font-medium transition-colors"
            >
              选择风格 →
            </button>
          )}
        </div>

        {/* Tips */}
        <div className="mt-12 grid grid-cols-3 gap-3 max-w-md mx-auto">
          {[
            { icon: '正面', desc: '正脸朝向镜头' },
            { icon: '光线', desc: '光线充足均匀' },
            { icon: '清晰', desc: '五官清晰可见' },
          ].map((tip, i) => (
            <div key={i} className="text-center p-3 rounded-xl bg-bg-secondary/50">
              <div className="text-xs text-accent-light font-medium mb-1">{tip.icon}</div>
              <div className="text-xs text-text-dim">{tip.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <UploadPageContent />
    </ProtectedRoute>
  );
}
