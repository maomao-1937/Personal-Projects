# 网络观察（脱敏）

## 方法

下表来自 EgoLite 操作期间的真实浏览器请求与页面读回。`<projectId>` 和 `<jobId>` 是脱敏占位符。本文不保存请求 Cookie、Authorization、签名媒体 URL、用户 ID 或云导出 Token。

## 已观察路由

| Method | Path | 触发行为 / 读回结果 |
|---|---|---|
| GET | `/api/create/models` | 打开创建器；返图片/视频模型、速度档与价格元数据 |
| GET | `/api/music-video/generated-images` | 打开工作区或选图器；实测顶层为 `history`、`projectGroups`，项目组含 `id`、`title`、`count`、`isImageLibrary`、`updatedAt` |
| GET | `/api/music-video/projects` | 打开项目列表 |
| GET | `/api/music-video/projects/published-status` | 加载项目发布/导出状态 |
| GET | `/api/music-video/projects/<projectId>` | 打开单项目；返回音频、转录、Timeline rows、Director `discountStoryboard`、导出及 UI 状态 |
| PUT | `/api/music-video/projects/<projectId>` | 编辑后自动保存整体项目状态 |
| POST | `/api/create/upload-audio` | 上传原始音频，返可供后续分析/切片使用的媒体地址 |
| POST | `/api/music-video/transcribe` | 触发转录；返全文、语言、时长、逐词时间戳、segments 和 lyricSubtitles |
| POST | `/api/music-video/storyboard-summary` | Director Plot 的 Generate with AI；观察到流式文本返回 |
| POST | `/api/music-video/storyboard-environments` | Make it for me；返环境名、描述，并触发环境图生成 |
| POST | `/api/music-video/storyboard-overview` | 生成 Director segments、段落摘要和 cut descriptions |
| POST | `/api/music-video/generate-images` | 以剧情、角色、环境和分镜描述生成候选图组 |
| POST | `/api/create/upload-image` | 上传本地图片到 Library /生成任务输入 |
| POST | `/api/create/jobs` | Director cut 或 Timeline row 视频生成；请求包含模型、prompt、image、audio slice、duration、aspect ratio、resolution 与目标类型 |
| GET | `/api/create/jobs/<jobId>` | 轮询异步任务；成功读回 `status: succeeded`、output/storedOutput、creditCost 和剩余积分 |
| POST | `/api/music-video/upload-segment-video` | 将生成视频附着到 Director cut 或 Timeline row，进入项目可持久化状态 |

## 生成任务已观察字段

```text
modelId, provider, status,
input.prompt, input.image, input.audio,
input.duration, input.aspectRatio, input.resolution,
creditCost, chargeOnSuccess,
projectType, targetType,
output, storedOutput, creditsRemaining
```

- Director Standard cut：2 秒、16:9、720p，实际扣费 `.04 cr`，`targetType = discountCut`。
- Director Express cut：2 秒、16:9、720p，实际扣费 `.01 cr`，`targetType = discountCut`。
- Editor Timeline Express Lipsync：8 秒、16:9、720p，实际扣费 `.04 cr`，`targetType = timelineRow`。
- Timeline Lipsync 的服务端 prompt 不只是用户文本，还包含“按音频口型、演唱、呼吸/身体随音乐运动”一类系统补全指令。
- 单项目读回中的根级 `generatedImages` 是媒体 URL 字符串数组，不是带 ID 的图片对象；图片历史接口和项目字段是两种不同结构。

## 未直接捕获

- Cloud Export 的单独路由未出现在最后保留的 Performance Resource 列表中。页面行为和项目读回证实了云端导出任务、进度和成片 URL，但不在文档中伪造 endpoint。
- Timeline Export Room 的新建 / 刷新 endpoint 未直接捕获；本次房间直接读到根级既有导出资产，不能据此虚构独立 Timeline 导出 API。
- 未观察到独立 BPM、Beat、Mood 或 Energy 分析 API。
