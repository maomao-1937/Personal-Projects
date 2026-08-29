# 4i Music Video 页面清单与信息架构

## 1. 页面地图口径

本文记录本次真实进入的页面、同页工作模式、弹窗和下拉菜单。4i 的 Music Video 并非每一步都切换 URL：上传、项目工作区、Director 向导和 Editor 主要通过同一路由中的项目状态与界面模式切换。因此，本文用「页面 / 视图」描述用户可感知的独立界面，用「弹窗 / 菜单」描述覆盖层。

安全展示的路由形式：

- Music Video 入口：`/music-video`；
- 新项目：`/music-video?new=1`，创建后会带项目 ID；
- 已有项目：`/music-video?id=<projectId>`；
- Timeline Export：由 Editor 的「Export」进入独立导出页面；本次不记录包含内部标识的实际 URL。

## 2. 全站信息架构

```text
全局外壳
├── 左侧导航
│   ├── Welcome
│   ├── Create Music
│   ├── Create Music Video
│   ├── Video Tools / Audio Tools / Image Tools / Other Tools
│   └── Browse Music Videos / Browse Music
├── 顶部搜索
├── Create 菜单
│   ├── Music Video
│   ├── Music
│   ├── Video
│   ├── Animated movie（Experimental）
│   └── Story
└── 账号菜单
    ├── Credits / Buy credits
    ├── Profile
    ├── Settings
    └── Sign out

Music Video
├── 项目列表
├── New project / 音频上传
├── 项目工作区 / 模式选择
│   ├── Transcript
│   ├── Director Mode
│   │   ├── Setup
│   │   │   ├── Aspect ratio
│   │   │   ├── Speed / model
│   │   │   ├── Plot
│   │   │   ├── Characters
│   │   │   ├── Environments
│   │   │   └── Segments
│   │   ├── Build
│   │   │   ├── Cuts
│   │   │   └── Videos
│   │   └── Export
│   └── Editor Timeline
│       ├── Setup
│       ├── Audio transcription
│       ├── Image library
│       ├── Timeline / Scene editor
│       ├── Preview
│       └── 独立 Export 页面
└── 项目删除确认
```

全局外壳证据：[Timeline Export 页面](evidence/55-timeline-export-ready.png)、[Create 菜单](evidence/58-create-menu.png)、[脱敏账号菜单](evidence/57-account-menu-redacted.png)。

## 3. 一级页面与视图清单

| 编号 | 页面 / 视图 | 进入方式 | 主要区域 | 离开方式 / 下一步 | 验证状态 | 证据 |
|---|---|---|---|---|---|---|
| P01 | Music Video 项目列表 | 左侧「Create Music Video」或从项目返回 | New project、项目卡、模式标签、项目状态、更新时间、Download、Delete | 新建项目、打开已有项目、下载、删除确认 | 已进入 | [项目列表](evidence/01-project-list-exported.png) |
| P02 | New project 上传页 | 项目列表的 New project | 拖放区、Upload audio、音频 URL 输入、积分、说明 | 选择本地音频或提交 URL | 已进入；本地上传已验证 | [上传页](evidence/02-new-project-upload.png) |
| P03 | 音频 Analyzing 状态 | 本地文件选择成功后自动进入 | 文件名、多个 Analyzing… 状态，无百分比 | 等待自动创建项目 | 已进入 | [分析中](evidence/03-audio-analyzing.png) |
| P04 | 项目工作区 / 模式选择 | 音频分析完成或打开未选择模式的项目 | 波形、播放、0:08、Transcribe、Replace audio、Director Mode、Editor Timeline、Delete | 进入 Director 或 Editor；返回项目列表 | 已进入 | [工作区](evidence/04-workspace-choice.png) |
| P05 | Director Setup | 工作区点击 Director Mode | 顶部波形、预计积分、Setup / Build / Export、6 个 Setup 步骤 | 步骤间前进 / 返回，完成后进入 Build | 已完整遍历 | [Aspect](evidence/05-director-aspect-ratio.png)、[Segments](evidence/19-segments-generated.png) |
| P06 | Director Build / Cuts | Setup 完成后点击 Build | Segment 列表、摘要、Cast / Where、Steer、Cuts / Videos、候选图、Cut 卡 | 生成候选图、编辑 Cut、切换 Videos、Preview | 已进入并生成 | [Build](evidence/20a-build-overview.png)、[Cuts](evidence/23c-cut-cards.png) |
| P07 | Director Build / Videos | Build 中切换 Videos | 每个 Cut 的图片、视频、Prompt、Transcript、Lipsync、模型、状态与生成入口 | 逐 Cut 生成、附加、Preview、Export | 已进入并完成 4/4 | [待生成](evidence/27-videos-pending.png)、[全部完成](evidence/33-all-videos-ready.png) |
| P08 | Director Export | 顶部进入 Export 或「Go Export」 | Stitch & ship、统计、Segment 完成检查、浏览器导出、云端导出、SRT / ASS | 启动导出、下载、返回 Build / 项目 | 已进入并完成两种导出 | [Export](evidence/35a-export-overview.png)、[完成](evidence/38-export-complete.png) |
| P09 | Editor Timeline | 工作区点击 Editor Timeline | 顶栏、Setup、转写、图片库、Scene 时间块、单 Scene 编辑器、Preview、Export | 编辑 / 生成 Scene，预览，进入独立 Export | 已进入并完成 1 个 Scene | [Editor 全页](evidence/44-editor-full-page.png)、[Scene 已附加](evidence/59-editor-video-attached-valid.png) |
| P10 | Timeline Export 加载页 | Editor 点击 Export | Back to project、Export 标题、Refresh、Start export、Loading export room… | 等待导出房间就绪 | 已进入 | [加载中](evidence/54-timeline-export-loading.png) |
| P11 | Timeline Export Ready 页 | 导出房间读到可用产物 | 视频播放器、Ready 100%、What will export、Timeline 摘要、Refresh、Export again、Save video | 保存视频、再次导出、返回项目 | 已进入并下载；下载内容实测复用既有 Director 蒙太奇，不是当前 Row | [Ready 100%](evidence/55-timeline-export-ready.png)、[内容对比](evidence/61-export-content-comparison.jpg) |

