"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkInToday, undoToday } from "@/lib/actions/checkin";
import { Mood } from "@/generated/prisma/enums";

const MOOD_OPTION: { value: Mood; label: string; emoji: string }[] = [
  { value: Mood.GREAT, label: "状态很好", emoji: "🔥" },
  { value: Mood.OK, label: "一般", emoji: "🙂" },
  { value: Mood.TOUGH, label: "有点吃力", emoji: "😮‍💨" },
];

export type TodayState = {
  checked: boolean;
  mood: Mood | null;
  note: string | null;
};

export function CheckInForm({ today }: { today: TodayState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mood, setMood] = useState<Mood>(today.mood ?? Mood.OK);
  const [note, setNote] = useState(today.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "操作失败");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {MOOD_OPTION.map((opt) => {
          const active = mood === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMood(opt.value)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "border-black/[.08] text-zinc-600 hover:bg-black/[.03] dark:border-white/[.145] dark:text-zinc-400 dark:hover:bg-white/[.06]"
              }`}
            >
              <span aria-hidden>{opt.emoji}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={200}
        rows={2}
        placeholder="今天学了点什么？（可选，200 字内）"
        className="resize-none rounded-lg border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-zinc-900"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => checkInToday(mood, note))}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? "处理中..." : today.checked ? "更新今日打卡" : "打卡"}
        </button>

        {today.checked && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("撤销今天的打卡记录？连续天数会跟着减少。")) {
                run(undoToday);
              }
            }}
            className="rounded-lg border border-black/[.08] px-3 py-2 text-sm text-zinc-600 disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-400"
          >
            撤销
          </button>
        )}
      </div>
    </div>
  );
}
