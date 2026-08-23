# MeetingMemo 技术适配说明

## 1. 需求裁决

本项目以 `docs/prd/meetingmemo-mvp-prd.md` 为产品输入，并按《AI 产品 Vibe Coding 通用技术栈手册》进行技术适配。用户在实施指令中明确要求“不做注册、登录，就一个邀请码可以被访问 50 次”，因此该要求覆盖 PRD 中的账号、工作区和 RBAC 条款。

本期的访问模型是封闭 Beta：

- 不创建用户账号，不收集密码，不提供第三方登录。
- 每个邀请码默认最多成功兑换 50 次；数据库通过条件更新原子计数。
- 成功兑换签发 30 天 HttpOnly Cookie 会话；刷新和业务请求不扣次数。
- 邀请码、会话 Token 和客户端 IP 均只保存不可逆哈希或 HMAC 指纹。

## 2. 技术栈适配

| 层 | 选择 | 适配原因 |
| --- | --- | --- |
| API | FastAPI + Pydantic | 与手册默认栈一致，提供明确契约、校验和 OpenAPI。 |
| 数据 | SQLAlchemy 2 + Alembic | 邀请码并发计数、任务 Lease、摘要版本和审计均需要事务与迁移。 |
| 开发数据库 | SQLite WAL | 降低本地启动成本，并验证真实事务和约束。 |
| 生产数据库 | PostgreSQL | 支持多实例持久化、并发更新和部署平台托管数据库。 |
| 后台任务 | 数据库 Job + Lease Runner | 任务状态可恢复，不把长耗时 LLM 调用绑在单个 HTTP 请求中。 |
| 模型接入 | Mock + OpenAI-compatible Provider | 无 Key 时可完整验收业务链路；有 Key 后替换 Base URL、模型和密钥即可。 |
| 测试 | pytest + HTTP 集成测试 | 覆盖 API、数据库约束、迁移、并发、失败恢复和完整主链路。 |

## 3. 产品范围适配

后端主链路采用“手工转录优先”：创建会议后粘贴文本，或上传 TXT、VTT、SRT。Zoom、Google Meet、Slack 和 SMTP 都需要独立平台凭据和真实环境，因此处理方式如下：

- Zoom 与 Google Meet：本期不启用 OAuth 或自动拉取，只返回真实的 `not_configured` 状态。
- Slack 与邮件：实现可选适配器；未配置密钥时禁用，只有已审批摘要可以分发，重复请求使用幂等键避免二次发送。生产 Slack 只接受官方 HTTPS Webhook；SMTP STARTTLS 使用系统可信 CA 校验证书，禁止明文 SMTP。
- 音频 ASR：未配置和验证 ASR Provider，因此不接受音频上传，不把未经验证的能力写成已完成。
- 转录文件：开发环境以内部会议 ID 保存到 `UPLOAD_DIR` 的受控路径，不保留用户文件名；数据库中的标准化 `TranscriptSegment` 是摘要权威输入。改为粘贴文本或删除会议时同步清理原文件，生产部署时需把该目录切换为持久化卷或对象存储适配器。

## 4. LLM 质量与安全适配

- 转录按不可信输入处理，版本化 Prompt 明确禁止执行转录中的指令。
- 长转录采用不拆分 Segment 的 map-reduce。
- 模型必须返回固定 Schema；无效 JSON 只允许一次格式修复。
- 决策、待办和问题必须引用输入 Segment ID；未知来源或虚构责任人会被确定性质量闸门拒绝。
- 401 不重试；429、超时和 5xx 进行有限重试。
- 摘要版本不可变，人工修改创建新版本；只允许审批最新版本。

## 5. 安全与运维适配

- Cookie 设置 HttpOnly、SameSite=Lax，生产环境启用 Secure。
- CORS 只允许配置的前端来源；状态修改请求额外校验同源 Origin。
- 邀请码兑换按客户端 IP 的 HMAC 指纹和时间窗限流，不保存原始 IP。
- 上传限制大小、扩展名、MIME、UTF-8 和安全文件名。
- 健康就绪检查同时核对数据库连接、当前 Alembic 版本和后台 Runner。
- 日志采用字段白名单，不记录请求体、Cookie、Authorization、邀请码、转录或摘要正文。
- `.env`、数据库、上传目录、缓存和测试临时文件均被 Git 忽略。
- 生产配置检查只打印缺失变量名，绝不打印 Secret 值；应用在生产配置不安全时拒绝启动。
- 生产 LLM Base URL 必须使用 HTTPS，避免 Bearer Key 和完整转录经明文链路发送。

## 6. 尚待外部条件

后端代码和 mock 链路不依赖真实 LLM Key。真实模型冒烟需要用户在部署前把国内模型的 API Key 写入本地 `.env` 或部署平台 Secret；完成中文与英文代表性转录验证后，才可把真实模型状态标记为通过。

生产 PostgreSQL 的迁移和并发测试同样需要部署前测试数据库凭据。当前本地端口只有不可认证的转发，未把 PostgreSQL 实测写成通过；该验证保留为部署前硬门槛。
