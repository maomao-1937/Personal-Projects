# ExplainBack

ExplainBack 是一个费曼学习法 AI 陪练 MVP。用户可以只输入学习主题，也可以粘贴学习资料；系统先生成知识地图，再围绕每个知识点完成“解释、追问、分层支持、重新验证”的训练闭环。AI 不直接替用户完成解释。

当前版本聚焦核心学习流程，暂不包含登录、PDF 上传、向量检索和多用户数据隔离。

## 核心流程

1. 输入学习主题；可选粘贴不少于 100 字的纯文本或 Markdown 资料。
2. AI 根据主题通用知识或用户资料生成 1～10 个知识点。
3. 用户用自己的话解释当前知识点。
4. AI 标出已理解、遗漏和明确误解，并提出一个追问。
5. 用户可逐级查看提示、资料证据和示例，再重新完整解释。
6. 通过验证后，知识点状态由确定性规则更新为“已掌握”。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript
- CSS / Tailwind CSS 4，Canvas 日光水纹交互背景
- SQLite 与 better-sqlite3，本地事务持久化
- AI SDK 7 与 OpenAI-compatible Provider
- Zod 4 结构化校验
- Vitest、Testing Library、Playwright

业务状态由服务端规则决定；模型只负责结构化分析和生成反馈，不直接修改学习状态。创建学习地图和提交训练均带幂等保护，数据写入和分析事件在同一事务内完成。

## 本地运行

需要 Node.js 22 或更高版本，推荐使用 Node.js 24 与 npm 11。

```bash
npm install
cp .env.example .env.local
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。示例环境默认启用 Mock AI，无需密钥即可体验完整流程。

学习资料留空时，系统使用通用知识进入主题直练模式；填写资料时，AI 只依据该资料生成知识点、判断回答和提供提示。

接入真实模型时修改 `.env.local`：

```dotenv
AI_API_KEY=your-api-key
AI_BASE_URL=https://your-provider.example/v1
AI_MODEL=your-model-name
AI_TIMEOUT_MS=30000
AI_MOCK_MODE=false
DATABASE_PATH=data/explainback.db
```

`AI_BASE_URL` 对应兼容 OpenAI API 的 `/v1` 地址；单次模型调用默认 30 秒超时。SQLite 适用于单机或带持久磁盘的部署，不适合无状态 Serverless 多实例共享写入。

## 质量检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

端到端测试覆盖桌面端和 360px 移动端，包括完整学习闭环、刷新后状态保留、网络失败后保留回答以及幂等重试。

## 目录

```text
src/app/          页面与 API 路由
src/components/   界面与日光水纹交互
src/lib/          输入校验、学习状态和领域类型
src/server/       AI、仓储与业务服务
tests/            单元、集成、浏览器验收
docs/             产品设计与实现计划
```
