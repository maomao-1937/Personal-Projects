# 豆包生产调用参数设计

## 背景

项目已选用火山方舟 `doubao-seed-2-0-pro-260215`。真实 API 验证表明，默认推理配置完成一次完整六维质检约需 52 秒，接近当前 60 秒超时；使用 `reasoning_effort=minimal` 和 3000 Token 输出上限后约需 24–32 秒。基础 `json_object` 模式曾连续返回无法解析的 JSON，因此生产请求还必须使用已通过真实能力探针的严格 JSON Schema，并在客户端重试前完成业务语义校验。

## 方案比较

1. 在客户端中硬编码豆包参数：改动最少，但会把通用 OpenAI 兼容客户端锁死到单一供应商，不利于回滚或更换模型。
2. 使用可选环境变量控制推理强度和输出上限：保持客户端通用，生产环境显式启用豆包参数，未设置时维持兼容行为。采用此方案。
3. 新建豆包专用客户端：隔离最彻底，但当前只有一个模型供应商，会增加重复代码和维护成本。

## 配置与调用

- 新增 `LLM_REASONING_EFFORT`，允许 `minimal`、`low`、`medium`、`high` 或留空。留空时不发送供应商扩展参数。
- 新增 `LLM_MAX_TOKENS`，默认值为 `3000`，必须大于 0。
- `OpenAIModelClient` 始终发送 `max_tokens`；仅在 `LLM_REASONING_EFFORT` 非空时，通过 `extra_body` 发送 `reasoning_effort`。
- `response_format` 使用 `ModelAnalysisResult` 生成的严格 JSON Schema，而不是仅保证“看起来像 JSON”的 `json_object`。`ModelDimension` 的 Schema 通过条件约束保证 `scored` 状态必须同时包含分数、至少一条证据与非空改进动作；不可评分状态的分数必须为 `null`。
- 每次模型响应在客户端内先通过 Pydantic 结构校验，再用同一份报告校验器检查六维唯一性、证据轮次与逐字原句、主要问题引用等业务约束；任一阶段失败都进入现有的最多两次重试。
- 火山方舟生产配置使用：

  ```dotenv
  LLM_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
  LLM_MODEL=doubao-seed-2-0-pro-260215
  LLM_REASONING_EFFORT=minimal
  LLM_MAX_TOKENS=3000
  ```

- `LLM_API_KEY` 只保存在被 Git 忽略的 `backend/.env` 和 veFaaS 远程环境变量中，不进入代码、文档、日志或测试输出。

## 失败与回滚

- 模型超时、限流和 5xx 仍沿用现有最多 2 次调用与稳定错误映射。
- JSON、Pydantic 或报告语义校验失败仍不会消耗邀请码额度。
- 若豆包参数兼容性发生变化，可删除 `LLM_REASONING_EFFORT` 恢复通用调用；模型版本继续固定，避免别名升级造成评分漂移。

## 验收

- 单元测试证明参数按配置传递，留空时不发送 `extra_body`，并验证严格 JSON Schema、评分状态条件字段与语义失败重试。
- Ruff、严格 mypy、全量 pytest、覆盖率 90% 和 Python 3.12 兼容性全部通过。
- 使用真实豆包 API 完成至少 1 条完整质检，验证 6 个固定维度、逐字证据、风险、主要问题、建议回复、延迟和 Token 用量。
- 通过真实 HTTP API 验证成功分析扣减 1 次，模型失败不扣额度。
