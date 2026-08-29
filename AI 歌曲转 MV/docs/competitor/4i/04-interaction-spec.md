# 4i Music Video 交互规格

## 1. 记录规则

本规格按实际可见控件记录点击前提、点击结果和状态变化，用于复现交互，不对产品做评价。

| 标记 | 含义 |
|---|---|
| 已执行 | 本次真实点击并观察到结果 |
| 已执行并取消 | 已打开会产生覆盖、删除等结果的确认层，但选择取消 |
| 界面可见 | 控件真实存在，未执行最终动作 |
| 条件禁用 | 控件存在，但在当前状态不可点击 |
| 未观察 | 对应控件或状态在本次流程未出现 |

以下「保存」指页面出现 Saving… / Saved 且观察到项目自动保存行为，不代表每次小操作都单独发出请求。

## 2. 全局外壳与项目列表

| 控件 | 前提 | 点击 / 操作后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 左侧「Create Music Video」 | 已登录 | 进入 Music Video 项目列表 / 新建入口 | 读取项目列表 | 已执行 | [项目列表](evidence/01-project-list-exported.png) |
| 项目卡 | 列表存在项目 | 打开对应项目工作区 | 恢复项目保存的模式与数据 | 已执行 | [项目列表](evidence/01-project-list-exported.png) |
| 「New project」 | 在项目列表 | 切换到音频上传页 | 不立即创建项目 | 已执行 | [上传页](evidence/02-new-project-upload.png) |
| 项目卡「Download」 | 项目状态为 Exported | 下载已导出视频 | 本次 MP4 从 Export 完成弹窗下载，未重复点击项目卡入口 | 界面可见 | [项目列表](evidence/01-project-list-exported.png) |
| 项目卡「Delete」 | 项目存在 | 打开删除确认 | 未确认前不删除 | 已执行并取消 | [项目列表](evidence/01-project-list-exported.png) |
| 删除确认「Cancel」 | 删除确认已打开 | 关闭弹窗并保留项目 | 无删除副作用 | 已执行 | — |
| 删除确认的最终删除按钮 | 删除确认已打开 | 预期确认删除项目 | 本次未执行，删除与恢复规则未验证 | 界面可见 | — |
| 顶部搜索框 | 全局页面 | 可输入视频、创作者或标签关键词 | 本次未提交搜索 | 界面可见 | [Timeline Export](evidence/55-timeline-export-ready.png) |
| 顶部「Create」 | 全局页面 | 展开产品创建菜单 | 不切页 | 已执行 | [Create 菜单](evidence/58-create-menu.png) |
| Create 菜单「Music Video」 | 菜单已展开 | 进入 Music Video 创建入口 | 与当前产品入口一致 | 界面可见，未重复进入 | [Create 菜单](evidence/58-create-menu.png) |
| Create 菜单其他项 | 菜单已展开 | 可进入 Music、Video、Animated movie、Story | 本次不进入，内部行为未验证 | 界面可见 | [Create 菜单](evidence/58-create-menu.png) |
| 头像 | 已登录 | 展开账号菜单 | 显示脱敏账号信息、Credits 与账号操作 | 已执行 | [账号菜单](evidence/57-account-menu-redacted.png) |
| 「Buy credits」 | 账号菜单已展开 | 预期进入购买流程 | 本次不进入付款页 | 界面可见 | [账号菜单](evidence/57-account-menu-redacted.png) |
| 「Profile」「Settings」 | 账号菜单已展开 | 预期进入相应账号页 | 本次未进入 | 界面可见 | [账号菜单](evidence/57-account-menu-redacted.png) |
| 「Sign out」 | 账号菜单已展开 | 预期退出当前会话 | 为保留登录态未点击 | 界面可见 | [账号菜单](evidence/57-account-menu-redacted.png) |

账号菜单同时显示 `1 credit = 1 euro` 和最低购买 5 credits；这只是可见购买说明，本次没有付款交互。

## 3. 音频上传与项目工作区

### 3.1 上传

| 控件 / 操作 | 前提 | 行为 | 状态变化 | 结果 | 证据 |
|---|---|---|---|---|---|
| 拖放区 | New project | 拖入音频文件后开始上传 / 分析 | 进入 Analyzing… | 入口可见；本次使用文件选择 | [上传页](evidence/02-new-project-upload.png) |
| 「Upload audio」 | New project | 打开系统文件选择器；选择 WAV 后立即处理 | `待选择 → Analyzing… → 项目工作区` | 已执行 | [上传页](evidence/02-new-project-upload.png)、[分析中](evidence/03-audio-analyzing.png) |
| 音频 URL 输入框 | New project | 接受 URL 文本 | 本次未提交，下载 / 校验行为未验证 | 界面可见 | [上传页](evidence/02-new-project-upload.png) |
| Analyzing 状态 | 已选文件 | 页面等待后自动进入项目，不需要用户再次确认 | 无百分比；约 20 秒完成 | 已观察 | [分析中](evidence/03-audio-analyzing.png) |

文件输入是单文件，接受 `audio/*`、`.mp3`、`.wav`、`.flac`。页面未显示最大音频大小，因此复现时不能从现有证据写死上限。

