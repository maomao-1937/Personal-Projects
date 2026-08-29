# 4i Music Video 页面与任务状态矩阵

## 1. 状态口径

本矩阵把页面可见状态、已观察到的数据状态和可执行的恢复动作分开记录。

| 标记 | 定义 |
|---|---|
| 已观察 | 在本次 8 秒音频项目中真实出现 |
| UI 可达 | 控件、提示或分支真实出现，但没有完成该分支的最终动作 |
| 推测 | 根据网络字段或相邻状态推测，不能作为已验证行为 |
| 未验证 | 本次没有触发，行为未知 |

## 2. 项目、上传与音频状态

| 区域 | 状态 | 进入条件 | 页面表现 | 可执行行为 / 下一状态 | 证据 | 结论 |
|---|---|---|---|---|---|---|
| 项目列表 | 无新项目 | 进入 Music Video 首页 | 显示 New project 上传区 | 上传本地音频或输入 URL | [上传页](evidence/02-new-project-upload.png) | 已观察 |
| 本地上传 | 待选择 | 尚未选择文件 | Drop a song to begin、Upload audio、URL 输入框 | 选文件后进入分析 | [上传页](evidence/02-new-project-upload.png) | 已观察 |
| 本地上传 | 分析中 | 选择有效 WAV 后 | 项目标题变为 audio；上传区和按钮均显示 Analyzing…；无百分比 | 等待自动进入工作区 | [分析中](evidence/03-audio-analyzing.png) | 已观察 |
| 本地上传 | 可编辑 | 分析完成并创建项目 | 波形、0:08、Transcribe、Replace audio；显示 Saved | 播放、转写、替换音频、选工作模式 | [工作区](evidence/04-workspace-choice.png) | 已观察 |
| 音频上传 | 拒绝 / 失败 | 不支持格式、损坏文件、超限或网络失败 | 未触发，没有真实错误文案 | 未知 | — | 未验证 |
| URL 导入 | 输入 / 校验 / 下载中 / 失败 | 提交音频 URL | 本次未提交 URL | 未知 | [上传页](evidence/02-new-project-upload.png) | UI 可达，后续未验证 |
| 项目保存 | 保存中 | 修改项目配置或 Scene | 顶部显示 Saving…；前端向项目接口发出 PUT | 成功后显示 Saved | [编辑器状态](evidence/interaction-observations.md) | 已观察 |
| 项目保存 | 已保存 | PUT 成功 | 顶部显示 Saved | 继续编辑或离开后恢复 | [预览完成](evidence/53-editor-preview-ready.png) | 已观察 |
| 项目保存 | 保存失败 | PUT 失败 | 本次未触发 | 未知是否自动重试 | — | 未验证 |
| 项目删除 | 待确认 | 点击项目内或项目卡 Delete | 进入浏览器控制的确认流程 | 本次选择取消，项目与证据保留；最终删除未执行 | [项目列表](evidence/01-project-list-exported.png)、[证据边界](evidence/README.md) | 确认流程已观察，删除结果未验证 |
| 转写 | 未生成 | 新项目进入工作区 | 显示 Transcribe | 点击后启动转写 | [工作区](evidence/04-workspace-choice.png) | 已观察 |
| 转写 | 处理中 | 点击 Transcribe 或 AI Plot 首次需要转写 | 页面等待异步返回；本次未看到百分比 | 成功后打开 Transcript | — | 已观察到过程，无独立截图 |
| 转写 | 成功 | 转写接口完成 | Transcript 弹窗显示 15 words、0:08 和全文 | Edit、Close、下载 TXT / SRT / ASS | [转写弹窗](evidence/09-transcript-modal.png) | 已观察 |
| 转写 | 编辑中 | 点击 Edit | 每个词变为独立输入项，带删除按钮 | Done editing 后保存 | [编辑转写](evidence/10-transcript-edit.png) | 已观察 |
| 转写 | 失败 | 转写服务失败 | 本次未触发 | 未知是否有 Retry | — | 未验证 |

