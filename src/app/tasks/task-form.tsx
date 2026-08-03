"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTask, updateTask, type ActionResult } from "@/lib/actions/tasks";
import { Priority } from "@/generated/prisma/enums";

const PRIORITY_LABEL: Record<Priority, string> = {
  P0: "P0 · 紧急",
  P1: "P1 · 高",
  P2: "P2 · 中",
  P3: "P3 · 低",
};

type Props =
  | { mode: "create"; parentId: string | null }
  | {
      mode: "edit";
      task: {
        id: string;
        title: string;
        description: string | null;
        priority: Priority;
        tags: string;
      };
      onDone?: () => void;
    };

const initialState: ActionResult = {};

export function TaskForm(props: Props) {
  const action =
    props.mode === "create"
      ? createTask.bind(null, props.parentId)
      : updateTask.bind(null, props.task.id);

  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const prevPending = useRef(pending);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) {
      if (props.mode === "create") {
        formRef.current?.reset();
      } else {
        props.onDone?.();
      }
    }
    prevPending.current = pending;
  }, [pending, state.error, props]);

  const defaults =
    props.mode === "edit"
      ? props.task
      : { title: "", description: "", priority: Priority.P2, tags: "" };

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          name="title"
          placeholder="任务标题"
          defaultValue={defaults.title}
          required
          className="flex-1 rounded-lg border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-zinc-900"
        />
        <select
          name="priority"
          defaultValue={defaults.priority}
          className="rounded-lg border border-black/[.08] bg-white px-2 py-2 text-sm dark:border-white/[.145] dark:bg-zinc-900"
        >
          {Object.values(Priority).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <input
        name="tags"
        placeholder="标签，用逗号分隔（最多 10 个，每个 30 字内）"
        defaultValue={defaults.tags}
        className="rounded-lg border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-zinc-900"
      />
      <textarea
        name="description"
        placeholder="备注（可选）"
        defaultValue={defaults.description ?? ""}
        rows={2}
        className="resize-none rounded-lg border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-zinc-900"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "保存中..." : props.mode === "create" ? "添加任务" : "保存"}
        </button>
        {props.mode === "edit" && (
          <button
            type="button"
            onClick={() => props.onDone?.()}
            className="rounded-lg border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145]"
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}
