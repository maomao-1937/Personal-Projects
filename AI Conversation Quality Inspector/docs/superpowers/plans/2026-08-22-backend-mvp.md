# 对话质检器后端 MVP 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现可独立核验的 FastAPI 后端，提供匿名邀请码访问、每码 50 次成功质检额度、六维 LLM 分析、匿名反馈和隐私安全边界。

**架构：** 使用 FastAPI 模块化单体承载 API，SQLAlchemy + Alembic 管理 SQLite 数据，服务层隔离邀请码、配额、对话解析、LLM 和报告校验。完整聊天与报告只存在于单次请求内，数据库仅保存额度流水和匿名元数据。

**技术栈：** Python 3.11、FastAPI 0.141.1、Pydantic 2.13.4、SQLAlchemy 2.0.52、Alembic 1.19.1、OpenAI SDK 3.3.1、pytest 9.1.1、Ruff 0.16.4、mypy 2.3.1。

---

## 文件结构

### 工程与配置

- 创建 `backend/pyproject.toml`：Python 版本、项目元数据、Ruff、mypy、pytest 配置。
- 创建 `backend/requirements.txt`：锁定运行时依赖。
- 创建 `backend/requirements-dev.txt`：锁定测试与质量工具。
- 创建 `backend/.env.example`：仅列不含秘密的配置示例。
- 创建 `backend/.gitignore`、`backend/.vefaasignore`：排除秘密、数据库、虚拟环境和构建缓存。
- 创建 `backend/alembic.ini`、`backend/alembic/env.py`、`backend/alembic/script.py.mako`：数据库迁移配置。

### 应用代码

- 创建 `backend/app/main.py`：应用工厂、生命周期和路由注册。
- 创建 `backend/app/core/config.py`：环境配置及生产安全校验。
- 创建 `backend/app/core/database.py`：Engine、Session、SQLite pragma。
- 创建 `backend/app/core/security.py`：邀请码摘要、访问 Cookie 和 CSRF。
- 创建 `backend/app/core/errors.py`：领域错误和统一 API 错误。
- 创建 `backend/app/core/middleware.py`：request ID、安全响应头、请求体限制。
- 创建 `backend/app/core/logging.py`：结构化且不记录正文的日志。
- 创建 `backend/app/models.py`：邀请码、分析流水和反馈 ORM 模型。
- 创建 `backend/app/schemas/access.py`：访问接口结构。
- 创建 `backend/app/schemas/analysis.py`：话轮、模型结果和公开报告结构。
- 创建 `backend/app/schemas/feedback.py`：反馈接口结构。
- 创建 `backend/app/schemas/common.py`：错误、健康检查和公开配置结构。
- 创建 `backend/app/services/invites.py`：邀请码同步和验证。
- 创建 `backend/app/services/quotas.py`：额度预占、消费、释放和过期回收。
- 创建 `backend/app/services/transcript.py`：角色与轮次解析。
- 创建 `backend/app/services/reporting.py`：模型结果校验、证据核对和确定性计分。
- 创建 `backend/app/services/model_client.py`：OpenAI 兼容模型客户端与依赖协议。
- 创建 `backend/app/services/analysis.py`：完整分析编排。
- 创建 `backend/app/services/feedback.py`：反馈新增和更新。
- 创建 `backend/app/services/retention.py`：90 天匿名数据清理。
- 创建 `backend/app/services/prompts/qa_analysis_v1.md`：版本化系统 Prompt。
- 创建 `backend/app/api/dependencies.py`：数据库、访问上下文和 CSRF 依赖。
- 创建 `backend/app/api/routes/access.py`：邀请码访问接口。
- 创建 `backend/app/api/routes/analyses.py`：质检接口。
- 创建 `backend/app/api/routes/feedback.py`：反馈接口。
- 创建 `backend/app/api/routes/health.py`：存活与就绪接口。
- 创建 `backend/app/api/routes/public_config.py`：公开限制和版本。

### 数据库与测试

