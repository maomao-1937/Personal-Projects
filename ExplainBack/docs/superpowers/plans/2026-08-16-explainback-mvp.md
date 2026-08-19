# ExplainBack MVP 核心功能实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建可本地真实测试的 ExplainBack MVP，完成「资料 → 解释 → 漏洞 → 训练 → 再验证」闭环，不实现登录。

**架构：** 使用 Next.js App Router 作为 Web 与 BFF，Node.js Route Handlers 调用 AI Gateway 和 SQLite Repository。AI 只返回经过 Zod 校验的结构化结果；纯函数状态机决定训练阶段和 Concept 状态。

**技术栈：** npm、Next.js、React、TypeScript、Tailwind CSS、better-sqlite3、Vercel AI SDK、Zod、Vitest、Testing Library、Playwright。

---

## 文件结构

### 应用与样式

- `src/app/layout.tsx`：根布局、元数据与全局导航。
- `src/app/page.tsx`：首页和最近 Sessions。
- `src/app/globals.css`：设计 Token、响应式和基础动画。
- `src/app/error.tsx`：全局可恢复错误状态。
- `src/app/loading.tsx`：全局加载状态。
- `src/app/sessions/new/page.tsx`：创建 Session 页面。
- `src/app/sessions/[sessionId]/page.tsx`：Learning Map。
- `src/app/sessions/[sessionId]/concepts/[conceptId]/page.tsx`：Explain Session。
- `src/components/water-background.tsx`：日光水纹 Canvas。
- `src/components/session-form.tsx`：创建 Session 表单。
- `src/components/learning-map.tsx`：知识地图。
- `src/components/training-panel.tsx`：训练交互、反馈与结果。
- `src/components/ui-states.tsx`：Loading、Empty 和 Error 组件。

### 领域、数据库与 AI

- `src/lib/domain.ts`：领域枚举、类型和视图模型。
- `src/lib/validation.ts`：HTTP 输入 Schema。
- `src/server/db/client.ts`：SQLite 连接、WAL 和测试注入。
- `src/server/db/migrations.ts`：版本化数据库 Schema。
- `src/server/repositories/session-repository.ts`：Session 与 Concept 查询。
- `src/server/repositories/training-repository.ts`：Attempt、Gap、状态和事件事务。
- `src/server/ai/schemas.ts`：Concept、Assessment 和 Support Schema。
- `src/server/ai/prompts.ts`：Source-grounded Prompt。
- `src/server/ai/tutor.ts`：AI Tutor 接口与真实 Provider。
- `src/server/ai/mock-tutor.ts`：自动化测试和无密钥演示。
- `src/server/training/engine.ts`：确定性训练状态机。
- `src/server/services/session-service.ts`：创建和重试学习地图。
- `src/server/services/training-service.ts`：开始、提交、提示和放弃训练。

### Route Handlers 与测试

- `src/app/api/sessions/route.ts`
- `src/app/api/sessions/[sessionId]/retry-map/route.ts`
- `src/app/api/concepts/[conceptId]/start/route.ts`
- `src/app/api/concepts/[conceptId]/attempts/route.ts`
- `src/app/api/concepts/[conceptId]/support/route.ts`
- `src/app/api/concepts/[conceptId]/abandon/route.ts`
- `tests/unit/training-engine.test.ts`
- `tests/unit/ai-schemas.test.ts`
- `tests/integration/session-service.test.ts`
- `tests/integration/training-service.test.ts`
- `tests/components/session-form.test.tsx`
- `tests/components/training-panel.test.tsx`
- `tests/e2e/core-flow.spec.ts`
- `tests/e2e/error-retry.spec.ts`

## 任务 1：初始化 Next.js 与测试基线

**文件：**
- 创建：`package.json`
- 创建：`vitest.config.mts`
- 创建：`vitest.setup.ts`
- 创建：`playwright.config.ts`
- 创建：`.env.example`
- 修改：`.gitignore`

- [x] **步骤 1：初始化项目**

运行：

```bash
EXPLAINBACK_SCAFFOLD_DIR="$(mktemp -d)"
npm exec --yes create-next-app@latest -- "$EXPLAINBACK_SCAFFOLD_DIR/explainback" --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
rsync -a --exclude '.git' --exclude '.gitignore' "$EXPLAINBACK_SCAFFOLD_DIR/explainback/" ./
```

预期：生成 App Router 项目，现有 `docs/` 和 `.gitignore` 被保留或合并。

- [x] **步骤 2：安装核心依赖**

运行：