### 3.2 工作区

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 播放按钮 / 波形 | 音频已上传 | 播放或暂停音频；进度与当前时间同步 | 不修改项目数据 | 已执行 | [工作区](evidence/04-workspace-choice.png) |
| 「Transcribe」 | 尚未生成或需要查看转写 | 启动转写，完成后打开 Transcript 弹窗 | 写入 transcript | 已执行 | [Transcript](evidence/09-transcript-modal.png) |
| 「Replace audio」 | 项目已有音频 | 进入替换音频动作 | 本次未执行，旧 Storyboard 如何迁移未验证 | 界面可见 | [工作区](evidence/04-workspace-choice.png) |
| 「Director Mode」 | 项目音频可用 | 进入 Director 三阶段向导 | 保存工作区模式 | 已执行 | [工作区](evidence/04-workspace-choice.png) |
| 「Editor Timeline」 | 项目音频可用 | 进入 Editor 单页编辑器 | 保存工作区模式 | 已执行 | [工作区](evidence/04-workspace-choice.png) |
| 项目内「Delete」 | 项目存在 | 打开删除确认 | 本次取消 | 已执行并取消 | [工作区](evidence/04-workspace-choice.png) |

### 3.3 Transcript 弹窗

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 「Edit」 | Transcript 查看态 | 全文变为逐词输入项 | 进入编辑态 | 已执行 | [逐词编辑](evidence/10-transcript-edit.png) |
| 单词输入框 | 编辑态 | 修改单个词 | 等待保存 | 已执行查看；未改写最终文本 | [逐词编辑](evidence/10-transcript-edit.png) |
| 单词旁「×」 | 编辑态 | 删除对应单词项 | 改变转写词列表 | 控件已验证；未保留删除结果 | [逐词编辑](evidence/10-transcript-edit.png) |
| 「Done editing」 | 编辑态 | 结束编辑并回到查看态 | 保存转写变更 | 已执行 | [逐词编辑](evidence/10-transcript-edit.png) |
| 「Close」 | 查看态 | 关闭弹窗，回到原页面 | 转写保留 | 已执行 | [Transcript](evidence/09-transcript-modal.png) |
| Transcript 下载 | 转写已生成 | 下载带单词时间戳的 TXT | 产生 `audio.txt` | 已执行 | [TXT](evidence/downloads/audio.txt) |
| 「Download SRT」「Download ASS」 | 转写已生成 | 生成并下载字幕文件 | 产生 SRT / ASS | 已执行 | [SRT](evidence/downloads/audio.srt)、[ASS](evidence/downloads/audio.ass) |

## 4. Director 公共导航

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 返回箭头 / Other projects | Director 内 | 返回项目或项目列表 | 已保存内容保留 | 已执行 | [Director](evidence/33-all-videos-ready.png) |
| 顶部音频播放 | Director 内 | 播放 / 暂停完整音频，波形时间同步 | 不修改项目 | 已执行 | [Aspect](evidence/05-director-aspect-ratio.png) |
| 「Setup」 | Director 任意阶段 | 切换到 Setup 的已保存步骤 | 不清空 Build 数据 | 已执行 | [Aspect](evidence/05-director-aspect-ratio.png) |
| 「Build」 | Segment 尚未生成 | 保持不可进入 | 完成 Segment 后启用 | 条件禁用已观察 | [Segments 生成中](evidence/18-segments-generating.png) |
| 「Build」 | Segment 已生成 | 进入 Cuts / Videos | 读取已规划 Segment | 已执行 | [Build](evidence/20a-build-overview.png) |
| 「Export」 | Build 有可用数据 | 进入 Stitch & ship | 读取 Cut 完成度 | 已执行 | [Export](evidence/35a-export-overview.png) |

## 5. Director Setup 交互

### 5.1 Aspect ratio 与 Speed

| 控件 | 行为 | 持久化 / 后续影响 | 结果 | 证据 |
|---|---|---|---|---|
| `1:1`、`16:9`、`9:16`、`4:3`、`3:4` | 点击即选中一个画幅 | 影响图片 / 视频生成的项目画幅；本次选 16:9 | 已执行 | [画幅](evidence/05-director-aspect-ratio.png) |
| 「Express」 | 选择快速低成本默认档 | 后续单 Cut 仍可改用 Standard | 已核对并用于 3 个 Cut | [Speed](evidence/06-director-speed.png) |
| 「Standard」 | 选择较慢的默认档 | 后续单 Cut 仍可改用 Express | 已核对并用于 1 个 Cut | [Speed](evidence/06-director-speed.png) |

### 5.2 Plot

| 控件 | 前提 | 点击 / 输入后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| Plot 文本框 | 进入 Plot 步骤 | 可直接输入或修改故事方向 | 自动保存 | 已执行查看并保留 AI 文本 | [Plot](evidence/07-director-plot.png) |
| 「Generate with AI」 | 音频可用 | 如无转写先转写，再生成故事摘要并回填 | 异步等待；成功后文本仍可编辑 | 已执行 | [AI Plot](evidence/08-director-plot-generated.png) |