- 创建 `backend/alembic/versions/20260822_0001_initial.py`：首个数据库版本。
- 创建 `backend/tests/conftest.py`：临时数据库、测试 Settings、假模型和 TestClient。
- 创建 `backend/tests/unit/test_config.py`。
- 创建 `backend/tests/unit/test_security.py`。
- 创建 `backend/tests/unit/test_transcript.py`。
- 创建 `backend/tests/unit/test_reporting.py`。
- 创建 `backend/tests/unit/test_model_client.py`。
- 创建 `backend/tests/integration/test_access_api.py`。
- 创建 `backend/tests/integration/test_quota.py`。
- 创建 `backend/tests/integration/test_analysis_service.py`。
- 创建 `backend/tests/integration/test_analysis_api.py`。
- 创建 `backend/tests/integration/test_feedback_api.py`。
- 创建 `backend/tests/integration/test_privacy.py`。
- 创建 `backend/tests/integration/test_migrations.py`。

## 任务 1：建立可复现的后端骨架

**文件：**

- 创建：`backend/pyproject.toml`
- 创建：`backend/requirements.txt`
- 创建：`backend/requirements-dev.txt`
- 创建：`backend/.env.example`
- 创建：`backend/.gitignore`
- 创建：`backend/.vefaasignore`
- 创建：`backend/app/__init__.py`
- 创建：`backend/app/core/config.py`
- 测试：`backend/tests/unit/test_config.py`

- [ ] **步骤 1：编写配置失败测试**

```python
from pydantic import ValidationError

from app.core.config import Settings


def test_production_requires_session_and_invite_secrets() -> None:
    with pytest.raises(ValidationError):
        Settings(environment="prod", session_secret="", invite_code_pepper="")


def test_llm_key_is_optional_before_real_smoke() -> None:
    settings = Settings(environment="test", database_url="sqlite:///:memory:")
    assert settings.llm_api_key is None
    assert settings.invite_usage_limit == 50
```

- [ ] **步骤 2：运行测试并确认因 `app.core.config` 不存在而失败**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_config.py -q`

预期：`ModuleNotFoundError: No module named 'app'`。

- [ ] **步骤 3：写入依赖和最小 Settings**

`requirements.txt` 固定以下运行依赖：

```text
alembic==1.19.1
fastapi==0.141.1
itsdangerous==2.2.0
openai==3.3.1
pydantic==2.13.4
pydantic-settings==2.15.0
SQLAlchemy==2.0.52
uvicorn[standard]==0.52.4
```

`Settings` 必须包含：`environment`、`database_url`、`session_secret`、`invite_code_pepper`、`invite_codes`、`invite_usage_limit=50`、`access_ttl_seconds=43200`、`reservation_ttl_seconds=180`、`min_transcript_chars=20`、`max_transcript_chars=12000`、`max_turns=200`、`metadata_retention_days=90`、`llm_api_key`、`llm_base_url`、`llm_model`、`llm_timeout_seconds=60`、`llm_max_attempts=2`、`allowed_origins`。

```python
@model_validator(mode="after")
def validate_production_secrets(self) -> "Settings":
    if self.environment == "prod":
        if len(self.session_secret.get_secret_value()) < 32:
            raise ValueError("SESSION_SECRET must contain at least 32 characters")
        if len(self.invite_code_pepper.get_secret_value()) < 32:
            raise ValueError("INVITE_CODE_PEPPER must contain at least 32 characters")
    return self
```

- [ ] **步骤 4：创建 Python 3.11 环境、安装依赖并确认测试通过**

运行：

```bash
/Users/liuxs/.local/bin/python3.11 -m venv .venv-backend
env -u ALL_PROXY -u all_proxy .venv-backend/bin/pip install -r backend/requirements.txt -r backend/requirements-dev.txt
cd backend && ../.venv-backend/bin/pytest tests/unit/test_config.py -q
```

预期：2 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add backend
git commit -m "build: scaffold FastAPI backend"
```

## 任务 2：建立数据库模型和可重复迁移

**文件：**

- 创建：`backend/app/core/database.py`
- 创建：`backend/app/models.py`
- 创建：`backend/alembic.ini`
- 创建：`backend/alembic/env.py`
- 创建：`backend/alembic/script.py.mako`
- 创建：`backend/alembic/versions/20260822_0001_initial.py`
- 测试：`backend/tests/integration/test_migrations.py`

- [ ] **步骤 1：编写从空库升级的失败测试**

```python
def test_alembic_upgrade_creates_all_tables(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'migration.db'}"
    run_alembic_upgrade(database_url)
    inspector = inspect(create_engine(database_url))
    assert set(inspector.get_table_names()) == {
        "alembic_version", "invite_codes", "analysis_attempts", "feedback"
    }
```