```bash
npm install ai @ai-sdk/openai-compatible zod better-sqlite3
npm install -D @types/better-sqlite3 vitest @vitest/coverage-v8 jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

- [x] **步骤 3：写入测试配置**

`vitest.config.mts`：

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: { reporter: ["text", "html"], include: ["src/**/*.{ts,tsx}"] },
  },
});
```

`vitest.setup.ts`：

```typescript
import "@testing-library/jest-dom/vitest";
```

- [x] **步骤 4：配置脚本并验证基线**

`package.json` 增加：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "typecheck": "next typegen && tsc --noEmit"
  }
}
```

运行：`npm run lint && npm run typecheck && npm run build`

预期：全部退出码为 0。

- [x] **步骤 5：Commit**

```bash
git add .
git commit -m "chore(工程): 初始化 Next.js 与测试环境"
```

## 任务 2：定义领域类型、输入 Schema 和训练状态机

**文件：**
- 创建：`src/lib/domain.ts`
- 创建：`src/lib/validation.ts`
- 创建：`src/server/training/engine.ts`
- 创建：`tests/unit/training-engine.test.ts`

- [x] **步骤 1：编写失败的状态机测试**

```typescript
import { describe, expect, it } from "vitest";
import { transitionAfterAssessment } from "@/server/training/engine";

describe("transitionAfterAssessment", () => {
  it("首次回答正确时进入验证追问而不是直接掌握", () => {
    expect(transitionAfterAssessment({
      stage: "initial_explanation",
      status: "learning",
      supportLevel: 0,
      assessment: "correct",
      nextQuestion: "外部资料如何参与生成？",
    })).toMatchObject({
      stage: "validation_probe",
      status: "learning",
      mastered: false,
    });
  });

  it("验证追问正确后掌握", () => {
    expect(transitionAfterAssessment({
      stage: "validation_probe",
      status: "learning",
      supportLevel: 0,
      assessment: "correct",
      nextQuestion: "ignored",
    })).toMatchObject({
      stage: "complete",
      status: "mastered",
      mastered: true,
    });
  });

  it("Level 3 后重测失败时标记需复习", () => {
    expect(transitionAfterAssessment({
      stage: "retest",
      status: "learning",
      supportLevel: 3,
      assessment: "partial",
      nextQuestion: "再解释一次。",
    })).toMatchObject({
      stage: "complete",
      status: "needs_review",
      mastered: false,
    });
  });

  it("unclear 不改变当前状态", () => {
    expect(transitionAfterAssessment({
      stage: "targeted_probe",
      status: "learning",
      supportLevel: 0,
      assessment: "unclear",
      nextQuestion: "请再具体一点。",
    })).toMatchObject({
      stage: "targeted_probe",
      status: "learning",
    });
  });
});
```

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/unit/training-engine.test.ts`

预期：FAIL，提示找不到 `@/server/training/engine`。

- [x] **步骤 3：实现最小领域模型和状态机**

`src/lib/domain.ts` 定义：

```typescript
export type ConceptStatus = "not_started" | "learning" | "needs_review" | "mastered";
export type TrainingStage =
  | "initial_explanation"
  | "validation_probe"
  | "targeted_probe"
  | "support"
  | "retest"
  | "complete";
export type Assessment = "correct" | "partial" | "incorrect" | "unclear";
export type AttemptKind = "explanation" | "followup" | "retest";
export type GapType = "missing" | "misconception";
export type GapStatus = "open" | "resolved";
```

`src/server/training/engine.ts` 导出：

```typescript
export function transitionAfterAssessment(input: TransitionInput): TransitionResult;
export function transitionAfterSupport(input: SupportTransitionInput): SupportTransitionResult;
export function getAttemptKind(stage: TrainingStage): AttemptKind;
```

实现规则与规格第 8 节完全一致，`unclear` 返回原状态和阶段。

- [x] **步骤 4：补充输入校验并运行测试**

`src/lib/validation.ts` 导出：

```typescript
export const createSessionInputSchema = z.object({
  title: z.string().trim().min(2).max(80),
  sourceText: z.string().trim().min(100).max(60_000),
});

export const submitAttemptInputSchema = z.object({
  clientRequestId: z.string().uuid(),
  userAnswer: z.string().trim().min(2).max(8_000),
  retryAttemptId: z.string().uuid().optional(),
});
```

