import Link from "next/link";
import { format, parseISO } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  dayKey,
  recentDayKeys,
  calcStreak,
  calcLongestStreak,
} from "@/lib/checkin-date";
import { CheckInForm, type TodayState } from "./checkin-form";
import { Heatmap, HeatmapLegend, type DayCell } from "./heatmap";
import type { Mood } from "@/generated/prisma/enums";

const HEATMAP_DAYS = 182; // 半年，太长了横向滚动条会很难用

const MOOD_EMOJI: Record<Mood, string> = {
  GREAT: "🔥",
  OK: "🙂",
  TOUGH: "😮‍💨",
};

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="flex-1 rounded-lg border border-black/[.08] px-3 py-2 dark:border-white/[.145]">
      <div className="text-xl font-semibold text-black dark:text-zinc-50">
        {value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

export default async function CheckInPage() {
  const keys = recentDayKeys(HEATMAP_DAYS);

  // 只取热力图窗口内的记录铺格子，连续天数另算：
  // 如果窗口边界正好在一段连续记录中间，用窗口数据算 streak 会被截断。
  const [windowed, all, today, recent] = await Promise.all([
    prisma.checkIn.findMany({
      where: { date: { gte: keys[0] } },
      select: { date: true, mood: true },
    }),
    prisma.checkIn.findMany({ select: { date: true } }),
    prisma.checkIn.findUnique({ where: { date: dayKey() } }),
    prisma.checkIn.findMany({
      orderBy: { date: "desc" },
      take: 7,
      select: { date: true, mood: true, note: true },
    }),
  ]);

  const moodByDate = new Map(windowed.map((c) => [c.date, c.mood]));
  const cells: DayCell[] = keys.map((key) => ({
    key,
    mood: moodByDate.get(key) ?? null,
  }));

  const allDates = new Set(all.map((c) => c.date));
  const streak = calcStreak(allDates);
  const longest = calcLongestStreak(allDates);

  const todayState: TodayState = {
    checked: Boolean(today),
    mood: today?.mood ?? null,
    note: today?.note ?? null,
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            打卡
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {todayState.checked
              ? `今天已打卡 · 连续 ${streak} 天`
              : "今天还没打卡，坚持一下"}
          </p>
        </div>
        <Link
          href="/timer"
          className="shrink-0 text-sm text-zinc-500 hover:underline"
        >
          去沉淀 →
        </Link>
      </div>

      <div className="flex gap-3">
        <Stat value={streak} label="当前连续（天）" />
        <Stat value={longest} label="历史最长（天）" />
        <Stat value={allDates.size} label="累计打卡（天）" />
      </div>

      <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
        <CheckInForm today={todayState} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">
          最近半年
        </h2>
        <Heatmap cells={cells} />
        <HeatmapLegend />
      </div>

      {recent.length > 0 && (
        <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">
            最近记录
          </h2>
          <ul className="flex flex-col divide-y divide-black/[.06] text-sm dark:divide-white/[.08]">
            {recent.map((r) => (
              <li key={r.date} className="flex gap-3 py-2">
                <span className="shrink-0 text-zinc-500">
                  {format(parseISO(r.date), "M 月 d 日")}
                </span>
                <span aria-hidden>{MOOD_EMOJI[r.mood]}</span>
                <span className="flex-1 truncate text-zinc-600 dark:text-zinc-400">
                  {r.note || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
