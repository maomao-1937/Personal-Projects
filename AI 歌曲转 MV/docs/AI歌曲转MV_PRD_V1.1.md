# AI 歌曲转 MV PRD V1.1

> 文档状态：待产品经理确认  
> 修订日期：2026-08-28  
> 产品阶段：P0 需求冻结前  
> 本文档只定义产品目标、用户流程、状态、数据、异常和验收，不授权开始开发

## 1. 产品概述

### 1.1 产品定位

“AI 歌曲转 MV”帮助没有专业剪辑团队的音乐人和内容创作者，把一段完成的音乐快速转成可发布的 AI MV。

产品自动分析 BPM、Beat、Onset 和 Energy，生成 Plot 与 Storyboard，再让每个 Cut 独立生成视频。用户可以在生成前微调分镜，也可以只重新生成不满意或失败的 Cut。最后由 FFmpeg 按音乐节拍重建 Preview，并分别导出 16:9 和 9:16 MP4。

### 1.2 P0 核心价值

用户不需要掌握专业 Timeline，也能完成以下闭环：

1. 上传音乐并看到真实音乐分析结果；
2. 获得一套覆盖目标音频区间的 Plot 和 Storyboard；
3. 分别生成、检查和重做每个 Cut；
4. 保留成功 Cut，只处理失败或不满意的 Cut；
5. 获得与 Beat 对齐、可预览、可下载的横版与竖版 MV。

### 1.3 主目标用户

P0 主用户：

- 独立音乐人、音乐厂牌运营；
- 需要为歌曲片段快速制作视觉内容的短视频创作者；
- 需要先验证歌曲视觉方向，再决定是否进入专业后期的内容团队。

P1 用户：需要更强镜头控制、歌词控制和素材管理的专业创作者。

### 1.4 典型使用场景

- 新歌宣发：将 30—60 秒副歌生成横版和竖版 MV；
- 社交媒体测试：用同一音乐快速验证一个视觉概念；
- Demo 可视化：在专业拍摄前，把歌曲情绪变成可播放 Storyboard；
- 歌词驱动内容：有可用转写时，让语义变化参与镜头内容生成。

## 2. 版本目标与范围

### 2.1 “一天上线版”的修订

完整 P0 包含登录、持久任务、两个模型 Provider、独立 Cut、部分失败、恢复、Preview、双比例导出和下载，不能被视为一个自然日内可稳定上线的范围。

因此 V1.1 将目标分为：

- **一天技术闭环**：只验证一段受控音频、一个 Storyboard、至少一个真实视频 Cut、一次 FFmpeg Preview/Export；使用最小验收界面，不代表完整 P0 上线。
- **完整 P0**：实现本文固定主链路、状态恢复、版本一致性和双比例导出，并通过人工验收后才可上线。

### 2.2 P0 固定主链路

邀请码登录  
→ 新建项目  
→ 上传音频  
→ librosa 分析 BPM / Beat / Energy  
→ AI 生成 Plot + Storyboard  
→ 用户确认或微调分镜  
→ 各 Cut 独立生成视频  
→ 失败 Cut 可单独重试  
→ FFmpeg 根据 Beat 自动卡点  
→ 生成 Preview  
→ 单 Cut 重新生成后重新构建 Preview  
→ 分别导出 16:9 和 9:16  
→ 下载 MP4

### 2.3 P0 功能

- 邀请码登录、会话保持和自己的项目列表；
- 新建项目、项目名称、项目最近状态；
- 上传和校验音乐；
- librosa 音乐分析：时长、BPM、Beat、Onset、Energy；
- 可选的歌词/语音转写；
- AI 生成 Plot 和 Storyboard；
- Storyboard 确认与轻量微调；
- 每个 Cut 独立生成、失败、重试、重新生成和版本保留；
- 部分成功聚合和失败 Cut 单独处理；
- 后端 FFmpeg 按 Beat 构建 Preview；
- 当前 TimelineVersion 的 Preview 自动失效和重建；
- 16:9、9:16 两个独立 Export；
- MP4 下载；
- 刷新、断网、SSE 中断和服务重启后的任务恢复；
- 后端事实状态、结构化错误和基础日志；
- Provider 可替换和安全环境变量配置。

### 2.4 P1 功能

- FLAC 和更多音频格式；
- 更长音乐、分段生成和长曲项目；
- 用户上传单 Cut 参考图或替换视频；
- 歌词逐句对齐与歌词驱动镜头；
- Cut 历史版本选择和手动回退；
- 转场模板、片头片尾、字幕与基础品牌模板；
- 更智能的 9:16 主体重构；
- 用户主动删除项目和完整数据删除回执；
- 更完整的历史筛选、复制项目和模板复用。

### 2.5 明确不做

- 专业多轨剪辑器；
- 完整复刻 4i Characters 系统；
- 完整复刻 4i Environments 系统；
- 多候选图片工作流；
- 复杂 Lipsync Timeline；
- 社区；
- 会员积分；
- 在线支付；
- 多人协作；
- 关键帧、滤镜、调色、音频混音等专业后期能力；
- YouTube 下载作为 P0 主入口。

