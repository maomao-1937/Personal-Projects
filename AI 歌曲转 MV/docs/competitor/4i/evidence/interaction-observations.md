# 瞬时交互观察日志

## 用途

本日志补足“状态确实在 EgoLite 操作中出现，但截图时视口没有落到该区域”的证据。它是当次浏览器操作记录，不是事后根据首页文案推测。对于可持久恢复的状态，已优先补拍有效截图。

## 操作日志

| 流程 | 真实操作 | 页面 / DOM 结果 | 证据边界 |
|---|---|---|---|
| Character 卡编辑 | 查看 Main character；新增临时空白角色后再 Remove；检查图片 Prompt / Create image | 卡片包含名称、描述、图片 Prompt、Create image；新增后角色集合增加，Remove 后恢复原集合 | `11` 只清楚保留页面上部与入口；持久字段见脱敏 [`project-schema-sanitized.json`](project-schema-sanitized.json) |
| Character 自动重建 | 已有 Main character 时点击 Make it for me | 打开 `Regenerate characters?`，提示会移除现有角色；本次 Cancel | `11` 只能证明页面入口；`12/13/13b/15` 中可见该确认层 |
| Environment AI | 在 Plot 完成后点击 Make it for me | 先显示 `Generating environments…`，后写入 2 个环境及 1024×1024 图片；名称为 `Dimly Lit Studio` / `Vibrant Urban Crowds` | 网络中观察到 `POST /api/music-video/storyboard-environments`；原始截图受角色确认层遮挡 |
| Director 候选图生成 | 在 Cast / Where 复核弹窗点击 `Looks good — generate 4 images` | Cut 区先显示生成占位和忙碌态；约 20 秒后返回 4 张候选图并自动形成 4 个选中 Cut | `22` 没有清晰保留忙碌文案；`21` 证明提交前复核，`23` 证明生成结果，网络中观察到 `POST /api/music-video/generate-images` |
| Director 无视频 Preview | 候选图已选为 Cut，但没有任何 Cut 视频时点击 Preview | 弹出 `Preview failed. You can retry or close. No videos yet — generate or attach at least one cut video first.`，按钮为 Retry / Close | `25` 截图实际是紧接着出现的 `Your cuts are ready`，不是错误弹窗 |
| Director 部分成功 | 只生成第 1 个 Cut 的 Standard 视频，其余 3 个仍 Pending 时点击 Preview | 生成 8 秒 Blob Preview；随后可继续并行生成其余 3 个 Cut | `30` 证明单条成功，`31` 证明同一阶段的 Preview，两者需联合使用 |
| Timeline 首帧校验 | Lipsync 已选且 First image 为空时点击 Generate | 原位显示 `A start image is required for lipsync. Set it via the "First" image slot.`，没有创建 Job | `45` 显示空 First/Last 与 Generate；`46` 视口位置失效，不作视觉证据 |
| Timeline 任务生成 | 选 First image，选 Express，在 `.04 credits` 弹窗点击 Generate | 先出现 `Generating…` / `starting`，对应 `POST /api/create/jobs` 与后续 Job 轮询 | `48` 有效显示费用确认；`49` 未截到行内运行态 |
| Timeline 任务成功但未附加 | Job 已 `succeeded`，项目 Row 尚无 videoUrl | 短暂显示 `This segment finished, but the video was not attached here. Browse finished videos` | `50` 视口位置失效；该瞬时状态数秒后自动恢复，未重新付费制造 |
| Timeline 已附加 | 等待数秒，无人工 Browse | Row 显示 `Segment 8s · Video 8s`、Regenerate、Download、Browse，Preview / Export 启用 | 有效持久态截图：[`59`](59-editor-video-attached-valid.png) / [`60`](60-editor-attached-full-valid.png) |
| Timeline Export Room | 从 Editor 点击 Export，经历 `Loading export room…` 后进入 Ready；点击 Save video | 页面显示 `Ready 100%`、Duration 0:08、Scenes 1、Gaps None、Audio Finalized；加载态 `Start export` 为禁用，本次没有创建新 Timeline 导出任务 | Save video 下载内容是旧 Director 蒙太奇而非当前 Row；见 [`61`](61-export-content-comparison.jpg) 和 [`export-metadata.md`](export-metadata.md) |
| Delete | 在项目列表点击 Delete | 进入浏览器控制的确认流程；明确拒绝后项目仍存在 | 弹窗未落图，不记录未捕获的精确文案 |

## 当前持久状态复查

2026-08-28 收尾时重新打开项目，DOM 仍显示：

```text
1 scenes
0:00 – 0:08
Lipsync / Scene
Segment 8s · Video 8s
First / Last
Express / Standard / Premium
Regenerate · 0.04 credits
Download / Browse
Preview / Export
```

这份复查证明 Timeline Row 的视频已持久附加；它不能倒推生成中和未附加两个瞬时状态的截图。
