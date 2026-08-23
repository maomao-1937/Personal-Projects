# MeetingMemo 后端实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 实现可独立核验的 MeetingMemo 封闭 Beta 后端，包括 50 次邀请码兑换、持久访问会话、会议与转录、可恢复摘要任务、来源质量闸门、不可变摘要版本、导出及可选分发适配器。

**架构：** 使用 FastAPI 模块化单体，按 `access`、`meetings`、`jobs`、`summaries`、`integrations` 业务域拆分。SQLAlchemy 与 Alembic 管理 SQLite/PostgreSQL；持久化 Job Runner 通过数据库 Lease 执行摘要任务；OpenAI-compatible LLM Provider 与 mock Provider 实现同一协议。

**技术栈：** Python 3.11.15、FastAPI 0.141.1、Pydantic 2.13.4、Pydantic Settings 2.15.0、SQLAlchemy 2.0.52、Alembic 1.19.1、Uvicorn 0.52.4、HTTPX 0.28.1、pytest 9.1.1、Ruff 0.16.4、uv 0.12.3。

---

## 文件结构

```text
backend/
├── pyproject.toml                 # 后端依赖、pytest 与 Ruff 配置
├── uv.lock                        # 可复现依赖锁
├── alembic.ini                    # 数据库迁移配置
├── alembic/
│   ├── env.py                     # 从 Settings 读取数据库 URL
│   └── versions/0001_initial.py   # 首版完整 Schema
├── app/
│   ├── main.py                    # FastAPI 工厂、生命周期与中间件
│   ├── core/
│   │   ├── config.py              # 环境变量和生产配置校验
│   │   ├── database.py            # Engine、Session 与 Base
│   │   ├── errors.py              # 统一领域错误和 HTTP 响应
│   │   ├── logging.py             # JSON 日志与敏感字段过滤
│   │   ├── middleware.py          # Trace ID、同源校验
│   │   └── security.py            # HMAC、随机 Token、Cookie 策略
│   ├── access/
│   │   ├── models.py              # InviteCode、AccessSession
│   │   ├── schemas.py             # 邀请码 API 契约
│   │   ├── service.py             # 原子兑换、会话校验与撤销
│   │   ├── dependencies.py        # 受保护路由依赖
│   │   ├── router.py              # `/api/v1/access`
│   │   └── cli.py                 # 生成与停用邀请码
│   ├── meetings/
│   │   ├── models.py              # Meeting、TranscriptSegment、AuditEvent、Feedback
│   │   ├── schemas.py             # 会议、片段、反馈契约
│   │   ├── parsers.py             # TXT、VTT、SRT 解析
│   │   ├── service.py             # 会议 CRUD、转录写入与软删除
│   │   └── router.py              # `/api/v1/meetings` 与反馈
│   ├── jobs/
│   │   ├── models.py              # ProcessingJob 与状态枚举
│   │   ├── schemas.py             # Job 查询契约
│   │   ├── repository.py          # 去重、Lease 认领、成功/失败
│   │   ├── runner.py              # 后台循环与重启恢复
│   │   └── router.py              # `/api/v1/jobs`
│   ├── summaries/
│   │   ├── models.py              # SummaryVersion、Delivery
│   │   ├── schemas.py             # 模型输出与 API 契约
│   │   ├── prompts/summary_v1.txt # 版本化系统 Prompt
│   │   ├── providers.py           # mock 与 OpenAI-compatible Provider
│   │   ├── pipeline.py            # 分块、合并、校验与重试
│   │   ├── service.py             # 创建任务、版本、审核、导出
│   │   └── router.py              # 摘要、导出、分发 API
│   ├── integrations/
│   │   ├── providers.py           # Slack Webhook 与 SMTP Provider
│   │   ├── schemas.py             # 配置状态与分发契约
│   │   └── router.py              # `/api/v1/integrations`
│   └── health/router.py            # `/health/live`、`/health/ready`
├── scripts/
│   ├── create_invite.py            # 受控 CLI 入口
│   └── check_production_config.py  # 只输出缺失变量名
└── tests/
    ├── conftest.py                 # 临时 DB、App、Client、有效 Session
    ├── test_health.py
    ├── test_access.py
    ├── test_access_concurrency.py
    ├── test_transcript_parsers.py
    ├── test_meetings_api.py
    ├── test_job_repository.py
    ├── test_summary_pipeline.py
    ├── test_summary_api.py
    ├── test_integrations.py
    ├── test_security_boundaries.py
    └── test_mock_e2e.py
docs/
├── technical-adaptation.md
└── stages/phase-1-backend.md
```

