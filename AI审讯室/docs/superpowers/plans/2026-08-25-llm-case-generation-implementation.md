# 大模型案件生成与连续开局实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把固定 `CASE-001` 升级为支持 OpenAI-compatible 实时生成、严格校验、动态审讯和连续生成下一案的安全闭环。

**架构：** 完整案件以不可变 JSON 快照保存在后端 `cases` 表；规则引擎和评分函数接收案件参数，不再导入全局固定案。模型适配层只返回结构化案件与自然语言回答，所有命中、状态、解锁和评分仍由确定性代码决定。前端改为动态 `[caseId]` 路由，并提供生成、失败重试、固定案降级、重玩同案和生成下一案。

**技术栈：** Python 3.11、FastAPI、Pydantic v2、SQLAlchemy 2、Alembic、httpx、pytest；Next.js 16、React 19、TypeScript、Vitest、Testing Library、Python Playwright。

---

## 文件结构

- 创建 `backend/app/domain/case_models.py`：案件快照 Pydantic 模型、跨字段校验和公开投影。
- 创建 `backend/app/repositories/cases.py`：不可变案件持久化与读取。
- 创建 `backend/app/llm/provider.py`：OpenAI-compatible Provider 协议、HTTP 实现与错误类型。
- 创建 `backend/app/llm/prompts.py`：案件生成、复核和嫌疑人表演 Prompt 构造。
- 创建 `backend/app/services/case_generation.py`：生成重试、复核、冻结和固定案降级。
- 创建 `backend/app/services/responder.py`：规则结果到 `ReplyDirective`，模型失败时模板降级。
- 创建 `backend/alembic/versions/20260825_0004_create_cases.py`：`cases` 表与 Session 外键兼容迁移。
- 修改 `backend/app/domain/rules.py`、`scoring.py`：以案件快照作为显式参数。
- 修改 `backend/app/services/game.py`、`repositories/sessions.py`、`api/v1.py`、`schemas/api.py`、`main.py`、`config.py`：动态案件与生成 API。
- 创建/修改 `backend/tests/test_case_models.py`、`test_case_generation.py`、`test_rules.py`、`test_scoring.py`、`test_session_service.py`、`test_api.py`。
- 创建 `frontend/app/case/[caseId]/{briefing,interrogate,report,result}/page.tsx`：动态路由页面。
- 创建 `frontend/features/game/components/case-generation-control.tsx`：生成状态、重试和固定案降级。
- 修改 `frontend/features/game/api.ts`、`session.ts`、`types.ts`、`use-game-data.ts` 与结果页动作。
- 修改 `tests/web_smoke.py`：动态案件、同案重玩和下一案 E2E。
- 修改 `.env.example`、`README.md` 与阶段文档：服务端密钥和启动说明。

### 任务 1：案件快照模型与不可变持久化

**文件：**
- 创建：`backend/app/domain/case_models.py`
- 创建：`backend/app/repositories/cases.py`
- 创建：`backend/alembic/versions/20260825_0004_create_cases.py`
- 测试：`backend/tests/test_case_models.py`

- [x] **步骤 1：编写失败测试**

```python
def test_case_snapshot_rejects_duplicate_evidence_ids(valid_case_payload):
    valid_case_payload["evidence"][1]["id"] = "E01"
    with pytest.raises(ValidationError):
        CaseSnapshot.model_validate(valid_case_payload)

def test_repository_round_trips_private_case(case_repository, valid_snapshot):
    case_repository.create(valid_snapshot)
    assert case_repository.get(valid_snapshot.case_id) == valid_snapshot
```

- [x] **步骤 2：运行测试验证红灯**

运行：`cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest tests/test_case_models.py -v`  
预期：FAIL，`app.domain.case_models` 不存在。

- [x] **步骤 3：实现最小案件模型、校验、公开投影、Repository 与迁移**

