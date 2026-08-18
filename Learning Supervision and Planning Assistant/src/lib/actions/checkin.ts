"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Mood } from "@/generated/prisma/enums";
import { dayKey } from "@/lib/checkin-date";

export type CheckInResult = { ok: boolean; error?: string };

const NOTE_MAX = 200;

function isMood(value: unknown): value is Mood {
  return typeof value === "string" && value in Mood;
}

/**
 * 今日打卡。Server Action 是可以被直接 POST 的入口，所以：
 * - 日期由服务端算，不接受客户端传日期（否则能随便补签任意一天）
 * - mood 走白名单校验，note 截断长度
 * - 用 upsert 而不是 create，重复点击/并发点两次都不会报唯一键冲突
 */
export async function checkInToday(
  moodRaw: string,
  noteRaw: string,
): Promise<CheckInResult> {
  const mood = isMood(moodRaw) ? moodRaw : Mood.OK;
  const note = noteRaw.trim().slice(0, NOTE_MAX) || null;
  const date = dayKey();

  await prisma.checkIn.upsert({
    where: { date },
    create: { date, mood, note },
    update: { mood, note },
  });

  revalidatePath("/checkin");
  return { ok: true };
}

/** 撤销今日打卡。只允许删今天的，历史记录不给通过这个入口动。 */
export async function undoToday(): Promise<CheckInResult> {
  const date = dayKey();
  const existing = await prisma.checkIn.findUnique({ where: { date } });
  if (!existing) return { ok: false, error: "今天还没有打卡记录" };

  await prisma.checkIn.delete({ where: { date } });
  revalidatePath("/checkin");
  return { ok: true };
}