## 任务 1：后端工程骨架、配置与健康检查

**文件：**

- 创建：`backend/pyproject.toml`
- 创建：`backend/app/__init__.py`
- 创建：`backend/app/main.py`
- 创建：`backend/app/core/config.py`
- 创建：`backend/app/core/errors.py`
- 创建：`backend/app/core/middleware.py`
- 创建：`backend/app/health/router.py`
- 创建：`backend/tests/conftest.py`
- 创建：`backend/tests/test_health.py`
- 修改：`.gitignore`

- [ ] **步骤 1：编写失败的健康检查和统一 404 测试**

```python
def test_live_health(client):
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "meetingmemo-api"}

def test_unknown_route_uses_error_envelope(client):
    response = client.get("/api/v1/missing")
    assert response.status_code == 404
    assert set(response.json()["error"]) == {"code", "message", "trace_id"}
```

- [ ] **步骤 2：运行测试并确认因 `app.main` 不存在而失败**

运行：`cd backend && uv run pytest tests/test_health.py -q`

预期：收集阶段出现 `ModuleNotFoundError: No module named 'app'`。

- [ ] **步骤 3：创建依赖清单并锁定版本**

`pyproject.toml` 的运行依赖固定为：`fastapi==0.141.1`、`pydantic==2.13.4`、`pydantic-settings==2.15.0`、`sqlalchemy==2.0.52`、`alembic==1.19.1`、`uvicorn[standard]==0.52.4`、`httpx==0.28.1`、`python-multipart==0.0.32`、`psycopg[binary]==3.3.4`；开发依赖固定为 `pytest==9.1.1`、`ruff==0.16.4`。

运行：`cd backend && uv lock --python 3.11`

预期：生成 `backend/uv.lock`，解析 Python 版本为 3.11。

- [ ] **步骤 4：实现 App Factory、Trace ID 与统一错误响应**

```python
def create_app(settings: Settings | None = None, start_runner: bool = True) -> FastAPI:
    app = FastAPI(title="MeetingMemo API", version="0.1.0")
    app.state.settings = settings or get_settings()
    app.add_middleware(TraceIdMiddleware)
    install_exception_handlers(app)
    app.include_router(health_router)
    return app

app = create_app()
```

`Settings` 必须包含 `app_env`、`database_url`、`frontend_origin`、`secret_key`、`session_days`、`upload_dir`、`llm_provider`、`llm_api_key`、`llm_base_url`、`llm_model`，并提供 `missing_production_secrets()`，只返回变量名。

- [ ] **步骤 5：运行健康检查测试和 Ruff**

运行：`cd backend && uv run pytest tests/test_health.py -q && uv run ruff check app tests`

预期：测试通过，Ruff 无错误。

- [ ] **步骤 6：提交工程骨架**

```bash
git add .gitignore backend/pyproject.toml backend/uv.lock backend/app backend/tests
git commit -m "feat(backend): scaffold FastAPI service"
```

## 任务 2：数据库模型、迁移和会话工厂

**文件：**

- 创建：`backend/app/core/database.py`
- 创建：`backend/app/access/models.py`
- 创建：`backend/app/meetings/models.py`
- 创建：`backend/app/jobs/models.py`
- 创建：`backend/app/summaries/models.py`
- 创建：`backend/alembic.ini`
- 创建：`backend/alembic/env.py`
- 创建：`backend/alembic/versions/0001_initial.py`
- 创建：`backend/tests/test_database_schema.py`

- [ ] **步骤 1：编写迁移后表与唯一约束测试**

