# MeetingMemo 后端

MeetingMemo 是一个邀请码访问的会议纪要应用。当前后端不提供注册或账号登录；每个邀请码默认最多成功兑换 50 次，每次兑换签发一个 30 天访问会话。刷新页面和普通 API 请求不会消耗次数。

## 本地启动

要求 Python 3.11 和 [uv](https://docs.astral.sh/uv/)。以下命令都在 `backend/` 目录执行。

```sh
uv sync --python 3.11
cp .env.example .env
uv run alembic upgrade head
uv run python -m scripts.create_invite --label local-pilot --max-redemptions 50
uv run uvicorn app.main:app --host 127.0.0.1 --port 8100 --no-access-log
```

创建邀请码的命令只会在标准输出显示一次明文邀请码，并同时显示不敏感的 `INVITE_ID`；数据库只保存 HMAC 哈希。需要提前停用时执行：

```sh
uv run python -m scripts.deactivate_invite --invite-id <INVITE_ID>
```

启动后可访问：

- 存活检查：`http://127.0.0.1:8100/health/live`
- 就绪检查：`http://127.0.0.1:8100/health/ready`
- OpenAPI：`http://127.0.0.1:8100/docs`

`/health/ready` 除了检查数据库和后台 Runner，还会核对 Alembic 是否处于当前版本；未执行迁移时返回 503。`--no-access-log` 用来关闭 Uvicorn 会记录原始客户端 IP 的默认访问日志，应用自身只输出脱敏白名单字段。

按 `Ctrl-C` 停止 API。若需要停止遗留后台进程，可先用 `lsof -nP -iTCP:8100 -sTCP:LISTEN` 确认 PID，再只终止该 PID。

## 验证

```sh
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
DATABASE_URL=sqlite:///./.tmp-roundtrip.db uv run alembic upgrade head
DATABASE_URL=sqlite:///./.tmp-roundtrip.db uv run alembic downgrade base
MEETINGMEMO_APP_ENV=production uv run python -m scripts.check_production_config
```

最后一条在配置不完整时列出缺失变量名并返回非零退出码；配置完整时输出 `ok`。

完整 mock 主链路可单独运行：

```sh
uv run pytest tests/test_mock_e2e.py -q
```

它覆盖创建邀请码、兑换、创建会议、上传 VTT、生成摘要、创建修订、审批、Markdown 导出、删除和删除后不可访问。

上传的 TXT、VTT、SRT 原文件使用内部会议 ID 保存到 `UPLOAD_DIR` 的受控目录，不沿用用户文件名；转录片段仍是摘要流程的权威输入。替换为粘贴文本或删除会议时会同步删除原文件。音频和视频在 ASR Provider 尚未配置时明确返回 `ASR_NOT_CONFIGURED`。

## 生产配置

生产环境必须覆盖以下变量：

- `MEETINGMEMO_APP_ENV=production`
- `DATABASE_URL`：PostgreSQL 连接串（生产不接受 SQLite 或其他数据库驱动）
- `FRONTEND_ORIGIN`：HTTPS 前端来源
- `SECRET_KEY`：至少 32 字符的高熵随机值
- `ALLOW_ORIGINLESS_STATE_CHANGES=false`
- `LLM_PROVIDER=openai-compatible`
- `LLM_BASE_URL`（HTTPS）、`LLM_MODEL`、`LLM_API_KEY`

`check_production_config` 只输出缺失的变量名，不输出任何值。生产配置不安全时，应用也会在启动阶段拒绝运行，错误只包含缺失变量名。LLM Key 只保存在部署平台 Secret 或本地 `.env`，不要提交到 Git。

Slack Webhook 和 SMTP 均为可选项。生产环境一旦配置 Slack，只接受官方 HTTPS Webhook；SMTP 必须启用 STARTTLS，并使用系统可信 CA 校验服务器证书。未配置时接口会明确返回 `not_configured`，不会伪造发送成功。Zoom 与 Google Meet 在本期仅保留能力边界，会议转录通过粘贴文本或上传 TXT、VTT、SRT 文件进入系统。

默认测试在 SQLite 上覆盖邀请码与 Job 的线程并发。生产 PostgreSQL 的迁移和并发验收需要可用的测试数据库连接串；当前本机没有可用凭据，因此必须在部署前环境中再执行该项，不将其标记为已经通过。

## API 约定

- 公开端点：健康检查、邀请码兑换、OpenAPI。
- 业务端点：要求 `meetingmemo_session` HttpOnly Cookie。
- 状态修改：浏览器请求要求 `Origin` 与 `FRONTEND_ORIGIN` 一致；生产默认拒绝无 `Origin` 请求。
- 错误格式：`{"error":{"code":"...","message":"...","trace_id":"..."}}`。
- 日志：仅记录方法、路由模板、状态、耗时、Trace ID 和错误类型，不记录请求体、Cookie、邀请码或转录正文。
