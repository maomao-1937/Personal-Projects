# MeetingMemo 封闭 Beta 设计规格

> 日期：2026-08-23  
> 状态：已按产品负责人「后续全部采用推荐方案并持续推进」的授权确认  
> 依据：`docs/prd/meetingmemo-mvp-prd.md`、《AI Agent 产品 Vibe Coding 通用技术栈手册 V2.1》及 2026-08-23 的范围补充

## 1. 目标与裁决

MeetingMemo 的本轮目标是交付一个可本地运行、可测试，并能在补充真实 LLM API Key 后进入部署的封闭 Beta。产品通过邀请码开放，不提供注册、登录、用户账号或角色系统。

本规格对 PRD 做以下明确裁决：

- 用户最新要求覆盖 PRD 的 FR-01、FR-02：本轮不实现用户、工作区和角色权限，以邀请码访问会话作为唯一产品访问边界。
- 一个邀请码最多成功兑换 50 次。每次成功兑换创建一个 30 天访问会话；页面刷新和后续 API 请求不重复扣减。
- 当前可完整验收的主链路是：兑换邀请码 → 创建会议并粘贴或上传转录 → 异步生成摘要 → 查看来源 → 编辑并生成新版本 → 确认 → 导出。
- Zoom、Google Meet、Slack 和 Email 保留适配器边界、配置状态与错误语义。没有平台凭据和真实账号 Spike 时，不把它们报告为已验收能力。
- 用户补充真实 LLM API Key 前，开发使用 mock 完成离线测试；真实模型端到端冒烟和生产上线保持待验。

## 2. 方案比较

### 2.1 方案 A：一次实现全部外部平台

优点是表面覆盖 PRD 最完整。缺点是 Zoom、Google Workspace、Slack 和邮件均需要独立凭据、账号类型、权限审批与真实环境验证；在缺少这些条件时只能产生未经验证的代码，安全和交付风险最高。

### 2.2 方案 B：封闭 Beta 核心闭环 + 适配器边界（采用）

先把产品核心价值和邀请码访问制度做成可运行闭环，第三方能力通过稳定接口隔离。后续拿到平台凭据时，只需新增或启用适配器，不改变会议、转录、摘要、版本和任务的数据契约。

### 2.3 方案 C：无持久化的一次性 Demo

开发最快，但无法满足 50 次邀请码原子计数、任务恢复、版本、删除、审计与部署要求，因此不采用。

## 3. 技术适配声明

### 3.1 产品形态判断

- 产品类型与核心任务：会议转录到可追溯结构化摘要的会后处理产品。
- 核心交互：异步生成 + 人工审核 + 版本确认。
- 开发路径：后端先行。摘要能力与数据契约先通过 API 和自动化测试核验，再开发正式 Web 前端。
- 当前阶段范围：封闭 Beta 核心闭环、正式前端、上线前配置与部署预检。

### 3.2 采用的默认方案

- Python 3.11、FastAPI、Pydantic、pytest：遵循通用手册的默认后端基线。
- `/api/v1`：所有公开业务 API 使用统一版本前缀。
- Next.js、TypeScript、Tailwind CSS：后端验收通过后采用 Web 默认前端栈。
- 模块化单体：当前规模无需微服务，业务边界仍通过模块和接口隔离。

### 3.3 触发的按需模块

- SQLAlchemy + Alembic：邀请码原子计数、访问会话、会议、版本、任务和审计存在关系与并发修改。
- SQLite / PostgreSQL：本地默认 SQLite；生产通过 `DATABASE_URL` 切换 PostgreSQL。
- 持久化任务执行器：摘要是长耗时操作，需要状态、认领、重试和重启恢复。
- 文件存储抽象：上传文件本地开发保存到受控目录，生产部署阶段切换持久化存储。

### 3.4 偏离或暂缓

- 不实现账号、登录、工作区和 RBAC：由邀请码访问会话替代，适合单租户封闭试点；未来引入团队协作时重新评估身份系统。
- Zoom / Google OAuth：保留接口和禁用状态，等待真实账号与 Scope Spike。
- Slack / Email 实际投递：保留适配器和配置校验，等待对应凭据后执行真实冒烟。
- 生产基础设施：前后端通过后再按部署手册确定，避免在核心链路未成立前绑定云资源。

### 3.5 强制底线

- 密钥与隐私：真实密钥仅从后端环境变量读取；`.env` 被忽略；日志不记录密钥或完整转录。
- 数据与任务可恢复：邀请计数、会话、会议、任务和摘要版本全部持久化。
- 输入输出校验：请求、模型结构化输出和错误响应均由 Pydantic 约束。
- 错误与日志边界：统一错误结构；外部异常不向客户端暴露堆栈。
- 测试与真实模型验收：先完成 mock 自动化测试；用户补 Key 后再运行真实模型冒烟。

## 4. 系统架构

