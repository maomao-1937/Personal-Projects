import { getDay, parseISO, format } from "date-fns";
import type { Mood } from "@/generated/prisma/enums";

export type DayCell = {
  key: string;
  mood: Mood | null;
};

/** 三档心情对应三种深浅，未打卡是空格子。跟 Recharts 无关，纯 CSS Grid。 */
const MOOD_CLASS: Record<Mood, string> = {
  GREAT: "bg-emerald-500 dark:bg-emerald-400",
  OK: "bg-emerald-300 dark:bg-emerald-600",
  TOUGH: "bg-amber-300 dark:bg-amber-600",
};

const MOOD_TEXT: Record<Mood, string> = {
  GREAT: "状态很好",
  OK: "一般",
  TOUGH: "有点吃力",
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function Heatmap({ cells }: { cells: DayCell[] }) {
  if (cells.length === 0) return null;

  // 第一列要按真实星期对齐，前面用空占位补齐，否则热力图的行会错位
  const leading = getDay(parseISO(cells[0].key));

  return (
    <div className="flex gap-2">
      <div className="grid grid-rows-7 gap-1 pt-px text-[10px] leading-none text-zinc-400">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className="flex h-3 items-center">
            {i % 2 === 1 ? d : ""}
          </span>
        ))}
      </div>

      <div
        className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto"
        role="grid"
        aria-label="打卡热力图"
      >
        {Array.from({ length: leading }, (_, i) => (
          <span key={`pad-${i}`} className="size-3" aria-hidden />
        ))}
        {cells.map((cell) => {
          const label = `${format(parseISO(cell.key), "M 月 d 日")}${
            cell.mood ? ` · 已打卡 · ${MOOD_TEXT[cell.mood]}` : " · 未打卡"
          }`;
          return (
            <span
              key={cell.key}
              role="gridcell"
              title={label}
              aria-label={label}
              className={`size-3 rounded-sm ${
                cell.mood
                  ? MOOD_CLASS[cell.mood]
                  : "bg-black/[.06] dark:bg-white/[.10]"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500">
      <span className="flex items-center gap-1">
        <span className="size-3 rounded-sm bg-black/[.06] dark:bg-white/[.10]" />
        未打卡
      </span>
      {(Object.keys(MOOD_CLASS) as Mood[]).map((m) => (
        <span key={m} className="flex items-center gap-1">
          <span className={`size-3 rounded-sm ${MOOD_CLASS[m]}`} />
          {MOOD_TEXT[m]}
        </span>
      ))}
    </div>
  );
}
