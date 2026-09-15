'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'file' | 'tel' | 'url';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** 输入框类型 */
  type?: InputType;
  /** 标签文本 */
  label?: string;
  /** 错误信息 */
  error?: string;
  /** 输入帮助文案 */
  helperText?: string;
  /** 左侧图标 */
  leftIcon?: React.ReactNode;
  /** 右侧图标 */
  rightIcon?: React.ReactNode;
  /** 容器类名 */
  containerClassName?: string;
}

/**
 * 统一的 Input 基础组件
 *
 * Features:
 * - 支持多种 type: text / email / password / number / file 等
 * - 支持 label 属性
 * - 支持 error 状态（红色边框 + 错误提示文字）
 * - 支持左右图标
 * - 统一的 focus ring 样式
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      type = 'text',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className={cn('w-full space-y-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium text-ink"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined}
            className={cn(
              'min-h-12 w-full rounded-lg border bg-paper px-4 py-3 transition-colors duration-200',
              'text-ink placeholder:text-[#9699a2]',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-signal focus:border-signal focus:ring-signal/20'
                : 'border-line focus:border-brand focus:ring-brand/15',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-2 flex items-center gap-1 text-sm text-signal"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-help`} className="mt-2 text-sm text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