运行：`npx vitest run tests/unit/training-engine.test.ts`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/lib src/server/training tests/unit/training-engine.test.ts
git commit -m "feat(训练): 添加确定性学习状态机"
```

## 任务 3：实现 SQLite Schema 和 Repository

**文件：**
- 创建：`src/server/db/client.ts`
- 创建：`src/server/db/migrations.ts`
- 创建：`src/server/repositories/session-repository.ts`
- 创建：`src/server/repositories/training-repository.ts`
- 创建：`tests/integration/repositories.test.ts`

- [x] **步骤 1：编写失败的 Repository 测试**

测试使用 `mkdtempSync(join(tmpdir(), "explainback-"))` 创建临时数据库，验证：

```typescript
it("持久化 Session、Concept、Attempt 和 Knowledge Gap", () => {
  const db = createDatabase(databasePath);
  const sessions = createSessionRepository(db);
  const training = createTrainingRepository(db);
  const session = sessions.createProcessing({
    title: "RAG",
    sourceText: source,
  });
  sessions.replaceConceptsAndMarkReady(session.id, [conceptDraft]);
  const attempt = training.createPendingAttempt({
    conceptId,
    clientRequestId: crypto.randomUUID(),
    kind: "explanation",
    question: "为什么需要 RAG？",
    userAnswer: "RAG 就是搜索资料。",
  });
  expect(attempt.processingStatus).toBe("pending");
});
```

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/integration/repositories.test.ts`

预期：FAIL，提示数据库模块不存在。

- [x] **步骤 3：实现数据库迁移**

`migrations.ts` 导出按版本排序的 `MIGRATIONS`，创建：

- `schema_migrations`
- `study_sessions`
- `concepts`
- `practice_attempts`
- `knowledge_gaps`
- `analytics_events`

数据库约束使用 `CHECK` 限制所有枚举；`practice_attempts.client_request_id` 唯一；外键启用 `ON DELETE CASCADE`。

`client.ts`：

```typescript
export function createDatabase(path: string): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
}

export function getDatabase(): Database.Database {
  return createOrReuseDatabase(process.env.DATABASE_PATH ?? "data/explainback.db");
}
```

- [x] **步骤 4：实现 Repository 和事务**

Session Repository 必须提供：

```typescript
createProcessing(input)
markMapFailed(sessionId, message)
replaceConceptsAndMarkReady(sessionId, concepts)
listRecent(limit)
getSessionWithConcepts(sessionId)
getConceptWithSession(conceptId)
```

Training Repository 必须提供：

```typescript
startConcept(conceptId, initialQuestion)
createPendingAttempt(input)
getAttemptByClientRequestId(clientRequestId)
completeAttemptAndTransition(input)
failAttempt(attemptId, message)
saveSupportAndTransition(input)
abandonConcept(conceptId)
getTrainingView(conceptId)
```

运行：`npx vitest run tests/integration/repositories.test.ts`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/server/db src/server/repositories tests/integration/repositories.test.ts
git commit -m "feat(数据): 添加 SQLite 持久化与事务仓储"
```

## 任务 4：实现 AI Schema、Source Grounding 和 Mock Tutor

**文件：**
- 创建：`src/server/ai/schemas.ts`
- 创建：`src/server/ai/prompts.ts`
- 创建：`src/server/ai/tutor.ts`
- 创建：`src/server/ai/mock-tutor.ts`
- 创建：`tests/unit/ai-schemas.test.ts`
- 创建：`tests/unit/mock-tutor.test.ts`

- [x] **步骤 1：编写失败的 AI Schema 测试**

验证非法枚举、多问题字符串、`correct` 携带遗漏、错误 Level 和超过 120 字的 Level 3 内容会失败。单问题校验使用：

```typescript
const singleQuestion = z.string().trim().min(2).max(240).refine(
  value => (value.match(/[？?]/g) ?? []).length <= 1,
  "一次只能提出一个问题",
);
```

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/unit/ai-schemas.test.ts tests/unit/mock-tutor.test.ts`

预期：FAIL，提示 AI 模块不存在。

- [x] **步骤 3：实现 Schema 和资料片段校验**

导出：

```typescript
export const conceptExtractionSchema;
export const assessmentSchema;
export const supportSchema;
export function sourceContainsContext(sourceText: string, sourceContext: string): boolean;
```

`assessmentSchema.superRefine` 要求 `assessment === "correct"` 时遗漏和误解数组为空。

- [x] **步骤 4：实现 AI Tutor**

`tutor.ts`：