- [ ] **步骤 2：运行测试并确认因 Alembic 配置不存在而失败**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_migrations.py -q`

预期：找不到 `alembic.ini` 或 `run_alembic_upgrade`。

- [ ] **步骤 3：实现 ORM 模型与迁移**

三个模型使用 UUID 字符串主键、UTC 时间和受控枚举。关键约束必须在数据库层表达：

```python
__table_args__ = (
    UniqueConstraint("invite_code_id", "idempotency_key", name="uq_attempt_invite_idempotency"),
    CheckConstraint("used_count >= 0", name="ck_invite_used_nonnegative"),
    CheckConstraint("reserved_count >= 0", name="ck_invite_reserved_nonnegative"),
    CheckConstraint("usage_limit > 0", name="ck_invite_limit_positive"),
)
```

SQLite 连接时设置 `journal_mode=WAL`、`foreign_keys=ON` 和 `busy_timeout=5000`。

- [ ] **步骤 4：运行迁移测试和 downgrade/upgrade 循环**

运行：

```bash
cd backend
../.venv-backend/bin/pytest tests/integration/test_migrations.py -q
DATABASE_URL=sqlite:///./data/test-migration.db ../.venv-backend/bin/alembic upgrade head
DATABASE_URL=sqlite:///./data/test-migration.db ../.venv-backend/bin/alembic downgrade base
DATABASE_URL=sqlite:///./data/test-migration.db ../.venv-backend/bin/alembic upgrade head
```

预期：测试通过，3 条迁移命令退出码均为 0。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/core/database.py backend/app/models.py backend/alembic.ini backend/alembic backend/tests/integration/test_migrations.py
git commit -m "feat: add backend persistence schema"
```

## 任务 3：实现邀请码摘要和匿名访问 Cookie

**文件：**

- 创建：`backend/app/core/security.py`
- 创建：`backend/app/services/invites.py`
- 创建：`backend/app/schemas/access.py`
- 测试：`backend/tests/unit/test_security.py`

- [ ] **步骤 1：编写摘要、篡改和过期测试**

```python
def test_invite_digest_never_contains_plain_code(security: Security) -> None:
    code = "pilot_" + "A" * 32
    digest = security.digest_invite(code)
    assert code not in digest
    assert len(digest) == 64


def test_access_token_rejects_tampering(security: Security) -> None:
    token, csrf = security.issue_access("invite-1")
    with pytest.raises(AccessExpired):
        security.read_access(token + "x")
    assert csrf
```

- [ ] **步骤 2：运行测试并确认缺少 Security 实现**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_security.py -q`

预期：导入失败。

- [ ] **步骤 3：实现 HMAC 摘要和签名访问载荷**

```python
def digest_invite(self, code: str) -> str:
    return hmac.new(self.pepper, code.strip().encode(), hashlib.sha256).hexdigest()

def issue_access(self, invite_id: str) -> tuple[str, str]:
    csrf = secrets.token_urlsafe(24)
    token = self.serializer.dumps({"invite_id": invite_id, "csrf": csrf})
    return token, csrf
```

`InviteService.sync_configured_codes()` 按 `INVITE_CODES` 顺序生成 `pilot-01` 等标签，只保存摘要；重复启动不重置 `used_count`。

- [ ] **步骤 4：运行测试并扫描明文泄露**

运行：

```bash
cd backend && ../.venv-backend/bin/pytest tests/unit/test_security.py -q
rg -n "pilot_[A-Za-z0-9]{16,}" app tests --glob '!tests/unit/test_security.py'
```

预期：测试通过；扫描无匹配。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/core/security.py backend/app/services/invites.py backend/app/schemas/access.py backend/tests/unit/test_security.py
git commit -m "feat: add anonymous invite access tokens"
```

## 任务 4：实现 50 次事务配额

**文件：**

- 创建：`backend/app/services/quotas.py`
- 测试：`backend/tests/integration/test_quota.py`

- [ ] **步骤 1：编写第 51 次、失败释放和重复 Key 测试**

```python
def test_only_fifty_successes_can_be_consumed(quota_service: QuotaService, invite_id: str) -> None:
    for index in range(50):
        attempt = quota_service.reserve(invite_id, str(uuid4()), "sales", 120, 4)
        quota_service.consume(attempt.id, completed_metadata())
    with pytest.raises(InviteQuotaExhausted):
        quota_service.reserve(invite_id, str(uuid4()), "sales", 120, 4)


def test_released_attempt_does_not_reduce_quota(quota_service: QuotaService, invite_id: str) -> None:
    attempt = quota_service.reserve(invite_id, str(uuid4()), "sales", 120, 4)
    quota_service.release(attempt.id, "MODEL_TIMEOUT")
    assert quota_service.remaining(invite_id) == 50
```