## 3. Director Setup 状态

| 区域 | 状态 | 进入条件 | 页面表现 | 可执行行为 / 下一状态 | 证据 | 结论 |
|---|---|---|---|---|---|---|
| Setup 导航 | 未完成 | 初次进入 Director | 当前步骤棕色圆点，未完成步骤没有绿色标记 | 完成画幅、模型、Plot、Characters、Environments、Segments | [画幅步骤](evidence/05-director-aspect-ratio.png) | 已观察 |
| Setup 导航 | 步骤完成 | 选择或生成当前步骤内容 | 已完成步骤显示绿色圆点 | 返回修改，或继续下一步 | [Segments 完成](evidence/19-segments-generated.png) | 已观察 |
| Plot | 空 / 可编辑 | 进入第 3 步 | 文本框和 Generate with AI | 手工输入或启动 AI | [Plot](evidence/07-director-plot.png) | 已观察 |
| Plot | AI 生成中 | 点击 Generate with AI | 先确保转写存在，再等待故事摘要 | 成功后回填可编辑文本 | — | 已观察到过程 |
| Plot | AI 成功 | 摘要接口完成 | 文本框出现一段完整故事方向 | 编辑、继续 Characters | [AI Plot](evidence/08-director-plot-generated.png) | 已观察 |
| Character | 默认 / 手工编辑 | 进入第 4 步 | Main character 卡，含名称、描述和图片生成入口 | 编辑、新增、删除、生成图片 | [页面](evidence/11-director-characters.png)、[操作日志](evidence/interaction-observations.md)、[脱敏结构](evidence/project-schema-sanitized.json) | 已观察 |
| Character | 自动重建确认 | 已有角色时点击 Make it for me | Regenerate characters?；说明会删除既有角色 | Cancel 或 Regenerate | [操作日志](evidence/interaction-observations.md) | UI 可达；本次取消 |
| Character | 自动生成中 / 成功 / 失败 | 确认 Regenerate | 本次未执行 | 未知 | — | 未验证 |
| Environment | 初始 | 进入第 5 步 | 可手工 Add 或 Make it for me | 启动 AI 生成 | [环境初始页](evidence/interaction-observations.md) | 已观察 |
| Environment | 生成中 | 点击 Make it for me | 按钮显示 Generating environments… | 等待环境文本和图片任务完成 | [环境生成前](evidence/interaction-observations.md) | 已观察 |
| Environment | 成功 | 生成任务完成 | 出现 2 张环境卡、名称、描述、1024×1024 图片；积分下降 | 编辑、重生成、移除、选图、放大 | [环境完成](evidence/interaction-observations.md) | 已观察 |
| Environment | 单图重生成 | 点击 Regenerate | 入口与价格可见 | 本次未再次付费触发 | [环境卡](evidence/interaction-observations.md) | UI 可达 |
| Environment | 生成失败 | 文本或图片任务失败 | 本次未触发；数据结构存在图片错误位，但不据此认定 UI | 未知 | — | 未验证 |
| Segment | 未规划 | 进入第 6 步 | Build 不可进入；显示 Create segments with AI | 点击启动规划 | [生成前 / 生成中](evidence/18-segments-generating.png) | 已观察 |
| Segment | 规划中 | 点击 Create segments with AI | Generating…、Please wait, creating segments… | 等待 Overview 返回 | [生成中](evidence/18-segments-generating.png) | 已观察 |
| Segment | 规划成功 | 任务完成 | 1 Segment、6 Cut 描述、覆盖 0:00–0:08，Build 可进入 | 编辑后进入 Build | [生成结果](evidence/19-segments-generated.png) | 已观察 |
| Segment | 规划失败 | Overview 请求失败 | 本次未触发 | 未知是否原位 Retry | — | 未验证 |

## 4. Director Build：候选图、Cut 和视频状态

