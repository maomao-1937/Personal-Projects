# ExplainBack MVP 设计规格

## 1. 产品目标

ExplainBack 用「主动解释」代替「被动总结」。用户粘贴刚学过的资料，AI 先要求用户用自己的话解释，再依据资料发现遗漏或误解，通过一次一个问题的追问、分级提示和重新解释完成训练闭环。

MVP 只验证以下假设：

> 用户主动讲解，再由 AI 诊断知识漏洞，是否比 AI 总结更能帮助用户判断自己真正掌握了什么。

## 2. 本轮范围

### 2.1 必须完成

- 创建学习 Session，输入主题和文本或 Markdown 资料。
- 保存原始资料，再生成 5～10 个核心知识点。
- 展示知识地图和「未学习、学习中、需复习、已掌握」四种状态。
- 首次进入知识点时，AI 不讲答案，只要求用户解释。
- 保存每次用户回答，返回经过 Schema 校验的结构化判断。
- 基于当前回答一次只追问一个问题。
- 识别知识遗漏和误解，持久化 Knowledge Gap。
- 支持「追问 → 提示 → 对比 → 简短解释 → 重新解释」。
- 通过验证追问或重新解释后，才能标记为「已掌握」。
- 页面刷新后数据不丢失。
- 保存 7 个核心埋点。
- 提供 Loading、Empty 和 Error 状态。
- 完成响应式 Web 页面和核心浏览器测试。

### 2.2 本轮不做

- 登录、注册、User 表和权限控制。
- PDF、视频、YouTube 或第三方内容导入。
- Flashcards、Anki、题库、社区、排行榜、XP 和签到。
- 向量数据库、复杂 RAG、LangChain、LangGraph 和多 Agent。
- 支付、移动 App、复杂 Analytics Dashboard。
- 面向 Serverless 的正式部署方案。

登录仅在核心闭环经用户核验后进入下一阶段。

## 3. 技术架构

### 3.1 技术栈

- 包管理：npm。
- Web 框架：当前稳定版 Next.js App Router、React 和 TypeScript。
- 样式：Tailwind CSS；核心视觉组件自建，不引入完整组件库。
- API：Next.js Route Handlers，运行在 Node.js Runtime。
- 数据库：SQLite 和 `better-sqlite3`，启用 WAL。
- 数据迁移：版本化 SQL Migration 和 `schema_migrations` 表。
- AI：Vercel AI SDK、`@ai-sdk/openai-compatible` 和 Zod。
- 单元及组件测试：Vitest、Testing Library。
- 浏览器测试：Playwright。
- 代码质量：ESLint、TypeScript 严格模式。

本机 Node.js v24.18.0 满足 Next.js 的运行要求。`better-sqlite3` 适合单机 MVP，但需要持久磁盘；本轮不把它包装成可在无状态 Serverless 环境持久化的方案。

### 3.2 系统边界

```text
浏览器页面
  ↓ fetch
Next.js Route Handler
  ├─ Zod 输入校验
  ├─ 训练状态机
  ├─ AI Gateway
  └─ SQLite Repository
```

页面只负责展示和收集输入。AI 负责提取和判断；状态机负责决定训练阶段和掌握状态；Repository 负责事务和持久化。

### 3.3 不引入的技术

不引入 ORM、全局状态库、消息队列、Redis、向量库或独立后端服务。数据量和并发量不足以证明这些依赖的必要性。

## 4. 页面与路由

### 4.1 Home：`/`

- 品牌主张：Learn by explaining.
- 主按钮：开始一次学习。
- 最近 Sessions：标题、知识点进度、创建时间和继续入口。
- Empty 状态：没有 Session 时只显示一个清晰入口。

### 4.2 Create Session：`/sessions/new`

- 学习主题：2～80 个字符。
- 学习资料：100～60,000 个字符，支持纯文本和 Markdown。
- 提交后先保存 Session，再调用 AI 生成知识地图。
- 生成状态：`processing / ready / failed`。
- 失败时保留主题和资料，可原地重试，不创建重复 Session。

