"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMinutes, type DailyPoint } from "@/lib/stats";

/**
 * Recharts 必须跑在客户端。这里只放"画"的部分，聚合全在 lib/stats.ts。
 *
 * 配色不写死十六进制，一律读 globals.css 里的 --viz-* 令牌，
 * 这样深色模式跟着 CSS 走，不需要在 JS 里判断主题。
 */

const AXIS = { fontSize: 11, fill: "var(--viz-ink-muted)" };

/** 轴与网格的公共配置。网格只留横线：竖线和柱子平行，纯属干扰。 */
const gridProps = {
  stroke: "var(--viz-grid)",
  strokeDasharray: "0", // 实线，虚线在小尺寸下像噪点
  vertical: false,
} as const;

/**
 * Recharts 会给 <svg> 加 tabindex=0，但不给可访问名字——键盘用户 Tab 进来
 * 只听到"图形"两个字。accessibilityLayer 打开后可以用方向键在数据点间移动，
 * 再补一个 aria-label 说明这张图是什么、数据也在表格里。
 */
const a11y = (label: string) =>
  ({
    accessibilityLayer: true,
    role: "application" as const,
    "aria-label": `${label}。用左右方向键逐日查看，完整数值也在页面底部的表格数据里。`,
  });

/**
 * 全零时不画图。空坐标系看着像图表坏了，一句话反而说得清；
 * 柱状图尤其明显——一根柱子都没有，只剩轴。
 */
function EmptyPlot({ hint }: { hint: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center text-sm"
      style={{ color: "var(--viz-ink-secondary)" }}
    >
      {hint}
    </div>
  );
}

function TooltipBox({ title, value }: { title: string; value: string }) {
  return (
    <div
      className="rounded-lg px-2.5 py-1.5 text-xs shadow-sm"
      style={{
        background: "var(--viz-surface)",
        border: "1px solid var(--viz-grid)",
      }}
    >
      {/* 数值在前、说明在后：能看到 tooltip 的人已经知道看的是什么了 */}
      <div className="font-semibold" style={{ color: "var(--viz-ink)" }}>
        {value}
      </div>
      <div style={{ color: "var(--viz-ink-secondary)" }}>{title}</div>
    </div>
  );
}

const monthDay = (key: string) => {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
};

/** 每日专注时长趋势。单序列，所以不要图例——标题已经说清画的是什么。 */
export function DailyFocusChart({ points }: { points: DailyPoint[] }) {
  // 点太密时抽稀刻度，否则日期会互相压住
  const tickGap = points.length > 60 ? 14 : points.length > 14 ? 7 : 1;
  const hasData = points.some((p) => p.minutes > 0);

  if (!hasData) {
    return (
      <div className="h-56 w-full">
        <EmptyPlot hint="这段时间还没有专注记录，跑完一段沉淀就会出现在这里。" />
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
          {...a11y("每日专注时长折线图")}
        >
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="date"
            tickFormatter={monthDay}
            interval={tickGap - 1}
            tick={AXIS}
            tickLine={false}
            stroke="var(--viz-axis)"
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}`)}
          />
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as DailyPoint;
              return (
                <TooltipBox
                  value={formatMinutes(p.minutes)}
                  title={`${p.date} · ${p.sessions} 段${p.checked ? " · 已打卡" : ""}`}
                />
              );
            }}
          />
          <Area
            // 用直线不用 monotone 平滑：平滑曲线会在 0 的日子鼓起来，
            // 看着像那天也学了，等于凭插值编数据
            type="linear"
            dataKey="minutes"
            // 关掉入场动画：每次切范围都重新扫一遍很吵，
            // 而且动画期间截图/首帧是空的，静态渲染下等于没有图
            isAnimationActive={false}
            stroke="var(--viz-series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="var(--viz-series-1)"
            fillOpacity={0.1}
            activeDot={{
              r: 4,
              fill: "var(--viz-series-1)",
              stroke: "var(--viz-surface)",
              strokeWidth: 2,
            }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 一周七天的专注分布。柱子封顶 24px，剩下的留白比填满好看也好读。 */
export function WeekdayChart({
  data,
}: {
  data: { weekday: string; minutes: number }[];
}) {
  if (!data.some((d) => d.minutes > 0)) {
    return (
      <div className="h-48 w-full">
        <EmptyPlot hint="还没有足够的记录看出节律。" />
      </div>
    );
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
          {...a11y("一周七天专注时长柱状图")}
        >
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="weekday"
            tick={AXIS}
            tickLine={false}
            stroke="var(--viz-axis)"
          />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}`)}
          />
          <Tooltip
            cursor={{ fill: "var(--viz-grid)", fillOpacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <TooltipBox
                  value={formatMinutes(Number(payload[0].value))}
                  title={String(label)}
                />
              );
            }}
          />
          <Bar
            dataKey="minutes"
            isAnimationActive={false}
            fill="var(--viz-series-1)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
