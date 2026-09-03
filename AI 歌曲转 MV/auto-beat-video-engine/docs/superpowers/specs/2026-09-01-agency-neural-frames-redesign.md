# AI 歌曲转 MV：Agency Agents 竞品复刻与模型路由设计规格

- 日期：2026-09-01
- 状态：视觉方案已批准，等待书面规格确认
- 竞品母版：Neural Frames Autopilot Storyboard
- 辅助参考：4i Music Video、One More Shot、Kaiber
- 参与角色：Agency Agents UI Designer、UX Researcher、Frontend Developer、AI Engineer
- 替代规格：`2026-08-29-formal-frontend-design.md`

## 1. 目标与结论

本轮重做不在现有页面上换色或微调间距，而是替换 Storyboard 工作区的视觉骨架。新界面复刻 Neural Frames 的任务分层、媒体密度和工作区结构，同时使用本产品自己的品牌、中文文案、模型目录和生成素材。

最终采用 3 个互不混杂的工作区：

1. **Storyboard：** 看全局叙事、设置全局参考、批量生成。
2. **Shot Editor：** 精修单个镜头、管理 Take、局部重新生成。
3. **Preview：** 连续播放、检查节奏、生成预览和导出。

信息优先级固定为：

```text
画面 > 场景与时间 > 生成状态 > 描述与模型 > 辅助操作
```

每个工作区只保留 1 个主 CTA。当前页面中的大步骤条、巨型波形、Scene 列表、Cut 卡片、常驻 Inspector 和底部统计栏不再同时出现。

## 2. 采用与替换边界

### 2.1 严格采用 Neural Frames 的部分

- Storyboard → Shot Editor → Preview 的工作模式分离；
- 左侧窄应用栏；
- 大号阶段面包屑；
- Storyboard 顶部单行全局控制；
- 4 列、16:9、大画面场景卡；
- Storyboard 不显示常驻右侧 Inspector；
- Shot Editor 采用左右分屏；
- 时间线只出现在 Shot Editor 和 Preview；
- 深色、媒体优先、低边框密度的信息层级。

### 2.2 使用本产品设计替代的部分

- Logo、产品名、中文术语和文案；
- 紫色品牌色与状态色；
- 模型目录、成本区间、生成规则和数据地域；
- 真实生成素材、人物、场景和示例项目；
- 图标、空状态、错误提示、加载动画与移动端交互；
- 无障碍、键盘操作和焦点规范。

不得复制竞品 Logo、品牌素材、专有图标、截图内容和原文案。4i 的暖米色、衬线字体和铁锈橙只可用于后续营销页，不进入生成工作台。

## 3. 产品路由与全局框架

### 3.1 正式路由

- `/projects/[projectId]/audio`
- `/projects/[projectId]/analysis`
- `/projects/[projectId]/story`
- `/projects/[projectId]/storyboard`
- `/projects/[projectId]/storyboard/shots/[shotId]`
- `/projects/[projectId]/preview`
- `/projects/[projectId]/export`

现有 `/projects/demo/storyboard` 继续作为稳定 Fixture 与视觉验收入口，不作为正式数据路由。

### 3.2 全局框架

桌面基准为 1440 × 900 px：

- 左侧应用栏：64 px；
- 顶部栏：64 px；
- 内容左右内边距：32 px；
- 内容最大宽度：1680 px；
- 阶段导航放进页面标题：`音频 › 分析 › 故事板 › 预览`；
- 顶栏只保留项目名、保存状态、连接状态和账户菜单。

不再保留现有 68 px 黑色顶栏与 72 px 步骤条组成的双层导航。

## 4. Storyboard 工作区

### 4.1 桌面布局

1440 × 900 px 下：

- 阶段标题区：88 px；
- 全局控制栏：72 px；
- 卡片区从 Y = 240 px 开始；
- 卡片区宽度约 1312 px；
- 4 列布局，间距 16 px；
- 单卡宽度约 316 px；
- 画面严格使用 16:9，约 316 × 178 px；
- 卡片总高为 258–276 px，行间距 20 px。

