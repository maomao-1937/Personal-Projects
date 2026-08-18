/**
 * 时间范围选项。单独一个文件而不是放在 range-picker.tsx 里：
 * 那是 "use client" 模块，它导出的非组件值到了 Server Component 里
 * 只是一个客户端引用占位符，不是真的数组（RANGES.some 会直接报
 * "is not a function"）。服务端和客户端都要用的常量必须放在中立模块里。
 */
export const RANGES = [
  { days: 7, label: "近 7 天" },
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
] as const;

export const DEFAULT_DAYS = 30;