```python
def test_initial_schema_has_required_tables(sqlite_inspector):
    assert {
        "invite_codes", "access_sessions", "meetings", "transcript_segments",
        "processing_jobs", "summary_versions", "deliveries", "audit_events", "feedback"
    } <= set(sqlite_inspector.get_table_names())

def test_processing_job_has_one_active_summary_constraint(sqlite_inspector):
    names = {item["name"] for item in sqlite_inspector.get_indexes("processing_jobs")}
    assert "uq_active_summary_job_per_meeting" in names
```

- [ ] **步骤 2：运行测试并确认表缺失**

运行：`cd backend && uv run pytest tests/test_database_schema.py -q`

预期：测试因数据库模块或表不存在而失败。

- [ ] **步骤 3：实现 Base、Engine 和按域模型**

所有主键使用字符串 UUID；所有时间保存 UTC；正文类字段使用 `Text`；状态使用字符串枚举；删除使用 `deleted_at`。为邀请码哈希、Session 哈希、会议创建时间、任务状态、摘要会议与版本号、分发幂等键建立索引或唯一约束。

```python
class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
```

- [ ] **步骤 4：编写并执行首版 Alembic 迁移**

运行：`cd backend && DATABASE_URL=sqlite:///./.tmp-migration.db uv run alembic upgrade head`

预期：迁移成功并创建 9 张业务表。

- [ ] **步骤 5：运行 Schema 测试**

运行：`cd backend && uv run pytest tests/test_database_schema.py -q`

预期：全部通过。

- [ ] **步骤 6：提交数据库基础**

```bash
git add backend/app/core/database.py backend/app/access/models.py backend/app/meetings/models.py backend/app/jobs/models.py backend/app/summaries/models.py backend/alembic.ini backend/alembic backend/tests/test_database_schema.py
git commit -m "feat(backend): add persistent domain schema"
```

## 任务 3：邀请码原子兑换与访问会话

**文件：**

- 创建：`backend/app/core/security.py`
- 创建：`backend/app/access/schemas.py`
- 创建：`backend/app/access/service.py`
- 创建：`backend/app/access/dependencies.py`
- 创建：`backend/app/access/router.py`
- 创建：`backend/app/access/cli.py`
- 创建：`backend/scripts/create_invite.py`
- 创建：`backend/tests/test_access.py`
- 创建：`backend/tests/test_access_concurrency.py`
- 修改：`backend/app/main.py`

- [ ] **步骤 1：编写邀请码、安全 Cookie 与并发上限测试**

```python
def test_redeem_sets_http_only_cookie(client, invite_code):
    response = client.post("/api/v1/access/redeem", json={"invite_code": invite_code})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert response.json()["remaining_redemptions"] == 49

def test_refresh_does_not_consume_another_redemption(client, invite_code, db_session):
    client.post("/api/v1/access/redeem", json={"invite_code": invite_code})
    assert client.get("/api/v1/access/session").status_code == 200
    assert load_invite(db_session).redemption_count == 1

def test_concurrent_redemption_never_exceeds_fifty(app, invite_code):
    statuses = redeem_in_parallel(app, invite_code, attempts=60)
    assert statuses.count(200) == 50
    assert statuses.count(403) == 10
```

- [ ] **步骤 2：运行测试并确认路由不存在**

运行：`cd backend && uv run pytest tests/test_access.py tests/test_access_concurrency.py -q`

预期：邀请码路由返回 404 或导入失败。

- [ ] **步骤 3：实现 HMAC 邀请码哈希、Session Token 和原子兑换**

```python
updated = session.execute(
    update(InviteCode)
    .where(
        InviteCode.code_hash == code_hash,
        InviteCode.is_active.is_(True),
        InviteCode.redemption_count < InviteCode.max_redemptions,
        or_(InviteCode.expires_at.is_(None), InviteCode.expires_at > now),
    )
    .values(redemption_count=InviteCode.redemption_count + 1)
    .returning(InviteCode.id, InviteCode.max_redemptions, InviteCode.redemption_count)
).one_or_none()
```