全局控制栏从左到右包含：

1. 视觉概念输入框；
2. 风格参考；
3. 角色参考；
4. 模型档位选择；
5. 「生成全部」按钮。

模型档位选择默认展示档位、预计成本区间、分辨率、生成视频覆盖比例和一致性水平。Provider 与 model ID 只放在高级详情中。

### 4.2 卡片结构

画面区展示真实 Poster 或视频代表帧：

- 左上：`Scene 04`；
- 右上：状态角标；
- Hover 或 Focus：中央播放，右下显示重新生成与更多操作。

信息区包含：

- 场景标题与时间范围；
- 最多 2 行镜头描述；
- 存在局部覆盖时显示模型名或「已覆盖全局设置」。

卡片不显示常驻底部按钮栏。失败状态只在卡片底部显示一条错误操作栏，不把整张卡片染红。

### 4.3 核心交互

- 单击卡片：选中并打开 380 px 快速编辑抽屉；
- 双击或按 Enter：进入 Shot Editor；
- Hover：静音播放 2–3 秒预览；
- 全局风格、角色和模型默认由所有镜头继承；
- 单镜头覆盖后显示紫色圆点；
- 「生成全部」提交前展示生成范围、预计成本和动态预计耗时；
- 重新生成创建新的 Take，不覆盖旧版本；
- 预览允许包含明确标记的缺失片段，但不得同时显示「已就绪」和失败状态。

## 5. Shot Editor 工作区

### 5.1 桌面布局

1440 × 900 px 下：

- 上部编辑区：632 px；
- 底部时间线：204 px；
- 左侧设置区：约 580 px；
- 右侧预览区：约 732 px；
- 两区间距：16 px。

左侧设置区从上到下包含：

1. Scene、时间范围与上一镜头 / 下一镜头；
2. 参考图条；
3. Prompt；
4. 镜头运动语义预设；
5. 默认折叠的高级设置；
6. 模型、预计成本与「生成新版本」。

首屏只提供「缓慢推进、拉远、横移、环绕、手持、固定」等语义预设。Zoom、Pan、Tilt、Roll 等精细控制放进高级设置。

右侧以大画面为主，显示当前 Take 与版本切换。支持空格播放、左右方向键切换 Take。

底部时间线包含：

- 28 px 标尺；
- 72 px 镜头轨；
- 56 px 音频波形；
- 32 px 工具栏；
- Beat、段落和歌词节点。

镜头边界吸附到 Beat。F1 若不实现拖拽，时间线必须明确显示为只读，不得伪装可编辑。

## 6. Preview 与 Export 工作区

桌面端以约 960 × 540 px 的 16:9 大预览为视觉中心，底部时间线高 236 px。右上仅保留：

- 画幅；
- 分辨率；
- 导出按钮。

导出按钮打开 360 px 右侧抽屉，用于配置格式、分辨率、字幕与平台预设。

时间线包含视频主轨、音频轨、Beat / 歌词标记和场景转场。失败或缺失片段显示斜线占位，点击后返回对应 Shot Editor；返回 Preview 时恢复播放头位置。

## 7. 响应式设计

### 7.1 断点

- `≥1600 px`：保持 4 列，只增加卡片和外侧留白；
- `1280–1599 px`：4 列；
- `1024–1279 px`：3 列；
- `768–1023 px`：2 列；
- `<768 px`：单列、底部导航、全屏 Shot Editor；
- `<420 px`：全局控制收进 Sheet，卡片描述默认 1 行。

### 7.2 移动端

390 × 844 px 为验收基准：

