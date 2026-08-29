# 4i Music Video 功能清单

## 1. 口径

本清单只记录实际浏览器操作、页面 DOM、网络行为和下载产物。状态含义如下：

| 状态 | 含义 |
|---|---|
| 已验证 | 已点击并获得可核对的页面、任务或文件结果 |
| UI 已验证 | 控件或说明真实存在，但没有执行会产生额外付费、删除或外部状态变化的最终动作 |
| 未观察到 | 本次完整流程对应页面中没有出现该能力或结果 |
| 未验证 | 当前证据不足，不能判断是否支持 |

测试样本为 1 个 8 秒 WAV 音频。项目选择 16:9，Director 模式生成 1 个 Segment、4 个最终 Cut，并完成视频预览及导出；Editor Timeline 另生成 1 个 8 秒 Lipsync Scene。

## 2. 项目、上传与音频分析

| 功能 | 状态 | 实际行为与边界 | 证据 |
|---|---|---|---|
| 新建 Music Video 项目 | 已验证 | 进入 New project，上传成功后自动以文件名 audio 建立项目 | [上传页](evidence/02-new-project-upload.png)、[工作区](evidence/04-workspace-choice.png) |
| 本地拖放或选择音频 | 已验证 | 文件输入接受 audio/*、.mp3、.wav、.flac；本次实际上传 WAV，689 KB、8 秒 | [上传页](evidence/02-new-project-upload.png) |
| 通过 URL 导入音频 | UI 已验证 | 存在 or paste URL… 输入框，类型为 URL；未提交真实 URL | [上传页](evidence/02-new-project-upload.png) |
| 上传大小限制 | 未验证 | 页面可见文案和文件输入未给出最大值，本次只验证 689 KB 文件 | [上传页](evidence/02-new-project-upload.png) |
| 上传后分析 | 已验证 | 上传后进入 Analyzing…，无百分比和分阶段说明；约 20 秒后自动进入工作区 | [分析中](evidence/03-audio-analyzing.png)、[工作区](evidence/04-workspace-choice.png) |
| 音频时长 | 已验证 | 工作区显示 0:08，并在后续 Segment、Timeline 和导出中沿用 | [工作区](evidence/04-workspace-choice.png) |
| 音频波形与播放 | 已验证 | 工作区及编辑器顶部提供波形、播放按钮、当前时间和总时长 | [工作区](evidence/04-workspace-choice.png)、[Editor 全页](evidence/44-editor-full-page.png) |
| 替换音频 | UI 已验证 | 工作区存在 Replace audio 按钮；未执行替换，替换后的项目数据迁移规则未验证 | [工作区](evidence/04-workspace-choice.png) |
| 转写 | 已验证 | Transcribe 产生全文、词数、时长和单词级时间戳，可再次转写 | [转写弹窗](evidence/09-transcript-modal.png)、[TXT 产物](evidence/downloads/audio.txt) |
| 编辑转写 | 已验证 | Edit 后按词拆成输入项，可删除单词，Done editing 保存 | [转写编辑](evidence/10-transcript-edit.png) |
| 下载转写与字幕 | 已验证 | 可下载 TXT、SRT、ASS；SRT 本次为 1 条 1.120–6.660 秒字幕，ASS 按 Cut 区间重复整句 | [TXT](evidence/downloads/audio.txt)、[SRT](evidence/downloads/audio.srt)、[ASS](evidence/downloads/audio.ass) |
| Lyrics 结构化分析 | 未观察到 | 本次页面只展示转写文本，未展示独立歌词段落、歌词置信度或歌曲结构 | [转写弹窗](evidence/09-transcript-modal.png) |
| BPM、音乐 Beat、Mood、Energy | 未观察到 | 上传后工作区、Director 和 Editor Timeline 均未出现这些分析字段；页面中的 15-second beats 指故事分段，不是音乐节拍标记 | [Segments](evidence/19-segments-generated.png)、[Editor 全页](evidence/44-editor-full-page.png) |

## 3. Director 模式：Setup

| 功能 | 状态 | 实际行为与边界 | 证据 |
|---|---|---|---|
| 进入 Director Mode | 已验证 | 工作区提供 Director Mode 与 Editor Timeline 两条入口；Director 在同一路由内进入全屏式三阶段流程 | [工作区](evidence/04-workspace-choice.png) |
| 三阶段导航 | 已验证 | 顶部固定为 Setup、Build、Export，并持续显示音频波形、0:08 和预估积分 | [画幅步骤](evidence/05-director-aspect-ratio.png) |
| 画幅选择 | 已验证 | 可选 1:1、16:9、9:16、4:3、3:4；本次选择 16:9 | [画幅步骤](evidence/05-director-aspect-ratio.png) |
| 生成速度 / 模型档位 | 已验证 | Express 为约 10 秒一个 Cut、0.005 credits/s；Standard 为约 40 秒一个 Cut、0.02 credits/s；本次后续逐 Cut 混用两档 | [模型步骤](evidence/06-director-speed.png) |
| 成本预估 | 已验证 | Setup 顶部显示估算总成本；本次初始估算 0.19 credits，生成动作前后余额变化可见 | [模型步骤](evidence/06-director-speed.png) |
| Plot 手工编辑 | 已验证 | Plot 为可编辑长文本，可直接输入故事方向 | [Plot](evidence/07-director-plot.png) |
| Plot AI 生成 | 已验证 | Generate with AI 先依赖音频转写，再生成一段完整故事方向并回填文本框 | [生成后的 Plot](evidence/08-director-plot-generated.png) |
| Character 添加、编辑、删除 | 已验证 | Character 卡可编辑名称、描述，可新增空白角色、删除角色；角色图支持生成 | [页面](evidence/11-director-characters.png)、[真实操作日志](evidence/interaction-observations.md)、[脱敏结构](evidence/project-schema-sanitized.json) |
| Character 自动重建 | UI 已验证 | Make it for me 在已有角色时弹出 Regenerate characters?，明确会移除既有角色；为避免覆盖，本次取消，未验证最终输出 | [真实操作日志](evidence/interaction-observations.md) |
| Environment 自动生成 | 已验证 | Make it for me 根据 Plot 生成 2 个环境及对应 1024×1024 图片，并扣除积分 | [生成前](evidence/interaction-observations.md)、[生成后](evidence/interaction-observations.md) |
| Environment 编辑 | 已验证 | 环境卡包含名称、描述、图片；支持 Regenerate、Remove、Pick image、Maximize | [环境卡](evidence/interaction-observations.md)、[图片放大](evidence/14-image-lightbox.png) |
| 图片库选图 | 已验证 | Pick image 打开 Chapter Images，包含 Library、Generate、Add 三个页签，选择后用 Use image 确认 | [图片选择器](evidence/15b-image-picker-clear.png) |
| 图片上传与 URL 添加 | UI 已验证 | Add 支持 PNG、JPG、WebP，页面标明上限 12 MB，并支持粘贴或图片 URL；本次未提交外部文件或 URL | [图片添加](evidence/16-image-picker-add.png) |
| AI 图片生成 / 编辑 | UI 已验证 | Generate 支持参考图、文本描述和 Standard / Premium 模型；本次只核对控件和价格，未额外发起该入口任务 | [图片生成](evidence/17-image-picker-generate.png)、[Premium](evidence/17b-image-picker-premium.png) |
| Segment AI 规划 | 已验证 | Create segments with AI 按页面定义规划 15 秒故事段；8 秒样本生成 1 个 Segment、6 条 Cut 描述，覆盖 0:00–0:08 | [生成中](evidence/18-segments-generating.png)、[生成结果](evidence/19-segments-generated.png) |
| Segment 手工编辑 | 已验证 | 可编辑标题、摘要及每条 Cut 描述；可新增空白 Cut、删除 Cut | [Segment 编辑](evidence/19b-segment-editor.png) |

## 4. Director 模式：Build、单 Scene / Cut 与视频生成

| 功能 | 状态 | 实际行为与边界 | 证据 |
|---|---|---|---|
| Build 分区 | 已验证 | 左侧为 Segment 列表，右侧分 Cuts 和 Videos 页签 | [空 Build](evidence/20a-build-overview.png) |
| 生成候选 Cut 图片 | 已验证 | Generate 4 images 前弹出人物与环境复核；确认后生成 4 张候选图 | [人物环境复核](evidence/21-image-generation-review.png)、[生成过程日志](evidence/interaction-observations.md)、[生成结果](evidence/23-cuts-generated.png) |
| 图片自动组成时间段 | 已验证 | 4 张选中图自动成为 4 个 Cut，本次初始各 2 秒并完整覆盖 8 秒 | [Cut 卡片](evidence/23c-cut-cards.png) |
| Cut 文案 | 已验证 | 每个 Cut 的镜头描述可编辑；生成视频时该文本作为提示词来源 | [Cut 卡片](evidence/23c-cut-cards.png) |
| Cut 图片替换 | 已验证 | 可 Return to candidates、再次选择候选图，或从图片库 Pick image；也可移除当前图 | [退回候选](evidence/24-candidate-returned.png) |
| Cut 时长 | 已验证 | 通过 − / + 以 1 秒调整；退回一个 Cut 后系统自动把剩余时长重分配以覆盖总时长 | [退回候选](evidence/24-candidate-returned.png) |
| Cut 顺序 | 已验证 | 支持 Move left / Move right；候选图重新加入时会追加到末尾，顺序与 Videos 页签一致 | [Cut 卡片](evidence/23c-cut-cards.png) |
| Cut Lipsync 开关 | 已验证 | 每个 Cut 独立显示 Lipsync 复选框，本次默认开启 | [Videos 待生成](evidence/27-videos-pending.png) |
| Cut Transcript 映射 | 已验证 | Videos 行显示分配到该 Cut 的转写内容，音频按 Cut 时间切片送入生成任务 | [Videos 待生成](evidence/27-videos-pending.png) |
| 单 Cut 视频生成 | 已验证 | 每行可选 Express 或 Standard；点击价格按钮即启动该 Cut 的生成任务 | [档位说明](evidence/29-standard-info-generating.png)、[单条完成](evidence/30-one-video-generated.png) |
| 并行生成 | 已验证 | 3 个剩余 Cut 可同时进入 Generating video…，随后分别完成 | [并行生成](evidence/32-three-videos-generating.png)、[全部完成](evidence/33-all-videos-ready.png) |
| 单 Cut 重生成 | UI 已验证 | 已生成 Cut 保留档位与生成入口，可重新启动；本次没有对同一 Cut 再次付费生成，因此覆盖旧任务、历史版本和扣费规则未验证 | [全部完成](evidence/33-all-videos-ready.png) |
| Attach from Generations | UI 已验证 | Edit 可打开已有生成视频选择器；本次库内没有匹配的 P-Video 16:9 产物，未完成附加 | [生成视频引导](evidence/28-videos-onboarding-attach.png) |
| 所有 Cut 完成提示 | 已验证 | 完成后 Videos 页签出现绿色完成标识，Segment 显示 All videos ready 和 Export now | [全部完成](evidence/33-all-videos-ready.png) |

## 5. Editor Timeline

| 功能 | 状态 | 实际行为与边界 | 证据 |
|---|---|---|---|
| Editor Timeline 入口 | 已验证 | 与 Director Mode 并列，进入单页编辑器 | [工作区](evidence/04-workspace-choice.png)、[Editor 全页](evidence/44-editor-full-page.png) |
| Timeline 画幅 | 已验证 | 同样提供 1:1、16:9、9:16、4:3、3:4 | [Editor 全页](evidence/44-editor-full-page.png) |
| 默认 Lipsync 模型 | 已验证 | Express 0.005 credits/s、Standard 0.02 credits/s、Premium 0.12 credits/s | [Editor 全页](evidence/44-editor-full-page.png) |
| 默认 Scene 模型 | 已验证 | Express 0.005 credits/s、Standard 0.02 credits/s、Premium 0.17 credits/s | [Editor 全页](evidence/44-editor-full-page.png) |
| 图片资产库 | 已验证 | 展示 Director 阶段产生的 6 张图片，可上传，也可基于文本和参考图生成 | [Editor 全页](evidence/44-editor-full-page.png) |
| Scene 时间块 | 已验证 | 8 秒样本显示 1 scenes 和一个 8s 块；详情显示 0:00–0:08、时长和局部播放滑杆 | [Editor 全页](evidence/44-editor-full-page.png) |
| Scene 类型切换 | 已验证 | 每个时间段可在 Lipsync 与 Scene 之间切换 | [类型选择](evidence/45-editor-lipsync-scene.png) |
| Scene 可编辑字段 | 已验证 | 包含动作提示词、首帧图、末帧图、模型档位；生成后提供视频、下载、Browse / Pick from generations | [类型选择](evidence/45-editor-lipsync-scene.png)、[首帧选择器](evidence/47-editor-first-image-picker.png) |
| Lipsync 输入校验 | 已验证 | 未设置首帧点击 Generate，页面提示必须设置 start image，不创建任务 | [校验状态](evidence/interaction-observations.md) |
| 生成前费用确认 | 已验证 | Express 8 秒任务显示约 0.04 credits；可勾选 Do not ask again，选择 Cancel 或 Generate | [费用确认](evidence/48-editor-cost-confirm.png) |
| Timeline Lipsync 生成 | 已验证 | 本次仅实际生成 Lipsync 类型：确认后进入 Generating / starting，完成 8 秒 P-Video Draft，并自动附加到时间段；非 Lipsync 的 Scene 任务未执行 | [生成中](evidence/interaction-observations.md)、[已附加](evidence/59-editor-video-attached-valid.png) |
| Timeline 单 Scene 重生成 | UI 已验证 | 完成后出现 Regenerate；未再次点击，因此旧版本保留、覆盖和再次扣费规则未验证 | [已附加](evidence/59-editor-video-attached-valid.png) |
| 音频轨 | 部分观察 | 页面顶部有全局波形；Scene 内有局部播放滑杆和 Transcript，但没有独立命名为 Audio 的多轨轨道 | [Editor 全页](evidence/44-editor-full-page.png) |
| Waveform | 已验证 | 只在页面顶部观察到波形画布 | [Editor 全页](evidence/44-editor-full-page.png) |
| Beat Marker | 未观察到 | 时间块和波形中没有独立音乐节拍标记或 Beat 轨 | [Editor 全页](evidence/44-editor-full-page.png) |
| Video Clip 轨 | 部分观察 | 视频作为 Scene 时间块的输出附加；未观察到独立的多轨 Clip lane | [已附加](evidence/59-editor-video-attached-valid.png) |
| Transition | 未观察到 | Scene 详情、时间块和导出页均没有转场类型、时长或转场轨控件 | [Editor 全页](evidence/44-editor-full-page.png) |

## 6. Preview 与 Export

| 功能 | 状态 | 实际行为与边界 | 证据 |
|---|---|---|---|
| 无视频预览保护 | 已验证 | 只有 Cut 图片、没有视频时，预览提示失败：至少需要生成或附加一个 Cut 视频；提供 Retry / Close | [预览失败流程](evidence/interaction-observations.md) |
| 部分成功预览 | 已验证 | Director 仅 1/4 Cut 视频完成时即可构建 8 秒预览；其余未完成区段的具体渲染策略未能从现有证据确认 | [单条成功](evidence/30-one-video-generated.png)、[部分预览](evidence/31-partial-preview.png) |
| 全量预览 | 已验证 | 4/4 Cut 完成后生成 8 秒 Blob 预览，可播放、全屏和重建 | [全部完成](evidence/33-all-videos-ready.png)、[完整预览](evidence/34-complete-preview.png) |
| Timeline 本地预览 | 已验证 | 显示 Building preview…、Stitching scene clips with audio… 和百分比，完成后显示 8 秒 Blob 视频 | [构建中](evidence/52-editor-preview-building.png)、[预览完成](evidence/53-editor-preview-ready.png) |
| Director 提前导出 | UI 已验证 | 页面明确允许未完成全部 Cut 时提前导出，未完成 Cut 会成为黑帧；本次最终导出使用 4/4 完成状态 | [导出页](evidence/35-export-page.png) |
| 浏览器导出 | 已验证 | Export and Download 在浏览器加载视觉源并合成；提供 Cancel export | [浏览器导出](evidence/40-browser-export-progress.png) |
| 云端导出 | 已验证 | Cloud export 进入 3% 排队 / 编码和 74% 等待状态；可按 OK 关闭，后台继续，完成后提供下载 | [排队](evidence/36-cloud-export-queued.png)、[处理中](evidence/37-cloud-export-progress.png)、[完成](evidence/38-export-complete.png) |
| 导出画幅 | 已验证 | 项目选择 16:9；页面没有在 Export 阶段提供第二套画幅设置 | [画幅步骤](evidence/05-director-aspect-ratio.png)、[导出页](evidence/35a-export-overview.png) |
| 导出分辨率 | 未提供选择 | 页面没有分辨率控件。Director 保留成片为 H.264、1280×704、30 fps；Timeline Export 页下载为 H.264、1280×720、30 fps，但其内容复用了 Director 蒙太奇；当前 Timeline Row 本身为 1280×704、24 fps | [Director MP4](evidence/downloads/audio-cloud.mp4)、[Export 页下载](evidence/downloads/audio.mp4)、[Row MP4](evidence/downloads/audio-timeline-row.mp4) |
| 文件格式 | 已验证 | Director、Timeline Row 媒体和 Timeline Export 页下载均为 MP4；字幕可另下 SRT 和 ASS。页面未提供其他视频封装格式选择 | [Director MP4](evidence/downloads/audio-cloud.mp4)、[Export 页下载](evidence/downloads/audio.mp4)、[Row MP4](evidence/downloads/audio-timeline-row.mp4)、[SRT](evidence/downloads/audio.srt)、[ASS](evidence/downloads/audio.ass) |
| 音频编码 | 已验证 | Director 保留成片为 AAC 44.1 kHz 单声道、8.000 秒；Timeline Export 页下载为 AAC 48 kHz 双声道、8.064 秒；当前 Row 为 AAC 44.1 kHz 单声道、8.000 秒 | [导出元数据](evidence/export-metadata.md) |
| 水印 | 未观察到 | Export 页面没有水印开关或套餐说明；两个导出页下载样本的抽帧均没有可见水印，但 Timeline 样本内容是 Director 蒙太奇，且不能据此确认所有账号和套餐均无水印 | [Director 抽帧](evidence/39-exported-video-frame.jpg)、[Timeline Export 页抽帧](evidence/56-timeline-export-frame.jpg) |
| Timeline 独立导出房间 | 已验证 UI 和下载 | Timeline 的 Export 跳转独立页面：先显示 Loading export room…，随后显示 Ready 100%、Duration 0:08、Scenes 1、Gaps None、Audio Finalized，并提供 Refresh、Export again、Save video | [加载中](evidence/54-timeline-export-loading.png)、[Ready 100%](evidence/55-timeline-export-ready.png) |
| Timeline 导出内容对齐 | 已观察到旧内容复用 | Save video 的文件内容与先前 Director 四镜头蒙太奇一致，不是当前 8 秒歌手 Lipsync Row。Editor 在生成 Row 前就已显示 Export ready | [三者对比](evidence/61-export-content-comparison.jpg)、[详细元数据](evidence/export-metadata.md) |

## 7. 登录、历史项目、积分和付费

| 功能 | 状态 | 实际行为与边界 | 证据 |
|---|---|---|---|
| 登录态访问 | 已验证 | 本次使用浏览器既有登录态，无需验证码即可进入产品和创建任务 | [项目列表](evidence/01-project-list-exported.png) |
| 登录 / 注册流程 | 未验证 | 未退出既有账号，未测试登录、注册、找回密码、验证码或第三方登录 | — |
| 历史项目 | 已验证 | 项目列表显示模式、项目名、Exported 状态、更新时间，并提供 Download 和 Delete | [项目列表](evidence/01-project-list-exported.png) |
| 自动保存 | 已验证 | 编辑时显示 Saving…，完成后显示 Saved；网络中观察到项目 PUT 保存 | [校验状态](evidence/interaction-observations.md)、[预览完成](evidence/53-editor-preview-ready.png) |
| 删除项目 | UI 已验证 | 项目内和项目卡均有 Delete；点击后进入浏览器控制的确认流程，本次选择取消，未执行最终删除 | [工作区](evidence/04-workspace-choice.png)、[项目列表](evidence/01-project-list-exported.png)、[证据边界](evidence/README.md) |
| 积分余额与扣费 | 已验证 | 页面持续显示 Credits；环境、图片和视频任务成功后余额下降，任务数据标记 charge on success | [上传页](evidence/02-new-project-upload.png)、[模型步骤](evidence/06-director-speed.png) |
| 购买积分 | UI 已验证 | 账号菜单说明 1 credit = 1 euro、最低购买 5 credits，并提供 Buy credits；未进入付款页 | [脱敏账号菜单](evidence/57-account-menu-redacted.png) |
| Profile、Settings、Sign out | UI 已验证 | 账号菜单存在这些入口；为保留会话未点击 Sign out，未改账号设置 | [脱敏账号菜单](evidence/57-account-menu-redacted.png) |
| 付款、订阅、退款 | 未验证 | 未触发付款，不掌握支付方式、税费、订阅层级、失败退款和任务失败返还积分规则 | — |

## 8. 本次未观察到或未完成验证的能力

- 未观察到 BPM、音乐 Beat Marker、Mood、Energy、段落标签或独立 Lyrics 分析面板。
- 未观察到传统多轨 Timeline：没有独立 Audio、Beat、Video Clip、Transition 轨道；实际是全局波形加 Scene 时间块。
- 未观察到转场编辑、关键帧、滤镜、文字图层、字幕样式编辑或音频混音。
- 未观察到 Export 阶段的分辨率、帧率、码率、编码器、容器格式或水印开关。
- 未验证 URL 音频导入、超限文件、损坏文件、不支持格式和长音频的处理。
- 未验证远端 AI 任务失败、积分不足、主动取消、重试后版本保留和扣费回滚。
- 未验证同一个 Cut / Scene 的二次生成覆盖逻辑，以及生成历史选择器有匹配素材时的完整附加流程。
- 未验证一个没有既有 Director `exportUrl` 的新项目能否正确导出当前 Timeline Row；本次实测是复用旧 Director 内容。
- 未验证登录、验证码、购买积分、付款、订阅、退款及账号权限边界。