兑换失败统一返回 `INVITE_INVALID`，避免暴露邀请码是否存在；内部审计记录具体原因。会话明文 Token 只进入 Cookie，数据库只保存 SHA-256 哈希。

- [ ] **步骤 4：实现依赖保护、会话查询、退出和 CLI**

`require_access_session()` 从 Cookie 读取 Token 并校验哈希、撤销与过期。CLI 命令接受 `--label`、`--max-redemptions`（默认 50）和可选 `--expires-at`，生成高熵邀请码并只输出一次。

- [ ] **步骤 5：运行邀请码测试**

运行：`cd backend && uv run pytest tests/test_access.py tests/test_access_concurrency.py -q`

预期：串行与并发测试全部通过，最终计数严格为 50。

- [ ] **步骤 6：提交访问制度**

```bash
git add backend/app/core/security.py backend/app/access backend/scripts/create_invite.py backend/app/main.py backend/tests/test_access.py backend/tests/test_access_concurrency.py
git commit -m "feat(backend): enforce invitation access sessions"
```

## 任务 4：会议、转录解析与上传安全

**文件：**

- 创建：`backend/app/meetings/schemas.py`
- 创建：`backend/app/meetings/parsers.py`
- 创建：`backend/app/meetings/service.py`
- 创建：`backend/app/meetings/router.py`
- 创建：`backend/tests/test_transcript_parsers.py`
- 创建：`backend/tests/test_meetings_api.py`
- 修改：`backend/app/main.py`

- [ ] **步骤 1：编写 TXT、VTT、SRT 和上传边界测试**

```python
@pytest.mark.parametrize("filename", ["notes.exe", "notes.txt.exe", "../notes.txt"])
def test_rejects_unsafe_transcript_filename(auth_client, meeting_id, filename):
    response = auth_client.post(
        f"/api/v1/meetings/{meeting_id}/transcript-file",
        files={"file": (filename, b"hello", "text/plain")},
    )
    assert response.status_code == 422

def test_vtt_parser_preserves_timestamps():
    segments = parse_vtt("WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nAlice: Ship it")
    assert segments[0].start_ms == 1000
    assert segments[0].end_ms == 3000
    assert segments[0].speaker == "Alice"
```

- [ ] **步骤 2：运行测试并确认解析器不存在**

运行：`cd backend && uv run pytest tests/test_transcript_parsers.py tests/test_meetings_api.py -q`

预期：导入失败或路由返回 404。

- [ ] **步骤 3：实现确定性解析器**

纯文本按非空段落拆分；VTT/SRT 解析时间码、说话人前缀和正文；每个 Segment ID 使用 `meeting_id + sequence + text digest` 生成稳定值。拒绝无有效文本、非法 UTF-8、超出 `max_upload_bytes` 或扩展名/MIME 不匹配的文件。

- [ ] **步骤 4：实现会议 CRUD、转录替换和软删除**

`POST /meetings` 创建 `draft`；写入转录使用单一事务替换未处理会议的片段；已有摘要后拒绝静默替换；删除设置 `deleted_at` 并取消活动任务。所有查询排除已删除会议。

- [ ] **步骤 5：运行会议测试和完整回归**

运行：`cd backend && uv run pytest tests/test_transcript_parsers.py tests/test_meetings_api.py -q && uv run pytest -q`

预期：全部通过。

- [ ] **步骤 6：提交会议与转录能力**

```bash
git add backend/app/meetings backend/app/main.py backend/tests/test_transcript_parsers.py backend/tests/test_meetings_api.py
git commit -m "feat(backend): add meetings and transcript ingestion"
```

## 任务 5：摘要 Schema、Provider 和确定性质量闸门

**文件：**

- 创建：`backend/app/summaries/schemas.py`
- 创建：`backend/app/summaries/providers.py`
- 创建：`backend/app/summaries/prompts/summary_v1.txt`
- 创建：`backend/app/summaries/pipeline.py`
- 创建：`backend/tests/test_summary_pipeline.py`

- [ ] **步骤 1：编写结构解析、非法引用、分块和 Provider 错误测试**