## 3. 产品术语与唯一含义

| 术语 | P0 定义 |
|---|---|
| Project | 一个用户从音频到 MV 的完整工作空间 |
| AudioAsset | 用户上传的原始音频文件 |
| AudioAnalysis | 对某个 AudioAsset 版本的真实分析结果 |
| BeatPlan | 从 Beat、Onset、Energy 派生的可执行卡点和镜头密度计划 |
| Plot | 整个 MV 的叙事或视觉概念摘要，不带逐 Cut 任务状态 |
| StoryboardVersion | 某次确认或修改后的有序 Cut 计划快照 |
| Cut | 最小视频生成、重试、排序和 Timeline 播放单元 |
| Artifact | 上传、模型生成或 FFmpeg 渲染得到的不可变文件资产 |
| Job | 一次可追踪、可恢复的异步工作，如分析、Storyboard、Cut 生成、Preview 或 Export |
| TimelineVersion | 当前播放所需音频、Cut 顺序、时间范围、active 视频和渲染参数的不可变快照 |
| Preview | 绑定一个 TimelineVersion 的低成本预览 Artifact |
| Export | 绑定一个 TimelineVersion 和一个输出比例的正式导出记录 |
| Active Artifact | 当前 Cut 实际用于 Preview/Export 的视频资产 |
| Stale | 资产存在，但不再对应当前 TimelineVersion，不能显示为当前结果 |

P0 不建立独立 Scene 实体。产品文案中的“分镜/Scene”在数据层统一落到 Storyboard 中的 Cut。后续如需要“一场 Scene 包含多个 Cut”，放入 P1 数据迁移，不在 P0 提前复杂化。

## 4. 完整用户 Journey

### 4.1 登录与项目

1. 用户打开登录页，输入有效邀请码。
2. 登录成功后进入自己的项目列表。
3. 用户点击“新建项目”，输入项目名称或使用系统默认名称。
4. 系统创建空 Project，进入上传页。
5. 用户只能查看自己的项目和 Artifact；邀请码不能绕过数据隔离。

异常：

- 邀请码为空、无效或过期：显示明确原因，不创建会话；
- 会话过期：保存当前路由，重新登录后回到项目；
- 项目不存在或不属于当前用户：返回 404，不暴露他人项目是否存在。

### 4.2 上传音乐

1. 用户拖入或选择音频。
2. 前端立即检查扩展名、MIME、大小；后端再次检查真实格式、大小和时长。
3. 上传成功后创建 AudioAsset，项目进入 `audio_uploaded`。
4. 系统自动创建 AudioAnalysis Job。

P0 推荐边界：

| 项目 | 规则 |
|---|---|
| 格式 | MP3、WAV |
| 时长 | 最短 30 秒，最长 60 秒 |
| 大小 | 最大 100 MB |
| 声道 | 任意输入，分析时转单声道；导出保留可用音轨 |
| 同项目音频 | P0 每个项目一个 active AudioAsset；重新上传会创建新版本并使下游结果 stale |

上传状态：`idle → validating → uploading → uploaded`，失败时为 `failed`，允许选择文件重试。上传失败不得创建伪造的分析结果。

### 4.3 音乐分析

AudioAnalysisProvider 默认使用本地 librosa，输出：

- `duration_ms`；
- `bpm` 与置信/警告信息；
- `beats[]`；
- `onsets[]` 及强度；
- `energy_curve[]` 与归一化 Energy 段；
- 以 4/4 为默认近似得到的 downbeat 建议，并明确这是推断而非乐理真值；
- 可供页面展示的简化 waveform；
- `analysis_version` 和算法版本。

页面显示：时长、BPM、Beat 数量、Energy 曲线、Waveform 和分析状态。P0 不把 Mood 当作 librosa 的确定结果；Mood 若出现，只能标记为 StoryboardProvider 的语义推断。

分析失败时：

- 保留已上传 AudioAsset；
- 显示结构化原因和“重新分析”；
- 不进入 Storyboard；
- Retry 创建新 Job，不重复上传音频。

### 4.4 BeatPlan：音乐分析如何进入分镜

为了避免让文本模型直接决定所有时间码，P0 采用“两段式分镜”：

1. **后端生成 BeatPlan**
   - 从 Beat、Downbeat、Onset 和 Energy 识别候选边界；
   - 高 Energy/强 Onset 区域提高镜头密度；
   - 低 Energy 区域延长镜头；
   - 优先在强 Beat 或 Downbeat 附近切换；
   - 输出连续覆盖 `[0, target_duration]` 的候选时间段。
2. **StoryboardProvider 生成语义内容**
   - 接收 Plot 指令、音频摘要、可选歌词和 BeatPlan 摘要；
   - 为每个候选段生成镜头内容、视觉风格、动作、摄影和情绪；
   - 不允许返回越界、重叠或任意缺口。
3. **后端归一化**
   - 校验 JSON Schema；
   - 按 Provider 支持的最短/最长视频时长合并或拆分；
   - 把边界吸附到最近的有效 Beat；
   - 保证顺序、连续覆盖、数量上限和总时长一致；
   - 无法自动修复时返回可重试错误，不保存半合法 Storyboard。

