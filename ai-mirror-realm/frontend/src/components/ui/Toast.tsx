'use client';

import { motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { ToastItem, useToast } from '@/contexts/ToastContext';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<string, { icon: string; border: string; bg: string }> = {
  success: { icon: 'text-success', border: 'border-success', bg: 'bg-paper' },
  error: { icon: 'text-signal', border: 'border-signal', bg: 'bg-paper' },
  warning: { icon: 'text-gold', border: 'border-gold', bg: 'bg-paper' },
  info: { icon: 'text-ink', border: 'border-line', bg: 'bg-paper' },
};

interface ToastProps {
  toast: ToastItem;
  index: number;
}

export default function Toast({ toast, index }: ToastProps) {
  const { dismissToast } = useToast();
  const Icon = iconMap[toast.type];
  const colors = colorMap[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1], delay: index * 0.05 }}
      className={`flex min-w-[min(300px,calc(100vw-36px))] max-w-sm items-start gap-3 rounded-md border p-4 shadow-card ${colors.border} ${colors.bg}`}
    >
      <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
        <Icon size={20} />
      </div>
      <p className="flex-1 text-sm text-text-primary leading-relaxed">{toast.message}</p>
      <button
        onClick={() => dismissToast(toast.id)}
        className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center text-text-dim transition-colors hover:text-text-primary"
        aria-label="关闭通知"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
