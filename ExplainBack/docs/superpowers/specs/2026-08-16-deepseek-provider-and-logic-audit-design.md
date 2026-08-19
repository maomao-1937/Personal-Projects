# ExplainBack DeepSeek Provider 与核心逻辑修正设计

## 1. 目标与范围

将 ExplainBack 的真实 AI 能力固定接入 DeepSeek，让本地环境在只提供 API 密钥时即可运行真实学习流程。本轮不增加模型选择界面、多 Provider 注册中心、登录、计费或用户级密钥管理。

同时修正逻辑审计中发现的双模式残留问题：主题直练仍出现“先别看资料”、错误文案默认资料存在，以及 Mock Tutor 对非 RAG 主题仍输出 RAG 内容。

## 2. 方案决策

采用“固定 DeepSeek Provider”方案：

- 服务端使用现有 `@ai-sdk/openai-compatible` 调用 DeepSeek OpenAI-compatible API。
- 默认 Base URL 固定为 `https://api.deepseek.com`。
- 默认模型固定为 `deepseek-v4-flash`，不在产品界面暴露选择入口。
- 本轮关闭 thinking mode，因为知识点拆解、结构化判断和短提示都是有明确 Schema 的交互任务，优先保证响应时延、成本和 JSON 稳定性。
- 不将 DeepSeek API 密钥传入浏览器、数据库、日志或 API 错误响应。

当前 DeepSeek 官方文档已将 `deepseek-v4-flash` 与 `deepseek-v4-pro` 列为有效模型，旧的 `deepseek-chat` 和 `deepseek-reasoner` 名称已弃用：

- https://api-docs.deepseek.com/zh-cn/quick_start/pricing
- https://api-docs.deepseek.com/guides/thinking_mode

## 3. 配置边界

### 3.1 环境变量

真实模式只新增一个必填秘密：

```dotenv
DEEPSEEK_API_KEY=sk-...
AI_MOCK_MODE=false
AI_TIMEOUT_MS=30000
DATABASE_PATH=data/explainback.db
```

- `DEEPSEEK_API_KEY` 只写入已被 Git 忽略的 `.env.local`。
- `AI_MOCK_MODE=true` 时始终使用 Mock Tutor，即使本机有密钥也不发起计费请求。
- `AI_MOCK_MODE=false` 且密钥缺失时，继续返回现有 `AI_CONFIGURATION` / HTTP 503，不自动回退到 Mock，避免把模拟结果误当成真实 AI。
- 删除 `.env.example` 中需要用户自行填写的通用 `AI_BASE_URL` 和 `AI_MODEL`；用户不参与模型选型。

### 3.2 Provider 创建

`tutor.ts` 继续对外暴露 `AiTutor`，调用者不知道 DeepSeek 细节。Provider 内部配置：

- `name: "deepseek"`
- `baseURL: "https://api.deepseek.com"`
- `model: "deepseek-v4-flash"`
- `transformRequestBody` 统一加入 `thinking: { type: "disabled" }`
- `supportsStructuredOutputs` 保持 `false`，使 AI SDK 向 DeepSeek 发送其官方支持的 `response_format: { type: "json_object" }`，而不是 `json_schema`
- AI SDK 层 `maxRetries: 0`，继续由业务服务层控制最多 2 次尝试，避免双重重试放大计费请求

## 4. 结构化输出稳定性

DeepSeek JSON Output 要求 Prompt 明确包含 JSON 指令和期望结构，并建议设置合理的输出上限：

- https://api-docs.deepseek.com/guides/json_mode/

因此在三类 System Prompt 中增加不可被用户内容覆盖的 JSON 输出规则：

1. 知识点提取：指明输出 `{"concepts":[...]}` 形状，`maxOutputTokens` 设为 4,000。
2. 回答判断：指明 `assessment` 及四类数组字段，`maxOutputTokens` 设为 2,000。
3. 分级支持：指明 `level/content/next_question` 形状，`maxOutputTokens` 设为 1,000。

AI SDK 继续用 Zod 对完整输出二次校验。空 content、非法 JSON、字段缺失、过长文本或非法枚举都会视为 Tutor 失败，进入现有重试和恢复流程。

## 5. 核心逻辑修正

### 5.1 初始训练问题

`startTraining` 的初始问题改为模式中性文案：

> 先别查现成答案。请用你自己的话解释：{concept.title}。