### 4.3 Learning Map：`/sessions/[sessionId]`

- 展示 Session 标题、概念状态和整体完成数量，不显示百分制掌握度。
- 概念按 `sort_order` 排序。
- 点击概念进入训练。
- Session 生成失败时显示重试入口。

### 4.4 Explain Session：`/sessions/[sessionId]/concepts/[conceptId]`

- 顶部显示面包屑、概念标题、阶段和状态。
- 主区域一次只显示一个 AI 问题。
- 提交回答后展示「已经理解、还需想清楚、存在误解」。
- 提示按钮按当前训练阶段显示。
- 训练完成直接在同一路由显示结果，不新增第 5 个页面。
- 结果区展示已掌握点、已修复漏洞、未解决漏洞和下一个知识点。

## 5. 视觉与交互

### 5.1 视觉方向

采用已确认的「日光水纹」：

- 暖白、湖蓝、日光黄和少量珊瑚橙。
- 背景包含持续流动的水底焦散。
- 鼠标移动生成短暂尾波。
- 鼠标停留或点击生成椭圆涟漪。
- 内容卡片保持半透明浅色，文字对比度不低于 4.5:1。
- 点击目标不小于 44 px；移动端主要按钮不小于 48 px。

### 5.2 动效边界

- Canvas 的设备像素比最多为 2。
- 同时存在的水纹最多为 42 个。
- 动效层不接收点击，不遮挡表单。
- `prefers-reduced-motion` 下关闭 Canvas 尾波和自动漂移。
- 移动端以轻触涟漪代替持续指针跟随。
- Explain Session 输入区降低背景动态强度，优先保证阅读和输入。

### 5.3 视觉参数

- 页面最大宽度：1180 px。
- 内容圆角：12～20 px；大容器圆角：28 px。
- 页面左右边距：桌面 32 px，移动端 20 px。
- 主要文字：`#16323B`。
- 主操作色：`#173C48`。
- 湖蓝：`#3E9BD0`。
- 水绿：`#9FE5E1`。
- 日光黄：`#FFE8A0`。
- 珊瑚橙：`#F3AF8E`。

## 6. 数据模型

所有 ID 使用 UUID 字符串，时间使用 ISO 8601 UTC 字符串。JSON 数组以 JSON 文本存储，Repository 负责解析和校验。

### 6.1 `study_sessions`

- `id`
- `title`
- `source_text`
- `map_status`：`processing / ready / failed`
- `map_error`
- `created_at`
- `updated_at`

### 6.2 `concepts`

- `id`
- `session_id`
- `title`
- `description`
- `source_context`
- `status`：`not_started / learning / needs_review / mastered`
- `training_stage`：`initial_explanation / validation_probe / targeted_probe / support / retest / complete`
- `support_level`：`0 / 1 / 2 / 3`
- `current_question`
- `current_support_content`
- `sort_order`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

### 6.3 `practice_attempts`

- `id`
- `concept_id`
- `client_request_id`，全局唯一。
- `kind`：`explanation / followup / retest`
- `question`
- `user_answer`
- `processing_status`：`pending / completed / failed`
- `assessment`：`correct / partial / incorrect / unclear`
- `understood_points_json`
- `missing_points_json`
- `misconceptions_json`
- `next_question`
- `error_message`
- `created_at`
- `updated_at`

### 6.4 `knowledge_gaps`

- `id`
- `concept_id`
- `gap_type`：`missing / misconception`
- `description`
- `status`：`open / resolved`
- `first_detected_attempt_id`
- `resolved_at`
- `created_at`
- `updated_at`

同一 Concept 下相同类型和标准化描述的未解决 Gap 不重复创建。Concept 通过最终验证时，当前未解决 Gap 标记为 `resolved`。

### 6.5 `analytics_events`