### 4.5 Plot 与 Storyboard

用户可输入可选的创意描述，也可直接使用系统推荐。AI 返回：

- Plot：一句主题、视觉主线、情绪走向、统一风格；
- Storyboard：4—12 个有序 Cut；
- 每个 Cut 的时间范围、时长、内容 Prompt、情绪、镜头、动作、Energy 标签和卡点理由。

默认目标 Cut 时长为 4—6 秒。最终 Cut 数量由音频时长、BeatPlan 和 VideoProvider 支持时长决定，且不得超过 12。

用户可以：

- 修改 Plot 文本；
- 修改单 Cut Prompt、镜头、动作和情绪；
- 调整 Cut 顺序；
- 调整允许范围内的 Cut 边界；
- 新增、删除或拆分 Cut，但系统必须即时重新校验连续覆盖、数量和 Provider 时长限制；
- 恢复到本次 AI 生成版本；
- 确认 Storyboard 并进入视频生成。

Storyboard 不变量：

1. Cut ID 唯一且顺序连续；
2. 第一个 Cut 从 0 开始，最后一个 Cut 到目标音频结束；
3. 相邻 Cut 无空隙、无重叠；
4. 所有时间均在目标音频范围内；
5. 每个 Cut 时长符合当前 VideoProvider 能力；
6. Cut 数量不超过项目上限；
7. 已确认版本不可原地改写，后续编辑创建新的 StoryboardVersion。

### 4.6 各 Cut 独立生成

用户确认 Storyboard 后，可以“一键生成全部”或先生成单个 Cut。

每个 Cut 独立创建 Video Generation Job，输入固定为：

- project_id；
- storyboard_version；
- cut_id 与 cut_version；
- Prompt、镜头、动作、情绪和目标时长；
- 统一视觉风格摘要；
- aspect_source（P0 默认生成 16:9 母版）；
- Provider、model 和非敏感生成参数快照；
- idempotency_key。

P0 默认使用文本生成视频，不要求用户先生成候选图片。经 2026-08-28 产品决策，默认 VideoProvider 由 Seedance 替换为低成本的百炼 Wan `wanx2.1-t2v-turbo`；该模型固定生成 5 秒无声源片，4—12 秒目标 Cut 由 FFmpeg 裁切或循环对齐。不得暗中扩展成多候选图片工作流。

单项目默认最多两个 Cut 同时生成，其余排队。成功 Cut 立即保存 Artifact，不等待其他 Cut。

### 4.7 Retry、Regenerate 与成功结果保留

**Retry（重试）**：

- 用于失败或可恢复中断；
- 输入、cut_version 和目标保持不变；
- 创建新的 Job attempt；
- 已有成功 Cut 不受影响；
- 只有明确可重试错误才自动重试。

**Regenerate（重新生成）**：

- 用于用户对成功结果不满意或修改了 Cut 生成字段；
- 创建新的 cut_version、Job 和 Artifact；
- 新 Job 运行期间，旧 active Artifact 继续用于当前 Preview；
- 新 Artifact 成功后自动设为 active，生成新的 TimelineVersion；
- 新 Job 失败时，旧 active Artifact 保持不变，用户可继续预览和再次重试；
- P0 保留 active 与紧邻的上一成功版本，完整版本选择放入 P1。

昂贵视频任务的自动重试规则：若上游已接受任务但本地响应丢失，必须通过 idempotency_key 或 provider_request_id 查询，不得直接创建第二个收费任务。

### 4.8 部分成功

Cut 聚合结果：

- 全部未开始：`not_started`；
- 有排队或运行：`processing`；
- 至少一个成功且至少一个失败/未完成：`partial`；
- 全部 active Cut Ready：`ready`；
- 无成功且所有任务终止失败：`failed`。

在 `partial` 状态：

- 成功 Cut 保留并可播放；
- 失败 Cut 显示失败原因和“重试”；
- 未开始 Cut 可继续生成；
- 可构建部分 Preview；
- 不允许创建正式 Export。

部分 Preview 的缺失 Cut 使用明确的占位片段，显示 Cut 序号和“尚未生成”，同时保留原音乐。占位片段不是成功视频，不得进入正式导出。

### 4.9 TimelineVersion

用户不操作专业多轨 Timeline。P0 Timeline 是系统生成的只读播放结构，包含：

- 一条 Audio：原始音乐；
- Waveform：简化波形；
- Beat Marker：Beat/Downbeat 标记；
- 一条连续 Cut 序列；
- 每个 Cut 的 active Video Artifact；
- P0 默认硬切，转场模板不进入 P0。

TimelineVersion 是不可变快照，至少包含：

- audio_asset_id、analysis_version；
- 有序 cut_id；
- 每个 Cut 的 start/end；
- 每个 Cut 的 active_artifact_id；
- BeatPlan 版本；
- 渲染参数与安全区版本；
- 创建时间和内容哈希。

以下变化创建新的 TimelineVersion：

