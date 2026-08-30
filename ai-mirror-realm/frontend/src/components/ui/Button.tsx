'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 按钮尺寸 */
  size?: ButtonSize;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 是否占满宽度 */
  fullWidth?: boolean;
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标 */
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-dark active:bg-accent-dark/90 focus-visible:ring-accent/50 shadow-lg shadow-accent/20 hover:shadow-accent/30',
  secondary:
    'bg-bg-tertiary text-text-primary hover:bg-bg-tertiary/80 active:bg-bg-tertiary/70 focus-visible:ring-accent/30 border border-[var(--border)]',
  outline:
    'bg-transparent text-text-primary border border-[var(--border)] hover:border-accent/50 hover:bg-accent/5 active:bg-accent/10 focus-visible:ring-accent/30',
  ghost:
    'bg-transparent text-text-primary hover:bg-bg-tertiary active:bg-bg-tertiary/80 focus-visible:ring-accent/30',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-700/90 focus-visible:ring-red-500/50 shadow-lg shadow-red-600/20',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-8 py-3.5 text-base rounded-xl gap-2',
};

/**
 * 统一的 Button 基础组件
 *
 * Features:
 * - 5 种变体: primary / secondary / outline / ghost / danger
 * - 3 种尺寸: sm / md / lg
 * - loading 状态（显示 spinner）
 * - disabled 状态
 * - fullWidth 属性
 * - 统一的 hover / active / focus 样式
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          'hover:scale-[1.02] active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Spinner size={size === 'lg' ? 'md' : 'sm'} className="text-current" />}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
