'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否使用玻璃拟态效果 */
  glass?: boolean;
}

/**
 * 卡片容器组件
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, glass = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl bg-bg-secondary border border-[var(--border)] shadow-sm',
        glass && 'glass',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/**
 * 卡片头部组件
 */
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-6 pb-4 flex flex-col space-y-1.5', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

/**
 * 卡片标题组件
 */
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight text-text-primary', className)}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

/**
 * 卡片描述组件
 */
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-text-dim', className)}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

/**
 * 卡片内容组件
 */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

/**
 * 卡片底部组件
 */
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('p-6 pt-0 flex items-center', className)}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;
