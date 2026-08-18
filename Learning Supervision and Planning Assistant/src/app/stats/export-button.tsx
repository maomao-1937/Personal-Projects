"use client";

import { useState } from "react";
import { exportAllData } from "@/lib/actions/export";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton() {
  const [pending, setPending] = useState(false);

  async function handleExport() {
    setPending(true);
    try {
      const data = await exportAllData();
      const stamp = data.exportedAt.replace(/[:.]/g, "-").slice(0, 19);
      download(
        `study-planner-backup-${stamp}.json`,
        JSON.stringify(data, null, 2),
      );
    } catch {
      alert("导出失败，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleExport}
      className="rounded-lg border border-black/[.08] px-4 py-2 text-sm text-zinc-600 hover:bg-black/[.03] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-400 dark:hover:bg-white/[.06]"
    >
      {pending ? "导出中..." : "导出 JSON 备份"}
    </button>
  );
}