```text
Browser / Next.js
       │ HTTPS + SameSite Cookie
       ▼
FastAPI `/api/v1`
  ├─ access       邀请码兑换、会话校验和退出
  ├─ meetings     会议与转录输入、查询和删除
  ├─ summaries    生成任务、摘要版本、审核和编辑
  ├─ deliveries   导出与可选外部分发
  └─ health       存活、就绪和版本信息
       │
       ├─ SQLAlchemy repositories ── SQLite / PostgreSQL
       ├─ managed asset storage ──── local / production adapter
       ├─ persistent job runner
       └─ provider adapters
            ├─ LLM provider（OpenAI-compatible）
            ├─ ASR provider（按配置启用）
            ├─ Slack provider（按配置启用）
            └─ Email provider（按配置启用）
```

模块边界要求：API 路由只负责 HTTP 适配；业务规则在 Service 层；持久化在 Repository 层；模型 Prompt 独立版本控制；第三方差异只存在于 Provider 层。

## 5. 邀请码与访问会话

### 5.1 邀请码存储

`invite_codes` 至少包含：

- `id`：UUID。
- `code_hash`：邀请码的带密钥哈希，不保存明文。
- `label`：运营识别名称。
- `max_redemptions`：默认 50。
- `redemption_count`：成功兑换次数。
- `is_active`、`expires_at`、`created_at`。

生产邀请码通过受控 CLI 创建，明文只显示一次。测试环境可以通过测试工厂创建固定邀请码。

### 5.2 原子兑换

兑换事务必须同时满足：邀请码有效、未过期、`redemption_count < max_redemptions`。数据库更新使用带条件的原子语句；并发请求中最多 50 个成功，其余返回 `INVITE_EXHAUSTED`。

成功后生成高熵随机 Session Token，只把 Token 哈希存入 `access_sessions`。浏览器收到 `HttpOnly`、`Secure`（生产）、`SameSite=Lax` Cookie，有效期 30 天。

### 5.3 API 保护

除健康检查、邀请码兑换和静态公开资源外，所有 API 都要求有效访问会话。状态修改请求还校验同源 `Origin`；CORS 只允许配置的前端来源。

## 6. 核心数据模型

- `Meeting`：标题、会议日期、时区、来源、语言、状态、创建时间、软删除时间。
- `TranscriptSegment`：稳定 ID、序号、开始/结束时间、说话人、文本。
- `ProcessingJob`：类型、状态、尝试次数、下次执行时间、Lease、错误码和 Trace ID。
- `SummaryVersion`：版本号、Schema 版本、结构化内容、质量标记、状态、父版本和创建来源。
- `Delivery`：渠道、目标脱敏值、摘要版本、幂等键、状态和回执摘要。
- `AuditEvent`：会话 ID 的不可逆标识、动作、资源、结果、时间和 Trace ID，不保存正文。
- `Feedback`：评分、错误类型和可选短文本，不自动包含会议正文。

会议状态使用受控枚举：

```text
draft → queued → summarizing → validating → ready_for_review
      ↘ failed
ready_for_review → approved
approved → archived
```

删除请求立即让会议不可访问，并阻止未完成任务继续写入。

## 7. 转录输入

首版支持：

- 直接粘贴纯文本。
- 上传 UTF-8 `.txt`、`.vtt` 或 `.srt`。
- 每个文件有大小上限、扩展名与实际 MIME 校验、安全文件名和受控路径。
- VTT/SRT 解析为带时间戳片段；纯文本生成稳定段落片段并标记“无媒体时间戳”。

音频或视频输入只有在 ASR Provider 配置并通过真实冒烟后才启用。未配置时返回明确的 `ASR_NOT_CONFIGURED`，不伪造转录结果。

## 8. 摘要生成与质量闸门

### 8.1 异步流程

`POST /api/v1/meetings/{id}/summary-jobs` 创建持久化任务并立即返回 `202`。前端轮询任务和会议状态。任务执行器使用数据库 Lease 认领任务；进程重启后可重新认领过期任务，且同一会议只允许一个活动摘要任务。

### 8.2 长文本策略

- 短转录：单次结构化生成。
- 长转录：按片段边界分块，先提取分块候选项，再做全局合并。
- 每个分块只允许引用输入中存在的 Segment ID。
- 合并阶段保留来源引用、去重，并识别被后文推翻的早期候选。

### 8.3 输出结构

摘要包含 `headline`、`topics`、`decisions`、`action_items`、`open_questions` 和 `quality_flags`。决策和待办至少引用一个真实 Segment ID；责任人、截止时间不明确时保持空值。

### 8.4 确定性校验

质量闸门至少检查：

- 摘要 Schema 版本与字段合法。
- 所有引用存在且属于当前会议。
- 决策或待办没有空引用。
- 输入不是空白或明显过短。
- 模型没有返回未知人员标识。
- 删除或取消后的会议没有生成结果。

校验失败先执行有限次数修复重试；仍失败则任务进入 `failed`，保留统一错误码并允许人工重试。

## 9. 审核、版本与导出

