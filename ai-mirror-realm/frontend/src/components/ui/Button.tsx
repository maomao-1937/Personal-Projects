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
    'bg-brand text-white hover:bg-[#a83d27] active:bg-[#8f321f]',
  secondary:
    'bg-[#e7e3dd] text-ink hover:bg-[#d9d5ce] active:bg-[#cbc5bc]',
  outline:
    'bg-paper text-ink border border-line hover:border-[#c8cad1] hover:bg-[#fafafa] active:bg-[#f0f0f2]',
  ghost:
    'bg-transparent text-ink hover:bg-[#e7e3dd] active:bg-[#d9d5ce]',
  danger:
    'bg-signal text-white hover:bg-[#842f23] active:bg-[#70271d]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 py-2 text-sm rounded-md gap-1.5',
  md: 'min-h-11 px-5 py-2.5 text-sm rounded-md gap-2',
  lg: 'min-h-12 px-7 py-3 text-base rounded-md gap-2',
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
          'inline-flex items-center justify-center font-medium transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          'disabled:cursor-not-allowed disabled:opacity-45',
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