```python
class CaseSnapshot(DomainModel):
    case_id: str
    case_code: str
    source: Literal["llm", "manual_fallback"]
    evidence: list[EvidenceDefinition]
    lie_nodes: list[LieNode]
    truth: TruthDefinition

    @model_validator(mode="after")
    def validate_graph(self) -> "CaseSnapshot":
        # 恰好 5 条证据、2 条公开、3 个谎言节点；ID 唯一且所有引用存在。
        return self
```

- [x] **步骤 4：运行测试验证绿灯与迁移**

运行：`cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest tests/test_case_models.py -v`  
运行：以临时 SQLite URL 连续执行两次 `run_migrations()`。  
预期：PASS，数据库 head 为 `20260825_0004`。

- [x] **步骤 5：提交**

```bash
git add backend/app/domain/case_models.py backend/app/repositories/cases.py backend/alembic/versions/20260825_0004_create_cases.py backend/tests/test_case_models.py
git commit -m "feat: add immutable generated case snapshots"
```

### 任务 2：模型 Provider、生成重试与公开生成 API

**文件：**
- 创建：`backend/app/llm/__init__.py`
- 创建：`backend/app/llm/provider.py`
- 创建：`backend/app/llm/prompts.py`
- 创建：`backend/app/services/case_generation.py`
- 修改：`backend/app/core/config.py`
- 修改：`backend/app/schemas/api.py`
- 修改：`backend/app/api/v1.py`
- 修改：`backend/app/main.py`
- 测试：`backend/tests/test_case_generation.py`
- 测试：`backend/tests/test_api.py`

- [x] **步骤 1：编写失败测试**

```python
def test_generation_retries_invalid_json_then_persists(fake_provider, repository):
    fake_provider.case_outputs = ["not-json", valid_case_json]
    generated = service.generate()
    assert generated.source == "llm"
    assert fake_provider.case_calls == 2
    assert repository.get(generated.case_id) is not None

def test_generation_without_key_is_explicitly_unavailable(client):
    response = client.post("/api/v1/cases/generate", json={})
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "LLM_NOT_CONFIGURED"
```

- [x] **步骤 2：运行测试验证红灯**

运行：`cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest tests/test_case_generation.py tests/test_api.py -v`  
预期：FAIL，生成服务与路由不存在。

- [x] **步骤 3：实现 Provider 和生成服务**

```python
class LLMProvider(Protocol):
    def generate_case_json(self, prompt: str) -> str: ...
    def review_case_json(self, prompt: str) -> str: ...
    def generate_reply(self, prompt: str) -> str: ...

class CaseGenerationService:
    def generate(self) -> CaseSnapshot:
        for _ in range(3):
            candidate = self.provider.generate_case_json(build_case_prompt())
            snapshot = parse_and_validate(candidate)
            return self.repository.create(snapshot)
        raise CaseGenerationFailedError
```

实施偏差（经用户确认）：真实冒烟显示阻塞式第二次模型复核会显著增加等待且可能保守拒绝合格结构。实时开局改为生成模型单次内自检 + Pydantic/证据图硬校验；`review_case_json` 保留给后续预生成案件池，不阻塞玩家。

- [x] **步骤 4：验证通过**

运行同一步骤 2 命令。  
预期：生成、重试、无 Key 错误、公开投影与不落半成品测试全部 PASS。

- [x] **步骤 5：提交**

```bash
git add backend/app/llm backend/app/services/case_generation.py backend/app/core/config.py backend/app/schemas/api.py backend/app/api/v1.py backend/app/main.py backend/tests/test_case_generation.py backend/tests/test_api.py
git commit -m "feat: add structured llm case generation"
```

### 任务 3：动态规则、评分和嫌疑人回答

**文件：**
- 创建：`backend/app/services/responder.py`
- 修改：`backend/app/domain/rules.py`
- 修改：`backend/app/domain/scoring.py`
- 修改：`backend/app/services/game.py`
- 修改：`backend/app/repositories/sessions.py`
- 测试：`backend/tests/test_rules.py`
- 测试：`backend/tests/test_scoring.py`
- 测试：`backend/tests/test_session_service.py`

