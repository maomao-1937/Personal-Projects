# 阶段 1：后端实现与验收记录

日期：2026-08-23

## 已实现范围

- 邀请码创建、HMAC 存储、原子兑换上限、30 天访问会话、退出和受保护 API。
- 邀请码兑换来源限流和持久化审计；不存原始 IP 或邀请码。
- 会议创建、列表、详情、软删除，以及 TXT、VTT、SRT 转录解析、受控原文件存储和上传边界。
- 持久化摘要 Job、活动任务去重、Lease 认领、过期恢复、失败与显式重试。
- 确定性 Mock Provider 和 OpenAI-compatible Provider。
- 版本化 Prompt、长转录 map-reduce、JSON 修复、来源引用和人员质量闸门。
- 不可变摘要版本、乐观锁冲突、最新版本审批、Markdown/JSON/纯文本导出。
- Slack Webhook 与 SMTP 可选分发、审批前禁止分发、幂等发送和安全失败记录。
- 显式结构化反馈，不保存转录副本。
- 同源写入保护、限定 CORS、流式请求体限制、统一错误包络、Trace ID、白名单结构化日志。
- 就绪检查核对数据库连接、Alembic 当前版本和后台 Runner。

## API 主链路

```text
邀请码兑换 → 创建会议 → 添加转录 → 创建摘要任务 → 轮询任务
→ 查看 v1 → 创建 v2 → 审批 → 导出/可选分发 → 提交反馈 → 删除
```

除健康检查和邀请码兑换外，业务 API 都要求有效访问会话。删除会议后，会议、任务和摘要立即对客户端不可访问，排队任务被取消。

## 自动化验收证据

执行命令：

```sh
cd backend
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
DATABASE_URL=sqlite:///./.tmp-roundtrip.db uv run alembic upgrade head
DATABASE_URL=sqlite:///./.tmp-roundtrip.db uv run alembic downgrade base
```

覆盖项包括：

- 111 项自动化测试全部通过。
- 60 个并发兑换请求对 50 次邀请码最多成功 50 次。
- 过期、停用、耗尽和错误邀请码使用统一公开错误。
- 未授权访问、外来 Origin、兑换限流与日志脱敏。
- 文件安全、解析、转录锁定和删除竞态。
- Job 去重、Lease 恢复、稳定失败码和显式重试。
- Mock 摘要、真实 Provider 协议、重试、Schema 和来源质量闸门。
- 版本、冲突、审批、三种导出、分发幂等与反馈校验。
- 从邀请码创建到会议删除的完整 mock E2E。
- Alembic 从 base 升级到 head，再回滚到 base。
- SQLite 并发测试已完成；PostgreSQL 实测因当前没有数据库凭据，保留为部署前硬门槛。

## 本地 HTTP 冒烟

服务使用端口 8100 启动，关闭 Uvicorn 默认访问日志后检查 `/health/live`、`/health/ready` 和 `/openapi.json`。OpenAPI 必须包含访问、会议、转录、任务、摘要版本、审批、导出、集成、分发和反馈路由。实际命令与停止方式见 `backend/README.md`。

## 未启用能力

- Zoom 和 Google Meet 自动同步：未提供 OAuth 应用和真实测试账号。
- Slack 与 SMTP 真实发送：适配器已实现，当前没有外部凭据。
- 真实 LLM 摘要：等待用户提供 API Key。
- 音频 ASR：未配置和验证 Provider，因此本期禁用。

上述能力均返回真实配置状态，不模拟第三方成功。

## 真实模型验收门槛

状态：**等待用户提供 Key，未标记为通过。**

拿到 Key 后需要完成：

1. 把 Key 保存到本地 `.env` 或部署平台 Secret，不写入代码和 Git。
2. 配置 `LLM_PROVIDER=openai-compatible`、国内模型 Base URL 和模型 ID。
3. 分别用一份中文、一份英文代表性转录完成真实请求、持久化和前端查看。
4. 记录模型名、首个结果时间、总耗时、Token、重试次数和 Schema 合规情况。
5. 重新运行生产配置检查和部署前全量验收。