- active AudioAsset 或 AudioAnalysis 改变；
- Cut 增删、顺序或起止时间改变；
- 某 Cut 的 active Artifact 改变；
- 影响播放结果的渲染参数改变。

仅修改一个已有成功 Cut 的 Prompt，但尚未生成/切换新视频时，不改变当前 TimelineVersion；它只创建新的 StoryboardVersion 或 cut_version 草稿。新视频成功并成为 active 后才改变 TimelineVersion。

### 4.10 Preview

Preview 由 RenderProvider 默认使用 FFmpeg 在后端构建，不能只存在浏览器内存中。

规则：

1. Preview 必须绑定一个精确 timeline_version；
2. 当前版本已存在 Ready Preview 时可直接播放；
3. 当前 TimelineVersion 改变后，旧 Preview 标为 stale，页面显示“内容已更新，需要重建预览”；
4. 用户进入 Preview 页时，如当前版本无运行中的 Preview Job，系统自动创建重建任务；
5. 重建期间可以继续播放旧 Preview，但必须显示其版本已过期；
6. 单 Cut Regenerate 成功后，按最新 active Cut 和顺序重建；
7. Preview 失败不影响成功 Cut，允许仅重试 Preview Job；
8. 部分 Preview 和完整 Preview 必须显式区分。

### 4.11 Export

正式 Export 必须满足：

- 所有当前 active Cut 为 Ready；
- 当前 TimelineVersion 有效；
- 不包含占位片段；
- 用户选择输出比例并确认导出参数。

P0 Export 参数：

| 参数 | 16:9 | 9:16 |
|---|---|---|
| 任务关系 | 独立 Export Job | 独立 Export Job |
| 默认分辨率 | 1920×1080 | 1080×1920 |
| 降级分辨率 | 1280×720 | 720×1280 |
| 视频编码 | H.264 | H.264 |
| 音频编码 | AAC | AAC |
| 文件格式 | MP4 | MP4 |
| 水印 | P0 无水印 | P0 无水印 |
| 画面来源 | 当前 16:9 母版 Timeline | 同一 TimelineVersion 的确定性中心裁切/缩放与安全区策略 |

16:9 和 9:16 是两个独立任务、两个 Export 记录和两个 Artifact。一个任务 Ready 不代表另一个 Ready；一个失败不影响另一个已成功文件。

每个 Export 保存：timeline_version、aspect_ratio、resolution、codec、active Artifact 清单、渲染参数、状态、Job 和输出 Artifact。

当 TimelineVersion 改变：

- 所有旧 Preview/Export 保留为历史记录，但自动标记 stale；
- 当前页面不得显示“已导出”；
- 旧文件 URL 即使存在，也不能证明当前版本已导出；
- 用户必须为新版本分别重新导出 16:9 和 9:16。

9:16 P0 不重新调用视频生成模型，而是确定性裁切/缩放。若安全区预览显示主体被严重裁掉，用户可以返回 Cut 阶段重新生成更适合竖屏的母版；智能主体重构放入 P1。

## 5. 页面与主要交互

### 5.1 邀请码登录页

- 输入邀请码；
- 登录按钮；
- 无效、过期、网络错误状态；
- 不包含注册、付款和会员入口。

### 5.2 项目列表页

- 新建项目；
- 项目名称、更新时间、当前阶段、部分失败/待恢复提示；
- 点击项目进入上次工作步骤；
- P0 不提供删除和协作。

### 5.3 上传与分析页

- 文件拖放/选择；
- 格式、大小、时长规则；
- 上传进度、取消、失败重试；
- 分析进度；
- BPM、Beat 数、Waveform、Energy 曲线；
- 分析失败后重新分析。

### 5.4 Director / Storyboard 工作区

- 音乐摘要和可选歌词状态；
- Plot 输入与 AI 结果；
- Storyboard Cut 列表；
- 单 Cut Prompt、情绪、动作、镜头和时间范围；
- 新增、删除、拆分、排序；
- 不变量校验提示；
- 确认 Storyboard；
- 生成全部或生成单个 Cut。

### 5.5 Cut 工作区

- 卡片展示 Cut 序号、时间、Prompt、active 视频与状态；
- 生成、重试、重新生成；
- 失败原因；
- 生成进度；
- 当前使用版本和“新版本生成中”；
- 聚合状态与失败 Cut 筛选；
- 进入 Preview。

### 5.6 Preview / Export 工作区

- 当前 Preview、版本号、完整/部分/stale 标签；
- Audio、Waveform、Beat Marker、Cut 和 Video Clip 的只读 Timeline；
- Preview 重建状态和重试；
- 16:9、9:16 两张独立 Export 卡；
- 比例、分辨率、编码、预计输出说明；
- 各自的导出、进度、失败重试和下载按钮；
- Timeline 变化后旧结果的 stale 提示。

## 6. 状态模型

### 6.1 Job 状态

统一 Job 状态：

`accepted → queued → running → succeeded`

异常分支：

- `failed_retryable`：可重试；
- `failed_terminal`：不可自动重试；
- `cancelled`：用户或系统取消；
- `timed_out`：超过最大任务时长；
- `unknown`：与 Provider 暂时失联，必须查询后确认，不得直接当失败重做。