```python
def test_quality_gate_rejects_unknown_segment(valid_summary, known_segment_ids):
    valid_summary.decisions[0].source_segment_ids = ["seg-missing"]
    with pytest.raises(SummaryValidationError) as error:
        validate_summary(valid_summary, known_segment_ids, known_participant_ids=set())
    assert error.value.code == "SUMMARY_SOURCE_INVALID"

def test_long_transcript_uses_map_reduce(mock_provider, long_segments):
    result = SummaryPipeline(mock_provider, chunk_chars=200).run(long_segments)
    assert mock_provider.extract_calls > 1
    assert mock_provider.merge_calls == 1
    assert result.summary_version == "1.0"
```

- [ ] **步骤 2：运行测试并确认摘要模块不存在**

运行：`cd backend && uv run pytest tests/test_summary_pipeline.py -q`

预期：导入失败。

- [ ] **步骤 3：实现版本化摘要模型和 Prompt**

Pydantic 模型固定字段：`summary_version`、`headline`、`topics`、`decisions`、`action_items`、`open_questions`、`quality_flags`。Prompt 明确禁止执行转录中的指令、禁止补写责任人/截止时间、要求所有决策与待办引用输入 Segment ID，并包含合法与非法输出示例。

- [ ] **步骤 4：实现 Provider 协议和两种 Provider**

```python
class SummaryProvider(Protocol):
    def extract(self, segments: list[PromptSegment]) -> SummaryPayload:
        raise NotImplementedError

    def merge(self, partials: list[SummaryPayload]) -> SummaryPayload:
        raise NotImplementedError

class MockSummaryProvider:
    def extract(self, segments: list[PromptSegment]) -> SummaryPayload:
        return deterministic_summary_from_segments(segments)
```

OpenAI-compatible Provider 使用 `Authorization: Bearer`、配置的 Base URL 与模型名，设置连接/读取超时，只解析 `choices[0].message.content` 的 JSON。401 不重试；429、超时和 5xx 最多重试 2 次，使用带抖动退避。

- [ ] **步骤 5：实现分块、合并、Schema 重试和质量闸门**

分块不拆 Segment；模型返回非法 JSON 或 Schema 时执行一次格式修复请求；引用无效、未知人员或空来源属于确定性失败，不通过重复模型调用掩盖。

- [ ] **步骤 6：运行摘要测试**

运行：`cd backend && uv run pytest tests/test_summary_pipeline.py -q`

预期：所有解析、长文本、错误与重试用例通过。

- [ ] **步骤 7：提交摘要核心**

```bash
git add backend/app/summaries/schemas.py backend/app/summaries/providers.py backend/app/summaries/prompts backend/app/summaries/pipeline.py backend/tests/test_summary_pipeline.py
git commit -m "feat(backend): add grounded summary pipeline"
```

## 任务 6：持久化 Job Runner 与摘要任务 API

**文件：**

- 创建：`backend/app/jobs/schemas.py`
- 创建：`backend/app/jobs/repository.py`
- 创建：`backend/app/jobs/runner.py`
- 创建：`backend/app/jobs/router.py`
- 创建：`backend/app/summaries/service.py`
- 创建：`backend/tests/test_job_repository.py`
- 创建：`backend/tests/test_summary_api.py`
- 修改：`backend/app/main.py`

- [ ] **步骤 1：编写去重、Lease 恢复和端到端任务测试**

```python
def test_duplicate_active_job_returns_existing(auth_client, meeting_with_transcript):
    first = auth_client.post(f"/api/v1/meetings/{meeting_with_transcript}/summary-jobs")
    second = auth_client.post(f"/api/v1/meetings/{meeting_with_transcript}/summary-jobs")
    assert first.status_code == 202
    assert second.status_code == 202
    assert first.json()["id"] == second.json()["id"]

def test_expired_running_lease_is_reclaimed(job_repository, expired_running_job):
    claimed = job_repository.claim_next(worker_id="worker-2")
    assert claimed.id == expired_running_job.id
    assert claimed.worker_id == "worker-2"
```

