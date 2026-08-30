'use client';

import { cn } from '@/lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  /** 尺寸大小 */
  size?: SpinnerSize;
  /** 自定义类名 */
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
};

/**
 * 纯 CSS 动画的 Loading 指示器组件
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="loading"
      className={cn(
        'inline-block rounded-full border-accent/30 border-t-accent animate-spin',
        sizeClasses[size],
        className
      )}
    />
  );
}

export default Spinner;