- 自动生成结果是 v1，默认 `ready_for_review`。
- 编辑采用乐观锁；请求必须携带当前版本号，冲突返回 `VERSION_CONFLICT`。
- 每次保存生成不可变新版本；确认操作只改变版本状态，不覆盖内容。
- 导出支持 Markdown、JSON 和复制用纯文本。
- 外部分发通过 `会议 + 摘要版本 + 渠道 + 目标` 的幂等键防重复。

## 10. API 轮廓

```text
POST   /api/v1/access/redeem
GET    /api/v1/access/session
POST   /api/v1/access/logout

POST   /api/v1/meetings
POST   /api/v1/meetings/{id}/transcript
POST   /api/v1/meetings/{id}/transcript-file
GET    /api/v1/meetings
GET    /api/v1/meetings/{id}
DELETE /api/v1/meetings/{id}

POST   /api/v1/meetings/{id}/summary-jobs
GET    /api/v1/jobs/{id}
GET    /api/v1/meetings/{id}/summaries
GET    /api/v1/summaries/{id}
POST   /api/v1/summaries/{id}/revisions
POST   /api/v1/summaries/{id}/approve
GET    /api/v1/summaries/{id}/export?format=markdown|json|text

GET    /api/v1/integrations
POST   /api/v1/summaries/{id}/deliveries
POST   /api/v1/feedback

GET    /health/live
GET    /health/ready
```

所有错误统一为：

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "面向用户的简短说明",
    "trace_id": "opaque-id"
  }
}
```

## 11. 正式前端

前端采用单一 Web 终端，信息架构为：

1. 邀请码入口。
2. 会议列表与创建入口。
3. 新建会议：输入会议信息并粘贴或上传转录。
4. 处理状态：显示当前阶段、可恢复失败和重试入口。
5. 摘要详情：桌面端摘要与转录并排，移动端切换标签；来源引用可定位。
6. 编辑与确认：修改结构化字段、质量提示、版本历史和导出。
7. 集成状态：只展示真实配置状态；未配置能力明确说明所需条件。

视觉方向以用户提供的 Refero 链接为参考。该链接在 2026-08-23 两次浏览器加载超时，因此前端阶段需重新获取；若仍不可读，则采用低饱和暖灰底、深墨色文字、克制的蓝紫强调色、较大留白和编辑工作台式层级，避免通用 AI 渐变模板感。

## 12. 错误处理与安全

- 邀请码错误、耗尽和过期使用相同粒度的公开信息，防止枚举。
- 兑换接口按 IP 的不可逆哈希和时间窗限流，不保存原始 IP。
- 上传阻止路径遍历、双扩展名和超限文件。
- Prompt 明确把转录视为不可信数据；转录中的指令不能改变系统规则。
- LLM 超时、限流和临时错误使用带抖动的有限重试。
- 日志只记录资源 ID、状态、耗时、Token 与错误类型，不记录完整正文。
- `.env`、数据库、上传文件、测试产物和视觉伴侣目录不得提交。

## 13. 测试与验收

### 13.1 自动化测试

- 50 次并发邀请码兑换恰好最多成功 50 次。
- 已耗尽、过期、停用和错误邀请码行为。
- Cookie 会话创建、过期、退出和受保护路由。
- TXT、VTT、SRT 解析与上传安全边界。
- 会议和任务状态机、重复提交、重启恢复与删除竞态。
- 模型结构解析、非法引用、未知人员、重试和统一错误。
- 摘要编辑乐观锁、不可变版本、确认和导出。
- 分发幂等与 Provider 未配置状态。
- API 契约、跨资源访问与日志脱敏。

### 13.2 真实模型冒烟

用户补充 Key 后，至少使用 1 份中文和 1 份英文代表性转录完成：真实请求 → 结构化摘要 → 持久化 → 前端查看。记录模型名、首个结果时间、总耗时、Token、重试次数和结构合规情况。

### 13.3 前端核验

运行类型检查、ESLint、组件测试和关键端到端测试；检查桌面与移动端的邀请、创建、轮询、失败恢复、审核、版本冲突和导出流程，并确认无严重控制台错误。

## 14. 部署前完成条件

- 后端和前端自动化测试全部通过。
- 本地完整 mock 主链路通过。
- 生产配置检查能明确列出缺失 Secret，而不打印其值。
- 数据库迁移、持久化文件方案、健康检查和回滚说明就绪。
- LLM API Key 是进入真实模型冒烟与生产发布前的唯一必需用户输入；如果用户希望同时启用外部分发或会议平台，还需另行提供对应平台凭据。

## 15. 规格自检结果

- 占位符：无 `TODO`、待定实现或未定义接口。
- 一致性：邀请码访问制度与“无注册、无登录”一致；PRD 中冲突条款已显式裁决。
- 范围：规格覆盖一个封闭 Beta，可由后端、前端和部署准备 3 个实现计划完成。
- 模糊性：50 次定义为成功兑换次数；刷新和 API 请求不扣次数；生产外部集成未配置时禁用而非假成功。
