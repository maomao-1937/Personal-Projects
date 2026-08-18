import { formatMinutes, type DailyPoint, type TaskShare, type TaskProgress } from "@/lib/stats";

/**
 * 不需要交互的展示块，全是 Server Component（没有 "use client"）：
 * 纯 HTML/CSS 能画的东西不必进图表库，少一份客户端 JS。
 */

export function StatTile({
  label,
  value,
  delta,
  deltaLabel,
}: {
  label: string;
  value: string;
  /** 与上期的差值，null 表示上期无数据，不显示对比 */
  delta?: number | null;
  deltaLabel?: string;
}) {
  const showDelta = typeof delta === "number" && delta !== 0;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
      <div className="text-xs text-zinc-500">{label}</div>
      {/* 大数字用默认比例数字，不用 tabular-nums——等宽数字在大字号下显得松散 */}
      <div className="text-2xl font-semibold text-black dark:text-zinc-50">
        {value}
      </div>
      {showDelta ? (
        <div
          className="text-xs"
          style={{ color: delta > 0 ? "var(--viz-up)" : "var(--viz-down)" }}
        >
          {/* 箭头 + 文字，不靠颜色单独表意 */}
          {delta > 0 ? "↑" : "↓"} {formatMinutes(Math.abs(delta))}
          {deltaLabel ? ` ${deltaLabel}` : ""}
        </div>
      ) : (
        <div className="text-xs text-zinc-400">
          {delta === null ? "上期无数据" : deltaLabel ? `与${deltaLabel.replace("较", "")}持平` : " "}
        </div>
      )}
    </div>
  );
}

/**
 * 任务时长排行。用 HTML 横条而不是饼图：
 * 长度比扇形角度好比较，而且任务名可以直接写在旁边，不需要图例来回对色。
 */
export function TaskShareList({ items }: { items: TaskShare[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">这段时间还没有专注记录。</p>;
  }
  const max = Math.max(...items.map((i) => i.minutes));

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.title} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-zinc-700 dark:text-zinc-300">
              {i.title}
            </span>
            {/* 数值直接标在条子旁边，不用悬停才能看到 */}
            <span className="shrink-0 tabular-nums text-zinc-500">
              {formatMinutes(i.minutes)}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--viz-grid)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((i.minutes / max) * 100, 2)}%`,
                background: "var(--viz-series-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 任务完成率。数字是主角，进度条只是辅助读数。 */
export function TaskProgressPanel({ progress }: { progress: TaskProgress }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <span className="text-4xl font-semibold text-black dark:text-zinc-50">
          {progress.rate}%
        </span>
        <span className="pb-1 text-sm text-zinc-500">
          {progress.done} / {progress.total} 项已完成
        </span>
      </div>

      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ background: "var(--viz-track)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress.rate}%`,
            background: "var(--viz-series-1)",
          }}
        />
      </div>

      <ul className="flex flex-col divide-y divide-black/[.06] text-sm dark:divide-white/[.08]">
        {progress.byPriority
          .filter((p) => p.total > 0)
          .map((p) => (
            <li key={p.priority} className="flex justify-between py-1.5">
              <span className="text-zinc-600 dark:text-zinc-400">
                {p.priority}
              </span>
              <span className="tabular-nums text-zinc-500">
                {p.done} / {p.total}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/**
 * 表格视图。图表的每个数值都能在这里读到，
 * 不依赖悬停、不依赖辨色——折叠起来不占地方，但始终可达。
 */
export function DataTable({ points }: { points: DailyPoint[] }) {
  const rows = [...points].reverse().filter((p) => p.minutes > 0 || p.checked);

  return (
    <details className="rounded-xl border border-black/[.08] bg-white dark:border-white/[.145] dark:bg-zinc-900">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-black dark:text-zinc-50">
        表格数据（{rows.length} 天有记录）
      </summary>
      <div className="max-h-72 overflow-y-auto px-4 pb-4">
        {rows.length === 0 ? (
          <p className="text-sm text-zinc-500">这段时间还没有数据。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500">
                <th scope="col" className="py-1.5 font-normal">日期</th>
                <th scope="col" className="py-1.5 text-right font-normal">专注</th>
                <th scope="col" className="py-1.5 text-right font-normal">段数</th>
                <th scope="col" className="py-1.5 text-right font-normal">打卡</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[.06] dark:divide-white/[.08]">
              {rows.map((p) => (
                <tr key={p.date}>
                  <td className="py-1.5 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {p.date}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatMinutes(p.minutes)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-500">
                    {p.sessions}
                  </td>
                  <td className="py-1.5 text-right text-zinc-500">
                    {p.checked ? "✓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