Job 必须保存：类型、输入快照、项目/资源关联、attempt、idempotency_key、provider_request_id、进度、event_sequence、错误码、创建/开始/结束时间、heartbeat、最大时长和结果 Artifact。

### 6.2 Cut 状态

`draft → ready_to_generate → queued → generating → ready`

异常与版本状态：

- `failed_retryable`；
- `failed_terminal`；
- `regenerating`：已有 active 成功资产，同时生成新版本；
- `stale_spec`：Storyboard 已改但当前 active 视频仍来自旧 spec；
- `missing_asset`：记录成功但文件不存在，必须视为失败并修复。

### 6.3 Preview / Export 状态

`not_created → queued → rendering → ready`

异常与版本状态：

- `failed_retryable`；
- `failed_terminal`；
- `stale`；
- `missing_asset`。

Ready 的充分条件是：状态为 `ready`、Artifact 可读取、Artifact 的 timeline_version 等于当前 TimelineVersion。仅有 URL 不满足条件。

### 6.4 Project 派生阶段

Project 不使用单一线性字段覆盖子任务事实，而是根据子对象派生显示阶段：

- `new`；
- `uploading`；
- `analyzing`；
- `storyboarding`；
- `generating_cuts`；
- `partial`；
- `preview_ready`；
- `exporting`；
- `exported_current`；
- `needs_attention`。

当存在并行任务时，页面展示主阶段和详细子状态，不把一个 Cut 失败误写成整个项目永久失败。

## 7. 刷新、断网与恢复

### 7.1 事实来源

- 后端持久化数据库中的 Job、Artifact 和版本状态是唯一事实来源；
- 前端本地状态和 SSE 消息不是最终事实；
- SSE 用于降低轮询延迟，不承担唯一状态存储。

### 7.2 恢复规则

1. 所有异步创建接口返回稳定 job_id 和资源 ID；
2. 页面刷新后先读取 Project 快照，再按活跃 job_id 恢复订阅；
3. SSE 每个事件包含 event_id/event_sequence；前端按序去重；
4. SSE 中断时页面显示“连接中断，正在恢复”，不把 Job 标失败；
5. 重连先按最后 event_id 获取增量，缺失时重新读取 Job 快照；
6. 后端重启后读取持久 Job；有 provider_request_id 的任务查询上游状态，有本地任务则按租约决定继续、重排或失败；
7. 用户关闭页面不取消后台任务；
8. 终态必须能通过普通 GET 查询，不依赖曾经收到 SSE；
9. 重复提交通过 idempotency_key 返回原 Job 或明确冲突，不重复收费。

## 8. Provider 与模型边界

### 8.1 Provider 结构

| Provider | P0 默认 | 职责 |
|---|---|---|
| AudioAnalysisProvider | librosa | BPM、Beat、Onset、Energy、Waveform |
| StoryboardProvider | DeepSeek 或用户提供的 OpenAI Compatible API | Plot、Storyboard 语义内容和严格 JSON |
| VideoProvider | 默认阿里云百炼 Wan；Seedance 作可选兼容 | 单 Cut 视频生成与任务查询 |
| TranscriptionProvider | 可替换国内 ASR 或本地方案 | 可选歌词/语音转写 |
| RenderProvider | FFmpeg | Beat 卡点、Preview、16:9/9:16 Export |

业务逻辑只依赖统一 Provider 接口。Provider、base_url、model、timeout、retry、并发与能力限制全部由后端环境变量配置，不在业务代码、前端或数据库明文中写死密钥。

### 8.2 模型输出与失败

- Storyboard 输出必须通过 JSON Schema 和业务不变量双重校验；
- JSON 无法解析、时间越界或 Cut 数量非法视为失败，不保存为已确认版本；
- 限流、网络超时、上游 5xx、内容审核、余额不足和参数错误使用不同错误码；
- 只对网络、限流和明确 5xx 做有限自动重试；
- 内容审核、余额不足、权限和非法参数不自动重试；
- 所有请求记录 provider、model、request_id、耗时、尝试次数和估算成本，不记录密钥；
- 达到项目预算或 Cut 数量上限时，阻止新任务并说明原因。

### 8.3 推荐时间与重试边界

以下是产品侧默认上限，阶段 1 可在不扩大范围的前提下根据真实 Provider 能力调整，并在技术适配声明中记录：

| 任务 | 单次超时/最大观察时长 | 自动重试 |
|---|---:|---:|
| Audio Analysis | 2 分钟 | 1 次 |
| Storyboard | 60 秒 | 最多 2 次，仅限可重试错误或一次结构修复 |
| 单 Cut Video | 20 分钟 | 最多 1 次；上游已接单时先查询，不重复创建 |
| Preview | 10 分钟 | 1 次 |
| 单比例 Export | 10 分钟 | 1 次 |

单项目初始视频生成上限推荐 12 个 Cut，并发 2。系统级并发由部署环境配置，不在前端硬编码。

## 9. 核心数据关系