它既适用主题直练，也不会改变资料约束模式的训练意图。

### 5.2 错误与幂等文案

将与输入模式耦合的文案改为“学习内容”：

- “AI 尚未配置，你的学习内容已保存”
- “这个创建请求已用于其他学习内容”

不改变 HTTP 状态码、错误码、`resourceId` 和原 Session/Attempt 恢复语义。

### 5.3 Mock Tutor 跨主题行为

Mock Tutor 分为两条确定性路径：

- RAG 示例：主题、知识点或判断基准明确包含 `RAG` / “检索增强生成”时，继续使用现有关键词判断，保证原 E2E 可重复。
- 通用示例：其他主题不再生成 RAG 内容。Mock 只根据回答长度和是否包含关系/原因/边界类表达生成 `unclear / partial / correct`，追问和分级支持引用当前知识点标题，不声称进行了真实知识判断。

Mock 仅用于界面开发和确定性测试，真实知识正确性以 DeepSeek 模式验收为准。

## 6. 数据流与安全

```text
浏览器输入
  → Next.js API 输入校验
  → Session / Training Service 持久化与幂等保护
  → AiTutor 根据 AI_MOCK_MODE 选择 Mock 或 DeepSeek
  → DeepSeek JSON Output
  → Zod 校验
  → 确定性训练状态机
  → 安全的前端响应
```

- 密钥仅在 `createProviderTutor` 的服务端创建阶段读取。
- Prompt 中的主题、资料、问题和回答继续视为不可信数据。
- DeepSeek 原始错误、请求头和密钥不返回前端。
- 服务层保留 Session/Attempt 后再调用 AI，Provider 故障不会丢失用户输入。

## 7. 测试与验收

### 7.1 自动化测试

1. Provider 配置测试：缺少 `DEEPSEEK_API_KEY` 时失败，只有密钥时可使用默认 Base URL 和模型。
2. Provider 请求体测试：确认 thinking disabled、`json_object`、各操作的 `maxOutputTokens` 和不输出密钥。
3. Prompt 测试：三类提示词均包含 JSON 指令和字段示例，资料/主题安全规则不回归。
4. 训练服务测试：初始问题不再假设资料存在。
5. Session 服务测试：配置错误和幂等冲突使用中性文案且保留原恢复语义。
6. Mock Tutor 测试：非 RAG 主题的判断、追问和 Level 1～3 支持不包含 RAG 或外部资料语义；原 RAG E2E 保持通过。
7. 完整回归：lint、typecheck、Vitest、build、桌面/移动 E2E 和视觉巡检全部通过。

### 7.2 真实 DeepSeek 验收

新增一个默认跳过、只在显式命令下运行的 live smoke test。测试通过 `.env.local` 读取密钥，但不输出密钥或原始请求头。

固定验收命令为 `npm run test:deepseek`。该 npm script 使用 Node.js `--env-file=.env.local` 加载本机配置，并只运行 `tests/provider/deepseek-live.test.ts`；密钥缺失时必须明确失败，不能跳过或切换到 Mock。

真实验收顺序：

1. 用“RAG 入门”空资料调用 `extractConcepts`，断言返回 1～10 个通过 Schema 的知识点。
2. 使用第一个知识点调用 `assessAnswer`，断言枚举、数组和单一追问都通过 Schema。
3. 使用 Level 1 调用 `generateSupport`，断言等级一致、内容非空且只生成一个下一问题。

live test 不加入默认 `npm test`，避免 CI 或本地回归意外产生费用。它的成功标准是三次真实调用全部完成，不跳过、不使用 Mock、无 Schema 错误且无密钥泄漏。

## 8. 完成标准

- 用户只需在 `.env.local` 配置 `DEEPSEEK_API_KEY` 并将 `AI_MOCK_MODE=false`，无需配置 Base URL 或选择模型。
- 真实 DeepSeek 模式通过知识点提取、回答判断和 Level 1 支持三步 live smoke。
- 空资料和有资料流程的幂等、重试、并发保护和状态机语义不改变。
- 主题直练界面与服务端不再出现“必然有资料”的错误假设。
- Mock Tutor 可用于非 RAG 主题的界面演示，且不伪装成真实知识裁判。
- 密钥不出现在 Git diff、提交历史、浏览器 bundle、数据库或前端错误中。
