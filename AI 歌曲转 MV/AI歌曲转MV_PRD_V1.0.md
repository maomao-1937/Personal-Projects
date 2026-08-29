# AI 歌曲转 MV｜PRD V1.0

> 项目阶段：一天上线版 MVP
> 产品形态：Web + 移动 Web
> 开发方式：基于现有 `auto-beat-video-engine` 二次开发
> 竞品母版：4i Music Video（Director 主流程）
> 工程约束：配套《通用技术栈手册》《通用前端技术栈手册》《上线部署手册》执行

---

## 1. 产品定义

### 1.1 一句话定位
用户上传一首歌曲，系统自动分析 BPM、鼓点、能量和可选歌词，AI 自动生成分镜并逐镜生成视频，再按音乐节拍自动卡点合成为 MV，最终导出 16:9 与 9:16 两种规格。

### 1.2 核心用户
- 独立音乐人 / AI 音乐创作者
- 小红书、抖音、B站等短视频创作者
- 没有专业剪辑能力、但需要快速把歌曲做成 MV 的用户

### 1.3 核心痛点
用户已经有歌曲，但从“音频”到“可发布 MV”仍要经历听歌找点、写分镜、找/生成素材、剪辑卡点、转场和多比例导出，耗时高、技术门槛高。

### 1.4 核心价值
把传统“听歌 → 写分镜 → 生成素材 → 剪辑 → 导出”的多工具流程，压缩成一个自动化工作流，同时保留单镜头重生成与人工微调能力。

---

## 2. 产品原则

1. **先自动完成，再允许局部修改**：默认一键生成完整 MV，不要求用户先学会 Timeline。
2. **节拍由确定性算法负责**：BPM / Beat / Energy 使用现有 librosa 链路，不让 LLM 猜节拍。
3. **创意由模型负责**：故事、分镜、镜头 Prompt 由国内文本模型生成。
4. **生成失败不推倒重来**：Scene / Cut 独立任务、独立重试，已成功资产保留。
5. **最终状态以后端为准**：刷新、断线、离开页面后可恢复真实任务状态。
6. **第一版不做专业剪辑器**：不复刻 Premiere / 剪映的完整多轨能力。

---

## 3. P0 范围｜一天上线必须完成

### 3.1 P0 主链路

```text
邀请码登录
→ 新建项目
→ 上传音频
→ 音频分析
→ AI 生成 Plot + Storyboard
→ 用户确认/微调分镜
→ 分镜逐个生成视频
→ 按 Beat 自动卡点
→ Preview
→ 单 Cut 重生成
→ 重新 Preview
→ 导出 16:9
→ 导出 9:16
→ 下载 MP4
```

### 3.2 P0 必做功能

#### A. 项目与上传
- 新建项目。
- 上传本地音频。
- P0 支持：MP3 / WAV；FLAC 如现有链路稳定则保留。
- 展示：文件名、时长、上传进度、失败原因。
- 上传后自动进入分析。

#### B. 音乐分析
复用并增强现有真实能力：
- duration
- BPM
- beat timestamps
- onset
- energy curve
- waveform

P0 不强制实现复杂音乐结构识别（Verse / Chorus / Bridge）。

#### C. 歌词 / Transcript
- 有人声时允许执行转写。
- 转写不是生成 MV 的强制前置条件。
- 有 Transcript：AI 分镜同时参考歌词语义。
- 无 Transcript：只依据音乐风格、节奏、能量和用户视觉偏好做分镜。

#### D. AI Director
参考 4i Director，但第一版压缩成一个工作区：
- Plot：AI 自动生成，可编辑。
- Visual Style：用户选择一个风格。
- Storyboard：AI 自动生成 Scene / Cut。
- 每个 Cut 至少包含：
  - start_time
  - end_time
  - duration
  - prompt
  - mood
  - camera_motion
  - energy_level
  - generation_status
  - generated_video_url

#### E. 分镜确认
用户在生成视频前至少可以：
- 修改 Cut Prompt。
- 调整 Cut 时长（受总时长约束）。
- 调整 Cut 顺序。
- 删除 Cut。
- 新增 Cut。
- 单独生成某个 Cut。

P0 不做角色库、环境库和候选图片库的完整 4i 复刻。

#### F. 视频生成
- 每个 Cut 独立创建生成任务。
- 支持串行或受控并发生成。
- 每个 Cut 显示：Pending / Generating / Ready / Failed。
- 单个失败不影响其他 Cut。
- Failed Cut 支持 Retry。
- Ready Cut 支持 Regenerate。
- Regenerate 不覆盖旧视频，至少在当前任务完成前保留旧结果；是否保留多版本由技术适配声明决定。