```text
User
 └─ Project
     ├─ AudioAsset ─ AudioAnalysis ─ BeatPlan
     ├─ Plot
     ├─ StoryboardVersion
     │   └─ Cut ── active ──> Video Artifact
     │       └─ Job attempts ──> Video Artifacts
     ├─ TimelineVersion
     │   ├─ ordered Cut snapshots
     │   ├─ Preview ─ Job ─ Artifact
     │   └─ Export (16:9) ─ Job ─ Artifact
     │   └─ Export (9:16) ─ Job ─ Artifact
     └─ Audit/Event records
```

### 9.1 核心实体字段

#### User

- id；
- invite_identity/session identity；
- status；
- created_at、last_login_at。

#### Project

- id、owner_user_id；
- name；
- active_audio_asset_id；
- active_storyboard_version_id；
- current_timeline_version_id；
- derived_phase；
- created_at、updated_at。

#### AudioAsset

- id、project_id、version；
- Artifact 引用；
- filename、mime、bytes、duration；
- checksum；
- validation_status。

#### AudioAnalysis

- id、audio_asset_id、analysis_version；
- bpm、beats、onsets、energy_curve、waveform；
- duration；
- algorithm/provider 版本；
- warnings、status、job_id。

#### BeatPlan

- id、analysis_id、version；
- candidate_boundaries；
- energy_sections；
- density_hints；
- normalization_rules_version。

#### Plot

- id、project_id、storyboard_version_id；
- theme、visual_arc、style、mood_inference；
- user_brief；
- provider metadata。

#### StoryboardVersion

- id、project_id、version；
- source_analysis_id、beat_plan_id、plot_id；
- status：draft/valid/confirmed/superseded；
- ordered_cut_ids；
- created_by、created_at。

#### Cut

- id、storyboard_version_id、cut_version；
- order、start_ms、end_ms；
- prompt、mood、action、camera、energy_label；
- beat_anchor、cut_reason；
- generation_status；
- active_artifact_id；
- latest_job_id。

#### Artifact

- id、project_id、owner_user_id；
- type：audio/video/preview/export/log；
- storage_key、mime、bytes、checksum；
- width、height、duration、codec；
- source_provider、source_job_id；
- timeline_version_id（适用时）；
- created_at、expires_at、availability_status。

#### Job

- id、project_id、type、status；
- resource_type、resource_id；
- input_snapshot_hash；
- provider、model、provider_request_id；
- idempotency_key、attempt、max_attempts；
- progress、event_sequence；
- error_code、safe_error_message、retryable；
- created_at、started_at、heartbeat_at、finished_at、deadline_at；
- result_artifact_id、estimated_cost。

#### TimelineVersion

- id、project_id、version、content_hash；
- audio_asset_id、analysis_version、beat_plan_id；
- ordered Cut 快照和 active_artifact_ids；
- render_rules_version；
- created_at、superseded_at。

#### Preview

- id、project_id、timeline_version_id；
- completeness：partial/full；
- status、job_id、artifact_id；
- stale_reason；
- created_at。

#### Export

- id、project_id、timeline_version_id；
- aspect_ratio、resolution、format、video_codec、audio_codec、watermark；
- render_snapshot；
- status、job_id、artifact_id；
- stale_reason；
- created_at、completed_at。

## 10. 产品 API 行为要求

本节只定义业务行为，不锁定最终路由：

- 登录和会话：校验邀请码、读取当前用户、退出；
- 项目：创建、列表、读取项目快照；
- 音频：上传、校验、重新上传；
- 分析：创建分析 Job、查询结果、重试；
- Storyboard：创建生成 Job、读取草稿、校验编辑、确认版本；
- Cut：生成全部、生成单个、Retry、Regenerate、读取版本与 active Artifact；
- Timeline：读取当前版本和只读结构；
- Preview：创建/重建、查询、播放；
- Export：分别创建 16:9/9:16、查询、重试、下载；
- Job：读取快照、事件增量、SSE 订阅；
- Artifact：经鉴权读取或生成短时下载地址。

所有创建任务的接口必须支持幂等；所有资源读取必须校验 owner_user_id；所有非法输入稳定返回结构化 4xx，不以 500 代替用户错误。

## 11. 错误、提示与可恢复行为

| 场景 | 页面行为 | 可继续动作 |
|---|---|---|
| 音频格式/大小/时长非法 | 上传前后均提示具体限制，不进入分析 | 重新选择文件 |
| 音频损坏 | 保留项目，标记上传资产不可分析 | 重新上传 |
| 分析失败 | 显示 safe error 和 job_id | 重新分析 |
| Storyboard JSON 非法 | 不保存为可确认版本 | 自动有限修复后手动重试 |
| Storyboard 边界不合法 | 标出具体 Cut 与原因 | 自动归一化或用户修改 |
| Cut 排队/限流 | 显示排队位置或等待原因 | 等待，不重复提交 |
| 单 Cut 失败 | 其他成功 Cut 保留 | Retry 或修改后 Regenerate |
| Provider 状态未知 | 显示“正在确认上游状态” | 等待查询，不直接创建收费任务 |
| Preview 失败 | active Cut 不受影响 | 重建 Preview |
| Preview stale | 旧预览可播放但有明显过期标签 | 重建当前版本 |
| 单比例 Export 失败 | 另一比例状态不受影响 | 仅重试失败比例 |
| Export stale | 不显示为当前已导出 | 为当前版本重新导出 |
| SSE 中断 | 显示恢复中，继续读取后端快照 | 自动重连 |
| 服务重启 | 根据持久 Job 恢复或给出明确终态 | 自动恢复/重排/手动重试 |
| Artifact 丢失 | Ready 降级为 missing_asset | 重建或重新生成 |
| 余额/权限不足 | 显示不可自动重试原因 | 配置有效服务后再试 |

