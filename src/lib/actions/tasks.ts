"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Priority } from "@/generated/prisma/enums";

export type ActionResult = { error?: string };

function parseTags(raw: FormData | string | null): string {
  const value = typeof raw === "string" ? raw : (raw?.get("tags") as string | null);
  if (!value) return "";
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .join(",");
}

function isPriority(value: unknown): value is Priority {
  return typeof value === "string" && value in Priority;
}

export async function createTask(
  parentId: string | null,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) {
    return { error: "标题不能为空" };
  }

  const priorityRaw = formData.get("priority");
  const priority = isPriority(priorityRaw) ? priorityRaw : Priority.P2;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const tags = parseTags(formData);

  const siblingCount = await prisma.task.count({ where: { parentId } });

  await prisma.task.create({
    data: {
      title,
      description,
      priority,
      tags,
      parentId,
      order: siblingCount,
    },
  });

  revalidatePath("/tasks");
  return {};
}

export async function updateTask(
  id: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const title = (formData.get("title") as string | null)?.trim();
  if (!title) {
    return { error: "标题不能为空" };
  }

  const priorityRaw = formData.get("priority");
  const priority = isPriority(priorityRaw) ? priorityRaw : Priority.P2;
  const description = (formData.get("description") as string | null)?.trim() || null;
  const tags = parseTags(formData);

  await prisma.task.update({
    where: { id },
    data: { title, description, priority, tags },
  });

  revalidatePath("/tasks");
  return {};
}

export async function toggleTask(id: string, completed: boolean) {
  await prisma.task.update({ where: { id }, data: { completed } });
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
}

export async function moveTask(id: string, direction: "up" | "down") {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;

  const siblings = await prisma.task.findMany({
    where: { parentId: task.parentId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  const index = siblings.findIndex((s) => s.id === id);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= siblings.length) return;

  const other = siblings[swapIndex];

  await prisma.$transaction([
    prisma.task.update({ where: { id: task.id }, data: { order: other.order } }),
    prisma.task.update({ where: { id: other.id }, data: { order: task.order } }),
  ]);

  revalidatePath("/tasks");
}
