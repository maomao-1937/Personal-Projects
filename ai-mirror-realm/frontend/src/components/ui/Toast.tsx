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
  success: { icon: 'text-green-400', border: 'border-green-500/30', bg: 'bg-green-500/5' },
  error: { icon: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/5' },
  warning: { icon: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  info: { icon: 'text-accent-light', border: 'border-accent/30', bg: 'bg-accent/5' },
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
      className={`flex items-start gap-3 min-w-[300px] max-w-sm p-4 rounded-xl glass border ${colors.border} ${colors.bg} shadow-lg shadow-black/20`}
    >
      <div className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
        <Icon size={20} />
      </div>
      <p className="flex-1 text-sm text-text-primary leading-relaxed">{toast.message}</p>
      <button
        onClick={() => dismissToast(toast.id)}
        className="flex-shrink-0 text-text-dim hover:text-text-primary transition-colors"
        aria-label="关闭通知"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
