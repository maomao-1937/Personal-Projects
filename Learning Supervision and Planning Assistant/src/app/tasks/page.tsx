import { prisma } from "@/lib/prisma";
import { TaskForm } from "./task-form";
import { TaskItem, type TaskWithSubtasks } from "./task-item";

function buildTree(tasks: Omit<TaskWithSubtasks, "subtasks">[]): TaskWithSubtasks[] {
  const byId = new Map<string, TaskWithSubtasks>(
    tasks.map((t) => [t.id, { ...t, subtasks: [] }]),
  );
  const roots: TaskWithSubtasks[] = [];

  for (const task of byId.values()) {
    if (task.parentId) {
      byId.get(task.parentId)?.subtasks.push(task);
    } else {
      roots.push(task);
    }
  }
  return roots;
}

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      tags: true,
      completed: true,
      parentId: true,
    },
  });

  const tree = buildTree(tasks);
  const total = tasks.length;
  const done = tasks.filter((t) => t.completed).length;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          任务管理
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {total > 0 ? `已完成 ${done} / ${total}` : "还没有任务，添加一个开始吧"}
        </p>
      </div>

      <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
        <TaskForm mode="create" parentId={null} />
      </div>

      <ul className="flex flex-col gap-3">
        {tree.map((task, i) => (
          <TaskItem
            key={task.id}
            task={task}
            isFirst={i === 0}
            isLast={i === tree.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}