错误信息不得包含 API Key、Provider 原始鉴权头、本地绝对敏感路径或其他用户数据。

## 12. 文件、存储与清理

- 开发阶段允许本地存储，但状态和文件元数据必须持久化；
- 生产文件必须进入对象存储，不能依赖函数实例本地磁盘；
- 上传、下载和 Artifact 访问必须有用户隔离；
- 临时转码文件推荐 24 小时清理；
- 被替换且非 active 的中间资产推荐 7 天清理；
- 项目 active 源音频、当前视频、Preview 和 Export 推荐在最后活动后保留 30 天；最终保留承诺上线前由产品经理确认；
- 清理任务不得删除 current_timeline_version 引用的 active Artifact；
- 清理失败可重试并产生审计记录；
- 上传和生成并发、磁盘余量、对象存储配额必须可观测。

## 13. 非功能要求与技术约束

### 13.1 必须保留

- 现有 librosa 真实 BPM、Beat、Onset、Energy 分析；
- 现有 FFmpeg 视频重排、卡点和 H.264/AAC 导出能力；
- FastAPI 接口和真实任务进度；
- Provider 替换能力。

### 13.2 阶段 1 准入约束

在开始正式前端前，后端必须解决：

1. 任务不能只保存在内存；
2. SSE 断线不能让页面永久卡住，日志不能重复；
3. 非法参数必须返回结构化 4xx，而不是未处理 500；
4. 跨平台路径不能写死 Windows，Mac/Linux 必须可运行；
5. YouTube 不是 P0 主链路，保留时必须完成跨平台和合规检查；
6. 建立 pytest 单元测试、接口测试、恢复测试、版本测试和 CI；
7. README、API 版本、前端显示版本、Tag 和真实实现保持一致；
8. 密钥只存在后端 `.env`/部署密钥系统，仓库只提交 `.env.example`；
9. 模型必须有 mock 测试和最小真实冒烟，未配置 Key 不得宣称真实调用通过；
10. Preview/Export 必须以 timeline_version 做防回归测试。

### 13.3 性能与可用性

- 30—60 秒音频上传后，普通本地环境下分析应在 2 分钟上限内结束或给出终态；
- 页面刷新后应在 5 秒内恢复项目快照，模型任务本身可继续运行；
- 同一操作重复点击不得创建重复收费任务；
- 所有终态在 30 秒内可通过普通查询接口确认，不依赖 SSE；
- MP4 需支持流式播放或可下载，并通过 ffprobe 校验。

## 14. 可操作验收标准

### 14.1 主链路

给定一个有效邀请码和一段 30—60 秒 MP3/WAV，用户能够：

1. 登录并新建项目；
2. 上传音频，看到真实时长、BPM、Beat 数、Waveform 和 Energy；
3. 生成 Plot 与合法 Storyboard；
4. 确认后产生 4—12 个连续覆盖音频区间的 Cut；
5. 至少完成 4 个真实 VideoProvider Cut，且每个 Cut 有独立 Job 和 Artifact；
6. 所有 Cut Ready 后生成完整 Preview；
7. 分别完成 16:9 与 9:16 Export；
8. 下载两个 MP4，ffprobe 显示预期比例、H.264、AAC 和接近目标音频的时长。

### 14.2 Beat 与时间一致性

- Storyboard 的第一个 Cut 从 0 开始，最后一个 Cut 到目标结束；
- 相邻 Cut 无可检测空隙或重叠；
- Timeline 中 Beat Marker 来自当前 AudioAnalysis；
- FFmpeg 使用 BeatPlan 的有效边界重建；
- 导出音视频时长差在验收阈值内，且无持续累积漂移；
- Beat 对齐指标使用固定样本和既有 `verify_sync` 思路给出数值，不只写“卡点效果良好”。

### 14.3 部分失败与重试

给定 6 个 Cut，其中 2 个模拟失败：

- 页面状态为 partial；
- 4 个成功 Cut 的 Artifact 保持不变；
- 用户可只重试 2 个失败 Cut；
- 重试成功后项目变为 ready；
- 成功 Cut 的 Job 不被再次创建；
- partial 时可生成带明确占位的 Preview，但 Export 按钮不可用。

### 14.4 Regenerate 与 Preview

给定一个已有完整 Preview 的项目：

