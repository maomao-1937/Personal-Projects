# 第 1 阶段后端实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 保留现有 librosa 与 FFmpeg 算法，交付 SQLite 单机可恢复后端、Provider 抽象、真实模型冒烟和最小验收页。

**架构：** 新 `/api/v1` 通过 Service 调用 Repository 与 Provider。SQLite WAL 保存领域对象、Job 和事件；同进程 Worker 通过租约领取任务，远程任务以 Provider Request ID 恢复；Artifact 开发期保存在本地受控目录。旧接口保留用于回归。

**技术栈：** Python 3.11、FastAPI、Pydantic、SQLite、httpx、librosa、FFmpeg、pytest、原生 HTML/JavaScript。

---

## 文件结构

- `pyproject.toml`：依赖和 pytest 配置。
- `.env.example`：安全配置模板。
- `backend/app.py`、`backend/api/`：App Factory、错误和 `/api/v1` 路由。
- `backend/domain/`：领域模型、状态和错误。
- `backend/persistence/`：SQLite、Migration 和 Repository。
- `backend/jobs/`：Job Service、Worker、Handler 和 Recovery。
- `backend/providers/`：librosa、OpenAI Compatible、Ark、Disabled ASR、FFmpeg。
- `backend/services/`：Auth、Project、Audio、Storyboard、Cut、Timeline 和 Rendering。
- `backend/storage/`：本地 Artifact Store。
- `backend/web/acceptance.html`：最小验收页。
- `tests/`：unit、integration、contract 和 smoke。

## 批次 A：工程与持久任务

### 任务 1：Python 3.11 与 pytest 基线

**文件：** 创建 `pyproject.toml`、`backend/version.py`、`tests/test_test_environment.py`；修改 `.gitignore`。

- [ ] 写失败测试：

~~~python
import sys
from backend.version import APP_VERSION

def test_python_and_version_baseline():
    assert sys.version_info >= (3, 11)
    assert APP_VERSION
~~~

- [ ] 创建隔离环境并安装计划内依赖：

~~~bash
uv venv --python /Users/liuxs/.local/bin/python3.11 .venv
uv pip install --python .venv/bin/python -e '.[test]'
~~~

- [ ] 运行测试，预期因 `backend.version` 缺失而失败。
- [ ] 最小实现：版本单一来源；依赖包含 FastAPI、Uvicorn、Pydantic Settings、httpx、multipart、aiofiles、librosa、numpy、soundfile、pytest 和 pytest-asyncio。
- [ ] 重跑，预期 `1 passed`。

### 任务 2：Settings 与统一错误

**文件：** 修改 `backend/config.py`；创建 `backend/domain/errors.py`、`backend/api/errors.py`、`.env.example`；测试 `tests/unit/test_settings.py`、`tests/integration/test_errors.py`。

- [ ] 写失败测试：错误的音频上下限触发 ValidationError；空项目名返回 `request_validation_failed` 422。
- [ ] 运行目标测试，确认失败原因是 Settings/App 尚未实现。
- [ ] 实现 Settings：从仓库根 `.env` 读取，Key 使用 `SecretStr`，安全输出只显示是否配置。
- [ ] 实现统一错误 Envelope：`code/message/retryable/details/request_id`。
- [ ] 重跑目标测试和任务 1 测试。

### 任务 3：SQLite Migration 与 Repository

**文件：** 创建 `backend/domain/models.py`、`backend/domain/states.py`、`backend/persistence/database.py`、`migrations.py`、`repositories.py`；测试 `tests/unit/test_database.py`、`test_repositories.py`。

- [ ] 写失败测试：WAL 和外键开启；用户 B 读取用户 A 的 Project 返回空。

~~~python
def test_project_repository_scopes_reads_to_owner(repositories):
    project = repositories.projects.create("usr_a", "MV")
    assert repositories.projects.get_for_owner(project.id, "usr_a") == project
    assert repositories.projects.get_for_owner(project.id, "usr_b") is None
~~~

- [ ] 运行目标测试，确认持久化模块缺失。
- [ ] 实现 Migration v1：技术文档定义的核心表和 `schema_migrations`。
- [ ] 实现短事务 Repository，不向 Service 暴露 `sqlite3.Row`。
- [ ] 重跑数据库与 Repository 测试。

### 任务 4：持久 Job、事件与幂等

**文件：** 创建 `backend/jobs/service.py`；测试 `tests/unit/test_job_service.py`。

- [ ] 写失败测试：相同幂等键返回同一个 Job；事件 sequence 严格递增且唯一。

~~~python
def test_create_job_is_idempotent(job_service):
    first = job_service.create("audio_analysis", "prj_1", {}, "same-key")
    second = job_service.create("audio_analysis", "prj_1", {}, "same-key")
    assert first.id == second.id
~~~

- [ ] 运行并确认 JobService 缺失。
- [ ] 实现输入哈希、合法状态迁移和 Job/Event 同事务写入。
- [ ] 重跑 Job 与 Repository 测试。

