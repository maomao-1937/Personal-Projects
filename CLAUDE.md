@AGENTS.md

# 学习监督规划助手 (study-planner)

Web 端学习监督规划助手：任务管理 + 番茄钟 + 打卡 + 统计面板。

## 技术栈（实际安装版本）

- Next.js 16.2.12（App Router + Turbopack）— **注意**：这是比训练数据新的大版本，写代码前先看 `node_modules/next/dist/docs/`（见上面 AGENTS.md 的强制要求）
- React 19.2.4 / React DOM 19.2.4
- TypeScript 5（strict）
- Tailwind CSS 4（CSS 内 `@theme inline` 配置，无 `tailwind.config.ts`）
- Prisma 7.9.1 + `@prisma/client` 7.9.1
  - **Prisma 7 强制要求 driver adapter**，不能像 Prisma 5/6 那样直接连字符串
  - 用的是 `@prisma/adapter-better-sqlite3` + `better-sqlite3`（同步驱动，Node 环境用）
  - Client 生成到 `src/generated/prisma`（自定义 output，不是默认的 `node_modules/.prisma`），已加入 `.gitignore`
- Zustand 5 — 客户端状态管理
- Recharts 3 — 统计图表
- Framer Motion 12 — 动画（番茄钟倒计时等）
- Howler 2.2 — 音效播放
- lucide-react — 图标
- date-fns 4 / clsx / tailwind-merge — 工具库

包管理器用 **npm**（环境里没装 pnpm，虽然早期方案文档提议用 pnpm，实际以 npm 为准）。

## 项目结构

```
src/
  app/                  # Next.js App Router 页面
    page.tsx            # 首页，四个功能模块的入口导航
    layout.tsx
    globals.css
    tasks/              # 功能 1：任务管理
      page.tsx          # Server Component，查任务 + buildTree 组装子任务树
      task-form.tsx     # 创建/编辑双模式表单（useActionState）
      task-item.tsx     # 递归渲染任务与子任务
    timer/              # 功能 2：番茄钟
      page.tsx          # Server Component，查未完成任务 + 今日会话记录
      timer-panel.tsx   # 主面板：环形倒计时、控制按钮、任务选择
      use-pomodoro.ts   # 计时核心 hook（endAt 时间戳驱动，非计数器）
      timer-store.ts    # Zustand + persist，只存配置偏好
      config-panel.tsx  # 时长/间隔/声音/通知设置
      session-list.tsx  # 今日记录列表 + 删除
      alert.ts          # Web Audio 合成提示音 + 桌面通知
    checkin/            # 功能 3：打卡
      page.tsx          # Server Component，查热力图窗口 + 全量日期算连续天数
      checkin-form.tsx  # 打卡/更新/撤销（心情 + 备注）
      heatmap.tsx       # 手写 CSS Grid 热力图（按周分列，无额外依赖）
    stats/              # 功能 4：统计面板
      page.tsx          # Server Component，按 days 区间查会话/任务/打卡，调 lib/stats 聚合
      ranges.ts         # 区间常量（7/30/90），必须是纯服务端模块，见下方说明
      range-picker.tsx  # 区间切换（Link + searchParams，不用客户端状态）
      panels.tsx        # 统计块、任务归集条、完成率、打卡摘要、表格数据
      charts.tsx        # Recharts 折线/柱状图，配色读 --viz-* CSS 令牌
  generated/prisma/      # Prisma Client 生成代码（勿手动编辑，勿提交）
  lib/
    prisma.ts           # PrismaClient 单例（driver adapter 初始化 + 热重载防重复连接）
    checkin-date.ts     # 日期字符串工具 + 连续天数算法（纯函数，无 Prisma 依赖）
    stats.ts            # 统计聚合（纯函数，无 Prisma 依赖）：按天铺满补零、周节律、任务归集、汇总
    actions/
      tasks.ts          # 任务 CRUD Server Actions
      pomodoro.ts       # 番茄钟会话记录 Server Actions
      checkin.ts        # 打卡 upsert / 撤销 Server Actions
prisma/
  schema.prisma          # Priority / SessionPhase / Mood 枚举 + Task / PomodoroSession / CheckIn 模型
```

四个功能页面均已实现。

## 统计面板设计要点

- 聚合全部走 `src/lib/stats.ts` 的纯函数，页面只负责查库和传参 —— 分组在 JS 里做而不写复杂 SQL：单用户本地应用数据量小（一年也就几千行），换来的是能脱离数据库单独验证边界情况
- **折线图用 `type="linear"` 不用 `monotone`**：平滑曲线会在 0 分钟的日子鼓起来，看着像那天也学了，等于凭插值编数据
- 按天铺满区间、没记录的日子补 0：折线图若只连有数据的点，中间空掉的几天会被直线跨过去
- `isAnimationActive={false}`：入场动画每次切区间都重扫一遍很吵，而且动画期间首帧是空的（静态渲染/截图下等于没有图）
- 全零时不画坐标系，改显示一句说明 —— 空轴看着像图表坏了，柱状图尤其明显
- 配色不在 JS 里判断主题，一律读 `globals.css` 的 `--viz-*` 令牌，深色模式跟着 CSS 走
- Recharts 给 `<svg>` 加了 `tabindex=0` 却没有可访问名字，已开 `accessibilityLayer` + 补 `aria-label`；所有数值同时在底部「表格数据」里可达，不依赖悬停
- 区间状态走 URL `searchParams`（`?days=30`）而非客户端 state：可以直接分享/刷新，也不需要 Zustand
- `days` 参数来自 URL，必须白名单校验（只接受 7/30/90），非法值回落 30

