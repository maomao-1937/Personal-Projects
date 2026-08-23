# MeetingMemo 前端技术适配说明

日期：2026-08-23

## 技术基线

- Node.js LTS（最低满足 Next.js 当前要求）。
- npm 作为唯一包管理器，提交 `package-lock.json`。
- Next.js App Router、React、TypeScript 严格模式。
- Tailwind CSS v4 与 `app/globals.css` 中的语义设计变量。
- Lucide React 图标，不使用字符模拟图标。
- Vitest + React Testing Library 做组件/逻辑测试，Playwright 做关键浏览器流程。

## 目录与职责

- `app/`：路由、根布局和页面级组合。
- `components/`：访问门、工作台、会议列表、编辑器和洞察卡片。
- `lib/api/`：唯一 HTTP 访问层、错误映射与下载。
- `lib/types/`：与 FastAPI 响应一致的 TypeScript 类型。
- `lib/summary/`：无副作用的编辑、来源定位和状态工具。
- `tests/`：组件及用户行为测试。
- `e2e/`：关键浏览器流程。

## 与后端的适配

- 浏览器统一请求同源 `/api/v1/*`，Next.js 开发和部署通过 rewrite 转发到 FastAPI。
- 所有请求使用 Cookie 会话；前端不读取 HttpOnly Cookie。
- 首次加载先查询 `/api/v1/access/session`，401 时进入邀请码页。
- 数据写入后重新获取服务端数据，不长期维护第二份实体缓存。
- 摘要保存提交完整 `SummaryPayload` 和 `expected_version`。
- 任务状态以 `/api/v1/jobs/{id}` 为准，轮询终态停止。

## 运行时配置

- `BACKEND_URL`：Next.js 服务端 rewrite 目标，默认 `http://127.0.0.1:8100`。
- 前端不使用 `NEXT_PUBLIC_*` 保存密钥。
- LLM、Slack、Email、数据库等密钥只存在后端 `.env`。

## 设计适配

- 根目录 `DESIGN.md` 是视觉真源。
- 产品内标题限制 24–32px，覆盖参考设计中的营销展示字号。
- 默认 Lora / DM Sans；字体加载失败时使用本地中文与系统回退。
- 画布、表面、边框、墨色、橄榄色和状态色全部通过 CSS 变量表达。
- 三栏是桌面信息架构，不等同于营销官网的 1200px 内容页。

## 质量命令

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

验收还需在 390、768、1280、1440px 使用真实浏览器检查布局、键盘焦点、空态、加载态、错误态及控制台。
