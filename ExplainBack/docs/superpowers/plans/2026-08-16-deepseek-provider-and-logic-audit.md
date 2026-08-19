# ExplainBack DeepSeek Provider 与核心逻辑修正实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 ExplainBack 只配置 DeepSeek API 密钥即可运行真实 AI 流程，并修正双模式残留文案与 Mock Tutor 跨主题错配。

**架构：** 保留现有 `AiTutor` 边界和 OpenAI-compatible SDK，在 `tutor.ts` 内将真实 Provider 收敛为固定 DeepSeek V4 Flash 非思考模式。三类 AI 调用继续使用 AI SDK `Output.object` + Zod，补齐 DeepSeek JSON Output 必需的 Prompt 指令和输出上限。业务服务仅修正模式中性语义，不改状态机、幂等、并发 CAS 或恢复逻辑。

**技术栈：** Next.js 16、React 19、TypeScript、AI SDK 7、`@ai-sdk/openai-compatible` 3、DeepSeek OpenAI-compatible API、Zod 4、Vitest、Playwright、SQLite。

---

## 文件结构

- 修改：`src/server/ai/tutor.ts`——固定 DeepSeek 配置、非思考请求体、分操作输出上限与可测试 Provider 工厂。
- 修改：`src/server/ai/prompts.ts`——三类输出补充 DeepSeek JSON 指令和字段示例。
- 修改：`src/server/services/training-service.ts`——将初始训练问题改为不假设资料存在。
- 修改：`src/server/services/session-service.ts`——将配置失败和幂等冲突文案改为“学习内容”。
- 修改：`src/server/ai/mock-tutor.ts`——保留 RAG 确定性路径，为非 RAG 主题增加通用模拟判断和支持。
- 修改：`.env.example`——只暴露 `DEEPSEEK_API_KEY`，移除用户级 Base URL/模型配置。
- 修改：`package.json`——新增显式付费验收命令 `test:deepseek`。
- 修改：`README.md`——更新 DeepSeek 本地配置与 live smoke 说明。
- 修改：`tests/unit/ai-tutor.test.ts`——验证固定模型、请求体、JSON 模式、token 上限和密钥边界。
- 修改：`tests/unit/ai-schemas.test.ts`——验证三类 Prompt 的 JSON 要求。
- 修改：`tests/unit/mock-tutor.test.ts`——验证非 RAG 主题不泄漏 RAG 语义。
- 修改：`tests/integration/training-service.test.ts`——验证模式中性初始问题。
- 修改：`tests/integration/session-service.test.ts`——验证中性配置/幂等错误文案。
- 创建：`tests/provider/deepseek-live.test.ts`——三步真实 DeepSeek API 验收，默认跳过。

---

### 任务 1：将真实 AI Provider 收敛为 DeepSeek

**文件：**
- 修改：`src/server/ai/tutor.ts`
- 修改：`tests/unit/ai-tutor.test.ts`

- [ ] **步骤 1：为 DeepSeek 配置和请求体编写失败测试**