### 5.3 Characters

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 名称 / 描述输入 | 角色卡存在 | 原位编辑角色属性 | 自动保存 | 已执行查看 | [操作日志](evidence/interaction-observations.md)、[脱敏结构](evidence/project-schema-sanitized.json) |
| 「+ Add」/「Add character」 | Characters 步骤 | 新增空白角色卡 | 角色集合增加 | 已执行；随后移除恢复 | [操作日志](evidence/interaction-observations.md) |
| 「Remove」 | 角色卡存在 | 移除当前角色卡 | 角色集合减少 | 已执行于临时空白角色 | [操作日志](evidence/interaction-observations.md) |
| 角色图片 Prompt | 角色卡存在 | 输入角色视觉描述 | 用作生成图片输入 | 界面可见 | [页面](evidence/11-director-characters.png)、[脱敏结构](evidence/project-schema-sanitized.json) |
| 「Create image」 | Prompt / 角色可用 | 启动角色图生成，页面显示价格 | 本次未额外付费执行 | 界面可见 | [操作日志](evidence/interaction-observations.md) |
| 「Make it for me」 | 已有角色 | 打开 Regenerate characters? | 不立即覆盖 | 已执行 | [操作日志](evidence/interaction-observations.md) |
| 确认框「Cancel」 | 重建确认打开 | 关闭确认并保留角色 | 无覆盖 | 已执行并取消 | [操作日志](evidence/interaction-observations.md) |
| 确认框「Regenerate」 | 重建确认打开 | 文案说明会移除现有角色并重建 | 本次未执行，生成结果未知 | 界面可见 | [操作日志](evidence/interaction-observations.md) |

### 5.4 Environments

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 「+ Add」/「Add environment」 | Environments 步骤 | 新增手工环境卡 | 环境集合增加 | 界面可见；未保留新卡 | [环境初始页](evidence/interaction-observations.md) |
| 「Make it for me」 | Plot 已有内容 | 进入 Generating environments…，自动生成环境文本和图片 | 成功写入 2 个环境并扣费 | 已执行 | [生成前](evidence/interaction-observations.md)、[生成后](evidence/interaction-observations.md) |
| 环境名称 / 描述 | 环境卡存在 | 原位编辑 | 自动保存 | 已执行查看 | [环境卡](evidence/interaction-observations.md) |
| 「Regenerate」 | 环境卡存在 | 重新生成该环境图片，按钮显示价格 | 本次未再次付费 | 界面可见 | [环境卡](evidence/interaction-observations.md) |
| 「Remove」 | 环境卡存在 | 移除环境 | 本次未移除正式环境 | 界面可见 | [环境卡](evidence/interaction-observations.md) |
| 「Pick image」 | 环境卡存在 | 打开 Chapter Images | 选图后替换环境图 | 已执行 | [图片选择器](evidence/15b-image-picker-clear.png) |
| 「Maximize」 | 环境有图 | 打开放大 Lightbox | 不修改图片 | 已执行 | [放大图](evidence/14-image-lightbox.png) |

### 5.5 Chapter Images

| 控件 | 前提 | 点击 / 输入后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 「Library」页签 | 弹窗打开 | 展示项目图片和其他项目图片 | 不修改当前槽位 | 已执行 | [Library](evidence/15b-image-picker-clear.png) |
| 图片缩略图 | Library | 选中候选图片 | 只更新弹窗选中态 | 已执行 | [图片选择](evidence/15b-image-picker-clear.png) |
| 「Use image」/「Use this image」 | 已选图片 | 把图片写入当前环境或 Scene 图片槽 | 项目保存 | 已执行 | [Library](evidence/15b-image-picker-clear.png)、[首帧](evidence/47-editor-first-image-picker.png) |
| 「Cancel」/关闭 | 弹窗打开 | 放弃当前选择并返回 | 不写入 | 已执行 | [Library](evidence/15b-image-picker-clear.png) |
| 「Generate」页签 | 弹窗打开 | 切换到 AI 图片生成表单 | 不立即创建任务 | 已执行 | [Generate](evidence/17-image-picker-generate.png) |
| 参考图 | Generate | 可从 Library 选参考图或上传参考图 | 作为编辑条件 | 界面可见 | [Generate](evidence/17-image-picker-generate.png) |
| 描述文本框 | Generate | 输入图片生成 / 编辑指令 | Enter / Shift+Enter 的提交提示可见 | 界面可见 | [Generate](evidence/17-image-picker-generate.png) |
| 「Standard」「Premium」 | Generate | 切换图片模型与价格 | 本次只核对切换，不提交 | 已执行 | [Premium](evidence/17b-image-picker-premium.png) |
| Generate 页「Generate」 | 表单满足 | 创建 AI 图片任务 | 本次未额外付费执行 | 界面可见 | [Generate](evidence/17-image-picker-generate.png) |
| 「Add」页签 | 弹窗打开 | 切换到文件 / URL 添加 | 不立即写入 | 已执行 | [Add](evidence/16-image-picker-add.png) |
| 文件选择 / 拖放 / 粘贴 | Add | 接收 PNG、JPG、WebP，页面写明最大 12 MB | 成功后进入图片库；未提交 | 界面可见 | [Add](evidence/16-image-picker-add.png) |
| 图片 URL 输入 | Add | 输入外部图片 URL | 下载与错误行为未验证 | 界面可见 | [Add](evidence/16-image-picker-add.png) |