#### G. Beat Sync
复用现有 FFmpeg + librosa 的真实剪辑链路：
- Cut 边界尽量吸附到 beat timestamp。
- 高能量区域允许更密集切换。
- 低能量区域允许更长镜头。
- 用户调整后重新计算 Timeline，不重新做音乐分析。

#### H. Preview
- 生成至少 1 个 Cut 后允许部分 Preview。
- 未生成 Cut 的区域用明确占位，不伪装为成功。
- 全部 Cut Ready 后生成完整 Preview。
- Preview 失败时保留已生成资产，并可重新 Stitch。

#### I. 双规格导出
必须支持：
- 16:9 MP4
- 9:16 MP4

P0 默认导出：
- H.264 + AAC
- 1080p 优先；如果一天上线时渲染资源不足，可先以 720p 作为明确的 MVP 降级项。

双规格策略：
- 16:9 作为主时间轴。
- 9:16 基于同一 Cut 顺序和 Beat Timeline 重新 crop / scale。
- P0 使用确定性的 center crop / fit 策略。
- P1 再增加 AI 主体跟踪与智能重构图。

#### J. 历史与恢复
至少保存：
- project
- audio analysis
- storyboard
- Cut 状态
- 视频产物
- preview 状态
- export 状态

刷新页面后不得丢失正在生成或已完成任务。

---

## 4. P0 不做

以下全部延期，防止一天上线失控：
- 4i 完整 Characters 系统
- 4i 完整 Environments 系统
- 候选图片四宫格
- 专业多轨 Timeline
- Transition 编辑器
- Keyframe
- 滤镜
- 字幕烧录编辑器
- Lip Sync
- YouTube URL 导入
- Credits 充值 / 支付
- 套餐系统
- 社区 / 分享广场
- 多人协作
- 原生 App

---

## 5. P1｜上线后增强

优先顺序：
1. Scene 候选图片 + Seedream 图生视频。
2. 角色 / 环境一致性。
3. Lyrics-aware Storyboard。
4. Timeline 可视化编辑。
5. AI 9:16 智能重构图。
6. Lip Sync。
7. Credits / 计费。
8. 多模型选择。

---

## 6. AI / 模型方案

### 6.1 模型槽位
业务代码不得直接绑定单一模型厂商，统一通过 Provider 层调用。

```text
AudioAnalysisProvider  → librosa（本地确定性算法）
TranscriptionProvider → 国内 ASR / 可替换
StoryboardProvider    → 国内文本模型
VideoProvider         → 国内视频生成模型
RenderProvider        → FFmpeg
```

### 6.2 P0 默认 Provider
- Beat / BPM / Energy：现有 `librosa`
- Storyboard：DeepSeek Provider
- Video：火山方舟 Seedance Provider
- Render：FFmpeg

具体模型 ID 不写死在业务代码，通过环境变量配置；Codex 在《技术适配声明》中根据实际可调用 API 再锁定精确 model id。

### 6.3 Storyboard 输入
至少输入：
- audio_duration
- bpm
- beats 摘要
- energy 分段摘要
- transcript（可空）
- visual_style
- target_scene_count / 建议 Cut 时长范围

### 6.4 Storyboard 输出合同

```json
{
  "plot": "string",
  "scenes": [
    {
      "id": "scene_001",
      "start": 0.0,
      "end": 4.0,
      "prompt": "string",
      "mood": "string",
      "camera_motion": "string",
      "energy_level": "low|medium|high"
    }
  ]
}
```

必须后端 Pydantic 校验；失败有限重试，不允许把非结构化文本直接写进任务数据。

---

## 7. 与 4i 的复现关系

### 7.1 P0 直接借鉴
- New Project → Upload → Analyze。
- Director 式“先 Plot / Storyboard，后视频生成”。
- Cut 独立生成。
- Partial Success。
- Preview 可重建。
- 单 Cut Retry / Regenerate。
- Export 为独立长任务。
- 项目自动保存和刷新恢复。

### 7.2 我们主动增加
- 真实 BPM。
- Beat timestamps。
- Energy curve。
- Beat-synced Timeline。
- 一次生成 16:9 + 9:16 两种发布规格。

### 7.3 明确不复制的竞品问题
竞品拆解观察到 Timeline Export 可能复用旧 Director Export 资产，因此本产品必须：
- Export 绑定 `timeline_version`。
- Timeline 发生 Cut / 顺序 / 视频变化时，旧 Export 标记 stale。
- 下载页必须显示本次 Export 对应版本。
- 不允许只因为存在旧 `export_url` 就显示当前 Timeline Ready。

