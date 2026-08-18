"use server";

import { prisma } from "@/lib/prisma";

export type ExportData = {
  exportedAt: string;
  tasks: {
    id: string;
    title: string;
    description: string | null;
    priority: string;
    tags: string;
    completed: boolean;
    parentId: string | null;
    order: number;
    createdAt: string;
    updatedAt: string;
  }[];
  pomodoroSessions: {
    id: string;
    phase: string;
    plannedMin: number;
    plannedSec: number;
    taskId: string | null;
    finishedAt: string;
  }[];
  checkIns: {
    id: string;
    date: string;
    mood: string;
    note: string | null;
    createdAt: string;
  }[];
};

/**
 * 导出全部数据为 JSON，用作备份。
 * 数据量小（单用户本地应用），不需要分页。
 */
export async function exportAllData(): Promise<ExportData> {
  const [tasks, pomodoroSessions, checkIns] = await Promise.all([
    prisma.task.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    prisma.pomodoroSession.findMany({ orderBy: { finishedAt: "desc" } }),
    prisma.checkIn.findMany({ orderBy: { date: "desc" } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    tasks: tasks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    pomodoroSessions: pomodoroSessions.map((s) => ({
      ...s,
      finishedAt: s.finishedAt.toISOString(),
    })),
    checkIns: checkIns.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}