- 顶栏：52 px；
- 阶段导航：52 px；
- 页面边距：16 px；
- Storyboard 单卡宽约 358 px，画面约 358 × 201 px；
- 「生成全部」固定在底部导航上方；
- 单击卡片进入全屏 Shot Editor；
- Scene、项目设置与高级设置使用带 Backdrop 的底部 Sheet；
- 首屏必须看到主画面、播放、当前镜头和主 CTA；
- 页面根节点不得横向溢出。

## 8. 视觉系统

```css
--bg-app: #111216;
--bg-panel: #191a20;
--bg-elevated: #212229;
--bg-hover: #292a33;
--border-default: #30313a;

--text-primary: #f6f5f2;
--text-secondary: #a7a8b2;
--text-tertiary: #747680;

--brand-primary: #745cff;
--brand-hover: #846fff;
--brand-soft: rgba(116, 92, 255, 0.16);

--success: #3ccb91;
--warning: #f2ad4b;
--danger: #ff666a;
--info: #7e8fff;

--radius-control: 8px;
--radius-card: 12px;
--radius-sheet: 16px;
```

排版：

- UI：Inter、PingFang SC、system-ui；
- 阶段标题：40 / 42 px，字重 600；
- 页面标题：28 / 34 px，字重 600；
- 卡片标题：15 / 22 px，字重 600；
- 正文：14 / 21 px；
- 辅助文字：12 / 18 px；
- 时间码：12 px 等宽字体，不低于 11 px。

动效遵循 `prefers-reduced-motion`。键盘焦点使用 2 px 紫色描边和 2 px 偏移。

## 9. 真实视觉资产

- Storyboard 使用真实生成结果，不再使用 CSS 渐变假缩略图；
- Demo 项目统一人物、服装、色彩脚本和镜头语言；
- 场景图输出 1600 × 900 px WebP / AVIF，并提供 400、800、1200 px 尺寸；
- 列表只加载缩略图，选中镜头后才加载 Poster 与视频；
- 主视图只挂载 1 个 `<video preload="metadata">`；
- Poster 使用视频 30%–40% 时间点的代表帧，避免首帧黑场；
- 失败镜头保留最后一张有效参考图并叠加状态；
- 媒体 URL 使用服务端短期签名地址，版本进入 Path 或 Query；
- 不在未选中卡片中批量挂载 `<video>`。

后端为每个 Cut 返回 `thumbnailArtifact`、`posterArtifact`、`videoArtifact`、`assetVersion`、画幅与安全区信息。

## 10. 状态与错误呈现

| 状态 | 呈现 |
|---|---|
| 草稿 | 灰色「未生成」，不使用状态色 |
| 排队 | 小时钟与「排队中」 |
| 生成中 | 缩略图底部 3 px 进度条与百分比 |
| 已完成 | 右上小型成功勾，不加绿色卡片描边 |
| 失败 | 卡片底部红色信息条与「重试」 |
| 已覆盖全局设置 | 标题旁紫色圆点 |
| 保存中 | 顶栏「正在保存……」 |
| 已保存 | 顶栏低对比度提示，2 秒后淡出 |
| 余额不足 | 禁用 CTA，并就地说明差额 |

错误只在发生位置完整显示 1 次。全局区域只汇总数量，不重复错误文案。异步状态通过 `aria-live` 播报。

## 11. 模型路由

### 11.1 用户档位

| 档位 | 剧情分镜 | 关键帧 | 视频 | 3 分钟目标成本 | 策略 |
|---|---|---|---|---:|---|
| 经济 | Qwen Flash | Qwen Image / Z-Image | Vidu Q2 Pro Fast 720p | ¥30–50 | 30%–40% 生成视频 |
| 平衡（默认） | `qwen3.7-max-2026-06-08` | `wan2.7-image-pro` | `wan3.0-video` 720p | ¥80–140 | 约 60% 生成视频 |
| 质量 | Qwen Max 高质量版本 | Wan Image + 可选角色 LoRA | Kling 3.0 Omni / Wan 1080p | ¥180–320 | 80%–100% 生成视频 |