### 任务 5：Worker、Recovery 与可恢复 SSE

**文件：** 创建 `backend/jobs/handlers.py`、`worker.py`、`recovery.py`、`backend/api/jobs.py`；测试 `tests/integration/test_worker_recovery.py`、`test_job_sse.py`。

- [ ] 写失败测试：过期本地租约重新排队；远程 Job 只续查；`after=1` 不返回重复事件。
- [ ] 运行并确认 Worker/Recovery/API 缺失。
- [ ] 实现事务领取、Lease、Heartbeat、Deadline、Handler Registry 和启动恢复。
- [ ] 实现 Job Snapshot、事件列表和基于持久事件的 SSE；不使用共享消费 Queue。
- [ ] 运行批次 A 全部测试。

## 批次 B：Auth、Audio 与 Storyboard

### 任务 6：邀请码登录、Project 与 Artifact Store

**文件：** 创建 `backend/services/auth.py`、`projects.py`、`backend/storage/local_artifacts.py`、`backend/api/auth.py`、`projects.py`；测试 `tests/integration/test_auth_projects.py`、`tests/unit/test_local_artifacts.py`。

- [ ] 写失败测试：邀请码和 Session 只存 Hash；跨用户 Project 返回 404；`../secret` 被拒绝。
- [ ] 运行并确认模块缺失。
- [ ] 实现一次明文 Session Token、Owner 隔离和受控 Artifact Path。
- [ ] 重跑目标测试。

### 任务 7：音频上传与 Librosa Provider

**文件：** 创建 `backend/providers/protocols.py`、`audio_librosa.py`、`backend/services/audio.py`、`backend/api/audio.py`；按需修改现有 `pipeline/audio_analyzer.py`；测试 `tests/unit/test_audio_provider.py`、`tests/integration/test_audio_api.py`。

- [ ] 创建固定 30 秒 WAV Fixture，并写失败测试：输出可 JSON 序列化且包含 BPM、Beat、Onset、Energy。
- [ ] 运行并确认 Provider 尚不存在。
- [ ] 包装现有分析，将 NumPy 数组转换为有界 JSON。
- [ ] 实现 MP3/WAV、100 MB、30—60 秒的上传前后校验与 4xx。
- [ ] 运行音频测试。

### 任务 8：BeatPlan 与 Storyboard 归一化

**文件：** 创建 `backend/services/storyboards.py`；测试 `tests/unit/test_storyboard_normalizer.py`。

- [ ] 写失败测试：第一个 Cut 从 0 开始、最后一个到音频结束、相邻无空隙、数量不超过 12、边界靠近有效 Beat。
- [ ] 运行并确认 Normalizer 缺失。
- [ ] 实现 BeatPlan 摘要、Pydantic Schema 和确定性边界归一化。
- [ ] 重跑归一化测试。

### 任务 9：OpenAI Compatible Storyboard Provider

**文件：** 创建 `backend/providers/storyboard_openai.py`、`backend/api/storyboards.py`；测试 `tests/contract/test_storyboard_provider.py`、`tests/integration/test_storyboard_api.py`。

- [ ] 写失败测试：使用配置 URL/Model、Authorization 不出现在结果、非法 JSON 不保存 Storyboard。
- [ ] 运行并确认 Provider 缺失。
- [ ] 实现 Timeout、有限重试、JSON 解析和 Provider 错误映射。
- [ ] 只对网络、429、5xx 和一次结构修复重试；401/403/余额/审核不自动重试。
- [ ] 运行批次 B Fake Provider 测试。

## 批次 C：Video Cut 与 Partial

### 任务 10：Ark Video Provider

**文件：** 创建 `backend/providers/video_ark.py`；测试 `tests/contract/test_video_ark_provider.py`。

- [ ] 写失败测试：创建任务保存 Request ID；查询已有 `cgt_...` 时不发送 POST；结果下载限制类型和大小。
- [ ] 运行并确认 Provider 缺失。
- [ ] 实现 Ark 状态映射、创建/查询、错误脱敏和安全下载。
- [ ] 重跑 Provider 契约测试。

### 任务 11：Cut Generate、Retry、Regenerate 与 Partial

**文件：** 创建 `backend/services/cuts.py`、`backend/api/cuts.py`；修改 `backend/jobs/handlers.py`；测试 `tests/integration/test_cut_jobs.py`。

- [ ] 写失败测试：4 成功 + 2 失败聚合为 Partial；失败 Cut 单独重试；Regenerate 失败保留旧 Active Artifact。
- [ ] 运行并确认 Cut Service 缺失。
- [ ] 实现并发 2、最多 12 Cut、Retry 与 Regenerate 语义。
- [ ] 新 Artifact 成功并验证后才原子切换 Active；失败不改变 Timeline。
- [ ] 运行批次 C 测试。

