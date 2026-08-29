# PRD Changelog：V1.0 → V1.1

> 2026-08-28 后续产品决策：为降低 P0 视频生成成本，默认 VideoProvider 由火山方舟 Seedance 调整为阿里云百炼 `wanx2.1-t2v-turbo`，Seedance 改为可选兼容项。Wan 固定 5 秒源片与 P0 4—12 秒 Cut 的差异由 FFmpeg 裁切/循环对齐。

> 日期：2026-08-28  
> 变更类型：产品逻辑修订，不涉及业务代码

## 1. 范围与交付节奏

- 保留完整 P0 主链路，不删减用户要求的关键能力。
- 将“一天上线版 MVP”改为“完整 P0 + 一天技术闭环验证”。一天只要求证明单 Cut 的真实模型与 FFmpeg 链路，不再承诺一天完成登录、持久化、恢复、双比例导出和正式前端。
- 明确 P0、P1、明确不做，并保留阶段闸门。

## 2. 产品对象与流程

- 统一 Plot、Storyboard、Scene、Cut、Timeline 的关系。
- P0 不单设 Scene 实体：Storyboard 是有版本的有序 Cut 计划，Cut 是最小生成和 Timeline 单元。
- 补齐上传、分析、确认、独立生成、部分失败、重试、重生成、Preview、双 Export 和下载的断点处理。

## 3. 音乐分析与卡点

- 新增 BeatPlan，明确 BPM、Beat、Onset、Energy 如何进入 AI 分镜。
- AI 负责语义与镜头内容，后端负责根据 BeatPlan 修正 Cut 边界、连续覆盖、密度与卡点，避免完全依赖大模型时间码。

## 4. Cut、任务与部分成功

- 区分 Retry 与 Regenerate。
- 失败 Cut 可单独重试，成功 Cut 不回滚、不重复生成。
- Regenerate 成功前保留旧 active 视频；成功后切换新 Artifact 并产生新 TimelineVersion。
- Partial 状态可生成带明确占位的 Preview，但正式 Export 必须全部 active Cut Ready。

## 5. Preview、Export 与版本

- 新增不可变 TimelineVersion 和 Preview 实体。
- Preview 和 Export 都绑定精确 timeline_version、Cut 顺序与 active Artifact。
- 16:9 与 9:16 改为两个独立 Export Job/Artifact；一个成功不代表另一个成功。
- active Cut、顺序、时间、视频资产、音频或渲染参数变化后，旧 Preview/Export 自动 stale。
- 明确禁止仅因旧 `export_url` 存在就显示当前版本已导出，并加入防回归验收。

## 6. 恢复与状态事实源

- 后端持久任务状态成为唯一事实来源，SSE 仅负责增量通知。
- 新增刷新、断网、SSE 中断、服务重启后的快照查询、event_id 去重和重连逻辑。
- 项目阶段改为由分析、Storyboard、Cut、Preview 和 Export 子状态聚合派生。

## 7. Provider、成本与边界

- 保留 AudioAnalysisProvider、StoryboardProvider、VideoProvider、TranscriptionProvider、RenderProvider。
- provider、base_url、model、timeout、retry 和并发全部通过后端环境变量配置。
- 增加模型超时、幂等、限流、昂贵任务重试、最大任务时长与成本边界。
- 收敛 P0 输入边界：推荐 MP3/WAV、30—60 秒、100 MB、4—12 个 Cut、单项目并发 2。

## 8. 数据与验收

- 补齐 User、Project、AudioAsset、AudioAnalysis、Plot、StoryboardVersion、Cut、Artifact、Job、TimelineVersion、Preview、Export 的关系。
- 将主观验收改为可真实操作验证的状态、版本、恢复和文件结果。
- 把任务内存存储、SSE、4xx、Mac 路径、pytest/CI、README/版本不一致列为阶段 1 技术约束。

## 9. 竞品证据边界

- 只引用 4i 已观察到的页面和行为。
- 登录注册闭环、付款、积分、最终删除、失败退款和重生成版本保留仍标记为未验证。
- 明确不复制 4i Timeline Export 复用旧 Director 内容的问题。

## 10. 已确认参数

产品经理于 2026-08-28 确认采用 V1.1 推荐值：P0 音频最长 60 秒、首次最多 12 个 Cut、单项目视频生成并发 2、生产资产在项目最后活动后保留 30 天；临时文件保留 24 小时，被替换且非 active 的资产保留 7 天。
