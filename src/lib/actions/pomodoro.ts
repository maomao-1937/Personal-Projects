"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SessionPhase } from "@/generated/prisma/enums";

export type LogResult = { ok: boolean; error?: string };

/** 单个阶段最长 3 小时，超出视为异常数据（比如电脑休眠后计时器错乱） */
const MAX_PHASE_SEC = 3 * 60 * 60;

function isPhase(value: unknown): value is SessionPhase {
  return typeof value === "string" && value in SessionPhase;
}

/**
 * 记录一个「跑完」的阶段。中途放弃的阶段不会调用这里，
 * 所以统计里只会出现完整的番茄钟。
 */
export async function logSession(input: {
  phase: string;
  plannedMin: number;
  plannedSec: number;
  taskId: string | null;
}): Promise<LogResult> {
  if (!isPhase(input.phase)) {
    return { ok: false, error: "阶段类型不合法" };
  }

  const plannedMin = Math.round(Number(input.plannedMin));
  const plannedSec = Math.round(Number(input.plannedSec));

  if (!Number.isFinite(plannedMin) || plannedMin < 1 || plannedMin > 180) {
    return { ok: false, error: "时长超出允许范围" };
  }
  if (!Number.isFinite(plannedSec) || plannedSec < 1 || plannedSec > MAX_PHASE_SEC) {
    return { ok: false, error: "计划时长异常，本次不记录" };
  }

  // taskId 来自客户端，不能直接信任：确认任务真实存在再关联
  let taskId: string | null = null;
  if (input.taskId) {
    const exists = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: { id: true },
    });
    taskId = exists?.id ?? null;
  }

  await prisma.pomodoroSession.create({
    data: {
      phase: input.phase,
      plannedMin,
      plannedSec,
      taskId,
    },
  });

  revalidatePath("/timer");
  return { ok: true };
}

/** 删掉一条记录（误触/测试数据清理用） */
export async function deleteSession(id: string): Promise<LogResult> {
  if (!id) return { ok: false, error: "缺少记录 id" };

  await prisma.pomodoroSession.delete({ where: { id } });
  revalidatePath("/timer");
  return { ok: true };
}
