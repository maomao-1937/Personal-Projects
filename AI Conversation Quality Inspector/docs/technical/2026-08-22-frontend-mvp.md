# 前端 MVP 实现与核验记录

日期：2026-08-22

## 交付范围

- 邀请码入口，无注册、登录、账号和密码路径。
- 销售／客服质检切换、输入约束、示例、清空、字符计数与防重复提交。
- `scored`、`partial`、`unable_to_score` 三种报告状态。
- 六维结论、独立风险提示、主要问题、建议回复、限制与匿名反馈。
- 通过 `tN` 节点和逐字原句显示“证据轨道”。
- 运行时可配置的同源 `/backend-api/*` Route Handler 转发，Zod 六维及跨字段响应校验，HttpOnly Cookie 与 CSRF 协作。
- 公开后端限制驱动字符数、轮次数和邀请码总额度；额度归零后保留报告但禁止继续提交。
- 报告展示总体置信度，复制文本包含主要问题、证据轮次、逐字原句、理由和改进动作。
- 生产 `standalone` 构建与静态资源装配。

## 自动化核验

最终收口前的验证结果：

- ESLint：通过。
- TypeScript strict typecheck：通过。
- Vitest + React Testing Library：6 个文件、22 个测试通过。
- Playwright：桌面 Chromium、Pixel 7 Chromium 与桌面 WebKit 三个项目、3 个闭环测试通过。
- Next.js production build：通过，根页面静态预渲染。
- `npm audit`：0 个已知漏洞。

## 独立浏览器核验

`scripts/visual_verify.py` 使用原生 Python Playwright 在 1440×1000 和 390×844 视口运行，逐项验证：

- 邀请码 → 工作台 → 示例输入 → 报告 → 原文证据 → 反馈闭环。
- 页面与浏览器控制台无非预期错误。
- `documentElement.scrollWidth` 不超过视口宽度。
- 键盘 Tab 可移动到可交互元素。
- `prefers-reduced-motion: reduce` 下完成相同流程。
- 人工检查访问页、报告总览、证据区与反馈区截图。

视觉检查发现并修复了移动端吸顶栏半透明导致底层深色内容透出的问题；复查后吸顶栏为实色，文字和操作保持清晰。

## 真实前后端联调

使用临时空 SQLite 数据库、真实 Alembic 迁移、真实 FastAPI 和真实 Next.js production server 完成无模型 Key 冒烟。前端构建时使用默认后端端口 8010，运行时改指向 8020 并成功完成闭环，证明线上可在不重建前端的情况下切换后端地址：

1. 邀请码兑换成功，同源签名 Cookie 可用。
2. 页面显示剩余 50 次。
3. 提交有效销售对话后，后端返回 `LLM_NOT_CONFIGURED` / 503。
4. 页面显示安全提示“模型服务尚未配置。”，不泄露堆栈。
5. 失败后剩余额度仍为 50。

真实模型报告与证据质量验收留待用户把 `LLM_API_KEY`、`LLM_MODEL`（以及需要时的 `LLM_BASE_URL`）写入部署环境后执行。