- [ ] **步骤 2：运行测试并确认 QuotaService 缺失**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_quota.py -q`

预期：导入失败。

- [ ] **步骤 3：实现原子预占、消费、释放与过期回收**

预占使用条件更新：

```python
statement = (
    update(InviteCode)
    .where(
        InviteCode.id == invite_id,
        InviteCode.is_active.is_(True),
        InviteCode.used_count + InviteCode.reserved_count < InviteCode.usage_limit,
    )
    .values(reserved_count=InviteCode.reserved_count + 1, updated_at=utc_now())
)
```

`consume()` 必须在同一事务中把流水从 `reserved` 改为 `consumed`，并执行 `reserved_count - 1`、`used_count + 1`。`release()` 只允许从 `reserved` 转为 `released`。过期回收处理 180 秒前仍为 `reserved` 的流水。

- [ ] **步骤 4：运行顺序和并发配额测试**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_quota.py -q`

预期：包括 ThreadPoolExecutor 并发用例在内全部通过，数据库最终 `used_count=50`、`reserved_count=0`。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/services/quotas.py backend/tests/integration/test_quota.py
git commit -m "feat: enforce fifty-use invite quota"
```

## 任务 5：实现对话解析和输入边界

**文件：**

- 创建：`backend/app/schemas/analysis.py`
- 创建：`backend/app/services/transcript.py`
- 测试：`backend/tests/unit/test_transcript.py`

- [ ] **步骤 1：编写销售、客服和错误路径测试**

```python
@pytest.mark.parametrize("qa_type,employee_label", [("sales", "销售"), ("customer_service", "客服")])
def test_parses_two_party_conversation(qa_type: str, employee_label: str) -> None:
    parsed = parse_transcript(f"客户：太贵了。\n{employee_label}：可以说说预算吗？", qa_type, limits())
    assert [turn.id for turn in parsed.turns] == ["t1", "t2"]
    assert [turn.role for turn in parsed.turns] == ["customer", "employee"]


@pytest.mark.parametrize("text", ["只有一段说明", "客户：你好", "客户A：你好\n客户B：你好\n销售：您好"])
def test_rejects_unscorable_role_structure(text: str) -> None:
    with pytest.raises(TranscriptInvalid):
        parse_transcript(text, "sales", limits())
```

- [ ] **步骤 2：运行测试并确认解析器缺失**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_transcript.py -q`

预期：导入失败。

- [ ] **步骤 3：实现确定性解析**

解析器支持全角和半角冒号，保留原句，生成稳定 `tN`。销售员工标签仅接受「销售／顾问／员工」，客服员工标签仅接受「客服／坐席／员工」。检测多人标签、单方发言、无有效往返、20 字以下、12,000 字以上和 200 轮以上并返回稳定错误码。

- [ ] **步骤 4：运行解析测试**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_transcript.py -q`

预期：全部通过。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/schemas/analysis.py backend/app/services/transcript.py backend/tests/unit/test_transcript.py
git commit -m "feat: parse and validate conversation turns"
```

## 任务 6：实现报告结构校验和确定性计分

**文件：**

- 创建：`backend/app/services/reporting.py`
- 测试：`backend/tests/unit/test_reporting.py`

- [ ] **步骤 1：编写半分进位、部分报告和证据错误测试**

```python
def test_total_score_uses_round_half_up() -> None:
    result = build_report(model_result(scores=[60, 61, 60, 61]), parsed_transcript())
    assert result.total_score == 61
    assert result.analysis_status == "scored"


def test_three_scored_dimensions_never_get_total_score() -> None:
    result = build_report(model_result(scores=[80, 70, 60]), parsed_transcript())
    assert result.analysis_status == "partial"
    assert result.total_score is None


def test_quote_must_exist_in_referenced_turn() -> None:
    with pytest.raises(ModelOutputInvalid):
        build_report(model_result(quote="模型编造的原句"), parsed_transcript())
```