---

## 8. 核心页面

### 页面 1｜项目列表
P0 最简：
- New Project
- 项目名称
- 更新时间
- 当前状态
- Continue
- Download（已有 Export 时）

### 页面 2｜Upload / Analyze
- Dropzone
- Audio 信息
- Waveform
- Analyze 状态
- BPM / Duration / Beat Count
- 可选 Transcript
- Continue to Director

### 页面 3｜Director 工作区
推荐三栏：
- 左：歌曲 / Plot / 风格
- 中：Scene / Cut 卡片列表
- 右：Cut 编辑 + 生成状态

核心按钮：
- Generate Storyboard
- Generate All
- Generate / Retry / Regenerate 单 Cut
- Preview

### 页面 4｜Preview / Export
- 视频 Preview
- Cut 完成率
- Rebuild Preview
- Export 16:9
- Export 9:16
- 两个独立任务状态
- 下载

---

## 9. 核心状态机

### 9.1 Project
```text
created
→ uploading
→ analyzing
→ storyboard_ready
→ generating
→ preview_ready
→ exporting
→ completed
```

### 9.2 Cut
```text
pending
→ queued
→ generating
→ ready
   ↘ regenerating → ready
→ failed → retrying
```

### 9.3 Export
```text
pending
→ queued
→ rendering
→ ready
→ failed
→ stale
```

前端统一映射到通用手册规定的 `idle / submitting / queued / running / succeeded / partially_succeeded / failed / disconnected / stale` 等用户状态。

---

## 10. 核心数据对象

### Project
- id
- user_id
- name
- audio_asset_id
- duration
- status
- visual_style
- plot
- current_timeline_version
- created_at
- updated_at

### AudioAnalysis
- project_id
- bpm
- beats[]
- onsets[]
- energy_curve[]
- waveform_asset
- transcript_id?

### Cut
- id
- project_id
- timeline_version
- order
- start
- end
- duration
- prompt
- mood
- camera_motion
- energy_level
- video_job_id?
- active_video_asset_id?
- status

### GenerationJob
- id
- project_id
- cut_id?
- type: storyboard | video | preview | export
- provider
- model
- status
- progress?
- input_snapshot
- output_asset_id?
- error_code?
- error_message?
- created_at
- updated_at

### Export
- id
- project_id
- timeline_version
- aspect_ratio
- resolution
- status
- asset_id?
- created_at

---

## 11. API 业务合同

具体路径允许 Codex 按现有代码适配，但业务至少需要：

- `POST /projects`
- `POST /projects/{id}/audio`
- `POST /projects/{id}/analyze`
- `GET /projects/{id}`
- `POST /projects/{id}/transcribe`
- `POST /projects/{id}/storyboard`
- `PATCH /projects/{id}/cuts/{cutId}`
- `POST /projects/{id}/cuts/{cutId}/generate`
- `POST /projects/{id}/cuts/{cutId}/regenerate`
- `POST /projects/{id}/preview`
- `POST /projects/{id}/exports`
- `GET /jobs/{jobId}`
- `POST /jobs/{jobId}/cancel`（若 Provider 支持；否则 UI 不得伪装可取消）

长任务采用“提交任务 + 查询状态”为默认方案；是否增加 SSE 作为进度体验，由技术适配声明决定。

---

## 12. 异常与恢复

必须覆盖：
- 非法音频格式。
- 文件上传失败。
- librosa 分析失败。
- Transcript 失败但允许继续做 MV。
- Storyboard JSON 校验失败。
- 单 Cut 视频生成失败。
- 多 Cut 部分成功。
- Preview Stitch 失败。
- Export 失败。
- 页面刷新 / SSE 断线后恢复。
- Provider 超时 / 限流。
- 磁盘或对象存储失败。

任何失败不得删除已经成功的 Cut 和资产。

---

## 13. 前端要求

正式前端开发遵循配套前端手册；PRD 不强制 Codex 为符合默认栈而立即重写已经可运行的 React/Vite 项目。

Codex 必须先输出《前端技术适配声明》，判断：
- 继续现有 React/Vite，还是迁移 Next.js；
- 对一天 MVP 的影响；
- 是否会破坏已有真实卡点闭环。

无论最终框架如何，必须满足：
- TypeScript strict。
- Tailwind / 语义化设计变量。
- API 集中管理。
- 后端是任务状态事实来源。
- desktop + 390px mobile 可完成核心链路。
- loading / empty / running / partial / failed / stale 均有真实 UI。