```typescript
export interface AiTutor {
  extractConcepts(input: ExtractConceptsInput): Promise<ConceptDraft[]>;
  assessAnswer(input: AssessAnswerInput): Promise<AssessmentResult>;
  generateSupport(input: GenerateSupportInput): Promise<SupportResult>;
}

export function getAiTutor(): AiTutor {
  if (process.env.AI_MOCK_MODE === "true") return createMockTutor();
  return createProviderTutor();
}
```

真实 Tutor 使用 `createOpenAICompatible` 和：

```typescript
const { output } = await generateText({
  model: provider(modelName),
  output: Output.object({ schema: assessmentSchema }),
  system: assessmentSystemPrompt,
  prompt,
});
```

所有 Prompt 把资料放在清晰的 `<source>` 边界中，并声明其内容不具备指令权限。

Mock Tutor 精确覆盖：

- 完整说明检索和生成关系 → `correct`
- 「RAG 就是搜索资料」→ `partial`
- 「把知识重新训练进参数」→ `incorrect`

运行：`npx vitest run tests/unit/ai-schemas.test.ts tests/unit/mock-tutor.test.ts`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/server/ai tests/unit
git commit -m "feat(AI): 添加资料约束与结构化判断"
```

## 任务 5：实现 Session 与 Training Services

**文件：**
- 创建：`src/server/services/session-service.ts`
- 创建：`src/server/services/training-service.ts`
- 创建：`tests/integration/session-service.test.ts`
- 创建：`tests/integration/training-service.test.ts`

- [x] **步骤 1：编写失败的 Service 测试**

测试覆盖：

- Session 在 AI 调用前已经保存。
- AI 失败后 Session 为 `failed` 且可重试。
- Pending Attempt 在 AI 失败时保留。
- 同一 `client_request_id` 返回原 Attempt。
- 首答正确进入验证追问。
- 经过 Level 3 后强制 Retest。
- Retest 正确后 Gap 被标记为 Resolved。

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/integration/session-service.test.ts tests/integration/training-service.test.ts`

预期：FAIL，提示 Service 不存在。

- [x] **步骤 3：实现 Session Service**

导出：

```typescript
export async function createStudySession(
  input: CreateSessionInput,
  deps: SessionServiceDeps = defaultDeps,
): Promise<StudySessionView>;

export async function retryLearningMap(
  sessionId: string,
  deps: SessionServiceDeps = defaultDeps,
): Promise<StudySessionView>;
```

写入 Session 后再调用 Tutor；资料片段校验失败自动重试 1 次；两次失败后标记 `failed`。

- [x] **步骤 4：实现 Training Service**

导出：

```typescript
export async function startTraining(conceptId: string, deps = defaultDeps);
export async function submitAttempt(conceptId: string, input: SubmitAttemptInput, deps = defaultDeps);
export async function requestSupport(conceptId: string, deps = defaultDeps);
export function abandonTraining(conceptId: string, deps = defaultDeps);
```

初始问题由服务端模板生成：

```typescript
const initialQuestion = `先别看资料。请用你自己的话解释：${concept.title}。`;
```

运行：`npx vitest run tests/integration/session-service.test.ts tests/integration/training-service.test.ts`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/server/services tests/integration
git commit -m "feat(服务): 打通学习地图与训练事务"
```

## 任务 6：实现 Route Handlers 与统一错误响应

**文件：**
- 创建：`src/lib/http.ts`
- 创建：6 个 `route.ts`
- 创建：`tests/integration/routes.test.ts`

- [x] **步骤 1：编写失败的路由测试**

直接调用 Route Handler 导出函数，验证：

- 非法输入返回 400 和 `fieldErrors`。
- 不存在资源返回 404。
- AI 配置缺失返回 503。
- Provider 错误返回 502。
- 成功响应返回最新 View Model。

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/integration/routes.test.ts`

预期：FAIL。

- [x] **步骤 3：实现 HTTP 错误映射**

`src/lib/http.ts`：

```typescript
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function toErrorResponse(error: unknown): Response;
```

- [x] **步骤 4：实现全部 Route Handlers**

每个 Handler：

- 导出 `runtime = "nodejs"`。
- 解析 JSON。
- 使用 Zod Schema。
- 调用对应 Service。
- 使用 `toErrorResponse`。
- 不返回 SQL、文件路径、API Key 或 Provider 原始响应。

