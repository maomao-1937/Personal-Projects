# AI 对话质检器前端技术适配声明

## 适配结论

本项目采用 Next.js 16 App Router、React 19、TypeScript strict、Tailwind CSS 4、Zod、Lucide、Vitest + React Testing Library 和 Playwright。当前仓库没有既有前端，因此使用手册默认栈；不引入 TanStack Query、Zustand、表单框架或完整组件库，因为 MVP 只有单页、单次同步分析和少量局部状态。

创建时锁定的基线为 Next.js 16.3.2、React 19.2.8、Tailwind CSS 4.3.3、TypeScript 5.9.3、ESLint 9.39.5、Vitest 4.1.11、Playwright 1.62.1。版本来自 2026-08-22 的 npm 官方 registry；TypeScript 与 ESLint 采用上一稳定兼容线，因为 Next.js 16.3.2 的配套 lint 插件尚不支持已发布的 TypeScript 7 与 ESLint 10。同一开发阶段不跨大版本升级。

## 与默认方案的关键适配

- 浏览器只请求同源 `/backend-api/*`。Next.js Route Handler 在请求时读取 `BACKEND_API_BASE_URL` 并转发，避免把后端地址做成浏览器配置、避免 build-time rewrite 固化错误环境，也让签名 Cookie 在前后端分开部署时仍保持第一方语义。
- API 调用全部集中在 `src/lib/api.ts`，响应在进入组件前用 Zod 做运行时校验；页面不散落 `fetch`。
- 后端同步返回报告，前端不伪造持久任务、历史记录或流式进度；分析阶段只展示真实的“请求处理中”。
- 报告仅留在页面内存中，刷新后不恢复，符合后端隐私边界。
- 字体使用 `@fontsource-variable/inter` 与 `inter-tight` 随包构建，不依赖运行时 Google Fonts。
- 首期没有真实模型 Key，因此 Playwright 使用受控 API fixture 验证完整交互；前后端真实联调已验证邀请码、同源 Cookie、503 错误和额度不扣，并用不同于构建默认值的后端端口证明代理地址可在运行时切换。真实报告内容质量仍待用户提供 Key。

生产 CSP 保留 Next.js 官方“无 nonce”静态渲染方案所需的 `script-src 'unsafe-inline'`，但不允许 `unsafe-eval`、第三方脚本或外部连接，也没有 `dangerouslySetInnerHTML`。若未来加入用户 HTML 或第三方脚本，应切换为每请求 nonce + 动态渲染；当前优先保留静态首屏与更低的函数计算开销。

## 视觉适配

参考链接的可迁移特征是：暖石色背景、白色工作面、近黑文字、细边框、清透蓝强调和克制密度。不会复制 Seline 商标、图标、布局或文案。

设计 token：

- `Stone Paper #FAFAF9`：页面背景。
- `Work White #FFFFFF`：主要工作面。
- `Ink #0C0A09`：标题与主操作。
- `Muted Stone #78716C`：说明文字。
- `Hairline #E8E6E5`：结构边界。
- `Trace Blue #3BA6F1` / `Trace Wash #C1E1F7`：证据和当前状态。

字体角色：Inter Tight Variable 用于品牌与报告大数字；Inter Variable + 中文系统字体用于正文；等宽系统字体用于 `tN` 轮次、版本和额度数据。

布局概念：桌面端左 40% 是输入与控制台，右 60% 是报告；移动端顺序变为访问／输入／状态／报告。唯一视觉签名是“证据轨道”：结论旁的蓝色纵向轨道通过 `tN` 节点和逐字原句把 AI 判断连回聊天轮次。

克制性复核：没有使用渐变、玻璃态、营销大标题、无意义统计卡或过量圆角。唯一动态是分析时扫过报告区的一条证据扫描线，并尊重 `prefers-reduced-motion`。