将 `tests/unit/ai-tutor.test.ts` 的 import 扩展为：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AiConfigurationError,
  createProviderTutor,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
  DEFAULT_AI_TIMEOUT_MS,
  getAiTimeoutMs,
  getDeepSeekConfig,
} from "@/server/ai/tutor";
```

在超时测试后增加：

```ts
describe("DeepSeek provider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("只需密钥即可使用固定地址和模型", () => {
    expect(getDeepSeekConfig("sk-unit-test")).toEqual({
      apiKey: "sk-unit-test",
      baseURL: "https://api.deepseek.com",
      modelName: "deepseek-v4-flash",
    });
    expect(DEEPSEEK_BASE_URL).toBe("https://api.deepseek.com");
    expect(DEEPSEEK_MODEL).toBe("deepseek-v4-flash");
    expect(() => getDeepSeekConfig("  ")).toThrowError(AiConfigurationError);
  });

  it("三类请求都使用 json_object、非思考模式和分级 token 上限", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const outputs = [
      {
        concepts: [
          {
            title: "RAG 的核心流程",
            description: "理解检索与生成的关系",
            source_context: "RAG 通常先检索信息，再将结果用于生成。",
          },
        ],
      },
      {
        assessment: "partial",
        understood_points: ["知道要检索"],
        missing_points: ["未说明生成关系"],
        misconceptions: [],
        next_question: "检索结果如何影响生成？",
      },
      {
        level: 1,
        content: "先想一想检索结果会放到哪里。",
        next_question: "它如何进入模型的当前输入？",
      },
    ];
    const fetchStub = vi.fn(async (
      _input: Parameters<typeof globalThis.fetch>[0],
      init?: Parameters<typeof globalThis.fetch>[1],
    ) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 1,
        model: "deepseek-v4-flash",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify(outputs.shift()),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    });
    const tutor = createProviderTutor({
      apiKey: "sk-unit-test",
      fetch: fetchStub,
    });
    const common = {
      conceptTitle: "RAG 的核心流程",
      sourceText: "",
      sourceContext: "RAG 通常先检索信息，再将结果用于生成。",
      question: "RAG 如何工作？",
      userAnswer: "先检索信息。",
      stage: "initial_explanation" as const,
    };

    await tutor.extractConcepts({ title: "RAG 入门", sourceText: "" });
    await tutor.assessAnswer(common);
    await tutor.generateSupport({ ...common, level: 1 });

    expect(bodies.map((body) => body.model)).toEqual([
      DEEPSEEK_MODEL,
      DEEPSEEK_MODEL,
      DEEPSEEK_MODEL,
    ]);
    expect(bodies.map((body) => body.max_tokens)).toEqual([4_000, 2_000, 1_000]);
    for (const body of bodies) {
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.thinking).toEqual({ type: "disabled" });
      expect(JSON.stringify(body)).not.toContain("sk-unit-test");
    }
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
npx vitest run tests/unit/ai-tutor.test.ts
```

预期：FAIL；`DEEPSEEK_BASE_URL` / `DEEPSEEK_MODEL` / `getDeepSeekConfig` 尚未导出，`createProviderTutor` 也不接受测试配置。

- [ ] **步骤 3：实现固定 DeepSeek 配置和可测试 Provider**

在 `src/server/ai/tutor.ts` 的 `DEFAULT_AI_TIMEOUT_MS` 前增加：

```ts
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_MODEL = "deepseek-v4-flash";

const OUTPUT_TOKEN_LIMITS = {
  extraction: 4_000,
  assessment: 2_000,
  support: 1_000,
} as const;

interface ProviderTutorOptions {
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
}
```

用以下实现替换 `aiRequestOptions` 和 `requireAiConfig`：

```ts
function aiRequestOptions(maxOutputTokens: number) {
  return {
    timeout: getAiTimeoutMs(),
    maxRetries: 0,
    maxOutputTokens,
  } as const;
}

