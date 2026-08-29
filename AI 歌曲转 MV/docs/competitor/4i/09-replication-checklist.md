# 4i Music Video 可复现功能清单

## 1. 使用方式

本清单用于后续复现，不代表当前项目已有或缺少哪些实现。本轮只完成竞品拆解，没有修改业务代码。

每个复现项包含：

- 未来实现检查框：保持未勾选，待实际开发和验收后更新。
- 可观察验收标准：只描述用户能看到的行为、数据或下载产物。
- 证据边界：区分竞品已验证行为与仍待补证的行为。

基准样本为 8 秒 WAV 音频。竞品流程已真实完成：

- Director：1 个 Segment、4 个最终 Cut、4 个视频、完整 Preview、浏览器导出和云端导出。
- Editor Timeline：1 个 8 秒 Lipsync Scene、完整 Preview、独立导出房间及 Save video；导出房间本次读到的是既有 Director 成片，不是当前 Row 的新成片。

## 2. 端到端复现基线：Director 模式

| ID | 未来实现项 | 可观察验收标准 | 竞品证据 |
|---|---|---|---|
| D-01 | [ ] 新建 Music Video 项目 | 进入 New project；展示拖放区、Upload audio 和音频 URL 输入框 | [上传页](evidence/02-new-project-upload.png) |
| D-02 | [ ] 本地音频输入 | 文件选择器至少接受 audio/*、MP3、WAV、FLAC；8 秒 WAV 可成功上传 | [上传页](evidence/02-new-project-upload.png) |
| D-03 | [ ] 上传分析态 | 选择文件后立即显示 Analyzing…；没有虚构百分比；完成后自动进入工作区 | [分析中](evidence/03-audio-analyzing.png)、[工作区](evidence/04-workspace-choice.png) |
| D-04 | [ ] 项目工作区 | 显示文件名、0:08、波形、播放、Transcribe、Replace audio、Saved 和 Delete | [工作区](evidence/04-workspace-choice.png) |
| D-05 | [ ] 双工作模式入口 | 同一项目可进入 Director Mode 或 Editor Timeline，音频和转写资产共用 | [工作区](evidence/04-workspace-choice.png) |
| D-06 | [ ] 音频转写 | Transcribe 返回全文、词数、总时长、单词级时间戳；可编辑到单词粒度 | [转写弹窗](evidence/09-transcript-modal.png)、[编辑转写](evidence/10-transcript-edit.png)、[TXT](evidence/downloads/audio.txt) |
| D-07 | [ ] 转写下载 | 支持 TXT、SRT、ASS；下载内容与项目转写和时间轴一致 | [TXT](evidence/downloads/audio.txt)、[SRT](evidence/downloads/audio.srt)、[ASS](evidence/downloads/audio.ass) |
| D-08 | [ ] Director 三阶段框架 | 顶部固定 Setup、Build、Export；保留音频波形、播放、时长和预估成本 | [画幅步骤](evidence/05-director-aspect-ratio.png) |
| D-09 | [ ] 画幅设置 | 提供 1:1、16:9、9:16、4:3、3:4；设置写入项目并影响图片 / 视频任务 | [画幅步骤](evidence/05-director-aspect-ratio.png) |
| D-10 | [ ] Director 模型档位 | 至少提供 Express 0.005 credits/s 与 Standard 0.02 credits/s，并展示速度 / 质量说明和估算成本 | [模型步骤](evidence/06-director-speed.png) |
| D-11 | [ ] Plot 手工输入 | Plot direction 为可编辑长文本，用户可直接作为后续规划上下文 | [Plot](evidence/07-director-plot.png) |
| D-12 | [ ] Plot AI 生成 | 若无转写，先完成转写；再根据音频内容生成故事方向并回填可编辑文本 | [AI Plot](evidence/08-director-plot-generated.png) |
| D-13 | [ ] Character 管理 | 角色至少包含名称、描述、角色图、来源和忙碌态；支持新增、编辑、删除和生成图片 | [Characters](evidence/11-director-characters.png)、[真实操作日志](evidence/interaction-observations.md)、[脱敏结构](evidence/project-schema-sanitized.json) |
| D-14 | [ ] Character 自动重建保护 | 已有角色时点击 Make it for me，必须先说明会移除既有角色并提供 Cancel / Regenerate | [真实操作日志](evidence/interaction-observations.md) |
| D-15 | [ ] Environment AI 生成 | 根据 Plot 生成环境名称、描述和图片；8 秒基准项目能生成 2 张环境卡 | [生成后](evidence/interaction-observations.md) |
| D-16 | [ ] Environment 编辑 | 每张环境支持名称 / 描述编辑、Regenerate、Remove、Pick image 和 Maximize | [环境卡](evidence/interaction-observations.md)、[放大图](evidence/14-image-lightbox.png) |
| D-17 | [ ] 统一图片选择器 | Chapter Images 包含 Library、Generate、Add；可选库内图、AI 生成 / 编辑、上传或 URL 添加 | [Library](evidence/15b-image-picker-clear.png)、[Add](evidence/16-image-picker-add.png)、[Generate](evidence/17-image-picker-generate.png) |
| D-18 | [ ] Story Segment 规划 | Create segments with AI 将歌曲拆成约 15 秒故事段；每段有标题、起止时间、摘要和 Cut 描述 | [生成中](evidence/18-segments-generating.png)、[生成结果](evidence/19-segments-generated.png) |
| D-19 | [ ] Segment 手工修订 | 用户可编辑 Segment 标题、摘要、Cut 描述，并新增或删除 Cut 描述 | [Segment 编辑](evidence/19b-segment-editor.png) |
| D-20 | [ ] Build 布局 | 左侧显示 Segment 列表与总时长，右侧分 Cuts / Videos 页签 | [Build](evidence/20a-build-overview.png) |
| D-21 | [ ] 生图前人物环境复核 | 生成 4 张候选图前展示 Cast / Where，允许逐项开关并确认 | [复核弹窗](evidence/21-image-generation-review.png) |
| D-22 | [ ] 批量候选图生成 | 确认后显示生成中状态；成功返回 4 张图并自动构成选中 Cut | [真实操作日志](evidence/interaction-observations.md)、[生成结果](evidence/23-cuts-generated.png) |
| D-23 | [ ] Cut 时间覆盖 | Cut 时间条显示每段时长和总覆盖；基准项目 4 个 Cut 初始各 2 秒，合计 8 秒 | [Cut 卡片](evidence/23c-cut-cards.png) |
| D-24 | [ ] 单 Cut 编辑 | 每个 Cut 可改提示词、图、时长、顺序和 Lipsync；支持移除图、选图库图、放大图 | [Cut 卡片](evidence/23c-cut-cards.png) |
| D-25 | [ ] 候选图退回与重选 | Return to candidates 后减少 Cut 并自动重分配剩余时长；重选图追加到当前队列 | [退回候选](evidence/24-candidate-returned.png) |
| D-26 | [ ] 视频生成准备态 | Videos 页每个 Cut 显示 Pending、Chosen image、Rendered video、Transcript、模型与价格 | [Videos 待生成](evidence/27-videos-pending.png) |
| D-27 | [ ] 单 Cut 视频任务 | 点击 Express / Standard 即创建该 Cut 任务；处理中显示明确状态，成功后显示 Generated 和可播放视频 | [生成中](evidence/32-three-videos-generating.png)、[单条完成](evidence/30-one-video-generated.png) |
| D-28 | [ ] 并行视频任务 | 多个 Cut 可并行生成，互不阻塞；每个任务独立轮询和写回 | [并行生成](evidence/32-three-videos-generating.png) |
| D-29 | [ ] 部分成功聚合 | 1/4 成功时保留成功结果、其余保持 Pending / Generating；不回滚整个 Segment | [单条成功](evidence/30-one-video-generated.png)、[部分预览](evidence/31-partial-preview.png) |
| D-30 | [ ] 全部成功聚合 | 4/4 成功后显示 All videos ready、Videos 完成标记和 Export now | [全部完成](evidence/33-all-videos-ready.png) |
| D-31 | [ ] 无视频预览保护 | 0 个视频时 Preview 返回明确错误，要求至少生成或附加一个视频，并提供 Retry / Close | [失败流程](evidence/interaction-observations.md) |
| D-32 | [ ] 部分与完整 Preview | 至少 1 个 Cut 成功即可构建完整时长预览；4/4 时提供完整视频、重建和进入 Export | [单条成功](evidence/30-one-video-generated.png)、[部分预览](evidence/31-partial-preview.png)、[完整预览](evidence/34-complete-preview.png) |
| D-33 | [ ] Director Export 概览 | 显示 Segment 数、Cut 数、生成数、总时长和每段完成明细 | [Export 概览](evidence/35a-export-overview.png) |
| D-34 | [ ] 浏览器导出 | Export and Download 显示本地素材加载 / 合成百分比和 Cancel export，完成后提供 Download video | [浏览器导出](evidence/40-browser-export-progress.png)、[完成](evidence/38-export-complete.png) |
| D-35 | [ ] 云端导出 | Cloud export 支持排队、进度、后台继续、完成写回和下载 | [3%](evidence/36-cloud-export-queued.png)、[74%](evidence/37-cloud-export-progress.png)、[完成](evidence/38-export-complete.png) |
| D-36 | [ ] 提前导出规则 | Pending Cut 仍允许导出，并把未完成区段作为黑帧；必须在 UI 提前说明 | [导出页](evidence/35-export-page.png) |
| D-37 | [ ] Director 成片合同 | 16:9 基准项目的云端产物保持竞品实测：MP4、H.264、1280×704、30 fps、AAC 单声道 44.1 kHz、8.000 秒、1,643,729 bytes | [Director MP4](evidence/downloads/audio-cloud.mp4)、[抽帧](evidence/39-exported-video-frame.jpg) |
| D-38 | [ ] 导出字幕 | Export 可单独下载 SRT 和 ASS，不要求烧录进视频 | [SRT](evidence/downloads/audio.srt)、[ASS](evidence/downloads/audio.ass) |

## 3. Editor Timeline 复现清单

| ID | 未来实现项 | 可观察验收标准 | 竞品证据 |
|---|---|---|---|
| T-01 | [ ] 单页 Editor 框架 | 顶部显示返回项目、项目名、Editor、画幅、全局波形、播放、时间、Saved 和 Delete | [Editor 全页](evidence/44-editor-full-page.png) |
| T-02 | [ ] Editor 画幅设置 | 提供 1:1、16:9、9:16、4:3、3:4，与项目共享 | [Editor 全页](evidence/44-editor-full-page.png) |
| T-03 | [ ] 默认 Lipsync 模型 | 提供 Express 0.005、Standard 0.02、Premium 0.12 credits/s | [Editor 全页](evidence/44-editor-full-page.png) |
| T-04 | [ ] 默认 Scene 模型 | 提供 Express 0.005、Standard 0.02、Premium 0.17 credits/s | [Editor 全页](evidence/44-editor-full-page.png) |
| T-05 | [ ] 转写与下载区 | 展示当前转写，并提供 Re-transcribe、Download、Download SRT | [Editor 全页](evidence/44-editor-full-page.png) |
| T-06 | [ ] 项目图片库 | 复用 Director 生成图；支持 Upload 和基于参考图 / 文本的 AI 图片生成 | [Editor 全页](evidence/44-editor-full-page.png) |
| T-07 | [ ] Scene 时间块 | 基准项目显示 1 scenes、一个 8s 块和详情 0:00–0:08；局部可播放并显示 Transcript | [Editor 全页](evidence/44-editor-full-page.png) |
| T-08 | [ ] Scene 类型 | 每个时间段可选择 Lipsync 或 Scene；选择后切换对应输入和模型 | [类型选择](evidence/45-editor-lipsync-scene.png) |
| T-09 | [ ] Scene 输入字段 | 支持动作提示词、First image、Last image、Edit、模型、Generate、Pick from generations | [类型选择](evidence/45-editor-lipsync-scene.png)、[图片选择](evidence/47-editor-first-image-picker.png) |
| T-10 | [ ] Lipsync 首帧校验 | 没有 First image 时不创建任务，并显示 start image is required 的原位错误 | [校验状态](evidence/interaction-observations.md) |
| T-11 | [ ] 生成费用确认 | 提交前显示估算 credits、Do not ask again、Cancel、Generate；基准 Express 8 秒约 0.04 credits | [费用确认](evidence/48-editor-cost-confirm.png) |
| T-12 | [ ] Timeline 视频生成 | 显示 Generating / starting；任务使用当前 Scene 的图片、切片音频、提示词、时长、画幅和模型 | [生成中](evidence/interaction-observations.md) |
| T-13 | [ ] 完成未附加中间态 | Job 成功但项目尚未写回视频时显示“完成但未附加”，提供 Browse；随后允许自动恢复附加 | [中间态](evidence/interaction-observations.md)、[已附加](evidence/59-editor-video-attached-valid.png) |
| T-14 | [ ] 已附加 Scene | 显示 Segment 8s · Video 8s、Regenerate、Download、Browse，启用 Preview / Export | [已附加](evidence/59-editor-video-attached-valid.png) |
| T-15 | [ ] Timeline Preview | 显示 Stitching scene clips with audio… 和百分比；完成后提供 8 秒 Blob 视频 | [构建中](evidence/52-editor-preview-building.png)、[完成](evidence/53-editor-preview-ready.png) |
| T-16 | [ ] Timeline 导出房间 | Export 跳转独立页面；加载后读到项目级可用导出资产，并显示 Duration、Scenes、Gaps、Audio 和 Timeline 明细；`Ready` 本身不代表已为当前 Row 新建导出 | [加载中](evidence/54-timeline-export-loading.png)、[Ready](evidence/55-timeline-export-ready.png) |
| T-17 | [ ] Timeline 导出操作 | Ready 100% 后提供 Save video、Export again 和 Refresh；加载期间 `Start export` 为禁用，本次未创建新的 Timeline 导出任务 | [Ready](evidence/55-timeline-export-ready.png)、[交互说明](evidence/interaction-observations.md) |
| T-18 | [ ] Timeline Row 媒体样本 | 已附加的当前 8 秒 Lipsync Row 可下载；本次为 MP4、H.264、1280×704、24 fps、AAC 单声道 44.1 kHz、8.000 秒、1,319,044 bytes | [Row MP4](evidence/downloads/audio-timeline-row.mp4)、[元数据](evidence/export-metadata.md) |
| T-19 | [ ] Timeline Export 页下载样本 | Save video 真实下载 MP4；本次为 H.264、1280×720、30 fps、AAC 双声道 48 kHz、8.064 秒、2,805,312 bytes，但内容是既有 Director 四镜头蒙太奇 | [页面下载](evidence/downloads/audio.mp4)、[抽帧](evidence/56-timeline-export-frame.jpg)、[内容对比](evidence/61-export-content-comparison.jpg) |
| T-20 | [ ] 导出资产来源 / 版本语义 | 同项目已有 Director 导出、之后生成 Timeline Row 时，Export Room 仍可把旧项目级资产显示为 Ready；复现时不得把该状态解释为当前 Row 已完成渲染 | [内容对比](evidence/61-export-content-comparison.jpg)、[脱敏结构](evidence/project-schema-sanitized.json) |

## 4. 任务状态和恢复机制复现清单

| ID | 未来实现项 | 可观察验收标准 | 竞品依据 |
|---|---|---|---|
| S-01 | [ ] 项目自动保存 | 编辑显示 Saving…，写回成功显示 Saved；刷新或重新进入可恢复同一阶段 | [编辑器状态](evidence/interaction-observations.md) |
| S-02 | [ ] 视频任务状态持久化 | 视频 Job 保存模型、输入、目标类型、状态、输出、成本和所属 Project / Segment / Cut；图片任务是否使用同一完整合同需另行补证 | [网络观察](evidence/network-observations.md) |
| S-03 | [ ] 成功后扣费 | 页面提交前显示预计成本，任务成功后余额下降；失败扣费规则在补证前不得自行假定 | [模型步骤](evidence/06-director-speed.png)、[费用确认](evidence/48-editor-cost-confirm.png) |
| S-04 | [ ] 多任务独立轮询 | 每个 Cut 独立从 Pending / Generating 到 Generated，不用等待整批任务一次返回 | [并行生成](evidence/32-three-videos-generating.png) |
| S-05 | [ ] 部分成功保留 | 部分成功时不丢弃已成功输出；Preview 和继续生成按可用素材工作 | [单条成功](evidence/30-one-video-generated.png)、[部分预览](evidence/31-partial-preview.png) |
| S-06 | [ ] 附件写回恢复 | Job 成功而 Scene 未附加时可自动重新取回结果，也提供 Browse 手动选择 | [中间态](evidence/interaction-observations.md) |
| S-07 | [ ] 可恢复后台导出 | 云端 Export 可关闭进度弹窗，任务继续，完成后在项目上出现下载入口 | [云端排队](evidence/36-cloud-export-queued.png) |
| S-08 | [ ] 显式输入校验 | 缺少首帧等前置输入时，在创建 Job 前阻止提交并给出字段级原因 | [Timeline 校验](evidence/interaction-observations.md) |
| S-09 | [ ] 显式预览错误 | 没有任何视频时返回可读原因和 Retry / Close，而不是空白预览 | [预览失败流程](evidence/interaction-observations.md) |
| S-10 | [ ] 重生成入口 | Environment、Cut 视频和 Timeline Scene 保留 Regenerate / 模型重提入口 | [环境卡](evidence/interaction-observations.md)、[视频完成](evidence/33-all-videos-ready.png)、[Timeline 已附加](evidence/59-editor-video-attached-valid.png) |
| S-11 | [ ] 项目级导出资产复用 | 项目根级已有导出资产时，Timeline Export Room 可以直接读到并显示 Ready；Row 更新不必然使旧资产失效 | [导出内容对比](evidence/61-export-content-comparison.jpg)、[数据模型](07-data-model.md) |

## 5. 项目、历史和账号外围复现清单

| ID | 未来实现项 | 可观察验收标准 | 竞品证据 |
|---|---|---|---|
| P-01 | [ ] 历史项目列表 | 卡片显示项目模式、名称、Exported 状态、更新时间、Download、Delete | [项目列表](evidence/01-project-list-exported.png) |
| P-02 | [ ] 项目续作 | 返回历史项目时恢复音频、转写、Director / Timeline 数据、任务结果和导出入口 | [Editor 全页](evidence/44-editor-full-page.png) |
| P-03 | [ ] 项目删除保护 | Delete 进入浏览器控制的确认流程，取消后项目保持不变；最终删除行为和恢复规则在补证前保持待定 | [证据边界](evidence/README.md) |
| P-04 | [ ] 积分余额 | 页面和账号菜单显示当前 Credits；任务估算与实际扣费可追踪 | [脱敏账号菜单](evidence/57-account-menu-redacted.png) |
| P-05 | [ ] 购买积分入口 | 显示 Buy credits，以及 1 credit = 1 euro、最低 5 credits；付款流程另行补证 | [脱敏账号菜单](evidence/57-account-menu-redacted.png) |
| P-06 | [ ] 账号菜单 | 提供 Profile、Settings、Sign out；不得把真实账号标识写入日志或证据 | [脱敏账号菜单](evidence/57-account-menu-redacted.png) |
| P-07 | [ ] 全局 Create 菜单 | Music Video 从全局 Create 菜单可达；菜单同时列出 Music、Video、Animated movie、Story | [Create 菜单](evidence/58-create-menu.png) |

## 6. 严格复现时不要自行增加的能力

以下能力在本次竞品完整路径中没有观察到。若目标是行为级复现，应保持为“未提供”或先单独取得新证据，不应当作竞品现有功能实现：

- BPM、音乐 Beat Marker、Mood、Energy 和歌曲段落分析面板。
- 独立 Lyrics 结构化结果；当前只观察到 Transcript、词级时间戳和字幕下载。
- 传统多轨 Timeline 的独立 Audio、Beat、Video Clip 和 Transition 轨。
- Scene 间转场类型、转场时长、滤镜、关键帧、文字图层和音频混音。
- Export 阶段的分辨率、帧率、码率、编码器、容器格式和水印开关。
- 导出成片中的可见水印；本次两个抽帧均未见水印，但套餐差异仍未验证。

## 7. 复现前必须补证的开放项

这些项目不能从当前证据推断，需要后续单独测试：

| 开放项 | 当前已知 | 需要补证 |
|---|---|---|
| 音频最大文件大小 | 文件输入未声明，689 KB WAV 成功 | 不同大小、时长和超限错误文案 |
| URL 音频导入 | 输入框真实存在 | 支持站点、重定向、鉴权 URL、下载进度和失败状态 |
| 长音频分段 | 页面说明按约 15 秒 Story Beat 规划 | 30 秒以上样本的 Segment 边界、尾段、Cut 数和费用 |
| 无人声 / 多语言 | 基准样本返回英文转写 | 纯音乐、无声、多语言、语言识别和低置信度 |
| Replace audio | 按钮存在 | 是否清空转写、Storyboard、Cut、Job 和 Export |
| Character 自动重建 | 有删除既有角色的确认弹窗 | 最终角色数量、字段、图片生成和失败恢复 |
| 图片上传 / URL | PNG、JPG、WebP，页面写明 12 MB | 超限、损坏、跨域 URL、重复资产和删除 |
| AI 任务失败 | 本次所有付费任务成功 | failed、timeout、moderation、取消、Retry 和扣费回滚 |
| 单 Cut 二次生成 | 生成入口保留 | 旧视频是否保留、版本选择、再次扣费和 Preview 失效规则 |
| Timeline Regenerate | 按钮存在 | 覆盖 / 版本化、旧下载地址、任务并发和失败回退 |
| 纯 Timeline 新项目导出 | 本项目先完成 Director 导出，Timeline Export Room 随后读到旧成片 | 无 Director 历史时的创建入口、任务状态、正确 Row 合成参数和失败恢复 |
| Timeline 导出缓存失效 | Row 更新后旧项目级成片仍显示 Ready | Refresh / Export again 是否创建新版本，何时替换 `exportUrl`，如何防止旧内容误绑定 |
| Attach from Generations | 选择器存在，但无匹配素材 | 匹配条件、裁剪、音频对齐和附件持久化 |
| 提前导出黑帧 | 页面有明确说明 | 真实黑帧范围、音频是否连续、字幕如何处理 |
| Director 16:9 输出尺寸 | 云端实测 1280×704 | 是否继承 Cut 源尺寸、浏览器导出是否始终一致 |
| 水印 | 页面无开关，抽帧未见水印 | 不同账号、余额、付费层级和导出模式 |
| 项目删除 | Delete 入口存在 | 二次确认、软删、恢复、关联资产和导出文件处理 |
| 登录与付款 | 本次复用既有登录态，未进付款页 | 登录、验证码、购买、税费、退款、套餐和权限 |
| Export 失败 | Director 浏览器与云端路径成功；Timeline 仅读到既有 Ready 资产 | 云端失败、浏览器编码失败、Timeline 新任务失败、重试、下载 URL 过期和版本管理 |

## 8. 复现验收用例

### 8.1 基准成功用例

- [ ] 使用 8 秒 WAV 建立项目，上传后出现 Analyzing… 并自动进入工作区。
- [ ] 完成转写，校验全文、词级时间戳、TXT、SRT、ASS。
- [ ] Director 选择 16:9，生成 Plot、2 个 Environment、1 个 Segment 和候选图。
- [ ] 选中 4 个 Cut，校验初始总时长为 8 秒，调整、退回、重选后仍能覆盖全长。
- [ ] 先生成 1 个 Cut，确认部分 Preview；再并行生成剩余 3 个，确认 All videos ready。
- [ ] 完成浏览器与云端 Export，验证 MP4 可播放、音频连续、下载入口可恢复。
- [ ] Editor Timeline 建立 1 个 8 秒 Lipsync Scene，先验证缺首帧错误，再完成生成。
- [ ] 捕获“Job 完成但尚未附加”或通过故障注入复现该中间态，并验证自动恢复。
- [ ] 完成 Timeline Preview，进入独立 Export Room，验证 Ready 100% 与 Save video；同时比对下载内容与当前 Row，不能只以 Ready 状态判定导出成功。

### 8.2 成片媒体验收

| 模式 | 基准参数 | 验收说明 |
|---|---|---|
| Director Cloud Export | MP4；H.264；1280×704；30 fps；AAC mono 44.1 kHz；8.000 秒；1,643,729 bytes | 严格复现时保留模式特定尺寸，不把 16:9 自动假定为 1280×720 |
| Editor Timeline Row 媒体 | MP4；H.264；1280×704；24 fps；AAC mono 44.1 kHz；8.000 秒；1,319,044 bytes | 这是当前已附加 Lipsync Row 的真实媒体，不等同于最终 Timeline 成片 |
| Timeline Export 页下载 | MP4；H.264；1280×720；30 fps；AAC stereo 48 kHz；8.064 秒；2,805,312 bytes | 这是 Save video 的真实下载样本，但画面复用旧 Director 蒙太奇，不能作为当前 Row 的正确成片合同 |

文件字节数只作为本次样本指纹，不要求不同生成结果保持同一大小；编码、画面尺寸、帧率、音轨规格和时长是本次观测基准，跨模型或跨导出路径是否稳定仍需补证。

### 8.3 失败与恢复用例

- [ ] 不支持格式、损坏文件、超限文件、URL 失败分别显示可恢复错误。
- [ ] 转写、Plot、Environment、Segment、图片、视频分别可注入失败，不丢失已成功数据。
- [ ] 多 Cut 中单任务失败时显示部分成功，可只重试失败 Cut。
- [ ] 积分不足时在创建付费任务前阻止提交，不出现余额负数。
- [ ] Job 成功但项目附件写回失败时显示 Browse，并可自动或手动恢复。
- [ ] Preview 没有视频时显示竞品同类保护；素材加载 / 编码失败时可关闭和重试。
- [ ] 云端 Export 可后台继续；失败后可重试且不破坏上一次成功成片。
- [ ] 浏览器 Export 可取消；取消后项目仍保持可再次导出。

## 9. 完成定义

后续实现只有同时满足以下条件，才可把对应检查框标记为完成：

1. 页面与弹窗可按相同用户顺序到达，不依赖开发者手工改数据库。
2. 所有异步动作都有 Loading、成功、失败和可恢复路径；部分成功不丢数据。
3. Project、Transcript、Segment、Cut、Timeline Row、Job 和 Export 的状态可刷新恢复。
4. 每个会扣费的动作在提交前可见成本，成功后的余额变化可核对。
5. Director 能从同一音频完成并下载成片；Timeline 能完成 Row 与 Preview，并能进入可下载的 Export Room。若实现目标还要求“当前 Row 的最终成片”，必须额外校验下载内容所对应的源版本。
6. 产物可用媒体探针核对视频轨、音频轨、画面尺寸、帧率和时长。
7. 未观察到的竞品能力保持明确未实现或另行立项，不以推测填补。