- `id`
- `session_id`
- `concept_id`
- `event_name`
- `properties_json`
- `created_at`

事件名只允许：`session_created`、`concept_started`、`explanation_submitted`、`followup_answered`、`hint_requested`、`concept_mastered`、`concept_abandoned`。

## 7. AI 结构化输出

### 7.1 知识点提取

AI 返回：

```json
{
  "concepts": [
    {
      "title": "为什么需要 RAG",
      "description": "理解 RAG 解决的知识边界问题",
      "source_context": "资料中与该知识点直接相关的内容"
    }
  ]
}
```

约束：

- 数量为 5～10 个；资料不足时允许 1～4 个。
- 不补充资料没有覆盖的知识点。
- `source_context` 必须是原始资料中的短原文片段，最长 2,000 个字符。
- 服务端按标准化空白验证 `source_context` 确实存在于原始资料中；验证失败时自动重试 1 次。
- 资料内容按不可信输入处理，忽略其中要求模型改变任务的指令。

### 7.2 回答判断

```json
{
  "assessment": "partial",
  "understood_points": ["知道 RAG 包含检索和生成"],
  "missing_points": ["没有解释检索内容如何参与生成"],
  "misconceptions": [],
  "next_question": "搜索到资料以后，它和最终答案是什么关系？"
}
```

约束：

- `assessment` 只允许 `correct / partial / incorrect / unclear`。
- `next_question` 是单个字符串，不允许问题列表。
- 评价只使用 `source_context` 和 Session 资料。
- 资料不足以判断时返回 `unclear`。
- UI 不直接展示模型原始文本，只展示校验后的结构化字段。

### 7.3 分级支持

AI 返回：

```json
{
  "level": 1,
  "content": "想一下：模型原有训练数据不知道今天的新闻时，会发生什么？",
  "next_question": "这种情况下，在回答前加入最新资料能解决什么问题？"
}
```

约束：

- `level` 必须与服务端请求的等级一致。
- Level 1 只提供启发线索；Level 2 提供选择或对比；Level 3 提供不超过 120 个汉字的核心解释。
- `next_question` 始终只有一个问题。
- 返回结果写入 Concept 的 `current_support_content` 和 `current_question`，刷新页面后仍可恢复。

### 7.4 AI Provider

通过以下环境变量配置：

- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`
- `AI_MOCK_MODE`

`AI_MOCK_MODE=true` 仅用于自动化测试和无密钥的本地演示。真实模式缺少环境变量时，API 返回可恢复错误。

## 8. 训练状态机

```text
not_started
  ↓ 打开
learning / initial_explanation
  ├─ correct → validation_probe
  │               ├─ correct → mastered / complete
  │               └─ 其他 → targeted_probe
  └─ partial 或 incorrect → targeted_probe
                                  ↓ 仍未理解
                             support level 1
                                  ↓ 仍未理解
                             support level 2
                                  ↓ 仍未理解
                             support level 3
                                  ↓
                               retest
                                  ├─ correct → mastered / complete
                                  └─ 其他 → needs_review
