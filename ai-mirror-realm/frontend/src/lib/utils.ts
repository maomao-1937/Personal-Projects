import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind CSS 类名，自动处理冲突
 * 使用 clsx 进行条件类名组合，再通过 tailwind-merge 解决样式冲突
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