- [ ] **步骤 2：运行测试并确认 reporting 模块缺失**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_reporting.py -q`

预期：导入失败。

- [ ] **步骤 3：实现六维、证据和总分校验**

固定维度为「需求理解、情绪与语气、信息准确性、异议处理、推进能力、风险话术」。使用 `Decimal(...).quantize(Decimal("1"), rounding=ROUND_HALF_UP)`。验证证据 turn ID、逐字 quote、主要问题上限和状态／分数字段一致性。发现明确停止联系时覆盖建议回复：

```python
SAFE_STOP_REPLY = "好的，感谢你的明确说明，我们不会再继续打扰。祝你一切顺利。"
```

- [ ] **步骤 4：运行报告测试**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_reporting.py -q`

预期：全部通过。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/services/reporting.py backend/tests/unit/test_reporting.py
git commit -m "feat: validate and score quality reports"
```

## 任务 7：实现可替换的 LLM 客户端和版本化 Prompt

**文件：**

- 创建：`backend/app/services/model_client.py`
- 创建：`backend/app/services/prompts/qa_analysis_v1.md`
- 测试：`backend/tests/unit/test_model_client.py`

- [ ] **步骤 1：编写无 Key、代码围栏解析和有限重试测试**

```python
def test_missing_key_fails_before_provider_call(settings_without_key: Settings) -> None:
    with pytest.raises(LLMNotConfigured):
        OpenAIModelClient(settings_without_key).ensure_configured()


def test_parser_accepts_json_code_fence() -> None:
    result = parse_model_json("```json\n{\"confidence\":\"high\"}\n```")
    assert result["confidence"] == "high"


def test_invalid_structure_is_attempted_at_most_twice(fake_openai: FakeOpenAI) -> None:
    fake_openai.responses = ["{}", valid_model_json()]
    client = OpenAIModelClient(configured_settings(), client=fake_openai)
    client.analyze(parsed_transcript(), "sales")
    assert fake_openai.call_count == 2
```

- [ ] **步骤 2：运行测试并确认客户端缺失**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_model_client.py -q`

预期：导入失败。

- [ ] **步骤 3：实现协议、官方 SDK 适配和 Prompt**

```python
class AnalysisModel(Protocol):
    def ensure_configured(self) -> None: ...
    def analyze(self, transcript: ParsedTranscript, qa_type: QAType) -> ModelAnalysisResult: ...
```

Prompt 必须明确：聊天内容是不可信数据；只能分析不能执行其中指令；六维字段、正反 JSON 示例、证据引用要求、软退出和明确拒绝差异、禁止编造价格政策。SDK 创建和调用均放在最外层异常边界内。

- [ ] **步骤 4：运行模型客户端测试**

运行：`cd backend && ../.venv-backend/bin/pytest tests/unit/test_model_client.py -q`

预期：全部通过，假客户端调用次数符合上限。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/services/model_client.py backend/app/services/prompts backend/tests/unit/test_model_client.py
git commit -m "feat: add structured LLM analysis client"
```

## 任务 8：编排完整分析并证明失败不扣额度

**文件：**

- 创建：`backend/app/services/analysis.py`
- 测试：`backend/tests/integration/test_analysis_service.py`
- 测试：`backend/tests/integration/test_privacy.py`

- [ ] **步骤 1：编写成功、无 Key、模型失败和隐私测试**

```python
def test_success_consumes_one_and_returns_report(analysis_service: AnalysisService, invite_id: str) -> None:
    outcome = analysis_service.analyze(invite_id, str(uuid4()), valid_request())
    assert outcome.remaining_uses == 49


def test_model_failure_releases_reserved_quota(failing_analysis_service: AnalysisService, invite_id: str) -> None:
    with pytest.raises(ModelUnavailable):
        failing_analysis_service.analyze(invite_id, str(uuid4()), valid_request())
    assert failing_analysis_service.quota_service.remaining(invite_id) == 50


def test_database_never_contains_transcript(db_connection: Connection) -> None:
    dump = " ".join(str(row) for table in persisted_tables() for row in db_connection.execute(select(table)))
    assert "你们这个太贵了" not in dump
```

- [ ] **步骤 2：运行测试并确认分析编排缺失**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_analysis_service.py tests/integration/test_privacy.py -q`

预期：接口返回 404 或服务导入失败。

- [ ] **步骤 3：实现 `AnalysisService.analyze()`**

