"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RANGES } from "./ranges";

/**
 * 时间范围筛选。放在所有图表上方一行，所有图表和统计块都跟着它变，
 * 不给单个图表配独立范围——那样几个数字对不上，读起来更累。
 *
 * 状态存 URL query 而不是 useState：刷新和分享链接都能保留选择，
 * 页面本身是 Server Component，换范围就是重新请求一次。
 */

export function RangePicker({ current }: { current: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function pick(days: number) {
    const next = new URLSearchParams(params);
    next.set("days", String(days));
    startTransition(() => router.push(`/stats?${next}`));
  }

  return (
    <div
      className="flex gap-1"
      role="group"
      aria-label="统计时间范围"
      // 重新取数时整体压暗，但保留原来的布局——不要骨架屏，跳动更烦人
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      {RANGES.map((r) => {
        const active = r.days === current;
        return (
          <button
            key={r.days}
            type="button"
            onClick={() => pick(r.days)}
            aria-pressed={active}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
                : "border border-black/[.08] text-zinc-600 hover:bg-black/[.03] dark:border-white/[.145] dark:text-zinc-400 dark:hover:bg-white/[.06]"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}