## 4. Director 页面内部结构

### 4.1 固定区域

Director 的 Setup、Build 和 Export 共用：

- 返回项目入口；
- 项目标题；
- 音频播放按钮、波形、当前时间 / 总时长；
- 预计 Credits；
- Setup / Build / Export 三阶段导航；
- 项目自动保存状态。

阶段切换主要是同页内容替换，不是独立浏览器页面。

### 4.2 Setup 六步

| 步骤 | 主信息 | 主要输入 | 主要输出 | 证据 |
|---|---|---|---|---|
| S1 Aspect ratio | 画幅选项 | 1:1、16:9、9:16、4:3、3:4 | 项目画幅 | [Aspect](evidence/05-director-aspect-ratio.png) |
| S2 Speed | 生成速度、成本与预估 | Express / Standard | 默认视频档位与总预估 | [Speed](evidence/06-director-speed.png) |
| S3 Plot | 故事方向 | 手工文本或 Generate with AI | 可编辑 Plot | [Plot](evidence/07-director-plot.png)、[AI Plot](evidence/08-director-plot-generated.png) |
| S4 Characters | 角色卡 | 名称、描述、图片 Prompt、Add / Remove / 自动生成 | 角色集合 | [Characters 页面](evidence/11-director-characters.png)、[操作日志](evidence/interaction-observations.md)、[脱敏结构](evidence/project-schema-sanitized.json) |
| S5 Environments | 环境卡 | 名称、描述、图片、Add / Remove / 自动生成 | 环境集合及图片 | [Environments](evidence/interaction-observations.md) |
| S6 Segments | 故事节拍规划 | Create segments with AI、标题、摘要、Cut 描述 | 带时间范围的 Segment 与 Cut 描述列表 | [Segments](evidence/19-segments-generated.png) |

### 4.3 Build

Build 不是传统 Timeline。它以 Segment 为容器：

```text
Segment
├── 标题、时间范围、摘要
├── Cast / Where
├── Image steer
├── Cuts
│   ├── Candidate images
│   └── Selected Cut cards
└── Videos
    └── 每个 Cut 一行生成状态
```

Cuts 页签负责图片、Prompt、时长和顺序；Videos 页签负责将每个 Cut 的图片、Prompt 和对应音频片段生成视频。证据：[Cuts](evidence/23c-cut-cards.png)、[Videos](evidence/27-videos-pending.png)。

### 4.4 Export

Export 页面以 Segment 完成度组织内容，不再显示逐帧 Timeline。页面提供：

- Browser export / Export and Download；
- Cloud export；
- SRT、ASS；
- 导出进度覆盖层；
- 完成后视频预览与下载。

页面未出现导出画幅、分辨率、帧率、码率、编码器、封装格式或水印设置区。

## 5. Editor Timeline 页面内部结构

### 5.1 页面纵向分区

