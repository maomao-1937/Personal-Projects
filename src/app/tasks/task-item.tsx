"use client";

import { useState } from "react";
import { toggleTask, deleteTask, moveTask } from "@/lib/actions/tasks";
import { TaskForm } from "./task-form";
import type { Priority } from "@/generated/prisma/enums";

export type TaskWithSubtasks = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  tags: string;
  completed: boolean;
  parentId: string | null;
  subtasks: TaskWithSubtasks[];
};

const PRIORITY_STYLE: Record<Priority, string> = {
  P0: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  P1: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  P2: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  P3: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function TaskItem({
  task,
  isFirst,
  isLast,
}: {
  task: TaskWithSubtasks;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const tagList = task.tags ? task.tags.split(",") : [];

  if (editing) {
    return (
      <li className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
        <TaskForm mode="edit" task={task} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={(e) => toggleTask(task.id, e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-black dark:accent-white"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                task.completed
                  ? "text-zinc-400 line-through"
                  : "text-black dark:text-zinc-50"
              }`}
            >
              {task.title}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_STYLE[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>
          {task.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {task.description}
            </p>
          )}
          {tagList.length > 0 && (
            <div className="mt-1 flex gap-1">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1 text-xs text-zinc-500">
          <button
            disabled={isFirst}
            onClick={() => moveTask(task.id, "up")}
            className="rounded px-1.5 py-1 hover:bg-black/[.04] disabled:opacity-30 dark:hover:bg-white/[.08]"
            aria-label="上移"
          >
            ↑
          </button>
          <button
            disabled={isLast}
            onClick={() => moveTask(task.id, "down")}
            className="rounded px-1.5 py-1 hover:bg-black/[.04] disabled:opacity-30 dark:hover:bg-white/[.08]"
            aria-label="下移"
          >
            ↓
          </button>
          <button
            onClick={() => setEditing(true)}
            className="rounded px-1.5 py-1 hover:bg-black/[.04] dark:hover:bg-white/[.08]"
          >
            编辑
          </button>
          <button
            onClick={() => {
              if (confirm("确定删除这个任务吗？")) deleteTask(task.id);
            }}
            className="rounded px-1.5 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            删除
          </button>
        </div>
      </div>

      {task.subtasks.length > 0 && (
        <ul className="mt-3 ml-6 flex flex-col gap-2 border-l border-black/[.08] pl-4 dark:border-white/[.145]">
          {task.subtasks.map((sub, i) => (
            <TaskItem
              key={sub.id}
              task={sub}
              isFirst={i === 0}
              isLast={i === task.subtasks.length - 1}
            />
          ))}
        </ul>
      )}

      <div className="mt-2 ml-6">
        {addingSubtask ? (
          <div className="rounded-lg border border-dashed border-black/[.08] p-3 dark:border-white/[.145]">
            <TaskForm mode="create" parentId={task.id} />
            <button
              onClick={() => setAddingSubtask(false)}
              className="mt-2 text-xs text-zinc-500 hover:underline"
            >
              收起
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingSubtask(true)}
            className="text-xs text-zinc-500 hover:underline"
          >
            + 添加子任务
          </button>
        )}
      </div>
    </li>
  );
}
