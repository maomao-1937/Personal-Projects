# 狗头人工坊

上传一张人像，将人物头部转换为指定犬种；在同一张照片与提示词上比较多个图生图模型。

本项目从空目录建立，面向可操作的面试展示与持续模型实验。产品范围见 [PRD.md](PRD.md)，视觉规范见 [DESIGN.md](DESIGN.md)，长期协作规则见 [AGENTS.md](AGENTS.md)。

## 本地运行

需要 Node.js 22.12+（已在 Node.js 24 环境运行）。

```sh
npm ci
npm run dev
```

打开 `http://127.0.0.1:5173`。Vite 前端通过代理调用 `127.0.0.1:8787` 的 Express 服务。没有密钥也能查看明确标注的示例、上传图片和配置模型；不会模拟真实生成。

```sh
npm test       # 适配器、图片验证、密钥边界、HTTP 契约测试
npm run check # TypeScript
npm run build # 前端静态资源 + Node 服务端产物
npm start     # 同一 Node 服务提供前端与 API，默认 127.0.0.1:8787
```

## V4：项目创作工作台

用户于 2026-09-14 确认复现 Lovart 的核心图片创作流程，核心仍是人像转狗头人。首页上传后进入作品画布与对话工作台；选中一个版本，直接描述修改要求，生成下一个版本。保留 Agent 创作 / 自己控制，手机默认收起历史对话，让修改框紧接作品。不是无限画布、局部涂抹编辑或 Lovart 全站逐像素复刻。

1. 首次由维护者进入右上角「设置」，添加绘图模型；使用 Agent 时再接入创作助手。
2. 点击「保存连接与默认设置」。之后刷新或切换两种创作方式，使用同一套服务端连接，无需重新输入密钥。也支持仅用于当前页面的会话密钥。
3. 回到创作，上传人像或使用明确标注的示例，选择犬种或交给 Agent，发送要求。
4. 选中作品后输入修改，按 Enter 或发送按钮继续；「从原图再创作」回到人像起点。下载选中版本，历史中可恢复项目。
5. 从作品旁「换模型对比」进入：固定该次调用的实际输入与完整提示词，交给 2–3 个绘图模型执行，不重新策划。

服务端凭证采用 AES-256-GCM 加密文件，默认位于 `.studio-data/`；加密密钥和密文同机，目录/文件权限分别为 0700/0600，不是外部 KMS。整个目录需要妥善保护和持久挂载。接口只返回非敏感连接配置，不向前台下发凭证；浏览器存储和导出不含密钥。开发环境管理只允许本机页面；生产环境必须设置 `STUDIO_ADMIN_TOKEN` 后才能修改共享连接。访客可使用已配置的共享连接，管理口令不是访客登录系统。

保存连接不会调用模型，也不代表接口已经连通。点击创作会调用供应商，可能计费；停止等待不保证供应商停止处理。没有账户、跨设备项目同步或计费系统。

## 已实现的协议

| 类型 | 传输形式 | 结果 |
| --- | --- | --- |
| OpenAI Images Edits / 同协议兼容服务 | multipart 图片文件 + prompt | `data[].b64_json` 或兼容服务 URL |
| Gemini generateContent | inline image + text parts | 非 thought 的最终 inline image |
| 阿里云 DashScope 图像编辑 | messages 内 image + text | choices 内图片 URL |
| 火山方舟 Seedream | JSON image + prompt，单张 2K | Base64 或 URL |

四类请求适配与响应解析已通过本地契约测试，**没有使用用户付费密钥完成供应商实测**。预设模型 ID 可编辑，不保证任意账户都有该模型权限；以控制台提供的模型与地域端点为准。

“国内外所有模型”是扩展方向，不是现有能力声明。文生图接口、只接收公网图片链接的接口、异步任务轮询、自定义签名鉴权、ComfyUI 工作流等不能仅填写密钥就通用，需要新增 adapter。