export function getDeepSeekConfig(
  rawApiKey = process.env.DEEPSEEK_API_KEY,
) {
  const apiKey = rawApiKey?.trim();
  if (!apiKey) {
    throw new AiConfigurationError(
      "真实 AI 模式需要配置 DEEPSEEK_API_KEY",
    );
  }
  return {
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
    modelName: DEEPSEEK_MODEL,
  };
}
```

用以下签名和 Provider 初始化替换 `createProviderTutor` 开头：

```ts
export function createProviderTutor(
  options: ProviderTutorOptions = {},
): AiTutor {
  const { apiKey, baseURL, modelName } = getDeepSeekConfig(options.apiKey);
  const provider = createOpenAICompatible({
    name: "deepseek",
    apiKey,
    baseURL,
    fetch: options.fetch,
    supportsStructuredOutputs: false,
    transformRequestBody: (body) => ({
      ...body,
      thinking: { type: "disabled" },
    }),
  });
  const model = provider.chatModel(modelName);
```

三个 `generateText` 调用分别改为：

```ts
...aiRequestOptions(OUTPUT_TOKEN_LIMITS.extraction),
```

```ts
...aiRequestOptions(OUTPUT_TOKEN_LIMITS.assessment),
```

```ts
...aiRequestOptions(OUTPUT_TOKEN_LIMITS.support),
```

- [ ] **步骤 4：运行 Provider 测试、类型检查和 lint**

运行：

```bash
npx vitest run tests/unit/ai-tutor.test.ts
npm run typecheck
npm run lint
```

预期：全部 PASS；捕获的 3 个请求体使用 DeepSeek V4 Flash、`json_object`、thinking disabled 和 4,000/2,000/1,000 token 上限。

- [ ] **步骤 5：Commit**

```bash
git add src/server/ai/tutor.ts tests/unit/ai-tutor.test.ts
git commit -m "feat(DeepSeek): 固定真实 AI Provider（任务 1/6）"
```

---

### 任务 2：补齐 DeepSeek JSON Output Prompt 契约

**文件：**
- 修改：`src/server/ai/prompts.ts`
- 修改：`tests/unit/ai-schemas.test.ts`

- [ ] **步骤 1：编写三类 JSON Prompt 失败测试**

在 `tests/unit/ai-schemas.test.ts` 的 `dual-mode prompts` 中增加：

```ts
it.each([
  [getExtractionSystemPrompt, "concepts", "source_context"],
  [getAssessmentSystemPrompt, "assessment", "next_question"],
  [getSupportSystemPrompt, "level", "next_question"],
] as const)(
  "两种模式的结构化输出都明确 JSON 字段：%s",
  (getPrompt, firstField, secondField) => {
    for (const mode of ["source_bound", "topic_general"] as const) {
      const prompt = getPrompt(mode);
      expect(prompt).toContain("仅输出 JSON");
      expect(prompt).toContain(firstField);
      expect(prompt).toContain(secondField);
      expect(prompt).toContain("不要使用 Markdown 代码块");
    }
  },
);
```

- [ ] **步骤 2：运行测试并确认失败**

```bash
npx vitest run tests/unit/ai-schemas.test.ts
```

预期：FAIL；当前提示词没有“仅输出 JSON”、字段示例或 Markdown 禁止语。

- [ ] **步骤 3：实现三类 JSON 输出规则**

在 `src/server/ai/prompts.ts` 的安全规则后增加：

```ts
const extractionJsonRule = `
<output>
仅输出 JSON，不要使用 Markdown 代码块或额外说明。
字段结构示例：{"concepts":[{"title":"标题","description":"描述","source_context":"引用或判断基准"}]}
</output>`;

const assessmentJsonRule = `
<output>
仅输出 JSON，不要使用 Markdown 代码块或额外说明。
字段结构示例：{"assessment":"partial","understood_points":[],"missing_points":[],"misconceptions":[],"next_question":"一个问题？"}
</output>`;

const supportJsonRule = `
<output>
仅输出 JSON，不要使用 Markdown 代码块或额外说明。
字段结构示例：{"level":1,"content":"支持内容","next_question":"一个问题？"}
</output>`;
```

在资料约束的 3 个 Prompt 常量末尾分别追加对应规则，例如：

```ts
${untrustedSourceRule}
${extractionJsonRule}`;
```

在 `getExtractionSystemPrompt` / `getAssessmentSystemPrompt` / `getSupportSystemPrompt` 的主题直练返回值末尾分别追加对应规则，例如：

```ts
${untrustedTopicRule}
${extractionJsonRule}`;
```

- [ ] **步骤 4：运行 Prompt 与 Provider 回归**

```bash
npx vitest run tests/unit/ai-schemas.test.ts tests/unit/ai-tutor.test.ts
```

预期：两个测试文件全部 PASS；资料约束和主题直练的安全规则继续通过。

- [ ] **步骤 5：Commit**

```bash
git add src/server/ai/prompts.ts tests/unit/ai-schemas.test.ts
git commit -m "feat(Prompt): 补齐 DeepSeek JSON 输出契约（任务 2/6）"
```

---

### 任务 3：修正双模式服务文案逻辑

**文件：**
- 修改：`src/server/services/training-service.ts`
- 修改：`src/server/services/session-service.ts`
- 修改：`tests/integration/training-service.test.ts`
- 修改：`tests/integration/session-service.test.ts`

- [ ] **步骤 1：编写模式中性文案失败测试**

在 `tests/integration/training-service.test.ts` 首个测试前增加：

```ts
it("初始问题不假设用户已提供资料", async () => {
  const started = await startTraining(conceptId, makeDeps(db, createMockTutor()));

  expect(started.concept.currentQuestion).toBe(
    "先别查现成答案。请用你自己的话解释：RAG 的作用。",
  );
  expect(started.concept.currentQuestion).not.toContain("资料");
});
```

将 `AiConfigurationError` 加入 `tests/integration/session-service.test.ts` 的 Tutor import，然后增加：

```ts
it("配置缺失时保留中性学习内容文案", async () => {
  await expect(
    createStudySession(
      { title: "光合作用", sourceText: "", clientRequestId: randomUUID() },
      makeDeps(db, {
        extractConcepts: vi.fn(async () => {
          throw new AiConfigurationError("missing key");
        }),
      }),
    ),
  ).rejects.toMatchObject({
    name: "AiConfigurationServiceError",
    message: "AI 尚未配置，你的学习内容已保存",
  });
});

it("幂等请求冲突使用中性学习内容文案", async () => {
  const clientRequestId = randomUUID();
  const deps = makeDeps(db, {
    extractConcepts: vi.fn(async ({ title }) => [
      {
        title,
        description: `理解 ${title} 的核心关系`,
        sourceContext: `以通用知识理解 ${title}。`,
      },
    ]),
  });
  await createStudySession(
    { title: "光合作用", sourceText: "", clientRequestId },
    deps,
  );

  await expect(
    createStudySession(
      { title: "细胞呼吸", sourceText: "", clientRequestId },
      deps,
    ),
  ).rejects.toMatchObject({
    name: "ConflictError",
    message: "这个创建请求已用于其他学习内容",
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

```bash
npx vitest run tests/integration/training-service.test.ts tests/integration/session-service.test.ts
```

预期：3 个新测试 FAIL；当前实现仍返回“先别看资料”、“学习资料已保存”和“另一份学习资料”。

- [ ] **步骤 3：替换三处模式耦合文案**

在 `src/server/services/training-service.ts` 中改为：

```ts
const initialQuestion = `先别查现成答案。请用你自己的话解释：${concept.title}。`;
```

在 `src/server/services/session-service.ts` 中改为：

```ts
throw new AiConfigurationServiceError(
  "AI 尚未配置，你的学习内容已保存",
  sessionId,
  error,
);
```

```ts
throw new ConflictError("这个创建请求已用于其他学习内容");
```

- [ ] **步骤 4：运行服务层回归**

```bash
npx vitest run tests/integration/training-service.test.ts tests/integration/session-service.test.ts tests/integration/routes.test.ts
```

预期：3 个测试文件全部 PASS；原有幂等、失败恢复、并发 CAS 和 HTTP 错误码不回归。

- [ ] **步骤 5：Commit**

```bash
git add src/server/services/training-service.ts src/server/services/session-service.ts tests/integration/training-service.test.ts tests/integration/session-service.test.ts
git commit -m "fix(双模式): 移除服务文案的资料必填假设（任务 3/6）"
```

---

### 任务 4：修正 Mock Tutor 的跨主题逻辑

**文件：**
- 修改：`src/server/ai/mock-tutor.ts`
- 修改：`tests/unit/mock-tutor.test.ts`

- [ ] **步骤 1：编写非 RAG 主题的失败测试**

在 `tests/unit/mock-tutor.test.ts` 增加：

```ts
const genericInput = {
  conceptTitle: "光合作用的能量转换",
  sourceText: "",
  sourceContext: "光合作用将光能转换为化学能，并储存在有机物中。",
  question: "请解释光合作用的能量转换。",
  stage: "initial_explanation" as const,
};

it("非 RAG 主题使用通用模拟判断，不泄漏 RAG 语义", async () => {
  const tutor = createMockTutor();
  const unclear = await tutor.assessAnswer({
    ...genericInput,
    userAnswer: "不知道",
  });
  const partial = await tutor.assessAnswer({
    ...genericInput,
    userAnswer: "光合作用会把光能变成化学能。",
  });
  const correct = await tutor.assessAnswer({
    ...genericInput,
    userAnswer:
      "因为植物能利用光能驱动反应，所以能把能量储存在有机物中，并在条件不足时受到限制。",
  });

  expect([unclear.assessment, partial.assessment, correct.assessment]).toEqual([
    "unclear",
    "partial",
    "correct",
  ]);
  for (const result of [unclear, partial, correct]) {
    expect(JSON.stringify(result)).not.toMatch(/RAG|外部资料/);
  }
});

it("非 RAG 主题的三级支持引用当前知识点", async () => {
  const tutor = createMockTutor();

  for (const level of [1, 2, 3] as const) {
    const result = await tutor.generateSupport({
      ...genericInput,
      userAnswer: "光合作用会把光能变成化学能。",
      level,
    });
    expect(result.level).toBe(level);
    expect(`${result.content}${result.nextQuestion}`).toContain("光合作用");
    expect(`${result.content}${result.nextQuestion}`).not.toMatch(/RAG|外部资料/);
    expect((result.nextQuestion.match(/[？?]/g) ?? []).length).toBeLessThanOrEqual(1);
  }
});
```

- [ ] **步骤 2：运行测试并确认失败**

```bash
npx vitest run tests/unit/mock-tutor.test.ts
```

预期：FAIL；当前 `assessAnswer` 和 `generateSupport` 对所有主题都返回 RAG/资料语义。

- [ ] **步骤 3：实现通用 Mock 判断和支持**

将 `src/server/ai/mock-tutor.ts` 的 Tutor type import 扩展为：

```ts
import type {
  AiTutor,
  AssessAnswerInput,
  AssessmentResult,
  GenerateSupportInput,
  SupportResult,
} from "@/server/ai/tutor";
```

在 `simulateConfiguredFailure` 后增加：

```ts
function conceptLabel(value: string): string {
  return value.replace(/[？?]/g, "").trim() || "当前知识点";
}

function isRagScenario(
  input: Pick<
    AssessAnswerInput,
    "conceptTitle" | "sourceText" | "sourceContext"
  >,
): boolean {
  return /\bRAG\b|检索增强生成/i.test(
    `${input.conceptTitle}\n${input.sourceText}\n${input.sourceContext}`,
  );
}

function assessGeneric(input: AssessAnswerInput): AssessmentResult {
  const answer = input.userAnswer.trim();
  const label = conceptLabel(input.conceptTitle);
  const explainsRelationship =
    /(因为|所以|因此|导致|关系|区别|如果|当|边界|限制|例如|比如|意味着)/.test(answer);

  if (answer.length < 8) {
    return parseAssessment({
      assessment: "unclear",
      understood_points: [],
      missing_points: ["还没有形成可判断的完整解释"],
      misconceptions: [],
      next_question: `请先用一句完整的话说明「${label}」是什么？`,
    });
  }

  if (answer.length >= 30 && explainsRelationship) {
    return parseAssessment({
      assessment: "correct",
      understood_points: ["已经说明概念的关系、原因或适用边界"],
      missing_points: [],
      misconceptions: [],
      next_question: `换一个情境时，「${label}」的核心关系仍如何成立？`,
    });
  }

  return parseAssessment({
    assessment: "partial",
    understood_points: ["已经开始描述当前概念"],
    missing_points: ["还需要说明原因、关系或适用边界"],
    misconceptions: [],
    next_question: `请再说明「${label}」中最关键的原因、关系或适用边界？`,
  });
}

function supportGeneric(input: GenerateSupportInput): SupportResult {
  const label = conceptLabel(input.conceptTitle);
  const supports = {
    1: {
      content: `先抓住「${label}」中的两个关键对象，想想它们如何互相影响。`,
      nextQuestion: `「${label}」中最重要的两个对象是什么？`,
    },
    2: {
      content: `对比「${label}」成立与不成立的情况，找出关键条件。`,
      nextQuestion: `哪个条件会改变「${label}」的结果？`,
    },
    3: {
      content: `解释「${label}」时，先说它是什么，再说关键原因或关系，最后补一个边界或例子。`.slice(0, 120),
      nextQuestion: `现在请重新完整解释「${label}」？`,
    },
  } as const;
  const support = supports[input.level];
  return parseSupport({
    level: input.level,
    content: support.content,
    next_question: support.nextQuestion,
  });
}
```

在 `assessAnswer` 的 `simulateConfiguredFailure` 之后增加：

```ts
if (!isRagScenario(input)) return assessGeneric(input);
```

在 `generateSupport` 的 `simulateConfiguredFailure` 之后增加：

```ts
if (!isRagScenario(input)) return supportGeneric(input);
```

- [ ] **步骤 4：运行 Mock、训练服务和 E2E 回归**

确保没有另一个 Next.js dev 进程持有当前项目的 `.next/dev/lock`，然后运行：

```bash
npx vitest run tests/unit/mock-tutor.test.ts tests/integration/training-service.test.ts
npx playwright test tests/e2e/core-flow.spec.ts tests/e2e/topic-only-flow.spec.ts
```

预期：Mock 与训练测试全部 PASS；原 RAG 闭环以及主题直练均在桌面和 360 px 项目通过。

- [ ] **步骤 5：Commit**

```bash
git add src/server/ai/mock-tutor.ts tests/unit/mock-tutor.test.ts
git commit -m "fix(Mock): 为非 RAG 主题生成通用训练反馈（任务 4/6）"
```

---

### 任务 5：增加安全的真实 DeepSeek 验收入口

**文件：**
- 创建：`tests/provider/deepseek-live.test.ts`
- 修改：`package.json`
- 修改：`.env.example`
- 修改：`README.md`

- [ ] **步骤 1：编写默认跳过、显式运行的 live smoke test**

创建 `tests/provider/deepseek-live.test.ts`：

```ts
import { describe, expect, it } from "vitest";

import { createProviderTutor } from "@/server/ai/tutor";

const liveDescribe =
  process.env.RUN_DEEPSEEK_LIVE === "true" ? describe : describe.skip;

liveDescribe("DeepSeek live smoke", () => {
  it(
    "完成知识点提取、回答判断和 Level 1 支持",
    async () => {
      const tutor = createProviderTutor();
      const concepts = await tutor.extractConcepts({
        title: "RAG 入门",
        sourceText: "",
      });
      expect(concepts.length).toBeGreaterThanOrEqual(1);
      expect(concepts.length).toBeLessThanOrEqual(10);
      const concept = concepts[0];

      const assessment = await tutor.assessAnswer({
        conceptTitle: concept.title,
        sourceText: "",
        sourceContext: concept.sourceContext,
        question: `请用自己的话解释：${concept.title}。`,
        userAnswer: "RAG 会先找到与问题相关的信息，再把这些信息作为上下文用来生成回答。",
        stage: "initial_explanation",
      });
      expect(["correct", "partial", "incorrect", "unclear"]).toContain(
        assessment.assessment,
      );
      expect(Array.isArray(assessment.understoodPoints)).toBe(true);
      expect((assessment.nextQuestion.match(/[？?]/g) ?? []).length).toBeLessThanOrEqual(1);

      const support = await tutor.generateSupport({
        conceptTitle: concept.title,
        sourceText: "",
        sourceContext: concept.sourceContext,
        question: assessment.nextQuestion,
        userAnswer: "我只知道它会找资料。",
        stage: "targeted_probe",
        level: 1,
      });
      expect(support.level).toBe(1);
      expect(support.content.trim().length).toBeGreaterThan(0);
      expect((support.nextQuestion.match(/[？?]/g) ?? []).length).toBeLessThanOrEqual(1);
    },
    120_000,
  );
});
```

- [ ] **步骤 2：添加显式命令和 DeepSeek 环境示例**

在 `package.json` 的 scripts 中增加：

```json
"test:deepseek": "RUN_DEEPSEEK_LIVE=true node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/provider/deepseek-live.test.ts"
```

将 `.env.example` 替换为：

```dotenv
DEEPSEEK_API_KEY=
AI_TIMEOUT_MS=30000
AI_MOCK_MODE=true
DATABASE_PATH=data/explainback.db
```

在 `README.md` 技术栈中将通用 Provider 改为 DeepSeek Provider，并用以下段落替换真实模型配置示例：

````markdown
真实 AI 固定使用 DeepSeek V4 Flash 非思考模式。将密钥只写入不会被 Git 跟踪的 `.env.local`：

```dotenv
DEEPSEEK_API_KEY=your-local-secret
AI_TIMEOUT_MS=30000
AI_MOCK_MODE=false
DATABASE_PATH=data/explainback.db
```

默认 `npm test` 不会发起付费请求。只有以下命令会调用真实 DeepSeek API 完成知识点提取、回答判断和 Level 1 支持：

```bash
npm run test:deepseek
```
````

- [ ] **步骤 3：验证默认测试不会调用真实 API**

在不设置 `RUN_DEEPSEEK_LIVE` 的情况下运行：

```bash
npx vitest run tests/provider/deepseek-live.test.ts
```

预期：该文件显示 1 个 skipped test，没有网络请求，退出码为 0。

- [ ] **步骤 4：安全确认本机密钥配置**

请用户在 `/Users/liuxs/Desktop/个人项目3/.env.local` 写入真实 `DEEPSEEK_API_KEY` 和 `AI_MOCK_MODE=false`。不通过聊天、Git patch、shell 命令参数或日志传递密钥。

使用不输出密钥的命令验证文件和前缀：

```bash
git check-ignore -q .env.local && node --env-file=.env.local -e 'process.exit(process.env.DEEPSEEK_API_KEY?.startsWith("sk-") ? 0 : 1)'
```

预期：退出码 0；终端不输出密钥。若退出码非 0，在此暂停并请用户完成本机配置。

- [ ] **步骤 5：运行三步真实 DeepSeek 验收**

```bash
npm run test:deepseek
```

预期：`DeepSeek live smoke` 实际运行 1 个 test 且 PASS，内部完成 3 次真实 API 调用，无 skipped test、无 Schema 错误、无密钥输出。

- [ ] **步骤 6：Commit**

```bash
git add .env.example README.md package.json tests/provider/deepseek-live.test.ts
git commit -m "test(DeepSeek): 增加显式真实 API 验收（任务 5/6）"
```

---

### 任务 6：完整回归、安全检查与预览恢复

**文件：**
- 验证：本计划所有已修改文件
- 不创建新业务文件

- [ ] **步骤 1：运行完整静态、单元、集成和生产构建检查**

若 3000 端口仍有本项目的 Next.js 开发预览，先停止该已知进程，避免 Next.js 16 的 `.next/dev/lock` 与 Playwright 服务冲突。然后顺序运行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

预期：ESLint 0 错误，TypeScript 0 错误，全部 Vitest 通过（live smoke 在默认套件中显示 skipped），生产构建成功，6 条桌面/移动 E2E 全部通过。

- [ ] **步骤 2：运行视觉巡检**

按 `webapp-testing` 技能要求先运行 helper `--help`，再运行：

```bash
python3 /Users/liuxs/.agents/skills/webapp-testing/scripts/with_server.py \
  --server "AI_MOCK_MODE=true DATABASE_PATH=data/visual-explainback.db npm run dev" \
  --port 3000 \
  -- /tmp/explainback-playwright/bin/python tests/browser/visual_smoke.py
```

预期：输出“视觉巡检通过”；日光水纹跟随有效、360 px 页面无横向溢出、控制台无错误。

- [ ] **步骤 3：执行密钥和工作区安全检查**

```bash
git check-ignore -q .env.local
git diff --check
git status --short
git grep -nE 'DEEPSEEK_API_KEY=sk-[A-Za-z0-9]+' -- ':!.env.example' ':!docs/**' || true
```

预期：`.env.local` 被忽略；`git diff --check` 无输出；只有本计划范围内的预期变更；`git grep` 无输出。

- [ ] **步骤 4：恢复用户可验收的本地预览**

使用 Mock 模式恢复免费预览，避免用户浏览页面时意外产生真实 API 费用：

```bash
AI_MOCK_MODE=true DATABASE_PATH=data/explainback.db npm run dev
```

预期：`http://localhost:3000` 返回 HTTP 200，预览进程保持运行供用户核验。

- [ ] **步骤 5：Commit 验收期间的必要文档修正**

如果回归和 live smoke 没有暴露文档错误，该步骤不产生新提交。如果仅需修正 README 中与实际命令不一致的文字，使用 `apply_patch` 修正、重跑对应验证后提交：

```bash
git add README.md
git commit -m "docs(DeepSeek): 校正真实 API 验收说明（任务 6/6）"
```

---

## 计划自检结果

- 规格覆盖：固定 DeepSeek Provider、非思考模式、JSON 契约、分操作 token 上限、模式中性文案、Mock 跨主题、密钥安全、三步 live smoke 和完整回归均有对应任务。
- 责任边界：`AiTutor` 对外接口不变，DeepSeek 详情局限在 Provider 创建内；Mock 与真实 Provider 不共享知识判断逻辑。
- 重试语义：AI SDK 保持 `maxRetries: 0`，Session/Training Service 保持最多 2 次业务尝试，无隐式重复计费。
- 测试安全：默认 `npm test` 必须 skip live smoke；只有显式 `npm run test:deepseek` 发起三次真实 API 请求。
- 密钥安全：密钥只由用户本机写入已忽略的 `.env.local`，所有检查命令只返回退出码，不打印密钥。
- 范围约束：不增加模型选择 UI、多 Provider 框架、登录、计费、搜索、PDF 或数据库迁移。
