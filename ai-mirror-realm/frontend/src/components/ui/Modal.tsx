'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ModalProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 标题 */
  title?: string;
  /** 内容 */
  children: React.ReactNode;
  /** 底部内容 */
  footer?: React.ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 点击遮罩是否关闭，默认 true */
  closeOnOverlayClick?: boolean;
  /** ESC 键是否关闭，默认 true */
  closeOnEsc?: boolean;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

/**
 * 模态框组件
 *
 * Features:
 * - isOpen / onClose 控制
 * - 支持 title
 * - 遮罩层点击关闭
 * - ESC 键关闭
 * - 淡入淡出动画（framer-motion）
 * - 4 种尺寸
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  size = 'md',
}: ModalProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null);

  // ESC 键关闭
  React.useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, onClose]);

  // 禁止背景滚动
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && closeOnOverlayClick) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* 遮罩层 */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />

          {/* 内容容器 */}
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? 'modal-title' : undefined}
              className={cn(
                'relative w-full rounded-2xl bg-bg-secondary border border-[var(--border)] shadow-2xl',
                sizeClasses[size],
                className
              )}
            >
              {/* 关闭按钮 */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-text-dim hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                aria-label="关闭"
              >
                <X size={18} />
              </button>

              {/* 头部 */}
              {title && (
                <div className="px-6 py-5 border-b border-[var(--border)]">
                  <h2 id="modal-title" className="text-lg font-semibold text-text-primary">
                    {title}
                  </h2>
                </div>
              )}

              {/* 内容 */}
              <div className={cn('px-6 py-5', !title && 'pt-6')}>{children}</div>

              {/* 底部 */}
              {footer && (
                <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Modal;