- [x] **步骤 1：编写失败测试**

```python
def test_dynamic_case_uses_its_own_evidence_mapping(generated_case, state):
    result = evaluate_turn(generated_case, state, "仓库门禁时间怎么解释？", "calm", "E02")
    assert result.evidence_effect == "effective"

def test_reply_failure_uses_case_template_without_changing_rule_result(...):
    provider.raise_on_reply = True
    result = service.submit_turn(session_id, question, "calm", "E02", "req_dynamic_1")
    assert result.evidence_effect == "effective"
    assert result.reply == generated_case.reply_templates["effective_L01"]

def test_same_request_id_does_not_call_reply_provider_twice(...):
    first = service.submit_turn(..., request_id="req_same_1")
    second = service.submit_turn(..., request_id="req_same_1")
    assert second == first
    assert provider.reply_calls == 1
```

- [x] **步骤 2：运行测试验证红灯**

运行：`cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest tests/test_rules.py tests/test_scoring.py tests/test_session_service.py -v`  
预期：FAIL，规则函数仍绑定 `CASE_001` 且无回答 Provider。

- [x] **步骤 3：参数化规则和评分，先判定再表演**

```python
decision = evaluate_turn(case, state, message, tactic, evidence_id)
reply = responder.reply(case=case, before=state, decision=decision, question=message)
decision.state.messages[-1].text = reply
repository.save(decision.state, expected_revision=revision, turn_replay=(request_id, decision))
```

- [x] **步骤 4：运行测试验证绿灯**

运行同一步骤 2 命令，再运行全部后端测试。  
预期：动态案与旧固定案全部 PASS，相同 request ID 只生成一次回答。

- [x] **步骤 5：提交**

```bash
git add backend/app/services/responder.py backend/app/domain/rules.py backend/app/domain/scoring.py backend/app/services/game.py backend/app/repositories/sessions.py backend/tests
git commit -m "feat: run interrogation rules against case snapshots"
```

### 任务 4：动态案件 Session API 与兼容固定案

**文件：**
- 修改：`backend/app/api/v1.py`
- 修改：`backend/app/schemas/api.py`
- 修改：`backend/app/main.py`
- 测试：`backend/tests/test_api.py`

- [x] **步骤 1：编写失败测试**

```python
def test_generated_case_can_complete_session_flow(client, generated_case):
    session = client.post("/api/v1/sessions", json={"caseId": generated_case.case_id}).json()
    case = client.get(f"/api/v1/cases/{generated_case.case_id}").json()
    assert session["caseId"] == generated_case.case_id
    assert "truth" not in case

def test_fallback_requires_explicit_request(client):
    response = client.post("/api/v1/cases/fallback", json={})
    assert response.json()["generationSource"] == "manual_fallback"
```

- [x] **步骤 2：运行测试确认失败**

运行：`cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest tests/test_api.py -v`。  
预期：FAIL，动态读取或降级端点尚未完成。

- [x] **步骤 3：实现动态 API 和固定案种子注册**

固定 `001` 在读取时转换为 `CaseSnapshot`；动态案从 `CaseRepository` 读取。`_session_payload` 使用 Session 绑定案件的证据，不再导入 `CASE_001`。

- [x] **步骤 4：运行全部后端测试**

运行：`cd backend && PYTHONPATH=. ../.venv/bin/python -m pytest`。  
预期：全部 PASS。

- [x] **步骤 5：提交**

```bash
git add backend/app backend/tests
git commit -m "feat: expose dynamic case session api"
```

### 任务 5：前端生成控件与动态案件路由

