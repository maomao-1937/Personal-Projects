# AI 对话质检器 veFaaS 上线清单

本项目按《AI Agent 产品上线部署手册》采用两个 veFaaS Web 应用和同一个公网 Serverless API 网关：后端为 FastAPI，前端为 Next.js standalone。正式入口是前端域名，浏览器只访问前端同源的 `/backend-api/*`，由 Next.js 运行时转发到后端域名。

## 上线前边界

- 后端固定 `min=1,max=1`，SQLite 扩容前必须迁移 PostgreSQL。
- SQLite 运行文件位于 `/tmp/data/app.db`；TOS 通过 S3 兼容接口保存不可变版本快照。
- 后端在首个携带 veFaaS STS 请求头的请求中恢复并校验数据库；初始化完成前仅存活探针可用，之后每 300 秒和正常关停前创建一致性快照。
- 备份最大允许年龄为 600 秒；超过后 readiness 降级，并拒绝会修改额度／反馈的请求。
- `.env`、`.vefaas/`、虚拟环境、测试和本地数据库均被 `.vefaasignore` 排除。
- 云账号密钥、STS 临时凭证、应用密钥和邀请码不写入仓库、日志或本清单。
- `LLM_API_KEY`、`LLM_MODEL` 暂不设置；用户补齐前，分析接口应稳定返回 `LLM_NOT_CONFIGURED` 且不扣额度。

## TOS 准备

1. 在华北 2（北京）创建独立私有 Bucket，开启 SSE-TOS 服务端加密和版本控制。
2. 创建函数服务角色，信任身份选择函数服务；给角色附加自定义策略，仅允许 `tos:GetObject`、`tos:PutObject` 访问 `trn:tos:::<Bucket>/conversation-qa/*`。Bucket 生命周期、加密和版本控制由部署管理员配置，不授予函数管理权限。
3. 把角色 TRN 绑定到后端函数；veFaaS 会为每个 Web 请求注入短期 AK、SK 和 Session Token。后端只在内存中轮换这些凭证，绝不记录或转发。
4. 给 `conversation-qa/snapshots/` 设置 90 天生命周期；保留 `current.json` 的历史版本用于人工恢复。
5. Endpoint 使用 `https://tos-s3-cn-beijing.volces.com`。应用固定使用 S3v4 签名、virtual-host addressing、5 秒连接超时、30 秒读取超时和最多 3 次标准重试。

## 后端首次发布

1. 登录后执行 `vefaas doctor`，复用华北 2（北京）的公网 Serverless 网关 `shipcheck-gw`。
2. 用 `vefaas link --newApp conversation-qa-api --gatewayName shipcheck-gw --command "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000" --port 8000 --yes` 先创建并链接应用，不发布。
3. 首次发布前设置以下环境变量：

   ```text
   ENVIRONMENT=prod
   DATABASE_URL=sqlite:////tmp/data/app.db
   STORAGE_PROVIDER=s3
   S3_AUTH_MODE=vefaas_request
   SQLITE_BACKUP_INTERVAL_SECONDS=300
   SQLITE_BACKUP_MAX_AGE_SECONDS=600
   SQLITE_ALLOW_BOOTSTRAP=true
   S3_ENDPOINT=https://tos-s3-cn-beijing.volces.com
   S3_REGION=cn-beijing
   S3_BUCKET=<Bucket 名>
   S3_OBJECT_PREFIX=conversation-qa
   SESSION_SECRET=<随机 32 字节以上>
   INVITE_CODE_PEPPER=<随机 32 字节以上>
   INVITE_CODES=<随机邀请码>
   INVITE_USAGE_LIMIT=50
   ALLOWED_ORIGINS=<前端正式域名；前端上线后回填>
   ```

4. 执行 `vefaas config settings --role <函数服务角色 TRN>` 绑定角色，再执行 `vefaas deploy --yes`；首次发布不设置预留实例。访问就绪接口时，平台注入的 STS 请求头会触发数据库初始化。
5. 确认 `conversation-qa/current.json` 和对应 `snapshots/*.db` 均存在且 `/health/ready` 返回 `backup_ready=true`。快照数据库的 `alembic_version` 必须严格等于当前 head。
6. 在前端尚未发布、没有外部流量时停止健康请求，把旧版本缩容为 0 并确认实例退出。
7. 把 `SQLITE_ALLOW_BOOTSTRAP` 改为 `false`，再次发布并复验从快照恢复；随后执行 `vefaas fn scale --min 1 --max 1`。首次切换同样禁止两个版本并行。
8. `SESSION_SECRET` 与 `INVITE_CODE_PEPPER` 必须跨发布保持不变；Pepper 改变会把同一原始邀请码识别为新的摘要并重置额度。STS 最长 12 小时，平台会随请求注入新凭证；若长时间完全无请求导致备份过期，下一个携带新凭证的请求必须先成功补快照才会放行。

## 后端后续发布

SQLite 禁止灰度发布和新旧版本并行。更新时接受短暂停机：确认最新快照成功，把旧版本缩容为 0 并确认实例退出，再发布新版本，验证恢复后设回 `min=1,max=1`。平台若不能确认单写者，停止发布并先迁移 PostgreSQL。

## 前端发布

1. 用 `vefaas link --newApp conversation-qa-web --gatewayName shipcheck-gw --buildCommand "npm run build" --outputPath ".next/standalone" --command "node server.js" --port 3000 --yes` 创建并链接应用。
2. 首次发布前设置 `BACKEND_API_BASE_URL=<后端 HTTPS 域名>`。该值由 Route Handler 在运行时读取，不进入浏览器包。
3. 执行 `vefaas deploy --yes`，取得前端正式域名。
4. 将后端 `ALLOWED_ORIGINS` 更新为前端正式域名并按停机流程重发后端。虽然当前浏览器调用同源代理，仍保持 CORS 最小授权。

## 线上验收

- `/health/live` 返回 `ok`，`/health/ready` 显示数据库和备份就绪、模型未配置。
- 未持有 Cookie 调用访问状态或分析接口会被拒绝；错误邀请码被拒绝。
- 正确邀请码可进入工作台，初始剩余次数为 50。
- 未配置模型时提交有效对话返回明确的 503，邀请码仍为 50 次。
- 对象存储已有 `current.json` 和版本快照；临时数据库不存在时能恢复额度。
- 前端桌面端和移动端可打开，无横向滚动；安全响应头存在；前端代理不会向浏览器泄露后端地址。
- 用户设置 `LLM_API_KEY` 与 `LLM_MODEL` 后，再执行一次真实模型分析，人工核对证据原句、评分、风险和建议回复，并确认额度变为 49。

轻量方案的 RPO 为 300 秒，健康保护窗口为 600 秒；极端故障仍可能丢失最近一次成功快照后的事务。若业务不能接受该边界，应在上线前改用 PostgreSQL。
