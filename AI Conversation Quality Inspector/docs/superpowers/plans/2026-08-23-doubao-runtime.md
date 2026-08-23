# 豆包运行参数接入实施计划

**目标：** 在保持 OpenAI 兼容客户端通用性的前提下，为豆包 Seed 2.0 Pro 配置最小推理强度和最大输出长度，并验证真实结构化质检结果。

**架构：** 运行参数进入统一 `Settings`，模型客户端基于配置组装请求。推理强度为空时不发送厂商扩展字段，保证其他兼容服务仍可使用；生产环境显式配置豆包参数。

**技术栈：** Python 3.12、FastAPI、Pydantic Settings、OpenAI Python SDK、pytest、Ruff、mypy。

---

### 任务 1：先定义配置行为

**文件：**
- 修改：`backend/tests/unit/test_config.py`
- 修改：`backend/app/core/config.py`

1. 添加测试，验证 `LLM_REASONING_EFFORT=minimal` 和 `LLM_MAX_TOKENS=3000` 可被解析。
2. 添加测试，验证非法推理强度与非正输出长度被拒绝。
3. 运行定向测试并确认测试先失败。
4. 在 `Settings` 中增加可选推理强度枚举，以及大于零、默认 3000 的最大输出长度。
5. 重跑定向测试并确认通过。

### 任务 2：先定义模型请求行为

**文件：**
- 修改：`backend/tests/unit/test_model_client.py`
- 修改：`backend/app/services/model_client.py`
- 修改：`backend/app/schemas/analysis.py`

1. 添加测试，验证配置推理强度后请求包含 `max_tokens=3000` 与 `extra_body.reasoning_effort=minimal`。
2. 添加测试，验证未配置推理强度时省略 `extra_body`。
3. 运行定向测试并确认测试先失败。
4. 用一个请求参数字典集中组装调用参数，始终传最大输出长度，只在配置存在时加入扩展字段。
5. 重跑模型客户端测试并确认通过。

### 任务 3：同步配置文档

**文件：**
- 修改：`backend/.env.example`
- 修改：`backend/README.md`
- 修改：`backend/.env`（忽略文件，仅补充本机值，不读取或输出密钥）

1. 在示例环境变量中加入两个新参数及安全默认值。
2. 在后端说明中记录豆包兼容配置、推理强度和最大输出长度。
3. 本地 `.env` 配置 `minimal` 与 `3000`，保持文件权限为 `600`。

### 任务 4：执行完整验证

1. 运行 Ruff 格式与静态检查。
2. 运行 mypy。
3. 运行 Python 3.12 全量测试与覆盖率门槛。
4. 使用本地 `.env` 对豆包执行真实完整质检，检查六个维度、证据原文、风险等级与建议回复，且不输出密钥或对话内容。
5. 将非敏感参数及密钥安全写入后端 veFaaS 环境，过程中不回显密钥。

### 任务 5：强化结构化输出可靠性

**文件：**
- 修改：`backend/tests/unit/test_model_client.py`
- 修改：`backend/app/services/model_client.py`

1. 添加测试，验证请求使用 `ModelAnalysisResult` 的严格 `json_schema`，而不是基础 `json_object`。
2. 添加测试，让第一次响应满足 Pydantic 结构但引用不存在的证据原句，验证客户端会重试并接受第二次语义有效响应。
3. 运行定向测试并确认测试先失败。
4. 在模型客户端中复用 `build_report` 完成响应语义预校验；结构或语义无效都沿用最多两次重试。
5. 为 `ModelDimension` 的生成 Schema 添加条件约束：`scored` 必须包含整数分数、至少一条证据和非空改进动作；其他状态的分数为 `null`。真实能力探针已经验证豆包支持所需的 `if/then/else`。
6. 运行定向测试、应用层 mypy 与全量回归。
7. 用真实豆包 API 验证严格 Schema 被接受，且完整报告语义校验通过。

### 任务 6：提交并进入上线阶段

1. 审核 diff，确认不存在密钥或无关文件。
2. 提交豆包运行参数实现。
3. 创建私有 TOS 桶、版本控制、服务端加密、生命周期规则及 veFaaS 最小权限角色。
4. 首发后端并验证数据库备份、邀请码扣减和冷启动恢复。
