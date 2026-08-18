"use client";

import { useState } from "react";
import { DEFAULT_CONFIG, useTimerStore, type TimerConfig } from "./timer-store";

const NUMBER_FIELDS: {
  key: keyof Pick<
    TimerConfig,
    "workMin" | "shortBreakMin" | "longBreakMin" | "longBreakEvery"
  >;
  label: string;
  min: number;
  max: number;
  unit: string;
}[] = [
  { key: "workMin", label: "专注时长", min: 1, max: 180, unit: "分钟" },
  { key: "shortBreakMin", label: "短休息", min: 1, max: 60, unit: "分钟" },
  { key: "longBreakMin", label: "长休息", min: 1, max: 60, unit: "分钟" },
  { key: "longBreakEvery", label: "长休息间隔", min: 1, max: 12, unit: "轮" },
];

export function ConfigPanel({ disabled }: { disabled: boolean }) {
  const config = useTimerStore((s) => s.config);
  const setConfig = useTimerStore((s) => s.setConfig);
  const resetConfig = useTimerStore((s) => s.resetConfig);
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-900">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-sm font-medium text-black dark:text-zinc-50"
      >
        <span>计时设置</span>
        <span className="text-zinc-500">{open ? "收起" : "展开"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {disabled && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              计时进行中，改动会在下一个阶段生效
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {NUMBER_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {f.label}（{f.unit}）
                </span>
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={config[f.key]}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (!Number.isFinite(raw)) return;
                    setConfig({
                      [f.key]: Math.min(f.max, Math.max(f.min, Math.round(raw))),
                    });
                  }}
                  className="rounded-lg border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-zinc-900"
                />
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.soundOn}
                onChange={(e) => setConfig({ soundOn: e.target.checked })}
                className="size-4 accent-black dark:accent-white"
              />
              <span className="text-zinc-600 dark:text-zinc-400">
                阶段结束播放提示音
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.notifyOn}
                onChange={(e) => setConfig({ notifyOn: e.target.checked })}
                className="size-4 accent-black dark:accent-white"
              />
              <span className="text-zinc-600 dark:text-zinc-400">
                发送桌面通知（首次开始时会请求权限）
              </span>
            </label>
          </div>

          <button
            onClick={resetConfig}
            className="self-start text-xs text-zinc-500 hover:underline"
          >
            恢复默认（{DEFAULT_CONFIG.workMin}/{DEFAULT_CONFIG.shortBreakMin}/
            {DEFAULT_CONFIG.longBreakMin}）
          </button>
        </div>
      )}
    </div>
  );
}
