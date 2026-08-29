# 阶段 1 API Key 配置清单

> 用途：在阶段 0 PRD 确认后，为真实模型冒烟准备最少配置。  
> 安全要求：任何真实 Key 都不得写入仓库、前端、README、日志、截图或对话输出。本地真实值只写入已被 `.gitignore` 排除的 `.env`；仓库只允许提交不含真实值的 `.env.example`。

## 1. 下一阶段必需配置

| 配置名称 | 用途 | 是否必填 | 环境变量 | 从哪里读取 | 如何验证 |
|---|---|---:|---|---|---|
| Storyboard Provider | 选择 Plot/Storyboard 文本模型适配器 | 是 | `STORYBOARD_PROVIDER` | 所选服务商的 Provider 标识；第一版推荐 `openai_compatible` | 启动配置检查显示 Provider 已选择，不输出密钥 |
| Storyboard API Key | 调用 Plot/Storyboard 文本模型 | 是 | `STORYBOARD_API_KEY` | DeepSeek 或用户提供的 OpenAI Compatible 多模型 API 控制台 | 后端执行一次最小 JSON Storyboard 冒烟，返回结构校验通过；日志只显示掩码 |
| Storyboard Base URL | 文本模型 API 地址 | 是 | `STORYBOARD_BASE_URL` | 服务商官方 API 文档或控制台 | 启动时校验为后端可访问的 HTTPS 地址，再做最小请求 |
| Storyboard Model | 指定文本模型 | 是 | `STORYBOARD_MODEL` | 服务商控制台的模型列表/模型标识 | 冒烟响应记录 model、request_id 和耗时，不记录输入密钥 |
| Video Provider | 选择视频生成适配器 | 是 | `VIDEO_PROVIDER` | P0 默认 `dashscope_wan` | 启动配置检查显示 Provider 已加载 |
| Video API Key | 调用阿里云百炼 Wan 视频生成 | 是 | `VIDEO_API_KEY` | 百炼控制台中当前地域的 API Key | 在单独授权后创建一个 5 秒 480P 任务；能查询终态并取得可探测的 MP4 Artifact |
| Video Base URL | 视频模型任务创建与查询地址 | 是 | `VIDEO_BASE_URL` | 百炼控制台/官方文档；通用北京域名可为 `https://dashscope.aliyuncs.com`，如控制台给出 Workspace 专属域名则以其为准 | 分别验证创建任务与查询任务接口可达 |
| Video Model | 指定 Wan 模型 | 是 | `VIDEO_MODEL` | P0 低成本默认 `wanx2.1-t2v-turbo` | 冒烟任务返回有效任务 ID，结果为固定 5 秒 H.264 MP4 |

## 2. 可选配置

| 配置名称 | 用途 | 是否必填 | 环境变量 | 从哪里读取 | 如何验证 |
|---|---|---:|---|---|---|
| Transcription Provider | 选择歌词/语音识别适配器 | 否 | `TRANSCRIPTION_PROVIDER` | 所选国内 ASR 或本地方案说明 | 未配置时产品明确显示“未启用歌词分析”，主链路仍可完成 |
| Transcription API Key | 云端 ASR 调用 | 否 | `TRANSCRIPTION_API_KEY` | 所选 ASR 服务商控制台 | 使用不含敏感信息的短音频冒烟，验证时间戳和文本结构 |
| Transcription Base URL | 云端 ASR 地址 | 否 | `TRANSCRIPTION_BASE_URL` | 服务商官方文档 | 启动校验与最小请求通过 |
| Transcription Model | ASR 模型标识 | 否 | `TRANSCRIPTION_MODEL` | 服务商控制台 | 响应模型标识与配置一致 |

## 3. 不需要 API Key 的能力

| 能力 | 默认实现 | 验证方式 |
|---|---|---|
| 音乐分析 | 本地 librosa | 固定音频样本输出 BPM、Beat、Onset、Energy 和时长，结果可重复读取 |
| Preview/Export | 本地 FFmpeg | `ffprobe` 验证 MP4、H.264、AAC、时长、分辨率和可播放性 |

## 4. 本阶段不应配置

- veFaaS、TOS、CDN、域名、短信、支付、会员或积分相关凭证：它们不属于阶段 1 最小模型冒烟，部署前另行确认费用后再配置。
- 4i 的任何 Cookie、Token、账号凭证或网络请求密钥：不得复制或使用。
- Key 不得以 `NEXT_PUBLIC_*` 或其他前端公开环境变量保存。

## 5. 配置文件规则

阶段 1 开始后才允许执行以下配置动作：

1. 本地创建 `.env` 并填写真实值；确认 `.env` 已被 `.gitignore` 排除。
2. 创建或更新 `.env.example`，只写变量名和安全占位符，不写可用凭证。
3. 后端启动时只报告“已配置/未配置”，最多显示不可逆掩码，不输出原值。
4. 测试失败信息、SSE、API 响应和日志必须经过密钥脱敏。
5. 提交前使用敏感信息扫描，并用 `git diff --cached` 人工确认没有真实 Key。

## 6. 进入阶段 1 前的人工确认

请完成以下事项，但不要把值发到对话中：

- 在本机 `.env` 配置一套可用的 Storyboard 文本模型配置。
- 在本机 `.env` 配置一套可用的百炼 Wan 视频模型配置。
- 如本轮需要歌词驱动分镜，再配置 Transcription；否则保持未配置。
- 明确回复：“PRD V1.1 已确认，API Key 已配置，开始后端阶段”。

未收到上述明确回复前，不得调用真实模型或进入后端开发。