| 区域 | 状态 | 进入条件 | 页面表现 | 可执行行为 / 下一状态 | 证据 | 结论 |
|---|---|---|---|---|---|---|
| Build / Cuts | 空 | 首次进入 Build | Segment 存在，但 0 Cuts；Videos 尚无素材 | 生成候选图片 | [Build 空态](evidence/20-build-cuts-empty.png) | 已观察 |
| 生成候选图 | 人物环境复核 | 点击 Generate 4 images | 弹窗列出 Cast 和 Where，可切换包含项 | Cancel 或 Looks good — generate 4 images | [复核弹窗](evidence/21-image-generation-review.png) | 已观察 |
| 生成候选图 | 生成中 | 确认复核 | 显示生成占位和忙碌状态 | 等待四宫格 / 单图结果 | [生成过程日志](evidence/interaction-observations.md) | 已观察 |
| 生成候选图 | 成功 | 图片接口返回 | 4 张图片进入候选并自动成为选中 Cut | 编辑 Cut，或切到 Videos | [图片生成结果](evidence/23-cuts-generated.png) | 已观察 |
| 生成候选图 | 部分失败 / 失败 | 部分或全部图片任务失败 | 本次未触发 | 未知能否只重试失败图 | — | 未验证 |
| Cut 集合 | 完整覆盖 | 4 张图均被选中 | 顶部时间条显示 4 Cuts、8s of 8s，本次各 2 秒 | 调时长、排序、编辑描述、替换图 | [Cut 卡片](evidence/23c-cut-cards.png) | 已观察 |
| Cut 集合 | 候选退回 | 点击 Return to candidates | Cut 数降为 3；其余时长自动重分配，仍覆盖 8 秒 | 再次加入候选图 | [退回候选](evidence/24-candidate-returned.png) | 已观察 |
| Cut 集合 | 重新加入 | 从候选区再次选图 | 图片追加到末尾；系统重新分配时长 | 调整顺序和时长 | [Cut 卡片](evidence/23c-cut-cards.png) | 已观察 |
| Videos | 待生成 | 有选中 Cut，但没有视频 | 每行状态 Pending，显示 Chosen image、空 Rendered video、Express / Standard | 生成、Edit / Attach | [Videos 待生成](evidence/27-videos-pending.png) | 已观察 |
| Videos | 生成说明 | 首次选择档位 | 弹出 Express vs Standard；说明 Standard 更适合脸部和 Lipsync | OK 后继续 | [档位说明](evidence/29-standard-info-generating.png) | 已观察 |
| 单 Cut 视频 | 处理中 | 点击 Express 或 Standard | 显示 Enhancing with Standard… 或 Generating video…；相应操作禁用 | 轮询任务状态 | [并行生成](evidence/32-three-videos-generating.png) | 已观察 |
| 单 Cut 视频 | 成功 | 任务状态为 succeeded | 行显示 Generated；Rendered video 可播放；积分在成功后扣除 | 预览、导出或再次生成 | [单条完成](evidence/30-one-video-generated.png) | 已观察 |
| Segment 视频 | 部分成功 | 仅 1/4 Cut 成功 | 已成功行可播放，其他行仍 Pending；Preview 已可用 | 先预览，或继续并行生成剩余 Cut | [单条成功](evidence/30-one-video-generated.png)、[部分预览](evidence/31-partial-preview.png) | 已观察 |
| Segment 视频 | 多任务处理中 | 同时启动剩余 3 个 Cut | 3 行同时显示 Generating video… | 各任务独立完成 | [并行生成](evidence/32-three-videos-generating.png) | 已观察 |
| Segment 视频 | 全部成功 | 4/4 Cut 均 succeeded | Cuts、Videos 均绿色完成；All videos ready、Export now | Preview、Go Export | [全部完成](evidence/33-all-videos-ready.png) | 已观察 |
| 单 Cut 视频 | 远端失败 | AI 视频任务失败 | 本次未产生 failed 任务 | 未知错误文案、Retry 按钮和扣费回滚 | — | 未验证 |
| 单 Cut 视频 | 重生成 | 已成功后再次选择模型 | 已成功行仍显示模型入口 | 本次未二次确认生成 | [全部完成](evidence/33-all-videos-ready.png) | UI 可达，覆盖规则未验证 |