音频转写默认使用 Qwen Audio ASR。用户提供歌词时，歌词为事实来源，ASR 只负责时间对齐。

所有视频请求固定关闭模型原生音频，最终只混入用户上传的原曲。

### 11.2 降级链

```text
ASR：Qwen Audio ASR → Fun-ASR Flash → 无歌词模式
分镜：Qwen Max 固定版本 → Qwen Flash → 确定性段落模板
图片：Wan Image Pro → Qwen Image → Z-Image → 复用参考图并改变构图
默认视频：Wan Video → Vidu Q3 Turbo → 关键帧确定性运镜
质量视频：Kling Omni → Wan 1080p → Vidu Q3 → 默认档 → 关键帧运镜
```

`CONTENT_BLOCKED` 不原样重试。系统先安全改写 1 次，仍失败则改换镜头方案或使用确定性素材。

### 11.3 Provider 边界

业务层只依赖能力，不直接依赖厂商：

```ts
interface ModelProvider<I, O> {
  provider: string;
  modelId: string;
  region: "cn" | "global" | "international";
  capabilities: string[];

  validate(input: I): ValidationResult;
  quote(input: I): CostEstimate;
  submit(input: I, idempotencyKey: string): Promise<TaskHandle>;
  poll(taskId: string): Promise<TaskStatus<O>>;
  cancel?(taskId: string): Promise<void>;
  normalizeError(error: unknown): ProviderError;
}
```

模型配置只存在于服务端配置中心，至少包含 Provider、model ID、版本、地域、能力、价格规则、时长范围、分辨率、参考输入能力、超时、启用状态与灰度比例。

### 11.4 前端展示

普通用户可见：

- 当前档位、分辨率、画幅；
- 预计成本区间与已用成本；
- 动态预计时间；
- 镜头完成数；
- 自动切换备用模型的提示；
- 歌词低置信片段；
- 最终使用模型与 AI 生成标识。

API Key、系统 Prompt、内部推理过程、异常堆栈和未授权素材地址不得返回前端。

## 12. 确定性音画链路

以下内容不得交给生成模型：

- 歌曲时长、采样率、响度和版权信息；
- BPM、Beat、Downbeat、Onset 的最终时间戳；
- 最终 Cut 点、帧号、字幕时间和音画同步；
- 原曲混音、编码、封装和发布规格；
- 成本上限、重试次数、超时和 Provider 切换；
- 最终人物一致性、安全与授权审核。

`librosa` 或 Essentia 负责节拍分析，FFmpeg 负责 Trim、Concat、Xfade、Scale、字幕、编码与封装。LLM 只决定叙事与镜头意图，程序将切点吸附到合法 Beat。

## 13. 成本、重试与熔断

- 任务创建前显示区间报价；
- 达到软上限后停止生成额外候选，只补齐缺失镜头；
- 预计突破硬上限时暂停并请求用户确认；
- 成本按「生成秒数 × 单价 × 实际尝试次数」计算；
- 核心指标为 `总生成费用 / 最终采用视频秒数`；
- 任务提交必须携带稳定的 `Idempotency-Key`；
- 网络重试使用 1、2、4 秒指数退避并加入 Jitter，最多 3 次；
- 熔断按 `provider + model + region` 隔离；
- 最近 20 次失败率超过 30%，或连续失败 5 次时，熔断 5 分钟；
- `INVALID_INPUT` 与 `CONTENT_BLOCKED` 不计入 Provider 故障率；
- `MODEL_RETIRED` 立即禁用模型。

## 14. 前端实现边界

保留：

- Next.js、React、TypeScript strict 和测试底座；
- Cut、Scene、Preview 状态语义；
- Retry、Save、Rebuild 的纯状态转换测试思路；
- Lucide、Skip Link、ARIA 与 44 px 触控基础。

重构：

