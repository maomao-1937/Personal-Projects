import Link from "next/link";

const modules = [
  { href: "/tasks", label: "任务管理", desc: "创建、分解、排序你的学习任务" },
  { href: "/timer", label: "沉淀", desc: "专注计时，工作/休息自动循环" },
  { href: "/checkin", label: "打卡", desc: "每日学习打卡，追踪连续天数" },
  { href: "/stats", label: "统计面板", desc: "查看学习时长与完成情况趋势" },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 py-24 px-6">
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            学习监督规划助手
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            任务管理 + 沉淀 + 打卡 + 统计面板
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex flex-col gap-1 rounded-xl border border-black/[.08] bg-white p-5 transition-colors hover:border-black/[.15] hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              <span className="text-lg font-medium text-black dark:text-zinc-50">
                {m.label}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {m.desc}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