```

规则：

1. 首次 `correct` 不直接掌握，必须通过一个验证追问。
2. `unclear` 不降低状态，继续要求澄清。
3. AI 不返回 Concept 状态；状态由纯函数根据当前阶段、判断和历史计算。
4. Level 1 提供启发线索；Level 2 提供选择或对比；Level 3 给出简短解释。
5. Level 3 之后必须进入 `retest`。
6. 用户主动退出未完成训练时，Concept 变为 `needs_review`。
7. 用户重新进入 `needs_review` 时回到 `learning`，保留历史 Gap。
8. `mastered` 后重新训练若出现明确误解，则降为 `needs_review`。

## 9. 请求和事务流程

### 9.1 创建 Session

1. Zod 校验输入。
2. 写入 `study_sessions`，状态为 `processing`。
3. 写入 `session_created`。
4. 调用 AI 提取 Concepts。
5. 在单个事务中写入 Concepts，并把 Session 改为 `ready`。
6. 失败时把 Session 改为 `failed`，保存可公开错误信息。
7. 重试时复用原 Session，先删除该 Session 尚未开始训练的旧 Concepts，再重新生成。

### 9.2 提交回答

1. 校验 Concept、问题和回答。
2. 以 `client_request_id` 去重。
3. 先写入 `pending` Attempt，保证用户回答不丢失。
4. 调用 AI 并校验结构化输出。
5. 在单个事务中更新 Attempt、Knowledge Gaps、Concept 阶段和状态。
6. AI 失败时把 Attempt 改为 `failed`，保留回答并允许重试。
7. 重试复用原 Attempt ID，不重复记录埋点。

### 9.3 请求提示

1. 读取 Concept 当前阶段和 `support_level`。
2. Level 1 和 Level 2 由 AI 基于资料、问题和失败回答生成。
3. Level 3 返回简短解释，并把阶段切换为 `retest`。
4. 在事务中保存 `current_support_content`、`current_question`、`support_level` 和新阶段。
5. 每次请求记录 `hint_requested`。
6. 返回内容只能包含一个训练任务。

## 10. 错误处理

- 输入错误：HTTP 400，返回字段级错误。
- 资源不存在：HTTP 404。
- 重复请求：返回原 Attempt，不重复执行。
- AI 配置缺失：HTTP 503，保留用户输入。
- AI 超时或 Provider 错误：HTTP 502，允许重试。
- AI Schema 校验失败：最多自动重试 1 次；再次失败后返回 HTTP 502。
- 数据库错误：HTTP 500；UI 显示通用错误，不泄露路径或 SQL。
- 页面错误边界提供返回学习地图和重试入口。
- 所有按钮在请求期间禁用，避免重复提交。

## 11. API 边界

- `POST /api/sessions`：创建 Session 并生成地图。
- `POST /api/sessions/[sessionId]/retry-map`：重试生成地图。
- `POST /api/concepts/[conceptId]/start`：开始或恢复训练。
- `POST /api/concepts/[conceptId]/attempts`：提交回答或重试失败 Attempt。
- `POST /api/concepts/[conceptId]/support`：请求下一等级提示。
- `POST /api/concepts/[conceptId]/abandon`：结束本次训练并标记需复习。

读取页面数据由 Server Component 直接调用 Repository，不从服务端再次请求自身 API。

## 12. 测试策略

### 12.1 单元测试

- 状态机的所有状态转移。
- `correct` 首答不会直接 Mastered。
- Level 3 之后强制 Retest。
- `unclear` 不惩罚用户。
- Zod Schema 拒绝多问题和非法枚举。
- Knowledge Gap 去重和解决。
- Analytics 事件白名单。
- Session 与回答输入边界。

### 12.2 集成测试

- Session 先持久化，再生成 Concepts。
- AI 失败后 Session 可重试。
- Attempt 在 AI 失败时仍保留。
- `client_request_id` 保证幂等。
- 三个指定 RAG Case 的结构化判断和状态变化。

### 12.3 浏览器测试

使用 Mock AI 和临时 SQLite：

1. 创建 Session。
2. 生成知识地图。
3. 进入 Concept 并提交不完整回答。
4. 查看针对性追问。
5. 请求 Level 1～3 支持。
6. 重新解释并完成 Mastered。
7. 刷新页面确认状态和历史保留。
8. 验证移动端主要页面。
9. 验证 AI 错误和重试。

最终必须通过 `npm run lint`、`npm test`、`npm run build` 和 Playwright 核心流程。

## 13. 验收标准

核心功能完成后交给用户核验，不继续实现登录。交付时说明：

- 已实现功能。
- 主要文件及职责。
- 当前产品流程。
- AI 判断和状态机逻辑。
- 准确运行命令和环境变量。
- 自动化测试结果。
- 暂未实现内容。
- 最多 3 个下一阶段建议。