- `AppHeader` → 64 px 暗色工具栏；
- `ProjectProgress` → 页面标题中的紧凑阶段导航；
- `SceneNavigator` → 64 px 应用栏或移动 Sheet；
- `CutCard` → 媒体优先的 Storyboard 卡；
- `AudioContextBar` → Shot Editor / Preview 的真实 Transport 与 Waveform；
- `CutInspector` → 快速编辑抽屉与独立 Shot Editor；
- `PreviewStatusBar` → 主 CTA 附近的 Job 摘要。

删除：

- 生产路径中的 `workspaceFixture` 与 `sceneCopy`；
- CSS 渐变假缩略图；
- 硬编码波形、BPM 和状态统计；
- 只改内存却声称保存的流程；
- 可点击但无行为的按钮。

选中 Scene 与 Cut 写入 URL Search Params。抽屉开关、播放状态等临时 UI 状态保留在本地。

## 15. 验收标准

### 15.1 视觉与响应式

- 1440 × 900：Storyboard 4 列完整可见，画面为绝对主角；
- 1280 × 800：4 列不挤压标题与主要操作；
- 1024 × 768：3 列，抽屉不引发布局跳动；
- 768 × 1024：2 列，Sheet 支持键盘操作；
- 390 × 844：单列，首屏可看到画面、当前镜头和主 CTA；
- 页面根节点无横向溢出；
- 稳定 Fixture 的截图差异 `maxDiffPixelRatio <= 1%`。

### 15.2 无障碍与交互

- axe 无 Serious / Critical 问题；
- Tab、Shift + Tab、Enter、Escape、Space 和方向键流程通过；
- Sheet 具备焦点陷阱、滚动锁、Escape 关闭和焦点恢复；
- 200% Zoom 可用；
- 正文对比度至少 4.5:1；
- 遵循 `prefers-reduced-motion`。

### 15.3 性能与媒体

- LCP 小于 2.5 秒；
- CLS 小于 0.1；
- 初始只请求缩略图和 1 个 Poster；
- 不预载多段视频；
- 动态 AI 素材不参与视觉差异验收，使用固定 Fixture 资产。

### 15.4 业务状态

- 单 Cut 重试不改变成功 Cut；
- 重新生成创建新的 Take，旧版本可回退；
- 时间线变化后，旧 Preview 与 Export 明确标记过期；
- SSE 中断不把任务误判为失败；
- 刷新后从后端快照恢复真实状态；
- 自动降级、预算暂停和内容审核均有明确提示。

## 16. P0 范围控制

P0 不实现以下能力：

- Neural Frames 的 Modulation；
- 专业多轨剪辑；
- 逐帧参数控制；
- 完整角色与环境资产库；
- Lip Sync；
- 社区、计费支付和多人协作。

本轮只取「Storyboard 大卡片 + Shot Editor 左右分屏 + Preview 时间线 + 暗色媒体工作台」4 层。避免因复刻竞品而扩张成专业剪辑器。

## 17. 参考资料

- [Neural Frames 产品页](https://www.neuralframes.com/product)
- [Neural Frames Frame-by-Frame Editor](https://help.neuralframes.com/en/articles/9992749-getting-to-know-the-frame-by-frame-editor)
- [One More Shot Music Video](https://www.onemoreshot.ai/make-a-music-video/)
- [4i Music Video](https://4i.app/music-video?new=1)
- [Wan 3.0 Video](https://help.aliyun.com/zh/model-studio/wan3-0-video)
- [阿里云百炼模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)
- [Kling API 计费](https://kling.ai/document-api/productBilling/billingMethod)
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)

## 18. 规格自检

- 无 TODO、TBD 或未决占位符；
- 界面结构、响应式、状态和模型路由之间无矛盾；
- 实现范围保持在 P0，不引入专业多轨编辑；
- Neural Frames 的采用边界与品牌替换边界明确；
- 成本区间为产品预算目标，不作为供应商永久报价承诺；
- 模型版本与价格必须从服务端配置读取，避免前端硬编码。