## 关键坑：`"use client"` 模块不能导出普通数组给服务端用

`RANGES` 常量最初放在 `range-picker.tsx`（`"use client"`）里，服务端 `page.tsx` 导入后拿到的不是真数组而是 client reference，运行时报错。常量必须放在**不带 `"use client"`** 的独立模块（现为 `src/app/stats/ranges.ts`），两端才能共用。

## 番茄钟设计要点

- 计时不用「每秒减一」的计数器，而是记 `endAt` 时间戳、每 250ms 反算剩余秒数——切标签页/息屏/浏览器降频 `setInterval` 都不会跑偏
- **只有完整跑完的阶段才落库**，「重置本段」「跳过」都不写记录，避免半个番茄钟污染统计（Pomotroid / Goodtime 的做法）
- 休息阶段不关联任务，只有专注阶段记 `taskId`
- `taskId` 来自客户端，Server Action 里先查任务是否真实存在，不存在就降级成 `null`（Server Actions 是公开 POST 端点，不能信任入参）
- 提示音用 Web Audio API 合成正弦音，没有引入 `public/` 音频文件（Howler 已装但这里用不上，留给后续需要真实音源时用）
- Zustand 的 `persist` 只存配置，`taskId` 走 `partialize` 排除掉——否则下次打开可能关联到已删除的任务

## 关键约定

- Prisma Client **必须**从 `@/lib/prisma` 导入使用（单例），不要在别处 `new PrismaClient()`
- Prisma Client 类型/命名空间从 `@/generated/prisma/client` 导入，不是 `@prisma/client`
- 路径别名 `@/*` → `./src/*`
- 数据库文件：`dev.db`（sqlite，通过 `DATABASE_URL` 环境变量指向，`.env` 中已配置 `file:./dev.db`），已在 `.gitignore` 中排除
- 打卡日期存 `"YYYY-MM-DD"` 字符串（`CheckIn.date`，唯一索引），不用 `DateTime`——避免时区换算把「今天」算错；连续天数算法在 `src/lib/checkin-date.ts`，纯函数不碰 Prisma，方便单独验证
- 环境变量 Prisma CLI 侧需要 `prisma.config.ts` 显式加载 `.env`（Prisma 7 变化，CLI 不再自动读取 `.env`）——已建好，内含 `import "dotenv/config"`
- 改完 `schema.prisma` 跑 `migrate dev` 后**必须重启 `next dev`**：开发服务器进程内缓存的是旧的 Prisma Client，不重启会报 `Cannot read properties of undefined (reading 'xxx')`
- 不要用 `sqlite3` CLI 手写 insert 造测试数据：Prisma 把 `DateTime` 存成 ISO 字符串，手写的 `unixepoch()*1000` 是整数，两种格式在时间范围查询里对不上。造数据走 Prisma

## 已知问题（暂不处理）

`npm audit` 报 3 个高危漏洞（postcss、sharp），均来自 **Next.js 16.2.12 内部打包依赖**，非项目直接依赖：

- postcss@8.4.31（XSS / sourcemap 路径穿越）
- sharp@0.34.5（libvips CVE）

`npm audit fix --force` 给出的方案是把 Next.js 降级到 9.3.3（无 App Router），不可行。16.2.12 已是当前系列最新 patch。当前项目未使用 `next/image` 远程图片优化，也无用户输入进入 CSS 编译流程，实际风险低。如需处理，倾向用 `package.json overrides` 强制提升嵌套版本，而非降级 Next——需要用户确认后再做。

## 当前进度

- [X] 项目基础设置：Next.js 脚手架、依赖安装、Prisma + SQLite（driver adapter）接入、构建/l	int/dev 验证通过
- [X] 功能 1：任务管理（CRUD + 优先级 + 标签）
- [X] 功能 2：番茄钟（计时器 + 工作/休息循环 + 任务关联）
- [X] 功能 3：打卡系统（一键打卡 + 心情标记 + 连续天数 + 半年热力图）
- [X] 功能 4：统计面板（每日时长 / 周节律 / 任务归集 / 完成率 / 打卡摘要 + 表格数据）

四个功能均已完成。完整技术选型调研与参考项目见 `/Users/liuxs/.claude/plans/quirky-prancing-fountain.md`。

## 常用命令

```bash
npm run dev      # 本地开发 (Turbopack)
npm run build    # 生产构建
npm run lint     # ESLint 检查
npx prisma migrate dev   # 应用数据库迁移（加模型后使用）
npx prisma studio         # 可视化查看数据库
```