### 5.6 Segments

| 控件 | 前提 | 点击 / 输入后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 「Create segments with AI」 | Plot / 角色 / 环境步骤可用 | 进入 Generating…，生成带时间范围的故事段 | 成功后 Build 启用 | 已执行 | [生成中](evidence/18-segments-generating.png)、[完成](evidence/19-segments-generated.png) |
| Segment 标题输入 | 已生成 Segment | 原位编辑标题 | 自动保存 | 已执行查看 | [Segment 编辑](evidence/19b-segment-editor.png) |
| Segment 摘要输入 | 已生成 Segment | 原位编辑摘要 | 自动保存 | 已执行查看 | [Segment 编辑](evidence/19b-segment-editor.png) |
| Cut 描述输入 | 已生成 Cut 描述 | 修改单条镜头计划 | 自动保存 | 已执行查看 | [Segment 编辑](evidence/19b-segment-editor.png) |
| Cut 描述「×」 | 描述存在 | 删除该镜头描述 | 列表减少 | 已执行于临时项 / 后恢复 | [Segment 编辑](evidence/19b-segment-editor.png) |
| 「+ Add cut」 | Segment 已生成 | 追加空白 Cut 描述 | 列表增加 | 已执行，随后删除恢复 | [Segment 编辑](evidence/19b-segment-editor.png) |
| Cast / Where 芯片 | Segment 已生成 | 在 Setup Segment 卡中显示关联角色和环境 | 本次未观察到该处独立编辑弹窗 | 展示项 | [Segment 编辑](evidence/19b-segment-editor.png) |

## 6. Director Build / Cuts 交互

| 控件 | 前提 | 点击 / 输入后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 左侧 Segment 卡 | 有多个或单个 Segment | 选中对应 Segment 并加载右侧 | 本次只有 1 个 Segment | 已执行 | [Build](evidence/20a-build-overview.png) |
| 「Cuts」页签 | Build | 显示候选图与已选 Cut 卡 | 保留 Videos 状态 | 已执行 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Videos」页签 | Build | 显示每个 Cut 的视频任务行 | 保留 Cuts 编辑结果 | 已执行 | [Videos](evidence/27-videos-pending.png) |
| Segment 摘要 | Build | 可原位修改 | 自动保存 | 已执行查看 | [Build](evidence/20a-build-overview.png) |
| Image steer 文本框 | Build | 输入该 Segment 的补充画面指令 | 用于候选图生成 | 界面可见 | [Build](evidence/20a-build-overview.png) |
| 「Generate 4 images」 | 当前 Segment 无候选图 | 先打开 Cast / Where 复核弹窗 | 尚未创建任务 | 已执行 | [复核](evidence/21-image-generation-review.png) |
| Cast / Where 复核开关 | 复核弹窗 | 包含或排除角色 / 环境 | 影响本轮图片上下文 | 已执行核对 | [复核](evidence/21-image-generation-review.png) |
| 「Do not show again」 | 复核弹窗 | 记录以后跳过该复核 | 本次未勾选 | 界面可见 | [复核](evidence/21-image-generation-review.png) |
| 「Cancel」 | 复核弹窗 | 关闭且不生成 | 本轮未使用取消 | 界面可见 | [复核](evidence/21-image-generation-review.png) |
| 「Looks good — generate 4 images」 | 复核完成 | 创建图片任务，显示生成中占位 | 约 20 秒后 4 张图自动成为 Cut | 已执行 | [生成过程日志](evidence/interaction-observations.md)、[结果](evidence/23-cuts-generated.png) |
| 候选图选择 | 有候选图片 | 将图片加入已选 Cuts | 分配顺序与时长 | 已执行 | [结果](evidence/23-cuts-generated.png) |
| Cut Prompt 文本框 | Cut 已选 | 修改镜头描述 | 后续视频生成读取该文本 | 已执行查看 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Return to candidates」 | Cut 已选 | 从时间段移回候选区 | Cut 数减少，其他 Cut 自动重分配时长 | 已执行 | [退回候选](evidence/24-candidate-returned.png) |
| 候选图重新加入 | 图片在候选区 | 追加到 Cut 列表末尾 | 再次自动分配可用时长 | 已执行 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Remove image」 | Cut 有图片 | 清除当前 Cut 图片 | 该 Cut 无法直接生成视频 | 界面可见；未保留移除结果 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Pick image」 | Cut 存在 | 打开 Chapter Images 替换图 | 选中图可能按目标画幅裁切 | 已执行查看 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Maximize」 | Cut 有图片 | 打开大图 | 无保存副作用 | 已执行于环境图；Cut 同类入口可见 | [Cut 卡](evidence/23c-cut-cards.png) |
| 时长「−」 | Cut 时长允许减少 | 每次减少 1 秒 | 释放时长给其他 / 新 Cut | 已执行 | [Cut 卡](evidence/23c-cut-cards.png) |
| 时长「+」 | 仍有可分配时长 | 每次增加 1 秒 | 达到总音频时长后不可再加 | 已执行 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Lipsync」复选框 | Cut 存在 | 开关该 Cut 的口型同步生成要求 | 本次默认开启并保留 | 已执行核对 | [Videos](evidence/33-all-videos-ready.png) |
| 「Move left」「Move right」 | 相邻 Cut 存在 | 调整 Cut 顺序 | Videos 顺序同步 | 已执行核对 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Add cut」 | 总时长未完全分配 | 新增 Cut | 8 秒全部分配时按钮禁用 | 条件禁用已观察 | [Cut 卡](evidence/23c-cut-cards.png) |
| 「Preview」 | 0 个视频 | 打开 Preview failed | 不生成预览 | 已执行 | [失败](evidence/interaction-observations.md) |
| Preview failed「Retry」 | 无视频错误弹窗 | 再次尝试预览；前提仍不满足时仍失败 | 本次未反复重试 | 界面可见 | [失败](evidence/interaction-observations.md) |
| Preview failed「Close」 | 错误弹窗 | 关闭并返回 Build | 随后出现下一步引导 | 已执行 | [失败](evidence/interaction-observations.md) |
| 「Review cuts」 | Your cuts are ready | 返回 Cuts | 不创建视频任务 | 界面可见 | [引导](evidence/26-next-step-create-videos.png) |
| 「Create videos」 | Your cuts are ready | 切到 Videos | 首次进入显示视频生成说明 | 已执行 | [引导](evidence/26-next-step-create-videos.png) |