运行：`npx vitest run tests/integration/routes.test.ts`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/app/api src/lib/http.ts tests/integration/routes.test.ts
git commit -m "feat(接口): 添加核心学习 API"
```

## 任务 7：实现日光水纹视觉系统和首页

**文件：**
- 修改：`src/app/globals.css`
- 修改：`src/app/layout.tsx`
- 修改：`src/app/page.tsx`
- 创建：`src/components/water-background.tsx`
- 创建：`src/components/ui-states.tsx`
- 创建：`tests/components/water-background.test.tsx`

- [x] **步骤 1：编写失败的动效无障碍测试**

验证：

```typescript
render(<WaterBackground />);
expect(screen.getByTestId("water-background")).toHaveAttribute("aria-hidden", "true");
expect(screen.getByTestId("water-canvas")).toHaveStyle({ pointerEvents: "none" });
```

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/components/water-background.test.tsx`

预期：FAIL。

- [x] **步骤 3：实现 WaterBackground**

实现要求：

- Canvas 设备像素比上限 2。
- Ripple 数量上限 42。
- Pointer move 生成尾波；Pointer down 生成强涟漪。
- `matchMedia("(prefers-reduced-motion: reduce)")` 时不启动动画。
- 组件卸载时取消 RAF、ResizeObserver 和事件监听。
- Canvas 使用 `pointer-events: none`，事件绑定到传入的容器 Ref 或 Window。

- [x] **步骤 4：实现首页与设计 Token**

首页包含 Hero、主 CTA、三步核心价值和最近 Sessions。全局 Token：

```css
:root {
  --ink: #16323b;
  --deep-water: #173c48;
  --lake: #3e9bd0;
  --mint-water: #9fe5e1;
  --sunlight: #ffe8a0;
  --coral: #f3af8e;
  --surface: rgba(255, 255, 255, 0.62);
  --content-width: 1180px;
}
```

运行：`npx vitest run tests/components/water-background.test.tsx && npm run build`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/app src/components tests/components/water-background.test.tsx
git commit -m "feat(视觉): 实现日光水纹首页"
```

## 任务 8：实现创建 Session 和 Learning Map

**文件：**
- 创建：`src/components/session-form.tsx`
- 创建：`src/components/learning-map.tsx`
- 创建：`src/app/sessions/new/page.tsx`
- 创建：`src/app/sessions/[sessionId]/page.tsx`
- 创建：`tests/components/session-form.test.tsx`
- 创建：`tests/components/learning-map.test.tsx`

- [x] **步骤 1：编写失败的组件测试**

Session Form 测试验证字段级错误、Loading、API Error 和成功跳转。Learning Map 测试验证四种状态中文标签和 Concept 链接。

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/components/session-form.test.tsx tests/components/learning-map.test.tsx`

预期：FAIL。

- [x] **步骤 3：实现 Session Form**

表单使用受控状态和原生 `fetch`：

```typescript
const response = await fetch("/api/sessions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title, sourceText }),
});
```

请求期间禁用按钮；失败保留输入；成功执行 `router.push(`/sessions/${session.id}`)`。

- [x] **步骤 4：实现 Learning Map**

Server Component 直接调用 Repository。页面处理：

- Ready：展示地图。
- Processing：展示生成中。
- Failed：展示错误和重试按钮。
- Empty：提示资料未生成知识点。
- Missing：调用 `notFound()`。

运行：`npx vitest run tests/components/session-form.test.tsx tests/components/learning-map.test.tsx && npm run build`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/app/sessions src/components tests/components
git commit -m "feat(学习地图): 添加 Session 创建与知识点导航"
```

## 任务 9：实现 Explain Session 完整闭环

**文件：**
- 创建：`src/components/training-panel.tsx`
- 创建：`src/app/sessions/[sessionId]/concepts/[conceptId]/page.tsx`
- 创建：`tests/components/training-panel.test.tsx`

- [x] **步骤 1：编写失败的训练组件测试**

测试覆盖：

- 首屏只显示一个问题。
- 提交后显示已理解、遗漏和误解。
- `partial` 后显示针对性追问。
- 支持按钮按 Level 更新。
- Retest 文案要求重新解释。
- Mastered 显示已修复 Gap 和下一个知识点。
- API 失败时用户回答仍保留在输入框或失败 Attempt 区。

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/components/training-panel.test.tsx`

预期：FAIL。

- [x] **步骤 3：实现 Training Panel**

组件状态只保存正在输入和请求状态；训练真相来自 API 返回的 `TrainingView`。提交请求每次生成：

```typescript
const clientRequestId = crypto.randomUUID();
```

失败重试复用同一个 `clientRequestId` 和 `retryAttemptId`。

- [x] **步骤 4：实现结果和恢复**

