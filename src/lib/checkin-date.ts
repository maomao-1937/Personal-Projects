import { format, subDays } from "date-fns";

/**
 * 打卡日期一律用本地时区的 "YYYY-MM-DD" 字符串。
 * 单独抽出来是因为 Server Action、页面查询、连续天数计算三处都要用，
 * 各写一遍 format 很容易出现某处漏掉时区差异。
 */
export function dayKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** 从 today 往前数 days 天的 key 列表，最早的在前面，用于铺热力图格子。 */
export function recentDayKeys(days: number, today: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(dayKey(subDays(today, i)));
  }
  return keys;
}

/**
 * 连续打卡天数：从今天往前逐日回溯，断了就停。
 *
 * 一个边界情况：如果今天还没打卡，不能直接算作断掉——不然每天零点后
 * 连续天数就归零了，用户看到会以为记录丢了。所以今天缺席时从昨天起算，
 * 昨天也没有才算 0。
 */
export function calcStreak(dates: Set<string>, today: Date = new Date()): number {
  const hasToday = dates.has(dayKey(today));
  if (!hasToday && !dates.has(dayKey(subDays(today, 1)))) return 0;

  let streak = 0;
  let cursor = hasToday ? today : subDays(today, 1);

  while (dates.has(dayKey(cursor))) {
    streak++;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** 历史最长连续天数，用于给用户一个对比目标。 */
export function calcLongestStreak(dates: Set<string>): number {
  const sorted = [...dates].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;

  for (const key of sorted) {
    if (prev && dayKey(subDays(new Date(`${key}T00:00:00`), 1)) === prev) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = key;
  }
  return longest;
}