## 7. Director Build / Videos 交互

| 控件 | 前提 | 点击 / 输入后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 视频说明「Got it — generate videos」 | 首次进入 Videos | 关闭说明，显示逐 Cut 操作 | 可勾选以后不显示 | 已执行 | [Videos 引导](evidence/27-videos-pending.png) |
| Prompt 文本框 | Cut 行存在 | 修改该视频任务提示词 | 后续生成读取 | 已执行查看 | [全部完成](evidence/33-all-videos-ready.png) |
| Lipsync 复选框 | Cut 行存在 | 切换口型同步 | 与 Cut 状态同步 | 已执行核对 | [全部完成](evidence/33-all-videos-ready.png) |
| Express 价格按钮 | Cut 为 Pending 或可重生成 | 点击即启动该 Cut 的 Express 任务 | 显示 Generating video…；成功后扣费 | 已执行于 3 个 Cut | [并行生成](evidence/32-three-videos-generating.png) |
| Standard 价格按钮 | Cut 为 Pending 或可重生成 | 点击即启动 Standard 任务 | 显示 Enhancing with Standard…；成功后扣费 | 已执行于 1 个 Cut | [Standard](evidence/29-standard-info-generating.png) |
| 模型信息图标 | 模型入口旁 | 打开 Express / Standard 差异说明 | 不创建任务 | 已执行 | [模型说明](evidence/29-standard-info-generating.png) |
| 「Generate video」 | 当前 Cut 尚无视频 | 以当前选定档位生成 | 行进入异步任务状态 | 已执行；具体触发与价格按钮合并呈现 | [待生成](evidence/27-videos-pending.png) |
| 「Edit」 | 当前 Cut 无附加视频 | 打开 Attach from Generations | 本次无匹配 P-Video 16:9 素材 | 已执行 | [Attach](evidence/28-videos-onboarding-attach.png) |
| Attach 选择项 | 有匹配历史生成 | 把选中视频附加到 Cut | 本次无候选，未验证完成行为 | 条件未满足 | [Attach](evidence/28-videos-onboarding-attach.png) |
| Rendered video 播放 | Cut 已生成 | 播放 / 暂停该 2 秒视频；行内视频可循环 | 不修改项目 | 已执行 | [全部完成](evidence/33-all-videos-ready.png) |
| 已生成行再次点击模型 / Generate | Cut 已成功 | 可启动重生成 | 本次未二次付费，覆盖与版本规则未知 | 界面可见 | [全部完成](evidence/33-all-videos-ready.png) |
| 「Preview」 | 至少 1 个 Cut 成功 | 构建 8 秒预览并打开视频弹窗 | 允许部分成功预览 | 已执行 | [单条成功](evidence/30-one-video-generated.png)、[部分预览](evidence/31-partial-preview.png) |
| 「Rebuild preview」 | 已有预览 | 按文案重新以当前 Cut 构建 | 预期替换当前预览 Blob；本次未单独确认重建结果 | 界面可见 | [完整预览](evidence/34-complete-preview.png) |
| 「Close」 | Preview 弹窗 | 关闭弹窗回 Videos | 预览结果保留于当前会话 | 已执行 | [完整预览](evidence/34-complete-preview.png) |
| 「Go Export」「Export now」 | 视频全部成功或导出入口可用 | 进入 Director Export | 不自动开始导出 | 已执行 | [全部完成](evidence/33-all-videos-ready.png) |

