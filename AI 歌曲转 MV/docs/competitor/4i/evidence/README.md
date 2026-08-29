# 4i Music Video 证据索引

## 采集边界

- 采集日期：2026-08-28（Asia/Shanghai）。
- 操作方式：由 EgoLite 在独立任务空间中操作真实 Chromium 页面，沿“上传音乐 → 分析 → Director / Editor → 生成 → Preview → Export”路径采集。
- 输入：8 秒合成 WAV，页面显示文件大小约 689 KB。
- 会话：复用了已登录状态，没有触发验证码或付款。
- 脱敏：邮箱、账号标识、Cookie、任务 Token、存储签名 URL 和内部数据库标识均未保存。

## 截图分组

| 范围 | 内容 |
|---|---|
| `01–04` | 项目列表、新建/上传、音频分析中、工作区模式选择 |
| `05–10` | Director Setup 画幅/速度/剧情，转录结果与逐词编辑 |
| `11–17b` | 角色、环境、环境图、图片灯箱及 Library / Generate / Add 选图器 |
| `18–24` | Segment/15-second beats 生成、候选分镜图、选中分镜、返回候选及时长重分配 |
| `25–34` | 无视频预览失败、生成引导、Pending/部分完成/全部完成及 Preview |
| `35–40` | Director Export 页、云端排队/进度/完成、浏览器导出与导出帧 |
| `41–51` | Editor Timeline 全页、模型、图库、Lipsync/Scene 表单、成本确认及操作过程的原始截屏；其中部分瞬时状态截图位置失效，见下方“截图质量说明” |
| `52–56` | Editor 本地 Preview、Timeline Export 加载/完成页和导出帧 |
| `57–58` | 已脱敏账户/积分菜单与全站 Create 菜单 |
| `59–61` | 重新取证的 Timeline 已附加状态、Editor 全页及 Director / Timeline 下载 / 当前 Row 内容对比 |

## 可下载证据

| 文件 | 来源 | 用途 |
|---|---|---|
| `downloads/audio-cloud.mp4` | Director Export 完成后下载 | 验证 Director 成片容器、编码、画面尺寸与时长 |
| `downloads/audio.mp4` | Editor Timeline Export 的 Save video | 验证该页面下载样本的参数；内容是旧 Director 蒙太奇，不是当前 Row 成片 |
| `downloads/audio-timeline-row.mp4` | 从当前 Timeline Row 的项目媒体地址读取 | 对比 Timeline Export 页下载文件是否真的来自当前 Row |
| `downloads/audio.srt` | Director Export 字幕下载 | 验证 SRT 输出 |
| `downloads/audio.ass` | Director Export 字幕下载 | 验证 ASS 样式与分段 |
| `downloads/audio.txt` | Transcript 下载 | 验证逐词时间戳 |

## 结构化证据

- [`network-observations.md`](network-observations.md)：脱敏后的真实 API 路径与触发行为。
- [`project-schema-sanitized.json`](project-schema-sanitized.json)：从项目读回结构归纳的脱敏样本。
- [`export-metadata.md`](export-metadata.md)：Director 成片、Timeline Export 页下载及当前 Timeline Row 媒体的 `ffprobe`、SHA-256 和内容对比。
- [`interaction-observations.md`](interaction-observations.md)：瞬时页面状态的浏览器操作日志，以及失效/遮挡截图的证据边界。

## 证据限制

- 没有在 UI 中观察到 BPM、音乐 Beat Marker、Mood、Energy 数值或专用 Transition 轨道；这些项目不根据营销文案补写。
- 上传页的 DOM `accept` 实测为 `audio/*,.mp3,.wav,.flac`；页面没有显示最大文件体积，未用超大文件做破坏性边界测试。
- 点击项目 Delete 会进入浏览器控制的确认流程；本次明确取消，没有删除项目。

## 截图质量说明

以下原始截图保留用于审计采集过程，但不应单独用来证明其文件名所描述的状态：

- `44-editor-timeline-detail.png` 为空白区域；Timeline 结构使用 `44-editor-full-page.png` 或 `60-editor-attached-full-valid.png`。
- `46`、`49`、`50`、`51` 只截到 Editor 顶部，没有显示校验错误、生成中、完成未附加和已附加文案；已附加持久态使用重新取证的 `59` / `60`。
- `25-preview-failed-no-video.png` 实际截到「Your cuts are ready」，与 `26` 重复，不作为 Preview failed 弹窗的视觉证据。
- `12`、`13`、`13b`、`15` 受「Regenerate characters?」确认层遮挡；环境状态以项目读回、网络路由和操作日志为准。
- `11b`、`42`、`43` 为滚动位置失效/空白截屏，不在主文档中引用。

## 导出内容异常的事实边界

Timeline Export 页面确实显示 `Ready 100%`、1 个 Lipsync Scene 并提供 `Save video`，但该按钮下载的 `audio.mp4` 在每 2 秒抽帧上与既有 Director 四镜头成片一致，不是当前 Timeline Row 中持续 8 秒的歌手 Lipsync 视频。对比见 [`61-export-content-comparison.jpg`](61-export-content-comparison.jpg)。因此，`Ready 100%` 只能证明导出页有可下载资产，不能证明该资产已按当前 Timeline Row 重建。