- [ ] **步骤 2：运行测试并确认 Job API 不存在**

运行：`cd backend && uv run pytest tests/test_job_repository.py tests/test_summary_api.py -q`

预期：导入失败或路由 404。

- [ ] **步骤 3：实现 Job Repository 状态机**

允许 `queued → running → succeeded|failed|cancelled`；`failed → queued` 只由显式重试触发。认领时原子设置 `worker_id` 与 `lease_expires_at`；过期 `running` 任务可重新认领；最大尝试次数为 3。

- [ ] **步骤 4：实现 Runner 生命周期与摘要持久化**

App lifespan 启动一个可停止线程；测试可传 `start_runner=False` 并同步调用 `run_once()`。Runner 每次只处理一个 Job，调用 Pipeline 后在单一事务中创建 SummaryVersion v1、更新 Meeting 和 Job；任何异常映射为稳定错误码。

- [ ] **步骤 5：实现任务创建与查询 API**

无转录返回 `TRANSCRIPT_REQUIRED`；活动任务去重；失败任务显式重试；任务响应包含 `id`、`status`、`attempts`、`error`、`created_at`、`updated_at`，不包含异常堆栈。

- [ ] **步骤 6：运行 Job 与摘要 API 测试**

运行：`cd backend && uv run pytest tests/test_job_repository.py tests/test_summary_api.py -q && uv run pytest -q`

预期：全部通过。

- [ ] **步骤 7：提交异步任务链路**

```bash
git add backend/app/jobs backend/app/summaries/service.py backend/app/main.py backend/tests/test_job_repository.py backend/tests/test_summary_api.py
git commit -m "feat(backend): persist and recover summary jobs"
```

## 任务 7：摘要版本、审核与导出

**文件：**

- 创建：`backend/app/summaries/router.py`
- 创建：`backend/app/summaries/exporters.py`
- 创建：`backend/tests/test_summary_versions.py`
- 修改：`backend/app/summaries/service.py`
- 修改：`backend/app/main.py`

- [ ] **步骤 1：编写不可变修订、冲突、审核和三种导出测试**

```python
def test_revision_creates_new_version_without_mutating_parent(auth_client, summary_v1):
    response = auth_client.post(
        f"/api/v1/summaries/{summary_v1.id}/revisions",
        json={"expected_version": 1, "content": revised_content()},
    )
    assert response.status_code == 201
    assert response.json()["version"] == 2
    assert fetch_summary(summary_v1.id).content == summary_v1.content

def test_stale_revision_is_rejected(auth_client, summary_v2):
    response = auth_client.post(
        f"/api/v1/summaries/{summary_v2.id}/revisions",
        json={"expected_version": 1, "content": revised_content()},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "VERSION_CONFLICT"
```

- [ ] **步骤 2：运行测试并确认端点不存在**

运行：`cd backend && uv run pytest tests/test_summary_versions.py -q`

预期：路由返回 404。

- [ ] **步骤 3：实现列表、详情、修订和审核**

修订内容重新通过同一 Schema 和来源质量闸门；`expected_version` 必须等于会议最新版本；批准只允许最新且质量闸门通过的版本。每次写操作记录不含正文的 AuditEvent。

- [ ] **步骤 4：实现 Markdown、JSON 和纯文本导出**

导出器是纯函数；Markdown 包含会议信息、核心结论、主题、决策、待办、未决问题、质量提示与来源 Segment ID；JSON 使用版本化 Schema；纯文本适合复制粘贴。

- [ ] **步骤 5：运行版本与导出测试**

运行：`cd backend && uv run pytest tests/test_summary_versions.py -q && uv run pytest -q`

预期：全部通过。

- [ ] **步骤 6：提交审核与导出**

```bash
git add backend/app/summaries backend/app/main.py backend/tests/test_summary_versions.py
git commit -m "feat(backend): add reviewable summary versions"
```

## 任务 8：集成状态、幂等分发与反馈

**文件：**

