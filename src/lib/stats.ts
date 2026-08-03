import { dayKey, recentDayKeys } from "@/lib/checkin-date";

/**
 * 统计聚合层：纯函数，不碰 Prisma。
 *
 * 分组在 JS 里做而不是写 SQL：单用户本地应用数据量很小（一年的番茄钟记录
 * 也就几千行），换来的是可以脱离数据库单独验证这些边界情况。
 */

export type SessionInput = {
  phase: string;
  actualSec: number;
  finishedAt: Date;
  taskId: string | null;
};

export type DailyPoint = {
  /** "YYYY-MM-DD" */
  date: string;
  /** 该日专注分钟数（只算 WORK 阶段） */
  minutes: number;
  /** 该日完成的专注段数 */
  sessions: number;
  /** 该日是否打卡 */
  checked: boolean;
};

/** 只有 WORK 阶段算"专注"，休息段不该计入学习时长。 */
const isWork = (s: SessionInput) => s.phase === "WORK";

/**
 * 按天铺满区间，没有记录的日子补 0。
 *
 * 补零是必须的：折线图如果只连有数据的点，中间空掉的几天会被直线跨过去，
 * 看上去像是那几天也在学习。
 */
export function buildDailySeries(
  sessions: SessionInput[],
  checkedDates: Set<string>,
  days: number,
  today: Date = new Date(),
): DailyPoint[] {
  const keys = recentDayKeys(days, today);
  const bucket = new Map<string, { minutes: number; sessions: number }>(
    keys.map((k) => [k, { minutes: 0, sessions: 0 }]),
  );

  for (const s of sessions) {
    if (!isWork(s)) continue;
    const slot = bucket.get(dayKey(s.finishedAt));
    if (!slot) continue; // 落在窗口外，忽略
    slot.minutes += s.actualSec / 60;
    slot.sessions += 1;
  }

  return keys.map((date) => {
    const slot = bucket.get(date)!;
    return {
      date,
      // 先累加秒数再取整，避免每段各自四舍五入后误差叠加
      minutes: Math.round(slot.minutes),
      sessions: slot.sessions,
      checked: checkedDates.has(date),
    };
  });
}

/** 一周七天的专注分布，用于看"哪天效率高"。周一起排，符合国内习惯。 */
export function buildWeekdayProfile(
  sessions: SessionInput[],
  today: Date = new Date(),
  days = 84,
): { weekday: string; minutes: number }[] {
  const labels = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const totals = new Array(7).fill(0);
  const window = new Set(recentDayKeys(days, today));

  for (const s of sessions) {
    if (!isWork(s)) continue;
    if (!window.has(dayKey(s.finishedAt))) continue;
    // getDay(): 0=周日，转成 0=周一
    const idx = (s.finishedAt.getDay() + 6) % 7;
    totals[idx] += s.actualSec / 60;
  }

  return labels.map((weekday, i) => ({
    weekday,
    minutes: Math.round(totals[i]),
  }));
}

export type TaskShare = {
  title: string;
  minutes: number;
};

/**
 * 专注时长按任务归集，取前 N 个，其余合并成"其他"。
 *
 * 不给每个任务分配一个颜色——任务数量无上限，配色只有固定几档，
 * 超过就会开始重复。这里用单色柱状图，长度已经表达了大小。
 */
export function buildTaskShare(
  sessions: SessionInput[],
  titleById: Map<string, string>,
  topN = 6,
): TaskShare[] {
  const byTask = new Map<string, number>();
  let freeMin = 0;

  for (const s of sessions) {
    if (!isWork(s)) continue;
    if (!s.taskId) {
      freeMin += s.actualSec / 60;
      continue;
    }
    // 任务被删除后 taskId 会置 null，所以能查到的都还存在；
    // 万一有残留就退回"已删除任务"，不要静默丢掉这段时长。
    const title = titleById.get(s.taskId) ?? "已删除的任务";
    byTask.set(title, (byTask.get(title) ?? 0) + s.actualSec / 60);
  }

  if (freeMin > 0) byTask.set("自由计时", (byTask.get("自由计时") ?? 0) + freeMin);

  const sorted = [...byTask.entries()]
    .map(([title, minutes]) => ({ title, minutes: Math.round(minutes) }))
    .filter((t) => t.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  if (sorted.length <= topN) return sorted;

  const head = sorted.slice(0, topN);
  const tailMin = sorted.slice(topN).reduce((sum, t) => sum + t.minutes, 0);
  return [...head, { title: `其他 ${sorted.length - topN} 项`, minutes: tailMin }];
}

export type Totals = {
  totalMin: number;
  totalSessions: number;
  activeDays: number;
  /** 有专注记录的日子的平均时长，不是除以窗口天数——否则休息日会把均值拉低 */
  avgMinPerActiveDay: number;
  /** 与上一个等长周期相比的分钟数变化，null 表示上期没有数据无从比较 */
  deltaMin: number | null;
};

export function summarize(points: DailyPoint[], prevPoints: DailyPoint[]): Totals {
  const totalMin = points.reduce((s, p) => s + p.minutes, 0);
  const totalSessions = points.reduce((s, p) => s + p.sessions, 0);
  const activeDays = points.filter((p) => p.minutes > 0).length;
  const prevMin = prevPoints.reduce((s, p) => s + p.minutes, 0);
  const prevActive = prevPoints.some((p) => p.minutes > 0);

  return {
    totalMin,
    totalSessions,
    activeDays,
    avgMinPerActiveDay: activeDays ? Math.round(totalMin / activeDays) : 0,
    deltaMin: prevActive ? totalMin - prevMin : null,
  };
}

/** 任务完成情况。子任务也算进去——它们同样是要做的事。 */
export type TaskProgress = {
  total: number;
  done: number;
  rate: number;
  byPriority: { priority: string; total: number; done: number }[];
};

export function buildTaskProgress(
  tasks: { priority: string; completed: boolean }[],
): TaskProgress {
  const order = ["P0", "P1", "P2", "P3"];
  const map = new Map(order.map((p) => [p, { total: 0, done: 0 }]));

  for (const t of tasks) {
    const slot = map.get(t.priority);
    if (!slot) continue;
    slot.total += 1;
    if (t.completed) slot.done += 1;
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;

  return {
    total,
    done,
    rate: total ? Math.round((done / total) * 100) : 0,
    byPriority: order.map((priority) => ({ priority, ...map.get(priority)! })),
  };
}

/** 把分钟数写成"2 小时 15 分"，图表轴和统计块都用它，避免各处格式不一致。 */
export function formatMinutes(min: number): string {
  if (min <= 0) return "0 分";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} 分`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}