## 5. Editor Timeline 状态

| 区域 | 状态 | 进入条件 | 页面表现 | 可执行行为 / 下一状态 | 证据 | 结论 |
|---|---|---|---|---|---|---|
| Timeline | 未定义 Scene 类型 | 首次进入 Editor | 1 scenes、8s 时间块；详情提供 Lipsync / Scene 两个类型 | 选择类型 | [Editor 全页](evidence/44-editor-full-page.png) | 已观察 |
| Timeline | Lipsync 已选择 | 点击 Lipsync | 显示提示词、First、Last、模型和 Generate；同步显示 Transcript | 配图并生成 | [Lipsync Scene](evidence/45-editor-lipsync-scene.png) | 已观察 |
| Timeline | 输入校验失败 | 未设首帧点击 Generate | 原位提示 A start image is required…；不创建任务 | 打开 First image 选择器 | [校验状态](evidence/interaction-observations.md) | 已观察 |
| Timeline | 选首帧 | 点击 First / Edit | Chapter Images 弹窗，Library、Generate、Add | 选图并 Use this image | [首帧选择器](evidence/47-editor-first-image-picker.png) | 已观察 |
| Timeline | 费用确认 | 输入满足后点击 Generate | 显示约 0.04 credits；Do not ask again、Cancel、Generate | 确认后创建任务 | [费用确认](evidence/48-editor-cost-confirm.png) | 已观察 |
| Timeline Lipsync | 生成中 | 确认 Generate | 显示 Generating…、starting，操作禁用；项目同时 Saving… | 等待任务和附件写回 | [生成中](evidence/interaction-observations.md) | 已观察 |
| Timeline Lipsync | 任务完成但未附加 | 视频任务先完成，Scene 行尚未取得 videoUrl | 短暂出现 This segment finished, but the video was not attached here. Browse finished videos | 可 Browse；本次无需手动操作，数秒后自动附加 | [短暂未附加](evidence/interaction-observations.md) | 已观察，属于部分成功 / 恢复中 |
| Timeline Lipsync | 已附加 | 项目刷新到视频 URL | 显示 Segment 8s · Video 8s、Regenerate、Download、Browse；Preview / Export 启用 | 预览、导出、重生成 | [视频已附加](evidence/59-editor-video-attached-valid.png) | 已观察 |
| Timeline Lipsync | 生成失败 | Job failed 或附件持续失败 | 本次未触发 | 未知是否原位 Retry；Browse 是可见替代入口 | — | 未验证 |
| Timeline Lipsync | 重生成 | 点击 Regenerate | 控件真实存在，本次未点击 | 未知旧视频是否保留 | [视频已附加](evidence/59-editor-video-attached-valid.png) | UI 可达 |

## 6. Preview 状态