- 创建：`backend/app/integrations/providers.py`
- 创建：`backend/app/integrations/schemas.py`
- 创建：`backend/app/integrations/router.py`
- 创建：`backend/tests/test_integrations.py`
- 修改：`backend/app/summaries/router.py`
- 修改：`backend/app/meetings/router.py`
- 修改：`backend/app/core/config.py`
- 修改：`backend/app/main.py`

- [ ] **步骤 1：编写未配置状态、分发幂等与反馈测试**

```python
def test_integrations_report_disabled_without_secrets(auth_client):
    response = auth_client.get("/api/v1/integrations")
    assert response.status_code == 200
    assert response.json()["slack"]["status"] == "not_configured"
    assert response.json()["email"]["status"] == "not_configured"

def test_duplicate_delivery_returns_same_record(auth_client, approved_summary):
    payload = {"channel": "slack", "target": "configured-default"}
    first = auth_client.post(f"/api/v1/summaries/{approved_summary}/deliveries", json=payload)
    second = auth_client.post(f"/api/v1/summaries/{approved_summary}/deliveries", json=payload)
    assert first.json()["id"] == second.json()["id"]
```

- [ ] **步骤 2：运行测试并确认集成路由不存在**

运行：`cd backend && uv run pytest tests/test_integrations.py -q`

预期：路由返回 404。

- [ ] **步骤 3：实现 Provider 状态与分发**

Slack 使用单一受控 Webhook；Email 使用 SMTP TLS。未配置返回 `INTEGRATION_NOT_CONFIGURED`；网络失败保存失败状态和脱敏错误，不回显 URL、账号或邮件正文。幂等键使用 Summary Version、渠道和规范化目标的 HMAC。

- [ ] **步骤 4：实现反馈 API**

评分限制为 1～5；错误类型来自受控枚举；短文本限制 1000 字符；默认不附带转录或摘要正文。

- [ ] **步骤 5：运行集成与反馈测试**

运行：`cd backend && uv run pytest tests/test_integrations.py -q && uv run pytest -q`

预期：全部通过。

- [ ] **步骤 6：提交集成边界**

```bash
git add backend/app/integrations backend/app/summaries/router.py backend/app/meetings/router.py backend/app/core/config.py backend/app/main.py backend/tests/test_integrations.py
git commit -m "feat(backend): add optional delivery adapters"
```

## 任务 9：安全边界与完整 mock 主链路

**文件：**

- 创建：`backend/app/core/logging.py`
- 创建：`backend/tests/test_security_boundaries.py`
- 创建：`backend/tests/test_mock_e2e.py`
- 修改：`backend/app/core/middleware.py`
- 修改：`backend/app/main.py`

- [ ] **步骤 1：编写同源、未授权、删除竞态与日志脱敏测试**

```python
def test_protected_api_rejects_missing_session(client):
    response = client.get("/api/v1/meetings")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "ACCESS_REQUIRED"

def test_state_change_rejects_foreign_origin(auth_client):
    response = auth_client.post(
        "/api/v1/meetings",
        headers={"Origin": "https://attacker.example"},
        json={"title": "Secret meeting"},
    )
    assert response.status_code == 403

def test_logs_do_not_contain_secret_or_transcript(captured_logs, auth_client, invite_code):
    submit_sensitive_fixture(auth_client, invite_code)
    rendered = "\n".join(captured_logs)
    assert invite_code not in rendered
    assert "quarterly confidential numbers" not in rendered
```

- [ ] **步骤 2：运行测试并确认安全断言失败**

运行：`cd backend && uv run pytest tests/test_security_boundaries.py tests/test_mock_e2e.py -q`

预期：至少同源校验、日志过滤或完整链路测试失败。

- [ ] **步骤 3：实现结构化日志过滤和同源中间件**

日志字段使用白名单；请求体、Cookie、Authorization、邀请码、转录和摘要正文永不进入日志。生产修改请求要求 `Origin` 等于 `frontend_origin`；无浏览器 Origin 的 CLI/测试请求通过显式测试配置控制。

- [ ] **步骤 4：打通完整 mock 主链路**