1. 用户对单个成功 Cut 发起 Regenerate；
2. 新任务运行期间旧 Preview 仍可播放，旧 active Artifact 不被删除；
3. 新任务失败时 TimelineVersion 不变；
4. 新任务成功并切换 active Artifact 时，TimelineVersion 增加；
5. 旧 Preview 变为 stale；
6. 新 Preview 必须包含新 active Artifact，其他 Cut 顺序和资产不变。

### 14.5 Export 版本防回归

给定当前 TimelineVersion `T1` 已完成两个比例导出：

1. 调整 Cut 顺序或切换一个 active Artifact，产生 `T2`；
2. T1 的两个 Export 都标记 stale；
3. 页面不得因为 T1 的 URL 仍存在而显示 T2 已导出；
4. 只重新导出 T2 的 16:9 时，T2 的 9:16 仍为未导出；
5. 两个 T2 Export 的输入快照都必须引用 T2 的 Cut 顺序与 active Artifact；
6. 下载画面不得复用 T1 的旧 Director 内容。

### 14.6 刷新和连接恢复

- Cut 生成中刷新页面：恢复相同 job_id、状态和已完成 Cut；
- SSE 断开再连接：日志按 event_sequence 去重，终态与普通 GET 一致；
- 服务重启：已持久的 Job 不丢失；能查询 Provider 的任务继续查询，无法恢复的本地任务进入明确可重试终态；
- 同一生成按钮连续点击：只产生一个收费任务或返回同一 idempotent Job。

### 14.7 安全与隔离

- 用户 A 无法读取用户 B 的项目、Job 或 Artifact；
- API、SSE、日志和错误不返回真实 API Key；
- `.env` 不出现在 Git 变更中，仓库只包含安全 `.env.example`；
- 无效参数返回结构化 4xx；
- Artifact 下载需要有效会话或短时授权。

## 15. 成功指标

P0 首轮人工验收关注完成性，不使用无法在小样本证明的增长指标：

- 主链路完成率：受控验收项目 100% 能走到两个 MP4；
- 状态一致性：刷新/SSE 恢复用例 100% 通过；
- 版本一致性：stale 与双比例独立导出用例 100% 通过；
- 部分失败：成功 Cut 保留与单独重试用例 100% 通过；
- 安全：无跨用户读取、无 Key 泄漏；
- 真实能力：至少一个 StoryboardProvider 和一个 VideoProvider 真实冒烟通过。

上线后的业务指标再观察：从上传到首个 Preview 的完成率、单 Cut 首次成功率、平均重试次数、单项目估算模型成本和导出下载率。

## 16. 竞品复现边界

- 允许参考 4i 已观察到的 Director、Storyboard、Cut、Preview、Export 的页面布局和交互路径；
- 不复刻品牌名称、Logo、素材或原文案；
- 不把 4i 未验证的注册、付款、积分、删除、退款和版本规则写成事实；
- 不复制 4i Timeline Export 复用旧 Director 内容的问题；
- 4i 未展示 BPM/Beat/Energy，本产品相关能力来自自有 librosa 与 FFmpeg 底座。

## 17. 已确认产品参数

产品经理于 2026-08-28 确认按以下方案执行：

| 事项 | 已确认方案 | 变更控制 |
|---|---|---|
| P0 音频时长上限 | 60 秒 | 扩展到整首 3—5 分钟需重新评审 Cut 数量、模型成本、任务时长和部署架构 |
| 单项目生成预算 | 首次最多 12 个 Cut、并发 2 | 提高上限前需同步确认模型预算、限流和失败恢复策略 |
| 生产资产保留期 | 最后活动后 30 天；临时文件 24 小时；被替换且非 active 资产 7 天 | 调整前需重新确认存储成本、隐私与用户数据承诺 |

以上参数已进入 P0 基线，不再作为阶段 1 待确认项。

## 18. 后续阶段闸门

### 阶段 0：当前阶段

只完成 PRD 逻辑审查、V1.1、Changelog 和 API Key 清单。完成后停止。

只有收到明确回复：

> PRD V1.1 已确认，API Key 已配置，开始后端阶段

才允许进入阶段 1。

### 阶段 1：后端能力与最小验收界面

进入后必须先输出《技术适配声明》，再输出《第 1 阶段技术开发文档》。保留现有 librosa + FFmpeg 链路，使用 FastAPI、Pydantic、pytest，建立持久可恢复任务、Provider 抽象和真实模型冒烟。不开发正式前端。完成后停止等待后端核验。

只有收到“后端核验通过，开始正式前端”后，才允许读取前端技术栈手册并开发正式前端。

### 正式前端

采用 Next.js、TypeScript strict、Tailwind CSS。先输出前端技术适配声明和分阶段前端开发文档，先做一个代表页面确认，再扩展全站。完成后停止等待人工验收。

只有收到“前端验收通过，开始上线”后，才允许读取上线部署手册并部署。

### 上线

默认遵循 veFaaS + TOS；创建计费资源前报告费用并等待确认。必须先判断 FFmpeg 长任务是否适合 veFaaS；如不适合，只提出一个明确替代方案和原因，不擅自更换架构。
