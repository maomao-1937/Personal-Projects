# AI 对话质检器后端

FastAPI 后端为销售／客服单段对话提供六维质检，使用匿名邀请码访问。没有注册、账号或密码体系；每个邀请码最多结算 50 次成功分析。模型失败、输入失败和重复幂等请求不扣额度。

## 本地启动

要求 Python 3.11（不支持 3.13 及以上）。在仓库根目录执行：

```bash
/Users/liuxs/.local/bin/python3.11 -m venv .venv-backend
uv pip install --python .venv-backend/bin/python -r backend/requirements.txt -r backend/requirements-dev.txt
cp backend/.env.example backend/.env
```

生成本地密钥与邀请码：

```bash
.venv-backend/bin/python -c 'import secrets; print(secrets.token_urlsafe(32))'
.venv-backend/bin/python -c 'import secrets; print("pilot_" + secrets.token_urlsafe(24))'
```

把前两条命令的输出分别写入 `SESSION_SECRET`、`INVITE_CODE_PEPPER`，把邀请码写入 `INVITE_CODES`。多个邀请码用英文逗号分隔。原始邀请码不会写入数据库，数据库只保存 HMAC-SHA256 摘要。

迁移并在 8010 端口启动：

```bash
cd backend
../.venv-backend/bin/alembic upgrade head
../.venv-backend/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

默认数据库是 `backend/data/app.db`。API 文档在非生产环境开放于 `http://127.0.0.1:8010/docs`。

## 环境变量

完整模板见 [`.env.example`](./.env.example)。关键配置：

- `INVITE_CODES`：逗号分隔的原始邀请码；每次启动会同步启用列表，不重置历史用量。
- `INVITE_USAGE_LIMIT=50`：每个邀请码的成功分析上限。
- `SESSION_SECRET`、`INVITE_CODE_PEPPER`：生产环境均须至少 32 个字符。
- `STORAGE_PROVIDER=s3`：生产环境使用 SQLite 时必须启用对象存储备份。
- `S3_AUTH_MODE`：本地／通用云环境可用 `static`；veFaaS 线上优先用 `vefaas_request`，从平台注入的请求头轮换 STS 临时凭证，不保存长期 AK/SK。
- `SQLITE_BACKUP_INTERVAL_SECONDS=300`、`SQLITE_BACKUP_MAX_AGE_SECONDS=600`：在线快照间隔与允许的最大备份年龄；超时后 readiness 降级并拒绝分析／反馈写入。
- `SQLITE_ALLOW_BOOTSTRAP`：仅首次空库发布临时设为 `true`；首份快照生成后必须改回 `false`。
- `S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`：TOS S3 兼容配置。仅 `S3_AUTH_MODE=static` 时需要 `S3_ACCESS_KEY`、`S3_SECRET_KEY`。
- `S3_OBJECT_PREFIX=conversation-qa`：本项目在 Bucket 内的独立对象前缀。
- `LLM_API_KEY`：用户后续提供；未设置时服务仍可启动，分析接口返回 `LLM_NOT_CONFIGURED`。
- `LLM_BASE_URL`：OpenAI 兼容地址；火山方舟可使用
  `https://ark.cn-beijing.volces.com/api/v3`。
- `LLM_MODEL`：实际模型 ID；火山方舟示例为
  `doubao-seed-2-0-pro-260215`。必须与 Key 一起设置才视为模型已配置。
- `LLM_REASONING_EFFORT`：可选推理强度，可填 `minimal`、`low`、`medium`
  或 `high`；留空时不向模型请求附加推理参数。火山方舟示例使用
  `minimal`。
- `LLM_MAX_TOKENS`：模型请求的最大输出 Token 数，必须为正数，默认 `3000`。
  火山方舟示例使用 `3000`。
- `ALLOWED_ORIGINS`：允许携带 Cookie 调用 API 的前端地址列表。

## curl 验证

以下示例假设 `INVITE_CODES` 中含有 `$INVITE_CODE`：

```bash
curl -sS http://127.0.0.1:8010/health/live
curl -sS http://127.0.0.1:8010/health/ready
curl -sS -c /tmp/aqi-cookie.txt \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"$INVITE_CODE\"}" \
  http://127.0.0.1:8010/api/v1/access/redeem
```

兑换响应中的 `csrf_token` 要通过 `X-CSRF-Token` 发送；分析请求还需新的 UUID `Idempotency-Key`：

```bash
curl -sS -b /tmp/aqi-cookie.txt \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF_TOKEN" \
  -H "Idempotency-Key: $(uuidgen | tr '[:upper:]' '[:lower:]')" \
  -d '{"qa_type":"sales","transcript":"客户：这个价格有些贵，我还需要比较一下。\n销售：可以说说您的预算和顾虑吗？"}' \
  http://127.0.0.1:8010/api/v1/analyses
```

未配置模型时，上述分析返回 503；再次请求 `/api/v1/access/status` 应仍显示 50 次，不会扣额度。

## 测试与质量门禁

自动化测试使用假模型，不冒充真实模型验收：

```bash
cd backend
../.venv-backend/bin/ruff check app tests
../.venv-backend/bin/mypy app
../.venv-backend/bin/pytest --cov=app --cov-report=term-missing --cov-fail-under=90
```

真实模型冒烟必须在设置 `LLM_API_KEY`、`LLM_MODEL`（以及需要时的 `LLM_BASE_URL`）后，通过上面的真实 HTTP 分析请求执行并人工核对证据和建议质量。

## 隐私边界

- 原始聊天、证据原句、完整报告和建议回复只存在于单次请求内，不写数据库或应用日志。
- 数据库只保存邀请码摘要、额度计数、分析 ID、字符／轮次数、耗时、版本、状态、风险级别和匿名反馈。
- 匿名分析及反馈元数据默认保留 90 天；清理不会恢复已使用额度。
- 页面刷新后不恢复报告。
- 早期 SQLite 部署固定单实例；扩容前应迁移 PostgreSQL。

## veFaaS 数据持久化

线上数据库使用 `sqlite:////tmp/data/app.db`，后端通过 TOS 的 S3 兼容接口持久化。静态凭证模式在进程启动阶段恢复；veFaaS 角色模式在首个携带平台 STS 请求头的请求中完成恢复和 `alembic upgrade head`，完成首份回读快照前除 `/health/live` 外均保持 503。运行中每 5 分钟执行一次 SQLite 在线一致性快照，正常关停前再备份一次。每份快照使用不可变对象名，上传后必须下载回读并通过 SHA-256、`alembic_version`、必需表校验，随后才更新 `current.json` 指针。损坏、缺失或过期的备份不会静默生成新额度。

TOS Bucket 必须开启服务端加密、版本控制，并给 `conversation-qa/` 设置 90 天生命周期。veFaaS 函数绑定只允许目标前缀 `GetObject`／`PutObject` 的服务角色；平台 STS 请求头不得记录或转发给浏览器。函数保持 `min=1, max=1`；确认对象存储中出现 `conversation-qa/current.json` 和可回读的 `conversation-qa/snapshots/*.db` 后才算持久化验收完成。

SQLite 版本更新采用停机发布：先把旧版本缩容为 0 并确认最终快照成功、再发布新版本、最后恢复 `min=1,max=1`。禁止灰度发布或新旧版本并行写同一 Bucket；需要无停机或横向扩容时先迁移 PostgreSQL。