## 8. Director Export 交互

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 「Export and Download · 4 cuts」 | Export 页面 | 浏览器加载视觉源并合成 | 显示百分比和 Cancel export；成功后进入下载完成态 | 已执行并完成；未单独保留该路径的二进制文件 | [浏览器进度](evidence/40-browser-export-progress.png)、[完成态](evidence/38-export-complete.png) |
| 「Cancel export」 | 浏览器合成中 | 预期终止本地合成 | 本次未点击，取消后状态未知 | 界面可见 | [浏览器进度](evidence/40-browser-export-progress.png) |
| 「Cloud export」 | Export 页面 | 创建云端导出任务 | 从 3% 排队 / 编码进入等待，后台持续 | 已执行并完成 | [排队](evidence/36-cloud-export-queued.png)、[等待](evidence/37-cloud-export-progress.png) |
| 云端进度「OK」 | 云端任务处理中 | 按按钮语义关闭进度弹窗 | 页面明确说明任务在后台继续；本次未单独保留点击后的截图 | 界面可见 | [排队](evidence/36-cloud-export-queued.png) |
| 「Download video」 | 导出完成 | 下载最终 MP4 | 产生 8 秒视频文件 | 已执行 | [完成](evidence/38-export-complete.png)、[MP4](evidence/downloads/audio-cloud.mp4) |
| 「Download SRT」 | Transcript 存在 | 下载 SRT 字幕 | 产生 `.srt` 文件 | 已执行 | [SRT](evidence/downloads/audio.srt) |
| 「Download ASS」 | Transcript 存在 | 下载 ASS 字幕 | 产生 `.ass` 文件 | 已执行 | [ASS](evidence/downloads/audio.ass) |
| 完成弹窗「Close」 | 导出完成 | 关闭弹窗，回 Export 页面 | 导出 URL 保留在项目 | 已执行 | [完成](evidence/38-export-complete.png) |

导出页面没有可点击的分辨率、帧率、码率、编码器、文件格式或水印参数。画幅沿用项目 Setup，不在此处二次选择。

## 9. Editor Timeline 交互

### 9.1 Header、Setup 与资产

| 控件 | 前提 | 点击 / 输入后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 「Back projects」 | Editor | 返回项目列表 | 保存中的变更完成后保留 | 已执行核对 | [Editor](evidence/44-editor-full-upper.png) |
| 顶部播放 / 波形 | Editor | 播放完整音频并定位 | 只影响播放状态 | 已执行 | [Editor](evidence/44-editor-full-upper.png) |
| 顶部画幅按钮 | Editor | 在 1:1、16:9、9:16、4:3、3:4 间选择 | 影响后续 Scene 生成 | 已执行核对；保留 16:9 | [Editor 全页](evidence/44-editor-full-page.png) |
| Setup 折叠按钮 | Editor | 展开 / 收起 Setup | 只改变 UI 展示 | 已执行核对 | [Editor 全页](evidence/44-editor-full-page.png) |
| 默认 Lipsync 模型 | Setup | 选 Express / Standard / Premium | 作为新 Lipsync Scene 默认档位 | 已执行核对 | [Editor 全页](evidence/44-editor-full-page.png) |
| 默认 Scene 模型 | Setup | 选 Express / Standard / Premium | 作为新 Scene 默认档位 | 已执行核对 | [Editor 全页](evidence/44-editor-full-page.png) |
| 「Re-transcribe」 | 已有转写 | 重新发起转写 | 本次未执行，是否影响既有 Scene 未验证 | 界面可见 | [Editor 全页](evidence/44-editor-full-page.png) |
| 「Download」 | 已有转写 | 下载原始转写文本 | 已取得 TXT | 已执行 | [TXT](evidence/downloads/audio.txt) |
| 「Download SRT」 | 已有转写 | 下载 SRT | 已取得 SRT | 已执行 | [SRT](evidence/downloads/audio.srt) |
| 「Upload image」 | Image library | 打开多文件图片选择 | 本次未上传外部图片 | 界面可见 | [Editor 全页](evidence/44-editor-full-page.png) |
| AI image generate | Image library | 打开带参考图、描述和模型的生成交互 | 本次未从 Editor 额外生成 | 界面可见 | [Editor 全页](evidence/44-editor-full-page.png) |
| 图片缩略图 | Image library | 作为 Scene First / Last 图片候选 | 需从图片槽选择器确认 | 已执行用于 First image | [首帧选择](evidence/47-editor-first-image-picker.png) |

### 9.2 Timeline 时间段与 Scene 字段