| 区域 | 内容 | 收起 / 展开 | 证据 |
|---|---|---|---|
| Header | Back projects、标题、Editor、画幅、播放、波形、时间、Saved、Delete | 固定顶栏 | [Editor 上部](evidence/44-editor-full-upper.png) |
| Export banner | 已有导出时显示 Export ready / Open export | 条件显示 | [Editor 全页](evidence/44-editor-full-page.png) |
| Setup | 画幅、默认 Lipsync 模型、默认 Scene 模型 | 可折叠 | [Editor 全页](evidence/44-editor-full-page.png) |
| Audio transcription | Re-transcribe、Download、Download SRT、转写文本 | 可折叠 | [Editor 全页](evidence/44-editor-full-page.png) |
| Image library | 项目图片、Upload image、AI 图片生成 | 可折叠 | [Editor 全页](evidence/44-editor-full-page.png) |
| Timeline | Scene 数、时间块、单条详情与局部播放 | 主工作区 | [Timeline 详情](evidence/44-editor-full-page.png) |
| Scene editor | Lipsync / Scene、Prompt、First / Last image、模型、Generate | 随时间块展开 | [Scene 类型](evidence/45-editor-lipsync-scene.png) |
| Footer actions | Preview、Export | 素材就绪后启用 | [已附加](evidence/59-editor-video-attached-valid.png) |

### 5.2 Timeline 结构

本次只观察到：顶部全局音频波形、1 个 Scene 时间块、Scene 详情中的局部播放滑杆、Transcript 和附加的视频。没有观察到独立 Audio 轨、Beat Marker 轨、Video Clip 轨或 Transition 轨。

因此复现页面时，应把当前产品形态理解为「基于时间段的 Scene 列表编辑器」，而不是「可自由叠层的多轨 NLE」。

### 5.3 Timeline Export

独立 Export 页面使用全站外壳，不再显示 Editor 配置。完成态布局为：

- 左：导出视频播放器、Ready 100%、Save video；
- 右上：What will export，显示 Duration、Scenes、Gaps、Audio；
- 右下：Timeline，列出场景类型和时间范围；
- 顶部：Refresh、Export again、Save video、Back to project。

本次页面摘要声称将导出 1 个 Lipsync Scene，但 Save video 下载内容与先前 Director 四镜头蒙太奇一致，与当前 Timeline Row 不同。Editor 页在 Row 生成前就有 `Export ready` banner，因此该页需按“项目级导出房间”理解，不能仅凭页面标题假定已用当前 Row 重建。

证据：[Timeline Export Ready](evidence/55-timeline-export-ready.png)、[导出内容对比](evidence/61-export-content-comparison.jpg)。

## 6. 弹窗、覆盖层和菜单清单