| 模式 | 状态 | 进入条件 | 页面表现 | 可执行行为 / 下一状态 | 证据 | 结论 |
|---|---|---|---|---|---|---|
| Director | 不可预览 | 没有生成或附加任何 Cut 视频 | Preview failed；No videos yet — generate or attach at least one cut video first | Retry 或 Close；随后可进入 Create videos 引导 | [失败流程](evidence/interaction-observations.md)、[下一步引导](evidence/26-next-step-create-videos.png) | 已观察 |
| Director | 部分预览可用 | 至少 1 个 Cut 视频成功 | 构建并显示 8 秒视频弹窗 | 关闭后继续生成剩余 Cut | [单条成功](evidence/30-one-video-generated.png)、[部分预览](evidence/31-partial-preview.png) | 已观察 |
| Director | 完整预览可用 | 4/4 Cut 成功 | 8 秒视频弹窗，带原生播放、音量、全屏 | Close、Rebuild preview、Go Export | [完整预览](evidence/34-complete-preview.png) | 已观察 |
| Editor Timeline | 构建中 | 已附加 Scene 视频后点击 Preview | Building preview…、Stitching scene clips with audio…、0%；显示 Close、Local encode、Export | 等待本地合成 | [预览构建](evidence/52-editor-preview-building.png) | 已观察 |
| Editor Timeline | 完成 | 本地合成成功 | Preview ready，Blob 视频为 8 秒 | 播放、全屏、Close | [预览完成](evidence/53-editor-preview-ready.png) | 已观察 |
| Preview | 合成失败 / 重试失败 | 素材加载或浏览器编码失败 | 除“没有视频”的保护外，本次未触发真实编码失败 | 未知 | — | 未验证 |

## 7. Export 状态

| 模式 | 状态 | 进入条件 | 页面表现 | 可执行行为 / 下一状态 | 证据 | 结论 |
|---|---|---|---|---|---|---|
| Director | 可导出 | 进入 Export 阶段 | Stitch & ship；显示 1 Segment、4 Cuts、0:08 和逐 Segment 4/4 generated | Browser export、Cloud export、下载 SRT / ASS | [导出页](evidence/35a-export-overview.png) | 已观察 |
| Director | 提前导出 | 存在 Pending Cut | 页面说明可提前导出，Pending Cut 会成为黑帧 | 本次未在未完成态真正导出 | [导出页](evidence/35-export-page.png) | UI 可达 |
| 云端导出 | 排队 / 编码 | 点击 Cloud export | 弹窗显示 Exporting…、3%、Encoding on server… | 等待，或 OK 关闭弹窗并后台继续 | [云端排队](evidence/36-cloud-export-queued.png) | 已观察 |
| 云端导出 | 等待结果 | 服务端任务处理中 | 显示 74%、Waiting for export… | 继续等待，或 OK 后后台运行 | [云端处理中](evidence/37-cloud-export-progress.png) | 已观察 |
| 云端导出 | 后台运行 | 处理中点击 OK | 页面可关闭进度弹窗，说明完成后会在项目顶部出现 | 返回项目或等待 | [云端排队](evidence/36-cloud-export-queued.png) | UI 已说明，本次最终等到完成 |
| 云端导出 | 完成 | 服务端生成成片并写回项目 | Export complete，8 秒视频预览，Download video | 下载 MP4 或 Close | [导出完成](evidence/38-export-complete.png)、[MP4](evidence/downloads/audio-cloud.mp4) | 已观察 |
| 浏览器导出 | 加载素材 / 合成 | 点击 Export and Download | Loading visual sources…、百分比、Cancel export | 等待或取消 | [浏览器导出](evidence/40-browser-export-progress.png) | 已观察 |
| 浏览器导出 | 完成 | 本地合成成功 | 同样进入 Export complete，提供下载 | 下载 MP4 | [浏览器进度](evidence/40-browser-export-progress.png)、[导出完成](evidence/38-export-complete.png) | 已观察；未单独保留该路径的二进制文件 |
| 浏览器导出 | 已取消 | 点击 Cancel export | 本次没有执行取消 | 未知能否立即重启 | [浏览器导出](evidence/40-browser-export-progress.png) | UI 可达，结果未验证 |
| Export | 失败 / Retry | 服务端编码或素材下载失败 | 本次未触发 | 未知错误文案和重试入口 | — | 未验证 |
| Editor Timeline | 导出房间加载中 | 从 Timeline 点击 Export | 跳转独立页面，Loading export room…；Refresh 和 Start export 暂不可用 | 等待房间读取导出资产 | [Timeline 导出加载](evidence/54-timeline-export-loading.png) | 已观察 |
| Editor Timeline | Ready（既有资产） | 导出房间读到项目级导出资产 | Ready 100%；What will export 显示 Duration 0:08、Scenes 1、Gaps None、Audio Finalized；Timeline 列出 1 个 Lipsync Scene | Save video、Export again、Refresh | [Timeline Ready](evidence/55-timeline-export-ready.png)、[页面下载](evidence/downloads/audio.mp4) | 已观察；下载内容与既有 Director 蒙太奇一致，不是当前 Row |
| Editor Timeline | 再次导出 | 完成后点击 Export again | 控件真实存在，本次未再次启动 | 未知是否创建新版本或覆盖当前成片 | [Timeline 导出完成](evidence/55-timeline-export-ready.png) | UI 可达 |
| Editor Timeline | 失败 | 导出房间或编码失败 | 本次未触发 | Refresh 真实存在，但失败后的具体文案和恢复规则未知 | [Timeline 导出完成](evidence/55-timeline-export-ready.png) | 未验证失败态 |