| 控件 | 前提 | 点击 / 输入后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| Scene 时间块 | Timeline 有 Scene | 选中并展开该时间段详情 | 本次只有 1 条 0:00–0:08 | 已执行 | [Timeline](evidence/44-editor-full-page.png) |
| 局部播放按钮 | Scene 展开 | 只播放该时间段 | 滑杆范围 0–8 秒、步进约 0.05 秒 | 已执行核对 | [Timeline](evidence/44-editor-full-page.png) |
| 局部时间滑杆 | Scene 展开 | 在当前 Scene 内定位 | 不修改 Scene 时间范围 | 已执行核对 | [Timeline](evidence/44-editor-full-page.png) |
| 「Lipsync」 | Scene 类型未定或可切换 | 把该时间段设为 Lipsync | 展示 Prompt、First / Last、Lipsync 模型、Transcript | 已执行 | [类型选择](evidence/45-editor-lipsync-scene.png) |
| 「Scene」 | 同上 | 把时间段设为普通 Scene | 展示相同图像槽和 Scene 模型 | 已执行切换核对 | [类型选择](evidence/45-editor-lipsync-scene.png) |
| Prompt 文本框 | 类型已选 | 输入该 Scene 的动作描述 | 进入生成输入 | 已执行输入 / 核对 | [类型选择](evidence/45-editor-lipsync-scene.png) |
| 「First」/首帧「Edit」 | 类型已选 | 打开 Chapter Images | Use this image 后写入首帧 | 已执行 | [首帧选择](evidence/47-editor-first-image-picker.png) |
| 「Last」/末帧「Edit」 | 类型已选 | 打开 Chapter Images | 可选末帧；本次未设置 | 界面可见 | [类型选择](evidence/45-editor-lipsync-scene.png) |
| Scene 行 Express / Standard / Premium | 类型已选 | 切换本条 Scene 模型与费用 | 本次 Lipsync 使用 Express | 已执行 | [费用确认](evidence/48-editor-cost-confirm.png) |
| 「Generate」且无 First image | Lipsync 已选、首帧为空 | 不创建任务，原位显示 start image required | 用户需先选图 | 已执行 | [校验错误](evidence/interaction-observations.md) |
| 「Generate」且输入完整 | 首帧与模型已设置 | 打开费用确认 | 尚未创建任务 | 已执行 | [费用确认](evidence/48-editor-cost-confirm.png) |
| 「Do not ask again」 | 费用确认 | 记录以后跳过确认 | 本次未勾选 | 界面可见 | [费用确认](evidence/48-editor-cost-confirm.png) |
| 费用确认「Cancel」 | 费用确认 | 关闭且不创建任务 | 本次未选取消 | 界面可见 | [费用确认](evidence/48-editor-cost-confirm.png) |
| 费用确认「Generate」 | 费用确认 | 本次创建 8 秒 Lipsync 任务 | 进入 Generating… / starting；成功后扣费 | 已执行 | [生成中](evidence/interaction-observations.md) |
| 「Browse finished videos」 | Job 完成但未附加 | 打开已完成视频选择器 | 本次等待数秒后自动附加，未手工 Browse | 界面可见 | [未附加中间态](evidence/interaction-observations.md) |
| 「Regenerate」 | Scene 已附加视频 | 再次生成该 Scene | 本次未点击，旧版本 / 扣费规则未知 | 界面可见 | [已附加](evidence/59-editor-video-attached-valid.png) |
| 「Download」 | Scene 已附加视频 | 下载单 Scene 视频 | 本次未单独下载 | 界面可见 | [已附加](evidence/59-editor-video-attached-valid.png) |
| 「Browse」 | Scene 已附加视频 | 从完成视频库替换 / 附加 | 本次未替换 | 界面可见 | [已附加](evidence/59-editor-video-attached-valid.png) |

### 9.3 Timeline Preview

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| 「Preview」 | Scene 视频已附加 | 打开 Building preview…，本地拼接 Scene 与音频 | 生成 8 秒 Blob 视频 | 已执行并完成 | [构建中](evidence/52-editor-preview-building.png)、[完成](evidence/53-editor-preview-ready.png) |
| 「Preview」 | 视频未附加 | 按钮不可用 | 等待 video URL 写回 | 条件禁用已观察 | [未附加](evidence/interaction-observations.md) |
| Preview「Close」 | 构建中或完成 | 关闭弹窗回 Editor | 不删除 Scene 视频 | 已执行 | [完成](evidence/53-editor-preview-ready.png) |
| Preview 原生播放 / 全屏 | 预览完成 | 播放、定位、调音量、全屏 | 只影响播放 | 已执行 | [完成](evidence/53-editor-preview-ready.png) |
| Preview 弹窗「Export」 | 预览流程 | 进入导出 | 本次从 Editor 主按钮进入 Export | 界面可见 | [构建中](evidence/52-editor-preview-building.png) |

### 9.4 Timeline Export