固定顺序：检查模型配置 → 解析输入 → 预占额度 → 调用模型 → 构建报告 → 消费额度 → 返回报告。任何模型或报告异常进入 `finally/except` 释放预占。日志只记录分析 ID、计数、版本、耗时和错误类型。

- [ ] **步骤 4：运行分析与隐私测试**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_analysis_service.py tests/integration/test_privacy.py -q`

预期：全部通过；失败用例剩余额度仍为 50。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/services/analysis.py backend/tests/integration/test_analysis_service.py backend/tests/integration/test_privacy.py
git commit -m "feat: orchestrate private quota-aware analysis"
```

## 任务 9：实现统一 API、中间件和访问接口

**文件：**

- 创建：`backend/app/core/errors.py`
- 创建：`backend/app/core/logging.py`
- 创建：`backend/app/core/middleware.py`
- 创建：`backend/app/api/dependencies.py`
- 创建：`backend/app/api/routes/access.py`
- 创建：`backend/app/api/routes/analyses.py`
- 创建：`backend/app/api/routes/health.py`
- 创建：`backend/app/api/routes/public_config.py`
- 创建：`backend/app/main.py`
- 测试：`backend/tests/integration/test_access_api.py`
- 测试：`backend/tests/integration/test_analysis_api.py`

- [ ] **步骤 1：编写 Cookie、CSRF、错误结构和健康检查测试**

```python
def test_valid_invite_sets_httponly_cookie(client: TestClient) -> None:
    response = client.post("/api/v1/access/redeem", json={"code": TEST_INVITE})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]


def test_missing_csrf_is_rejected(access_client: TestClient) -> None:
    response = access_client.post("/api/v1/analyses", json=valid_request(), headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "CSRF_INVALID"


def test_ready_reports_llm_configuration_without_failing_startup(client: TestClient) -> None:
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["llm_configured"] is False
```

- [ ] **步骤 2：运行接口测试并确认 404**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_access_api.py -q`

预期：目标接口返回 404。

- [ ] **步骤 3：实现应用工厂和路由**

`create_app(settings, model_client)` 在 lifespan 中运行迁移状态检查、同步邀请码和清理陈旧预占。统一错误包含 `code`、安全 `message`、`request_id`、可选 `field_errors`。中间件设置 CSP、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`，拒绝超过配置的请求体。

- [ ] **步骤 4：运行访问和分析接口测试**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_access_api.py tests/integration/test_analysis_api.py -q`

预期：全部通过，错误响应没有堆栈。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/core backend/app/api backend/app/main.py backend/tests/integration/test_access_api.py
git commit -m "feat: expose secure versioned backend API"
```

## 任务 10：实现匿名反馈和保留期清理

**文件：**

- 创建：`backend/app/schemas/feedback.py`
- 创建：`backend/app/services/feedback.py`
- 创建：`backend/app/services/retention.py`
- 创建：`backend/app/api/routes/feedback.py`
- 测试：`backend/tests/integration/test_feedback_api.py`

- [ ] **步骤 1：编写反馈新增、更新、跨邀请码和清理测试**

```python
def test_feedback_can_be_created_then_updated(client: TestClient, completed_analysis: CompletedAnalysis) -> None:
    first = put_feedback(client, completed_analysis, {"helpful": True})
    second = put_feedback(client, completed_analysis, {"helpful": False, "reason_code": "score_unfair"})
    assert first.status_code == 200
    assert second.json()["helpful"] is False


def test_other_invite_cannot_modify_feedback(other_access_client: TestClient, completed_analysis: CompletedAnalysis) -> None:
    response = put_feedback(other_access_client, completed_analysis, {"helpful": True})
    assert response.status_code == 404
```

- [ ] **步骤 2：运行测试并确认接口 404**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_feedback_api.py -q`

预期：接口返回 404。

- [ ] **步骤 3：实现 upsert 和 90 天清理**

反馈只允许已 `consumed` 且属于当前邀请码的分析 ID。`RetentionService.cleanup()` 删除 90 天前的反馈和分析流水，但保留邀请码累计 `used_count`，防止删除元数据后恢复额度。

- [ ] **步骤 4：运行反馈与隐私测试**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_feedback_api.py tests/integration/test_privacy.py -q`

预期：全部通过。

- [ ] **步骤 5：Commit**

```bash
git add backend/app/schemas/feedback.py backend/app/services/feedback.py backend/app/services/retention.py backend/app/api/routes/feedback.py backend/tests/integration/test_feedback_api.py
git commit -m "feat: store anonymous report feedback"
```