---

## 14. 后端与现有项目改造原则

### 保留
- FastAPI。
- librosa 音频分析。
- FFmpeg 视频处理。
- 当前真实上传 / 分析 / 合成链路。

### 必须修复
- 当前内存 `job_store` → 可持久化任务状态。
- SSE 断线永久卡 Processing。
- File / YouTube 模式隐藏旧素材提交问题；P0 可直接移除 YouTube 输入以缩范围。
- 参数校验错误应返回合理 4xx，而非 500。
- 真实自动测试与核心 E2E。
- README / 版本 / 部署信息一致。

### 不允许
- 为了匹配手册整体重构已运行的合理代码。
- 用 Mock 代替最终真实模型验收。
- 把模型 Key 写进前端或 Git。

---

## 15. 数据与文件

### 本地开发
- 结构化数据：SQLite 或 Codex 评估后的等价持久化方案。
- 大文件：本地受控目录。

### 生产
- 音频、Cut 视频、Preview、Export：对象存储 TOS。
- 结构化任务状态：按部署手册轻量方案持久化；若采用 SQLite，必须有备份和恢复。
- 每个资产记录用户归属，用户只能读取自己的项目。

---

## 16. 上线要求

默认遵循上线部署手册：
- 火山引擎。
- veFaaS 作为 Web/API 默认部署路线。
- TOS 保存音频与视频资产。
- 邀请码登录。
- Secret / 环境变量管理 API Key。
- trace_id + 结构化日志。

由于 FFmpeg Render 属于 CPU / 文件 / 长耗时任务，Codex 在《技术适配声明》中必须单独检查：
- veFaaS 单任务执行时间
- CPU / 内存
- `/tmp` 空间
- 最大音频 / 视频大小

若不适合，允许仅将 Render Worker 独立到更合适的容器 / 云计算服务；前端与 API 仍保持统一业务合同。

---

## 17. P0 验收标准

### 核心闭环
使用一段 30–60 秒音频：
1. 成功上传。
2. 得到真实 BPM、Beat 和 Energy。
3. AI 成功返回合法 Storyboard。
4. 至少生成 4 个真实 Cut 视频。
5. 某一个 Cut 可以单独 Regenerate，不影响其他 Cut。
6. 按 Beat 合成真实 Preview。
7. 生成并下载真实 16:9 MP4。
8. 生成并下载真实 9:16 MP4。
9. 刷新后项目、Cut 和 Export 状态仍在。
10. 任意一个 Cut 生成失败时，其余成功 Cut 不丢失。

### 工程验收
- 后端 mock 自动测试通过。
- 国内真实模型 API 冒烟通过。
- FFmpeg 真实合成通过。
- 前端 lint / typecheck / test / build 通过。
- 浏览器 E2E 跑通核心闭环。
- 390px / 1280px 均可完成操作。
- API Key 不进入前端、仓库、日志。

---

## 18. 成功指标｜上线后再观察

P0 先不做复杂埋点，至少记录：
- 上传成功率
- Storyboard 成功率
- Cut 生成成功率
- Preview 成功率
- Export 成功率
- 单个 MV 平均生成时长
- 单个 MV 模型成本
- Regenerate 次数
- 16:9 / 9:16 下载次数

---

## 19. Codex 开发前的强制动作

拿到本 PRD 后禁止直接修改代码。

Codex 必须按三份技术栈手册先完成：

1. 重新检查当前仓库与未提交修改。
2. 输出《技术适配声明》：明确采用纵向切片，说明沿用 / 偏离哪些默认技术方案。
3. 输出《第 1 阶段技术开发文档》。
4. 把第一阶段控制为一条最小真实闭环：

```text
上传 30–60 秒音频
→ librosa 分析
→ DeepSeek 生成 Storyboard JSON
→ Seedance 只生成 1 个 Cut
→ FFmpeg 合成最小 Preview
```

5. 第一阶段验收通过后，再扩展成多 Cut、Regenerate 和双规格 Export。

---

## 20. 开发阶段建议

### Stage 1｜最小 AI 闭环
上传 → 分析 → Storyboard → 1 Cut → Preview。

### Stage 2｜完整 MV
多 Cut → 并发 / 部分成功 → Regenerate → 完整 Preview。

### Stage 3｜双规格 + 状态恢复
16:9 / 9:16 Export → Job 持久化 → 刷新恢复。

### Stage 4｜正式前端 + 上线
正式 UI → mobile → TOS → 登录 → veFaaS / Render 适配 → 公网验收。