## 8. 已观察到的异步任务状态机

以下状态转换来自页面文案与项目 / Job 响应的组合；UI 文案不一定与后端枚举同名。

### 8.1 AI 生成任务

1. 用户确认付费生成。
2. 页面进入 starting、Generating…、Generating video… 或 Enhancing with Standard…。
3. 前端持续轮询 Job；轮询期间页面显示 starting / Generating / Enhancing，但本轮没有保存到与这些 UI 文案一一对应的后端中间枚举。
4. 成功后服务端响应实测为 succeeded，页面显示 Generated。
5. Timeline 模式还存在“Job 已完成，但尚未附加到 Scene”的中间态。
6. 项目写回 videoUrl 后，Scene 进入可预览、下载和重生成状态。

远端 failed、cancelled、超时和积分不足状态均未真实触发。

### 8.2 Cut 集合聚合状态

| 成功数 | 页面聚合状态 | Preview | Export |
|---:|---|---|---|
| 0 / 4 | 全部 Pending | 失败并要求至少 1 个视频 | 页面说明可提前导出，未生成部分为黑帧 |
| 1 / 4 | 部分成功 | 可生成完整时长的部分预览 | 可继续生成；提前导出行为仅见说明 |
| 1 / 4 且其余处理中 | 部分成功 + 并行处理中 | 已成功素材仍可用 | 等待或继续操作 |
| 4 / 4 | All videos ready | 完整预览 | 正常云端或浏览器导出 |

### 8.3 导出任务

云端导出已观察到：可导出 → 3% 排队 / 编码 → 74% 等待 → 完成并写回下载地址。处理中允许关闭弹窗，任务继续在后台执行。

浏览器导出已观察到：可导出 → 加载视觉源 → 本地合成 → 完成。Cancel export 控件真实存在，但取消后的状态未验证。

Timeline 导出已观察到：导出房间加载 → Ready 100%。本次没有观察到 Start export 转为可用或新任务处理进度；完成页虽显示 1 个 8 秒 Lipsync Scene、无 Gap、音频已 Finalized，但 Save video 实际下载的是既有 Director 蒙太奇内容。

## 9. 必须保留为未验证的失败分支

- 音频格式不支持、文件过大、损坏、URL 不可访问、上传中断。
- 转写失败、无语音、语言识别失败及重新转写对既有 Storyboard 的影响。
- Plot、Character、Environment、Segment 或候选图 AI 请求失败和部分返回。
- 视频 Job 的 failed、cancelled、timeout、moderation、积分不足和扣费回滚。
- 二次生成后旧版本保留、覆盖、回退和任务历史。
- 预览素材跨域失败、浏览器编码失败、内存不足和用户取消。
- 云端导出失败、重试、过期下载地址和多次导出的版本管理。
- 无既有 Director 导出的新项目如何创建真正的 Timeline 成片，以及 Timeline 导出房间的失败、重试、缓存失效和多版本覆盖规则。