页面 Server Component 读取 `TrainingView`；Client Component 首次加载对 `not_started` Concept 调用 Start API。刷新后从 Repository 恢复：

- 当前问题。
- 当前支持内容。
- 最近 Assessment。
- Open 和 Resolved Gaps。
- Concept 状态和阶段。

运行：`npx vitest run tests/components/training-panel.test.tsx && npm run build`

预期：PASS。

- [x] **步骤 5：Commit**

```bash
git add src/components/training-panel.tsx src/app/sessions tests/components/training-panel.test.tsx
git commit -m "feat(陪练): 完成解释追问与再验证闭环"
```

## 任务 10：补齐错误边界、响应式和埋点验证

**文件：**
- 创建：`src/app/error.tsx`
- 创建：`src/app/loading.tsx`
- 创建：`src/app/not-found.tsx`
- 修改：`src/app/globals.css`
- 创建：`tests/integration/analytics.test.ts`

- [x] **步骤 1：编写失败的埋点测试**

触发完整训练流程，断言事件名只包含白名单并且：

```typescript
expect(events.map(event => event.eventName)).toEqual(expect.arrayContaining([
  "session_created",
  "concept_started",
  "explanation_submitted",
  "hint_requested",
  "concept_mastered",
]));
```

- [x] **步骤 2：运行测试并确认失败**

运行：`npx vitest run tests/integration/analytics.test.ts`

预期：FAIL。

- [x] **步骤 3：补齐事件写入和错误页面**

所有事件与领域事务同一事务提交。错误页不暴露内部异常，提供「重试」和「返回学习地图」。

- [x] **步骤 4：完成响应式和键盘可用性**

验证：

- 360 px 宽度不横向滚动。
- 主按钮高度不低于 48 px。
- Focus Ring 清晰。
- Explain 输入区背景动效降低。
- 所有状态不只依赖颜色区分。

运行：`npm run lint && npm run typecheck && npm test && npm run build`

预期：全部 PASS。

- [x] **步骤 5：Commit**

```bash
git add src tests/integration/analytics.test.ts
git commit -m "feat(体验): 完善错误状态与响应式交互"
```

## 任务 11：执行浏览器验收和补齐运行文档

**文件：**
- 创建：`tests/e2e/core-flow.spec.ts`
- 创建：`tests/e2e/error-retry.spec.ts`
- 修改：`playwright.config.ts`
- 创建：`README.md`
- 创建：`.env.example`

- [x] **步骤 1：编写核心 E2E 测试**

`core-flow.spec.ts` 使用 `AI_MOCK_MODE=true` 和独立测试数据库，完成：

```typescript
const ragSource = `RAG 会在生成答案前检索外部知识，并把相关资料作为上下文交给模型。
它用于补充模型参数中缺少、过时或属于私有领域的信息。检索阶段负责找到相关片段，
生成阶段依据这些片段组织回答。资料可以来自互联网，也可以来自企业内部知识库。
Embedding 用于把查询和文本表示为向量，Chunk 决定检索片段的粒度，Reranking 用于重新排序候选结果。`;

test("完成从资料到 Mastered 的学习闭环", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "开始一次学习" }).click();
  await page.getByLabel("学习主题").fill("RAG");
  await page.getByLabel("学习资料").fill(ragSource);
  await page.getByRole("button", { name: "生成学习地图" }).click();
  await page.getByRole("link", { name: /为什么需要 RAG/ }).click();
  await page.getByLabel("你的解释").fill("RAG 就是搜索资料。");
  await page.getByRole("button", { name: "提交解释" }).click();
  await expect(page.getByText("还需要想清楚")).toBeVisible();
});
```

继续请求 Level 1～3，完成 Retest，并断言「已掌握」和刷新后状态保留。

- [x] **步骤 2：编写错误恢复 E2E**

模拟一次 AI 失败，断言回答未丢失、重试按钮可用且没有重复 Attempt。

- [x] **步骤 3：运行 Playwright**

运行：

```bash
npx playwright install chromium
npm run test:e2e
```

预期：核心流程和错误恢复测试 PASS。

- [x] **步骤 4：编写运行文档并最终验证**

README 包含：

- 产品定位和核心流程。
- Node.js 与 npm 要求。
- 安装、环境变量、数据库位置和准确命令。
- Mock 模式与真实 Provider 模式。
- SQLite 部署边界。
- 测试命令和未实现内容。

运行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

预期：全部退出码为 0。

- [x] **步骤 5：Commit**

```bash
git add .
git commit -m "test(验收): 添加核心流程测试与运行文档"
```