## 批次 D：Timeline、Preview 与 Export

### 任务 12：不可变 TimelineVersion 与 stale

**文件：** 创建 `backend/services/timelines.py`；测试 `tests/unit/test_timeline_versions.py`。

- [ ] 写失败测试：Active Artifact/顺序/时间改变产生新版本；仅 Prompt 草稿改变不产生新版本。
- [ ] 运行并确认 Service 缺失。
- [ ] 实现确定性 Snapshot、内容 Hash、版本递增和旧结果 stale。
- [ ] 重跑版本测试。

### 任务 13：FFmpeg Preview

**文件：** 创建 `backend/providers/render_ffmpeg.py`、`backend/services/rendering.py`、`backend/api/previews.py`；测试 `tests/integration/test_preview_render.py`。

- [ ] 写失败测试：固定媒体 Timeline 输出 H.264/AAC，时长差小于 500 ms。
- [ ] 运行并确认 Render Provider 缺失。
- [ ] 使用安全参数数组实现 Full/Partial Preview 和占位片段；完成后先 ffprobe 再登记 Ready。
- [ ] 运行真实 FFmpeg Preview 测试。

### 任务 14：16:9 与 9:16 独立 Export

**文件：** 创建 `backend/api/exports.py`；修改 Rendering Service 与 FFmpeg Provider；测试 `tests/integration/test_exports.py`。

- [ ] 写失败测试：16:9 成功不让 9:16 Ready；Timeline 改变后旧 URL 仍存在但状态为 stale。

~~~python
def test_landscape_success_does_not_mark_portrait_ready(export_service, timeline):
    export_service.mark_ready(timeline.id, "16:9", "art_landscape")
    assert export_service.status(timeline.id, "9:16") == "not_created"
~~~

- [ ] 运行并确认 Export 行为缺失。
- [ ] 实现两个独立 Job 和确定性竖屏中心裁切/缩放。
- [ ] 运行批次 D 全部测试与 ffprobe 验证。

## 批次 E：验收、冒烟与交付

### 任务 15：App Factory、验收页与旧接口回归

**文件：** 创建 `backend/app.py`、`backend/web/acceptance.html`；修改 `backend/main.py`；测试 `tests/integration/test_app.py`、`test_acceptance_page.py`。

- [ ] 写失败测试：`/acceptance` 返回最小页面；旧 `/api/process` 仍注册；生命周期启动 Migration/Recovery/Worker。
- [ ] 运行并确认 App Factory/Page 缺失。
- [ ] 组装依赖和生命周期，实现原生验收页；不引入 React。
- [ ] 运行 API 与页面测试。

### 任务 16：真实模型冒烟

**文件：** 创建 `tests/smoke/test_storyboard_real.py`、`test_video_real.py`、`tests/smoke/README.md`。

- [ ] 先写带 `@pytest.mark.real_model` 和 `RUN_REAL_MODEL_SMOKE=1` 门禁的测试。
- [ ] 默认运行 `pytest tests/smoke -q`，确认全部 Skip 且无网络请求。
- [ ] 运行一次 DeepSeek 最小 JSON Storyboard 冒烟。
- [ ] 报告 Model、固定 5 秒、480P、1 次调用与估算费用后，运行一个百炼 Wan 单 Cut 冒烟；只轮询原 Request ID。
- [ ] 记录脱敏 Request ID、状态、耗时和 ffprobe 元数据，不记录 Key。

### 任务 17：CI、README、版本与最终验证

**文件：** 创建 `.github/workflows/backend-ci.yml`；修改 `README.md`、`CHANGELOG.md`、`verdict.txt`；测试 `tests/integration/test_version_consistency.py`。

- [ ] 写失败测试：Health API 的版本必须出现在 README，验证当前不一致。
- [ ] 统一版本来源、运行命令和能力说明；CI 使用 Python 3.11，不运行真实模型测试。
- [ ] 运行完整验证：

~~~bash
.venv/bin/python -m pytest -m 'not real_model' -q
.venv/bin/python -m compileall backend
git diff --check
git status --short
~~~

- [ ] 确认 `.env`、数据库、上传文件和 Artifact 均未进入 Git 状态。
- [ ] 输出后端核验报告并立即停止，不进入正式前端。

## 规格覆盖自检

| 规格要求 | 任务 |
|---|---|
| Python/FastAPI/Pydantic/pytest | 1—2 |
| SQLite、Repository、数据关系 | 3 |
| 持久 Job、事件、幂等、恢复、SSE | 4—5 |
| 邀请登录、Project、Artifact 隔离 | 6 |
| librosa、BeatPlan、Storyboard | 7—9 |
| Ark、Cut、Partial、Retry、Regenerate | 10—11 |
| TimelineVersion、stale、Preview、Export | 12—14 |
| 最小验收页 | 15 |
| 真实模型冒烟 | 16 |
| CI、README、版本与最终验证 | 17 |