## 任务 11：完成后端质量门禁和运行文档

**文件：**

- 创建：`backend/README.md`
- 修改：`README.md`
- 创建：`docs/technical/2026-08-22-backend-mvp.md`
- 修改：`backend/pyproject.toml`

- [ ] **步骤 1：先运行全量门禁并记录当前失败项**

运行：

```bash
cd backend
../.venv-backend/bin/ruff check app tests
../.venv-backend/bin/mypy app
../.venv-backend/bin/pytest --cov=app --cov-report=term-missing --cov-fail-under=90
```

预期：首次运行会暴露格式、类型或覆盖率缺口；保留输出作为修复依据。

- [ ] **步骤 2：补充失败测试或最小代码，直到门禁全绿**

不得用 `# noqa`、`type: ignore`、删除测试或降低覆盖率掩盖问题。只对第三方无类型信息且已验证接口的最小边界允许局部 `cast()`。

- [ ] **步骤 3：编写运行与验收文档**

文档必须包含：Python 3.11 环境、安装、迁移、启动端口 8010、环境变量、生成安全邀请码的方法、curl 验证、无 Key 行为、mock 自动化测试、真实模型冒烟命令、隐私边界和数据库位置。

- [ ] **步骤 4：启动服务并完成无 Key API 冒烟**

运行：

```bash
cd backend
ENVIRONMENT=dev DATABASE_URL=sqlite:///./data/app.db ../.venv-backend/bin/alembic upgrade head
ENVIRONMENT=dev DATABASE_URL=sqlite:///./data/app.db ../.venv-backend/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

另一个终端验证：`GET /health/live` 为 200、`GET /health/ready` 为 200 且 `llm_configured=false`、无访问 Cookie 调分析为 401、正确邀请码可兑换、无 LLM Key 的有效分析为 503 且剩余额度不变。

- [ ] **步骤 5：Commit**

```bash
git add backend README.md docs/technical/2026-08-22-backend-mvp.md
git commit -m "docs: add backend runbook and verification"
```

## 任务 12：后端阶段最终核验

**文件：**

- 修改：`docs/technical/2026-08-22-backend-mvp.md`

- [ ] **步骤 1：从空数据库重新执行完整验证**

运行：

```bash
cd backend
../.venv-backend/bin/alembic upgrade head
../.venv-backend/bin/ruff check app tests
../.venv-backend/bin/mypy app
../.venv-backend/bin/pytest --cov=app --cov-report=term-missing --cov-fail-under=90
```

预期：所有命令退出码为 0，测试无警告和错误。

- [ ] **步骤 2：运行 50 次额度专项核验**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_quota.py -q -x`

预期：第 50 次成功，第 51 次得到 `INVITE_QUOTA_EXHAUSTED`，失败和重复请求不扣额度。

- [ ] **步骤 3：运行隐私专项核验**

运行：`cd backend && ../.venv-backend/bin/pytest tests/integration/test_privacy.py -q -x`

预期：数据库、日志和错误响应均不包含测试聊天原文、证据或建议回复。

- [ ] **步骤 4：记录真实模型验收状态**

如果 `LLM_API_KEY` 未设置，文档明确记录「真实模型冒烟待用户提供 Key 后执行」，不得把假模型测试写成真实验收。如果已设置，则用 PRD 示例执行一次真实冒烟并记录模型、耗时、重试、结构和内容质量。

- [ ] **步骤 5：提交核验记录**

```bash
git add docs/technical/2026-08-22-backend-mvp.md
git commit -m "test: record backend MVP verification"
```

## 计划自检

- 规格覆盖：邀请码访问、50 次成功额度、失败释放、隐私不落正文、双角色解析、六维报告、确定性总分、风险、反馈、统一错误、健康检查、迁移和双层验收均有对应任务。
- 完整性：计划不含未决标记、模糊处理要求或省略实现。
- 类型一致性：邀请码主键、分析 ID 和幂等 Key 均使用 UUID 字符串；报告状态、维度状态、风险等级和额度状态在模型、Schema、服务和测试中保持一致。
- 阶段边界：本计划不创建正式前端，不实现历史报告、注册登录、批量上传或企业接入。

## 执行方式

计划保存后采用当前会话内联执行。当前环境的开发约束不允许主动派遣子代理，因此使用 `superpowers:executing-plans` 分批执行并在每批后核验。
