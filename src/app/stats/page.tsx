import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { recentDayKeys } from "@/lib/checkin-date";
import {
  buildDailySeries,
  buildTaskProgress,
  buildTaskShare,
  buildWeekdayProfile,
  formatMinutes,
  summarize,
  type SessionInput,
} from "@/lib/stats";
import { DailyFocusChart, WeekdayChart } from "./charts";
import { RangePicker } from "./range-picker";
import { DEFAULT_DAYS, RANGES } from "./ranges";
import {
  DataTable,
  StatTile,
  TaskProgressPanel,
  TaskShareList,
} from "./panels";

/** 周分布固定看 12 周，比当前范围长：7 天窗口下每个星期只有一个样本，看不出规律 */
const WEEKDAY_DAYS = 84;

function parseDays(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  // 只接受按钮上列出的几个值，避免有人手改 URL 传个 100000 把查询拖死
  return RANGES.some((r) => r.days === n) ? n : DEFAULT_DAYS;
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
      <div>
        <h2 className="text-sm font-medium text-black dark:text-zinc-50">
          {title}
        </h2>
        {hint && <p className="text-xs text-zinc-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// Next.js 16：searchParams 是 Promise，必须 await
export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: rawDays } = await searchParams;
  const days = parseDays(rawDays);

  // 取两倍窗口：前一半用来算"较上期"的对比，一次查询搞定
  const spanKeys = recentDayKeys(days * 2);
  const since = new Date(`${spanKeys[0]}T00:00:00`);
  // 周分布要的窗口更长，取两者里更早的那个时间点
  const weekdaySince = new Date(`${recentDayKeys(WEEKDAY_DAYS)[0]}T00:00:00`);
  const queryFrom = since < weekdaySince ? since : weekdaySince;

  const [sessions, checkIns, tasks] = await Promise.all([
    prisma.pomodoroSession.findMany({
      where: { finishedAt: { gte: queryFrom } },
      select: { phase: true, actualSec: true, finishedAt: true, taskId: true },
    }),
    prisma.checkIn.findMany({
      where: { date: { gte: spanKeys[0] } },
      select: { date: true },
    }),
    prisma.task.findMany({ select: { id: true, title: true, priority: true, completed: true } }),
  ]);

  const inputs: SessionInput[] = sessions;
  const checkedDates = new Set(checkIns.map((c) => c.date));

  // 当期与上期：同一条时间线切两半，长度一致才能直接比
  const full = buildDailySeries(inputs, checkedDates, days * 2);
  const points = full.slice(days);
  const prevPoints = full.slice(0, days);
  const totals = summarize(points, prevPoints);

  const rangeLabel = RANGES.find((r) => r.days === days)!.label;
  // 任务归集只看当期，不能把上期的时长混进来
  const windowStart = new Date(`${points[0].date}T00:00:00`);
  const inWindow = inputs.filter((s) => s.finishedAt >= windowStart);

  const titleById = new Map(tasks.map((t) => [t.id, t.title]));
  const taskShare = buildTaskShare(inWindow, titleById);
  const weekday = buildWeekdayProfile(inputs, new Date(), WEEKDAY_DAYS);
  const progress = buildTaskProgress(tasks);
  const checkedInRange = points.filter((p) => p.checked).length;

  return (
    <div className="viz-root mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            统计面板
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {rangeLabel}的学习情况
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-sm text-zinc-500 hover:underline"
        >
          ← 首页
        </Link>
      </div>

      {/* 筛选放一行，在所有内容上方，作用于下面全部图表 */}
      <RangePicker current={days} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="累计专注"
          value={formatMinutes(totals.totalMin)}
          delta={totals.deltaMin}
          deltaLabel="较上期"
        />
        <StatTile label="专注段数" value={`${totals.totalSessions}`} />
        <StatTile
          label="有效学习日"
          value={`${totals.activeDays} / ${days}`}
        />
        <StatTile
          label="日均专注"
          value={formatMinutes(totals.avgMinPerActiveDay)}
        />
      </div>

      <Card
        title="每日专注时长"
        hint={`${rangeLabel} · 只统计完整跑完的专注段`}
      >
        <DailyFocusChart points={points} />
      </Card>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Card title="时间去哪了" hint={`${rangeLabel} · 按任务归集`}>
          <TaskShareList items={taskShare} />
        </Card>

        <Card title="任务完成率" hint="全部任务，含子任务">
          <TaskProgressPanel progress={progress} />
        </Card>
      </div>

      <Card title="一周节律" hint="近 12 周 · 看哪天更容易专注">
        <WeekdayChart data={weekday} />
      </Card>

      <Card title="打卡" hint={rangeLabel}>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-semibold text-black dark:text-zinc-50">
            {checkedInRange}
          </span>
          <span className="pb-1 text-sm text-zinc-500">
            天 / {days} 天（{Math.round((checkedInRange / days) * 100)}%）
          </span>
        </div>
        <Link
          href="/checkin"
          className="text-sm text-zinc-500 hover:underline"
        >
          去看热力图 →
        </Link>
      </Card>

      <DataTable points={points} />
    </div>
  );
}
