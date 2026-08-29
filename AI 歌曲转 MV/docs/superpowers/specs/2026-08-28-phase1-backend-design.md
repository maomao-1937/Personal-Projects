# 第 1 阶段后端设计规格

> 日期：2026-08-28  
> 状态：等待用户书面审阅  
> 详细规格：[第 1 阶段技术开发文档](../../第1阶段技术开发文档.md)  
> 技术取舍：[技术适配声明](../../技术适配声明.md)

## 1. 设计目标

在保留 librosa 与 FFmpeg 真实链路的前提下，为 AI 歌曲转 MV 建立单机可恢复的后端：SQLite 持久 Job、同进程 Worker、事件可恢复 SSE、Provider 抽象、TimelineVersion、Preview/Export 版本绑定，以及后端自带的最小验收页。

## 2. 已确认决策

- 使用 Python 3.11、FastAPI、Pydantic、pytest；
- 使用 SQLite WAL，不引入 PostgreSQL、Redis 或 Celery；
- Worker 与 API 同进程，但通过 Repository 与 Handler 解耦；
- 新接口位于 `/api/v1`，旧接口保留用于回归；
- Artifact 开发期保存在本地受控目录；
- Storyboard 使用 OpenAI Compatible Provider；
- Video 默认使用阿里云百炼 DashScope Wan Provider，火山方舟 Ark Provider 作兼容项（根据 2026-08-28 后续成本决策更新）；
- Transcription 默认禁用；
- Preview/Export 使用 FFmpeg；
- 最小验收页使用原生 HTML/JavaScript，不开发正式前端。

## 3. 核心不变量

1. 后端持久 Job 状态是唯一事实来源；
2. SSE 事件可重放且按 sequence 去重；
3. 上游已接受的视频任务不得因本地恢复重复提交；
4. 成功 Cut 在失败重试和 Regenerate 期间保留；
5. TimelineVersion 快照不可变；
6. Preview/Export 只接受明确 TimelineVersion；
7. 16:9 与 9:16 为两个独立 Export；
8. URL 存在不代表当前版本 Ready；
9. 所有资源读取校验 Owner；
10. Key 不进入 Git、前端、日志或 API 响应。

## 4. 数据流

```text
Upload Audio
  → AudioAnalysis Job
  → Librosa Provider
  → AudioAnalysis + BeatPlan
  → Storyboard Job
  → OpenAI Compatible Provider
  → Schema/Beat Normalizer
  → Confirmed Storyboard
  → Independent Cut Jobs
  → Ark Provider create/query/download
  → Active Video Artifacts
  → Immutable TimelineVersion
  → FFmpeg Preview
  → Independent 16:9 / 9:16 Exports
  → Authenticated MP4 Download
```

## 5. 恢复流

```text
Service Startup
  → Migrate SQLite
  → Scan Non-terminal Jobs
  → Expired Local Lease: requeue
  → Remote Job with provider_request_id: resume query
  → Start Worker
  → API snapshot + SSE incremental events
```

## 6. 错误策略

- 用户输入错误返回结构化 4xx；
- 可重试 Provider 错误有限重试；
- 审核、权限、余额和非法参数不自动重试；
- 远程未知状态进入 `unknown_provider_state`，只查询原任务；
- 未知服务错误返回安全 Request ID；
- Artifact 丢失将 Ready 降级为 `missing_asset`。

## 7. 测试策略

- 所有生产行为遵循 TDD：先看到目标测试失败，再写最少实现；
- Repository、状态机、版本和安全边界使用真实 SQLite 临时库；
- 外部模型使用可编程 Fake Provider；
- 真实模型冒烟默认跳过，显式开关后才运行；
- FFmpeg 使用固定本地媒体 Fixture 做真实集成测试；
- 阶段结束前运行完整 pytest、媒体探测、安全检查和 Git Diff 审计。

## 8. 范围边界

本规格不包含正式前端、云部署、对象存储、独立 Worker 集群、支付、积分、社区、多轨 Timeline、Characters、Environments、多候选图片或 Lipsync。