E2E 测试必须执行：创建邀请码 → 兑换 → 创建会议 → 上传 VTT → 创建任务 → `run_once()` → 查询 v1 → 创建 v2 → 批准 → Markdown 导出 → 删除 → 确认 API 不可访问。

- [ ] **步骤 5：运行全部测试、Ruff 和迁移往返**

运行：

```bash
cd backend
uv run pytest -q
uv run ruff check app tests scripts
uv run ruff format --check app tests scripts
DATABASE_URL=sqlite:///./.tmp-roundtrip.db uv run alembic upgrade head
DATABASE_URL=sqlite:///./.tmp-roundtrip.db uv run alembic downgrade base
```

预期：测试全部通过；Ruff 无错误；迁移升级和回滚成功。

- [ ] **步骤 6：提交安全和 E2E**

```bash
git add backend/app/core backend/app/main.py backend/tests/test_security_boundaries.py backend/tests/test_mock_e2e.py
git commit -m "test(backend): verify secure mock workflow"
```

## 任务 10：阶段文档、启动说明与后端验收

**文件：**

- 创建：`docs/technical-adaptation.md`
- 创建：`docs/stages/phase-1-backend.md`
- 创建：`backend/README.md`
- 创建：`backend/.env.example`
- 创建：`backend/scripts/check_production_config.py`
- 修改：`README.md`

- [ ] **步骤 1：编写生产配置检查测试**

```python
def test_production_check_lists_names_not_values(tmp_path):
    result = run_config_check(app_env="production", llm_api_key="super-secret-value")
    assert "super-secret-value" not in result.output
    assert "DATABASE_URL" in result.output
```

- [ ] **步骤 2：实现 `.env.example` 和配置检查 CLI**

`.env.example` 只包含安全示例；生产检查输出 `ok` 或缺失变量名列表，不输出变量值。必需项为 `APP_ENV`、`DATABASE_URL`、`SECRET_KEY`、`FRONTEND_ORIGIN`、`LLM_PROVIDER`、`LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY`。

- [ ] **步骤 3：编写技术适配、阶段开发和 README 文档**

阶段文档逐条列出已实现范围、未配置外部集成、测试命令、mock 验收步骤和真实模型冒烟命令。README 给出：创建数据库、启动 API、创建邀请码、访问 OpenAPI、运行测试、停止服务的精确命令。

- [ ] **步骤 4：启动服务并执行真实 HTTP mock 冒烟**

使用空闲端口 8100：

```bash
cd backend
APP_ENV=test LLM_PROVIDER=mock uv run uvicorn app.main:app --host 127.0.0.1 --port 8100
curl -fsS http://127.0.0.1:8100/health/live
curl -fsS http://127.0.0.1:8100/openapi.json
```

预期：健康检查返回 `status=ok`；OpenAPI 包含所有已设计路由。冒烟完成后停止 Uvicorn。

- [ ] **步骤 5：执行后端完成审计**

核对设计规格第 5～10、12～13 节的每项要求，并把证据记录到 `docs/stages/phase-1-backend.md`。真实模型冒烟必须标记为“等待用户提供 Key”，不能写成通过。

- [ ] **步骤 6：提交阶段交付**

```bash
git add backend/.env.example backend/README.md backend/scripts/check_production_config.py backend/tests docs/technical-adaptation.md docs/stages/phase-1-backend.md README.md
git commit -m "docs(backend): add setup and verification guide"
```

---

## 计划自检

- 规格覆盖：邀请码、访问会话、会议、转录、任务恢复、摘要质量、版本、审核、导出、集成边界、安全和双层测试均有对应任务。
- 占位符扫描：计划不包含未分配的实现占位；真实模型和第三方真实冒烟被明确作为外部凭据门槛，而不是代码缺口。
- 类型一致性：`Meeting`、`TranscriptSegment`、`ProcessingJob`、`SummaryVersion`、`Delivery` 及状态名在各任务中保持一致；API 路径与设计规格一致。
- 执行方式：用户已要求持续采用推荐方案，因此在当前会话使用 `executing-plans` 内联执行，不启用子代理。