官方依据（2026-09-12 核对）：[OpenAI 图片编辑](https://developers.openai.com/api/reference/resources/images/methods/edit)、[Gemini 图像生成/编辑](https://ai.google.dev/gemini-api/docs/generate-content/image-generation)、[千问图像编辑](https://help.aliyun.com/zh/model-studio/qwen-image-edit-api)、[火山方舟 SDK 的 images 实现](https://github.com/volcengine/volcengine-python-sdk/blob/master/volcenginesdkarkruntime/resources/images/images.py)。

## 数据流与实验边界

- 上传后图片在浏览器预览并自动保存到本地 IndexedDB 项目历史。点击生成后，本次输入经本站服务端发给选定供应商；服务端使用托管凭证或本轮会话密钥。本站不落盘保存上传图像，不记录请求体、密钥或供应商原始错误正文；供应商自己的数据处理规则以其服务说明为准。
- 服务端验证 10 MB、静态 JPG/PNG/WebP、最多 4000 万像素；统一自动旋转、去除元数据，长边缩至最多 2048px，编码为 PNG 再发送。
- 真实结果统一解码成 PNG 后返回；下载不依赖供应商临时链接长期可用。
- 同一轮对比锁定实际输入图片与完整提示词（编辑任务的输入可能是已有狗头作品）；导出记录包含模型、原图 SHA-256（规范化后）、提示词、开始时间、状态、耗时、输出尺寸、adapter 参数。不导出密钥或人像二进制。
- 模型默认参数并不相同：Seedream 使用 2K；其他协议使用接口默认尺寸；千问支持时关闭 prompt_extend。没有共同 seed，也不保证结果可完全复现。单次对比不代表模型排名。
- 项目的照片、版本、当前草稿和任务上下文自动保存在当前浏览器 IndexedDB，刷新可恢复。无跨设备同步；清除网站数据会移除项目，容量不足时就近报错，作品应及时下载。等待期间刷新会将未完成记录标为中断，不伪造后台继续完成。
- 首屏示例使用内置图像生成工具单独创作，与已接入模型的实测无关。生成提示和素材来源见 [素材记录](docs/design/ASSETS.md)。

## 上线方式

项目提供 Node 服务与 Dockerfile，可部署到支持持续运行 Node/Docker 且能访问目标供应商的服务器。**当前尚未公开部署；Docker 镜像尚未在本环境构建验证。**

```sh
docker build -t goutou-studio .
docker run --rm -p 8787:8787 --memory=2g -e STUDIO_ADMIN_TOKEN -v goutou-data:/app/.studio-data goutou-studio
```

或者构建后设置 `HOST=0.0.0.0` 并运行 `npm start`。公网使用 HTTPS 反向代理，请求体上限至少 16 MB；直接生成超时至少 190 秒，Agent 至少 430 秒。静态托管不能直接运行此服务端。

环境变量通过部署平台或 shell 设置；`.env.example` 是说明文件，不会自动加载。代理层数已知时才设置 `TRUST_PROXY_HOPS`。新增兼容服务域名需在服务端设置 `ALLOWED_API_HOSTS=api.your-provider.example` 并重启；仅允许明确域名、标准 HTTPS、公网解析，禁止内网目标及重定向携带凭证。

直接生成包含单进程每 IP 20 次 / 15 分钟限流、共享 6 个在途请求上限、3 分钟请求超时、响应大小限制与安全响应头；Agent 限制见下文。多实例部署时限流需接共享存储。会话模式使用访客自己的密钥；托管模式使用维护者配置的共享凭证。`STUDIO_DAILY_RENDER_LIMIT` 默认按 UTC 日最多预留 100 次绘图额度，Agent 按本轮最大次数预留，失败也不退还。此额度是单进程内存计数，重启重置，不是持久账本或多实例预算。公开部署前应明确额度与运维方案。

## 目录

```text
src/pages/             创作、模型接入、模型对比
src/components/ui/     通过 shadcn CLI 引入的 Radix 基础组件
src/components/        上传、预览、模型弹窗
src/lib/session.tsx    项目状态、连续编辑与运行快照
src/lib/projects.ts    本地 IndexedDB 项目历史
server/connections.ts  受保护的服务端模型连接
shared/models.ts       公共协议、模型预设与提示词
server/adapters.ts     四类真实请求适配器
server/network.ts      出站域名、DNS 和下载边界
tests/                 本地契约测试与独立浏览器模拟服务
docs/design/           设计概念稿与素材来源
docs/screenshots/      浏览器审查证据
```

本轮验收、Critique、修正和证据见 [UI-REVIEW-V4.md](docs/UI-REVIEW-V4.md)，旧版记录保留归档。本地模拟 QA 入口为 `npx tsx tests/fixture-server.ts`（需先构建，端口 8788，仅监听本机）；该入口不被生产服务引用，不调用外部模型。

## V2：创作 Agent（本地实现）

首页以照片和自然语言想法为中心。24 个犬种支持中文、英文、别名搜索与自定义外观；常用犬种展示 AI 外观参考。画面质感和编辑范围收在「绘图设置」，默认只换头部。可切换「自己控制」直接调用绘图模型。

作品默认显示完整狗头效果。左下缩略图按钮「切回自己」查看完整原图，「看狗头效果」返回结果；只保留这一个对照入口，已移除滑块。切换不改动生成记录或下载内容，新作品默认显示结果。

启用 Agent：在「模型接入」同时配置 **绘图模型** 和 **创作助手的理解模型**。后者必须支持函数工具调用，采用 OpenAI 兼容 Chat Completions 协议；视觉模式还需图像输入，文字模式只做文字策划与绘图调度，不收图、不检查、不自动修正。预设是便于填写的例子，不表示已验证账户权限。视觉理解和检查使用同一个理解模型，绘图调用已有四类适配器。配置不发模型请求；V4 支持受保护的服务端凭证保存。

运行时实际加载 `agent-skills/creation-workflow/SKILL.md` 和 `agent-skills/portrait-director/SKILL.md`，检查时再加载 `agent-skills/portrait-review/SKILL.md`。三份指令分别指导工作流、造型与原图/结果检查，不增加独立模型角色调用。加载器校验白名单、名称和版本；实际使用的版本与 SHA-256 写入执行事件和记录导出。模型可调用 `lookup_breeds`、`propose_design`、`generate_image`、`inspect_result`、`ask_user`、`finish`。需要澄清时可以不出图；结果检查返回具体观察和无法判断项，不生成伪评分。

- `POST /api/agent` 流式返回 NDJSON 事件。最多 8 轮规划、10 次理解调用（包含检查）、默认 1 次绘图；用户勾选后最多 2 次绘图，且第二次必须在检查提出修正后执行。达到上限停止。
- 首次从原始人像出发；选中作品继续修改时，该版本图像作为新的实际输入，并保留父版本 ID 和最初人像。每次调用的实际输入、完整提示词和结果绑定。当前项目保存最近六轮任务上下文与方案，恢复后可继续，但不承诺模型能完全保持像素或身份一致性。
- 检查失败仍保留作品，不因此自动重复付费绘图。停止等待保留已经返回的版本；供应商是否取消及计费由供应商决定。
- 选择新照片会清除旧方案、追问和本轮事件，避免沿用上一张人像的上下文。导出 Agent 记录含方案、提示词、检查、参数及输入指纹，不含图像二进制或密钥。
- 视觉模式的理解模型收到本轮输入（首次人像或选中作品）；检查时收到本轮输入与输出。文字模式的理解模型仅接收文字，本轮输入仍交给绘图模型。代理请关闭 `/api/agent` 响应缓冲，请求体上限至少 16 MB、超时至少 430 秒。Agent 单 IP 为 8 次 / 15 分钟，420 秒请求超时；与直接生成共享单进程 6 个在途请求上限。
- Docker 运行镜像包括 `agent-skills/`。直接启动服务时应以项目根目录为工作目录，修改 skill 后重启服务（进程内有读取缓存）。

V4 已通过 40 项本地自动测试及隔离响应浏览器流程验证，覆盖服务端保存、刷新恢复、版本编辑、失败恢复和对比。**没有供应商密钥，因此尚未验证真实看图、追问质量、修正质量或任何模型的狗头效果；网站尚未公开部署。** 测试 fixture 只存在于专用 8788 入口，生产入口不会加载。

已参考 Agency Agents 的提示工程、后端架构与证据审查角色，来源快照和许可证保留在 `docs/references/agency-agents/`，不自动加载或执行。MCP 与 LangGraph.js 已评估，尚未安装；取舍、现有实现和下一版目标见 [Agent 技术方案](docs/AGENT-ARCHITECTURE.md)。

连续创作：普通造型细节默认交给助手决定。必要问题显示在输入框上方，可点选回答后直接继续；文字回答按 Enter 发送、Shift+Enter 换行。已有作品时输入修改要求后直接发送，不输入则可点击发送按钮再生成一个版本。失败保留草稿和旧作品，换照片清除对话上下文。调用上限不变，服务端拦截相同文本的重复提问。验证记录见 [连续创作审查](docs/UI-REVIEW-CONTINUATION.md)。

协议参考：[千问视觉兼容接口](https://help.aliyun.com/zh/model-studio/qwen-vl-compatible-with-openai)、[千问工具调用](https://help.aliyun.com/zh/model-studio/qwen-function-calling)、[Gemini OpenAI 兼容接口](https://ai.google.dev/gemini-api/docs/openai)。

## 2026-09-13：犬种表情与多厂商理解模型

24 种犬种均有 AI 摄影参考和不同的嘴型、舌头、神态建议。目录、手动提示词与 Agent 犬种工具共享 `breedExpressions`；用户明确表情要求优先。这些是可修改的创作建议，不是犬种性格分类。

「模型接入 → 接入助手」支持七家厂商及同级自定义入口：

| 厂商 | 预设型号 | 输入模式 |
| --- | --- | --- |
| OpenAI | gpt-4.1 | 视觉 |
| 通义千问 | qwen3-vl-plus | 视觉 |
| Gemini | gemini-2.5-flash | 视觉 |
| DeepSeek | deepseek-v4-flash-vision-exp / deepseek-v4-flash / deepseek-v4-pro | 视觉实验版 / 文字 / 文字 |
| 智谱 | glm-4.6v-flash | 视觉 |
| MiniMax | MiniMax-M3 / MiniMax-M2.7 / MiniMax-M2.5 | 视觉 / 文字 / 文字 |
| Kimi | kimi-k3 / kimi-k2.6 | 视觉 |

自定义模型填写完整 Chat Completions 地址和型号，并选择输入能力，默认文字。新增域名需通过服务端 `ALLOWED_API_HOSTS` 开放后重启，不能只在前端填写。修改供应商或接口地址清空表单密钥；名称、型号、模式和地址可保存，密钥可仅用于会话，或通过设置页保存到受保护的服务端。已知文字型号的能力上限由服务端再次核对，不能通过篡改前端选项获得图像输入或二次绘图。

兼容层保留多轮工具调用需要的 `reasoning_content`、`reasoning_details`、工具 `extra_content`，只在本轮服务端上下文中使用，不写入客户端事件或日志。MiniMax 官方接口使用 `reasoning_split`。没有有效视觉检查时，不允许自动额外绘图。

官方依据（2026-09-13 核对）：[DeepSeek 视觉输入](https://api-docs.deepseek.com/guides/vision/)、[DeepSeek 思考模式](https://api-docs.deepseek.com/guides/thinking_mode/)、[智谱 GLM-4.6V-Flash](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.6v-flash)、[MiniMax OpenAI 接口](https://platform.minimax.cn/docs/api-reference/text-openai-api)、[Kimi 快速开始](https://platform.kimi.com/docs/get-api-key)。接口预设未做真实账户连通测试。视觉审查见 [本轮记录](docs/UI-REVIEW-V3.md)，精确素材提示词见 [素材来源](docs/design/ASSETS.md)。

## 模型 ID 手填与 DeepSeek 提示词生成器

所有新建绘图/理解模型 ID 均留空；选择供应商只补接口地址。编辑时保留已有 ID，不自动替换。上文型号表为历史能力参考，不是当前表单默认值。

在首页或项目输入框旁点击「提示词生成器」，填写 DeepSeek 模型 ID 和 API Key，可单独保存连接；设置页也能打开。输入一句想法后生成，结果可编辑、复制、应用到创作。应用只写入草稿，不调用绘图模型，不改变 Agent / 自己控制方式。此功能不需要先连接绘图或理解模型。

只发送文字、犬种建议、质感、编辑范围和选中版本的已有提示词，不发送照片。接口固定为 DeepSeek 官方 Chat Completions，模型 ID 原样使用用户填写值，使用最终 content，不展示 reasoning_content。空内容或截断返回报错并保留已有提示词。首次生成会调用一次文字模型，按供应商计费。配置与绘图/助手分开保存，刷新后可用；生产写入需要管理口令。未保存密钥关闭弹窗后清除。

共享提示词连接限流20次/15分钟/IP、并发3、超时60秒；STUDIO_DAILY_PROMPT_LIMIT 默认100次/UTC日，单进程内存计数、重启重置。正文请求限制64KB。首次请求前的配置保存不会调用 DeepSeek。

官方协议依据：[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)（2026-09-14核对）。本地模拟与契约测试不代表用户账户连通或提示词质量实测。审查见 docs/UI-REVIEW-PROMPT-WRITER.md。