| 控件 | 前提 | 点击后的行为 | 状态与副作用 | 结果 | 证据 |
|---|---|---|---|---|---|
| Editor「Export」 | Scene 视频已附加 | 跳转独立 Export 页面 | 初始显示 Loading export room… | 已执行 | [加载中](evidence/54-timeline-export-loading.png) |
| Editor「Export」 | 视频未附加 | 按钮不可用 | 等待附加完成 | 条件禁用已观察 | [未附加](evidence/interaction-observations.md) |
| 「Refresh」 | Export 页面 | 刷新导出房间状态 | 加载中存在；完成页仍保留 | 界面可见 | [加载中](evidence/54-timeline-export-loading.png)、[完成](evidence/55-timeline-export-ready.png) |
| 「Start export」 | Export 房间加载中 | 加载阶段为禁用状态 | 本次未观察到该按钮转为可用，也未点击；页面随后自动读到 Ready 的既有导出资产 | 条件禁用已观察；新建 Timeline 导出任务未验证 | [加载中](evidence/54-timeline-export-loading.png)、[内容对比](evidence/61-export-content-comparison.jpg) |
| 「Save video」 | Ready 100% | 下载导出房间当前指向的视频 | 产生 MP4；实测 H.264 1280×720 / 30 fps、AAC 双声道 48 kHz、8.064 秒，但画面是既有 Director 蒙太奇，不是当前 Timeline Row | 已执行；旧内容复用已观察 | [完成](evidence/55-timeline-export-ready.png)、[页面下载](evidence/downloads/audio.mp4)、[当前 Row](evidence/downloads/audio-timeline-row.mp4)、[对比](evidence/61-export-content-comparison.jpg) |
| 「Export again」 | Ready 100% | 重新发起 Timeline 导出 | 本次未执行，版本与覆盖规则未知 | 界面可见 | [完成](evidence/55-timeline-export-ready.png) |
| 「Back to project」 | Export 页面 | 返回 Editor 项目 | 已导出状态保留 | 界面可见 | [完成](evidence/55-timeline-export-ready.png) |
| 导出视频原生控制 | Ready 100% | 播放、定位、音量、全屏 | 只影响播放 | 播放器已观察；抽帧来自下载文件 | [完成](evidence/55-timeline-export-ready.png)、[抽帧](evidence/56-timeline-export-frame.jpg) |

## 10. 关键条件、错误与重试语义

| 场景 | 触发条件 | 页面行为 | 用户恢复动作 | 验证状态 |
|---|---|---|---|---|
| 音频分析中 | 选中有效文件 | Analyzing…，无百分比 | 等待自动完成 | 已验证 |
| Segment 规划中 | 点击 Create segments with AI | Generating…，Build 暂不可用 | 等待 | 已验证 |
| 图片生成中 | 确认 Generate 4 images | 候选占位 / 生成状态 | 等待 | 已验证 |
| 0 个视频 Preview | 点击 Preview | Preview failed | Retry 或 Close 后去 Videos | 已验证 |
| 部分成功 | 1/4 Cut 成功 | 可先 Preview，剩余 Cut 继续独立生成 | 逐条生成 / 并行生成 | 已验证 |
| 视频生成中 | 单 Cut 点击模型档位 | 该行显示 Generating / Enhancing | 等待轮询；其他行可独立操作 | 已验证 |
| Timeline 输入不完整 | Lipsync 无首帧点击 Generate | 原位校验错误，不创建任务 | 选择 First image 后重试 | 已验证 |
| Job 成功但未附加 | Timeline Job 先完成 | 显示 finished but not attached 与 Browse | 可 Browse；本次自动恢复 | 已验证 |
| Preview 构建中 | Timeline 点击 Preview | Building preview / Stitching | 等待或 Close | 已验证 |
| 云端导出中 | Cloud export | 百分比与 Waiting | 可 OK 关闭，后台继续 | 已验证 |
| 导出完成 | 服务端或浏览器成功 | Complete / Ready 100% | 下载、保存、关闭或再次导出 | 已验证 |
| AI 远端 failed | 远端任务失败 | 本次未触发 | Retry 文案与扣费回滚未知 | 未观察 |
| 上传失败 | 格式、大小、损坏或网络错误 | 本次未触发 | 错误与重试未知 | 未观察 |

## 11. 复现时必须保持的交互约束

1. 上传后自动分析并创建项目，不要求额外提交；分析态不显示百分比。
2. Director 必须先完成 Segment 规划，Build 才可进入。
3. 规划层的 Cut 描述数量与 Build 的实际 Cut 数可以不同；本次是 6 条计划、4 个实际 Cut。
4. Cut 被退回候选区后，系统自动重分配剩余时长，保证总时长继续覆盖音频。
5. 每个 Cut 独立生成、独立状态、独立模型和独立费用；一条成功不阻塞其他条并行。
6. Director Preview 的最低条件是至少 1 个 Cut 视频，不要求全部成功。
7. Editor Timeline 的 Lipsync 必须有 First image；缺失时应在前端原位阻止任务创建。
8. Timeline Job 成功与视频附加是两个状态；产品需要表达“已完成但尚未附加”的中间态，并允许自动恢复或 Browse。
9. 项目编辑使用 Saving… / Saved 反馈；生成中的局部控件禁用，但页面其他区域可继续查看。
10. Director 导出提供浏览器与云端两条路径；Timeline 使用独立 Export 房间和 Ready 100% 完成页。
11. Timeline Ready 是项目级导出资产可用状态，不自动保证内容与当前 Row 一致；本次 Save video 复用了既有 Director 内容。
12. 付款、Sign out、确认删除和二次付费重生成不应在缺少明确用户确认时自动执行。
13. 未观察到的 BPM、音乐 Beat Marker、传统多轨、Transition 和导出参数控件，不应凭概念补进复现范围。