| 编号 | 名称 / 触发点 | 类型 | 内容与操作 | 关闭 / 完成结果 | 验证状态 | 证据 |
|---|---|---|---|---|---|---|
| M01 | Transcript / Transcribe | 模态弹窗 | 全文、词数、时长、Edit、Close | 关闭回工作区；Edit 进入逐词编辑 | 已打开 | [Transcript](evidence/09-transcript-modal.png) |
| M02 | Transcript Edit | 同一弹窗编辑态 | 每词输入框、单词删除、Done editing | 保存后回查看态 | 已编辑 | [逐词编辑](evidence/10-transcript-edit.png) |
| M03 | Regenerate characters? | 确认弹窗 | 提示将移除既有角色；Cancel / Regenerate | 本次 Cancel，未覆盖角色 | 已打开并取消 | [真实操作日志](evidence/interaction-observations.md) |
| M04 | Image lightbox | 图片覆盖层 | 放大环境图 | 关闭回环境卡 | 已打开 | [Lightbox](evidence/14-image-lightbox.png) |
| M05 | Chapter Images / Library | 选图弹窗 | Library、Generate、Add；Cancel / Use image | Use image 写入当前图片槽 | 已打开并选图 | [Library](evidence/15b-image-picker-clear.png) |
| M06 | Chapter Images / Generate | 选图弹窗页签 | 参考图、描述、Standard / Premium、Generate | 生成后进入资产库；本次未提交任务 | 控件已核对 | [Generate](evidence/17-image-picker-generate.png) |
| M07 | Chapter Images / Add | 选图弹窗页签 | 文件、粘贴、图片 URL；PNG / JPG / WebP，最大 12 MB | 添加到图片库；本次未提交 | 控件已核对 | [Add](evidence/16-image-picker-add.png) |
| M08 | Who and where is in this scene? | 生成前复核弹窗 | Cast、Where、Do not show again、Cancel、生成 4 张图 | 确认后启动候选图生成 | 已确认 | [复核](evidence/21-image-generation-review.png) |
| M09 | Preview failed | 错误弹窗 | 无视频提示；Retry / Close | 重试或返回生成视频 | 已触发 | [预览失败](evidence/interaction-observations.md) |
| M10 | Your cuts are ready | 下一步弹窗 | Review cuts / Create videos | 返回 Cuts 或进入 Videos | 已打开 | [下一步](evidence/26-next-step-create-videos.png) |
| M11 | Attach from Generations | 选择器弹窗 | 浏览已完成的匹配视频 | 选中后附加；本次无匹配项 | 已打开，未附加 | [Attach](evidence/28-videos-onboarding-attach.png) |
| M12 | Express / Standard 说明 | 信息弹窗 | 速度、成本、脸部与 Lipsync 差异 | 关闭后继续选择模型 | 已打开 | [模型说明](evidence/29-standard-info-generating.png) |
| M13 | Director Preview | 视频弹窗 | 部分或完整 Blob 视频、原生播放控制 | Close 回 Build | 已打开 | [单条成功](evidence/30-one-video-generated.png)、[部分](evidence/31-partial-preview.png)、[完整](evidence/34-complete-preview.png) |
| M14 | Cloud Exporting | 进度弹窗 | 百分比、Encoding / Waiting、OK | OK 可关闭，任务后台继续 | 已观察 3% 与 74% | [排队](evidence/36-cloud-export-queued.png)、[等待](evidence/37-cloud-export-progress.png) |
| M15 | Export complete | 完成弹窗 | 完整视频、Download video、Download SRT、Close | 下载或关闭 | 已完成 | [完成](evidence/38-export-complete.png) |
| M16 | Browser export progress | 进度覆盖层 | Loading visual sources、百分比、Cancel export | 成功进入完成弹窗；取消结果未验证 | 已完成，未取消 | [浏览器导出](evidence/40-browser-export-progress.png) |
| M17 | Timeline First / Last image picker | 选图弹窗 | Chapter Images 的 Library / Generate / Add | Use this image 写入 Scene | 已用于首帧 | [首帧选图](evidence/47-editor-first-image-picker.png) |
| M18 | Generation cost confirmation | 费用确认弹窗 | 预计 Credits、Do not ask again、Cancel、Generate | Generate 创建 Scene 任务 | 已确认 | [费用确认](evidence/48-editor-cost-confirm.png) |
| M19 | Timeline Preview | 模态弹窗 | Building preview、合成进度；完成后显示视频 | Close 返回 Editor | 已完成 | [构建中](evidence/52-editor-preview-building.png)、[完成](evidence/53-editor-preview-ready.png) |
| M20 | Account menu | 下拉菜单 | Credits、Buy credits、换算与最低购买、Profile、Settings、Sign out | 点击头像或页面外关闭 | 已打开；敏感信息已脱敏 | [账号菜单](evidence/57-account-menu-redacted.png) |
| M21 | Create menu | 下拉菜单 | Music Video、Music、Video、Animated movie、Story | 选择产品或点击外部关闭 | 已打开 | [Create 菜单](evidence/58-create-menu.png) |
| M22 | Delete confirmation | 确认弹窗 | 确认删除或取消 | 本次取消，项目保留 | 已打开并取消；无独立截图 | — |

本次没有观察到从页面侧边滑入的 Drawer；可感知的覆盖层均表现为居中模态弹窗、图片 Lightbox 或顶部下拉菜单。

## 7. 页面状态与入口约束

- Director 的 Build 在 Segment 规划完成前不可进入。
- Cuts 尚无任何视频时，Preview 可以点击，但会进入错误弹窗。
- 至少 1 个 Cut 视频成功后，Director Preview 可用；4/4 后显示 All videos ready。
- Editor Timeline 未设置首帧时，Lipsync Generate 原位报错，不创建任务。
- Editor Scene 视频尚未附加时，Preview / Export 不可用；附加成功后启用。
- Timeline Export 初始有房间加载态，读到可用产物后显示 Ready 100% 和 Save video；本次产物内容是既有 Director 导出，所以 Ready 不等于已为当前 Row 重建。
- Buy credits、Sign out、确认删除会改变外部或会话状态，本次没有执行最终动作。

## 8. 未进入页面

以下页面只看到了入口，没有进入，不能据入口文案推断其内部能力：Profile、Settings、付款页、登录 / 注册 / 验证码、Create 菜单中的 Music / Video / Animated movie / Story，以及左侧其他 Tools / Browse 页面。