**文件：**
- 创建：`frontend/features/game/components/case-generation-control.tsx`
- 创建：`frontend/app/case/[caseId]/briefing/page.tsx`
- 创建：`frontend/app/case/[caseId]/interrogate/page.tsx`
- 创建：`frontend/app/case/[caseId]/report/page.tsx`
- 创建：`frontend/app/case/[caseId]/result/page.tsx`
- 修改：`frontend/features/game/api.ts`
- 修改：`frontend/features/game/session.ts`
- 修改：`frontend/features/game/types.ts`
- 修改：`frontend/features/game/use-game-data.ts`
- 修改：`frontend/app/page.tsx`
- 修改：`frontend/app/globals.css`
- 测试：`frontend/tests/api-client.test.ts`
- 测试：`frontend/tests/game-utils.test.ts`
- 创建：`frontend/tests/case-generation-control.test.tsx`

- [x] **步骤 1：编写失败测试**

```tsx
it("announces generation phases and routes to the generated case", async () => {
  gameApi.generateCase = vi.fn().mockResolvedValue({ caseId: "case_new", generationSource: "llm" });
  render(<CaseGenerationControl />);
  await user.click(screen.getByRole("button", { name: "生成免费案件" }));
  expect(await screen.findByText("校验证据链")).toBeVisible();
  expect(router.push).toHaveBeenCalledWith(expect.stringContaining("/case/case_new/briefing"));
});
```

- [x] **步骤 2：运行测试确认红灯**

运行：`cd frontend && npm run test -- case-generation-control.test.tsx api-client.test.ts game-utils.test.ts`。  
预期：FAIL，新控件与动态 API 不存在。

- [x] **步骤 3：实现动态 API、路由工具和生成 UI**

```ts
export const caseRoutes = (caseId: string) => ({
  briefing: `/case/${encodeURIComponent(caseId)}/briefing`,
  interrogate: `/case/${encodeURIComponent(caseId)}/interrogate`,
  report: `/case/${encodeURIComponent(caseId)}/report`,
  result: `/case/${encodeURIComponent(caseId)}/result`,
});
```

生成按钮显示机械步骤并使用 `aria-live="polite"`；失败后显示“重新生成”和“使用固定案件”。固定旧路由可以重定向到动态路径或由动态目录自然覆盖。

- [x] **步骤 4：运行前端单元测试、lint 与 typecheck**

运行：`cd frontend && npm run test && npm run lint && npm run typecheck`。  
预期：全部 PASS。

- [x] **步骤 5：提交**

```bash
git add frontend/app frontend/features frontend/tests
git commit -m "feat: add generated case flow and dynamic routes"
```

### 任务 6：结果页连续开局、文档与完整验收

**文件：**
- 修改：`frontend/app/case/[caseId]/result/page.tsx`
- 修改：`tests/web_smoke.py`
- 修改：`.env.example`
- 修改：`README.md`
- 修改：`docs/阶段1技术开发文档.md`
- 修改：`docs/阶段2前端开发文档.md`

- [x] **步骤 1：编写失败的 E2E/组件断言**

断言结果页同时存在“重新审讯同案”和“生成下一案”；前者创建相同 `caseId` 的 Session，后者调用生成 API 并进入不同 `caseId`。

- [x] **步骤 2：运行目标测试确认失败**

运行：`cd frontend && npm run test`。  
预期：FAIL，结果页仍显示“预约下一案”或重玩动作未区分。

- [x] **步骤 3：实现连续开局并补齐配置文档**

`.env.example` 只提供空值：

```text
LLM_ENABLED=false
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=
LLM_TIMEOUT_SECONDS=45
```

不得提交真实密钥。README 说明无 Key 降级、OpenAI-compatible 配置和生产迁移顺序。

- [x] **步骤 4：运行最终验证**

```bash
cd backend
PYTHONPATH=. ../.venv/bin/python -m pytest
../.venv/bin/python -m compileall -q app
cd ../frontend
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

预期：全部退出码 0；四个视口无横向滚动；固定案降级完整一局；使用 Fake Provider 的动态案完整一局；密钥扫描无命中。

- [x] **步骤 5：提交**

```bash
git add .env.example README.md docs/阶段1技术开发文档.md docs/阶段2前端开发文档.md tests/web_smoke.py frontend/app/case
git commit -m "feat: complete continuous generated case loop"
```
