---
name: 狗头人工坊 V2
description: 以照片和创作意图为中心的摄影工作台
colors:
  background: "#f3f5f7"
  surface: "#ffffff"
  foreground: "#20242c"
  secondary-text: "#596170"
  border: "#dde2ea"
  control-border: "#858d9b"
  primary: "#3658c9"
  on-primary: "#ffffff"
  primary-hover: "#2946a8"
  accent-soft: "#edf0fb"
  muted: "#e9ecf1"
  error: "#b42318"
  warning: "#8a5900"
typography:
  display:
    fontFamily: '"Studio Noto Sans", "Helvetica Neue", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Studio Noto Sans", "Helvetica Neue", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  mobile-heading:
    fontFamily: '"Studio Noto Sans", "Helvetica Neue", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "28px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  body:
    fontFamily: '"Helvetica Neue", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: '"Helvetica Neue", "PingFang SC", "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s6: "24px"
  s8: "32px"
  s12: "48px"
  s16: "64px"
  s24: "96px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-text}"
  style-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  intent-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "20px"
  upload:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-text}"
    rounded: "{rounded.lg}"
    height: "64px"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "32px"
---

# Design System: 狗头人工坊 V2

## Overview

**Creative North Star: "摄影选片桌"**

### Product Personality

有趣而成熟，清楚、可操作、诚实。照片和犬系角色提供趣味，界面用安静的控制与直接反馈帮助创作。标题说明动作，图像说明效果；简短方案、观察和版本帮助用户继续修改，不把工具执行包装成虚构思考。

### Visual Direction

采用冷白画布、石墨文字、钴蓝操作和摄影作品。视觉重心落在作品与一句话想法上，界面边界适度、导航浅，复杂模型配置渐进展开。参考站仅启发创作趣味；其配色、三步流程、爪印和开盲盒不属于本项目设计承诺。

**Key Characteristics:**

- 作品提供色彩，钴蓝标记行动、选择与焦点。
- 自托管中文标题配系统正文，以字重、留白和对齐组织信息。
- 桌面作品与意图并置；手机先输入，主操作固定，作品完整可滚达。
- 示例、生成结果、检查与错误均有可见文字身份。

### Project Audit 与规范依据

2026-09-12 首次检查时目录为空，尚无 PRD、README、设计、依赖、代码、截图或 Git 仓库；这是历史基线，不是当前清单。用户随后确认人像转狗头人与跨模型实验，用于可操作的面试展示。现有 React / Vite / TypeScript、Express、shadcn/Radix、Lucide，包含创作 `/`、对比 `/compare`、接入 `/models`。创作为主，对比为辅助；范围和接口以 PRD.md、PRODUCT.md、README.md 为准。

本次在用户授权下合并 V1 与 V2 条目。当前 tokens 由 `src/index.css` 及实际组件提取；页面构图源于 `docs/design/STUDIO-V2.md`。正文描述实施值，废止旧深绿配色、1200px 容器、24px 手机边距、40px 创作标题及全控件8px圆角说法。此文件是唯一现行视觉规范，旧审查和概念稿仅作历史证据。

### 三个方向的比较与演进

| 维度 | A · 创作工作台（选定并演进为 V2） | B · 趣味影像画廊 | C · 专业模型评测台 |
| --- | --- | --- | --- |
| 字体 | 清楚的中文任务标题、轻量标签 | 更重的作品标题、少量说明 | 紧凑 UI、参数等宽 |
| 密度 | 中等，图像和想法优先 | 较疏，作品浏览优先 | 较密，多字段、多结果 |
| 间距 | 16/24/32 组织任务 | 48/64 大图节奏 | 8/12/16 参数节奏 |
| 导航 | 三个顶部任务入口 | 创作、浏览作品 | 实验与设置侧栏 |
| 用色 | 中性底色，单一操作色；V2 为钴蓝 | 图片承担主要色彩 | 中性基底、局部状态色 |
| 组件构造 | 图片、自然语言、犬种和主操作 | 图像、标题、再创作 | 输入基线、模型列表、结果矩阵 |
| 布局节奏 | V1 偏表单；V2 作品左、创作右 | 连续作品流 | 控制区配并排实验 |
| 取舍 | 保留可操作性，以 V2 修正首版表单感 | 借用作品优先，不增加作品社区 | 对比置于独立页面，避免首屏后台化 |

### Tool Audit 与证据边界

frontend-design、Impeccable、shadcn/Radix 已用于本轮；Browser 技能与受支持接口可用。早期未在已检查位置发现 OpenPencil、Stagewise、React Grab，当前工具清单未发现 21st.dev MCP；不代表机器其他位置绝对不存在，也不为凑齐工具而安装。UI/UX Pro Max 曾用于基础校准，不是产品事实来源。

浏览器验证、具体批评与修正以 `docs/UI-REVIEW.md` 的对应版本记录及截图为准；目标是实际 1440 × 900 和 390 × 844，旧 V1 截图不替代 V2。此文只记录已实施设计，不声称供应商实测或公开部署完成。

## Colors

### Color：Background / Surface / Text / Border / Accent / Semantic

前置 tokens 是数值规范；现有 CSS 通过语义变量及 Tailwind 映射使用它们。

| 角色 | Token | 使用规则 |
| --- | --- | --- |
| Background | background | 页面冷白底，托住照片与白色控制面 |
| Surface | surface | 创作面板、输入、顶栏、弹窗 |
| Primary Text | foreground | 标题、正文与主要标签 |
| Secondary Text | secondary-text | 描述、参数、真实状态；不靠透明度降低可读性 |
| Border | border | 区域分隔；不作为普通输入唯一轮廓 |
| Control Border | control-border | 输入、描边按钮和上传边界 |
| Accent | primary / primary-hover / on-primary | 主操作、选中、焦点及悬停文字背景组合 |
| Accent Surface | accent-soft | 低强调选择、上传拖入与交互反馈 |
| Neutral State | muted | 缺图、缩略图背景与次级按钮 |
| Error / Warning | error / warning | 局部错误与需注意信息，始终配文字 |

成功检查点当前使用局部绿色 `#30704d`，它是检查组件的观察状态，不是第二品牌色；没有全局 success token。画布灰 `#e3e6e8`、意图框 `#fafbfc` 是该组件材料值，不提升为跨页面色阶。对比度目标为正文 4.5:1、大字和必要控件图形 3:1，新增组合须测量。

**The Photo Color Rule.** 图像提供丰富色彩；界面强调色用于行动和状态，不铺成装饰背景。

## Typography

### Chinese / English / Weights / Line Height

标题使用自托管 `Studio Noto Sans`（Noto Sans SC 的 600 字重子集），资源为 `public/fonts/studio-heading.ttf`，`font-display: swap`；许可为 `public/fonts/OFL.txt`，原始来源记录为 `docs/design/font-source.css`。更改标题必须同步子集或明确接受回退。

正文和控件使用前置 body 字体栈：英文优先 Helvetica Neue，中文回退 PingFang SC / Noto Sans SC / Microsoft YaHei，末尾 Arial / sans-serif。中文和英文不分别制造装饰层级；普通字重400、操作和小标题500、主标题及字段标签600。没有现用独立等宽展示体系。

| 层级 | 桌面 / 手机 | 字重 / 行高 | 用途 |
| --- | --- | --- | --- |
| 创作标题 | display / mobile-heading | 600 / 1.3 | 一句话说明变身任务 |
| 对比、接入标题 | headline / mobile-heading | 600 / 1.35 | 页面任务标题 |
| 弹窗标题 | 22 / 20px | 600 / 1.4 | 当前短任务 |
| 工作区标题 | 15 / 14px | 500 / 继承1.65 | 画布、小分区 |
| 正文 | 16px 基础；工作台描述15 / 14px | 400 / 1.65；手机描述1.8 | 说明与阅读 |
| 标签 | label | 600 / 1.5 | 可见字段名 |
| 输入 | 14 / 16px | 400 / 1.5 | 手机避免小字输入 |
| 辅助 | 12–13px，紧凑示例11px | 400 / 继承1.65或局部1.5–1.8 | 来源、模型、调用预算与短说明 |

所有页面主标题最终字距为 `-0.025em`。标题按语义短句自然换行，正文用 pretty 换行；不以全大写眉题、装饰衬线或满屏加粗建立层级。紧凑辅助字号是现有局部样式，不应用于主要动作或长文。

## Layout

### Spacing

统一保留前置间距档位 **4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px**（对应 s1–s24）。4/8用于紧密关联，12/16用于组内关系，24/32用于工作区与任务组，48用于页面下留白。64/96已定义但不要求首屏强行使用。20px是当前控制面板及手机边距的刻意布局尺寸；尺寸、比例、行高不强套间距刻度。

### Container

顶栏、主内容、页脚最大1280px。大桌面居中；768–1375px两侧32px；767px及以下两侧20px。桌面顶栏64px高，手机品牌和48px导航分成两行。主内容桌面上24px、下48px，手机上下24px。

创作双列为 `minmax(0, 1.55fr) minmax(360px, 1fr)`，间距32px；768–1375px为1.3:1、右列至少340px、间距24px。画布始终3:2，图像完整 contain；手机输入面板在前、画布在后，间距32px。手机固定主操作的底部内边距使用 `max(8px, env(safe-area-inset-bottom))`，页脚留120px下空间，最终内容必须可滚到操作条上方。

### 核心页面骨架与状态

- **创作 `/`：** “换个狗头，保持你的风格。” → 作品画布与创作设置。设置包含人像、一句话想法、犬种、展开绘图设置、创作模式和单一主操作。画布含前后对照、可辨识的人脸缩略图、真实版本、检查与执行记录。手机标题说明旁保留带“效果示例”的小图。
- **对比 `/compare`：** 固定原图与提示词 → 选择2–3模型 → 开始对比 → 各模型独立结果。桌面2/3列，手机单列；图片状态紧邻图片，参数渐进展开，不做排行榜。
- **接入 `/models`：** 添加模型与配置工具栏 → 模型行 → 接入说明；理解模型配置独立说明。添加/编辑用弹窗，密钥状态与连通结果区分。

初始示例、上传后待生成、缺少模型、真实执行中、成功、错误、部分失败均需有对应内容和恢复动作。换照片清除旧结果语境；已生成版本绑定本轮提示与检查。停止等待不能保证供应商停止处理。具体状态实现以 session 与页面组件为准。

## Elevation & Depth

### Shadow

默认平面：按钮、工作区、图片均无承托阴影，用白色表面、灰底与必要分隔表达层次。弹窗使用 `0 8px 24px rgb(20 30 24 / 12%)`，遮罩为半透明黑。下拉层的基础组件保留自身轻阴影，不推广到静态页面分区。

全局键盘焦点为2px钴蓝 outline、4px偏移；原图/结果切换按钮聚焦时为3px、4px偏移。公共样式取消按钮和输入的 box-shadow，不把底层工具类的 ring 宣称为实显发光效果。交互以160ms颜色变化为主；真实忙碌图标1.4s线性旋转；尊重减少动态偏好，不模拟进度。

**The Flat Surface Rule.** 静态工作面保持平面，浮层才使用环境阴影，焦点靠清晰边界表达。

## Shapes

### Radius：Button / Input / Card / Modal

| 类型 | 当前圆角 | 适用范围 |
| --- | --- | --- |
| Button | md（6px） | 基础按钮与分段选项 |
| Input | md（6px） | 普通输入与 Select |
| 意图框、上传、犬种参考图 | lg（8px） | V2 创作组件 |
| Card / 创作面板 | xl（12px）；手机lg（8px） | 现有独立白色创作控制面，无通用 Card 组件 |
| 画布 | xl（12px） | 3:2前后对照 |
| Modal | xl（12px） | 所有弹窗 |
| 标签 / 内部缩略图 | sm（4px） | 图片上的短来源标签 |
| 版本缩略图 | md（6px） | 会话版本序列 |

圆形仅用于小状态点等明确功能。分组优先用留白、对齐与分隔，不以层层卡片制造结构。

## Components

### Button

主按钮用 primary / on-primary，悬停 primary-hover；基础按钮至少44px，生成操作48px、满列宽。描边按钮白底和 control-border；文字、ghost 操作保持低强调。禁用使用透明度和不可重复提交，真实等待配状态文字。现有紧凑设置/目录辅助动作有28–36px覆盖，不将其作为新主操作尺寸规范。

### Input

可见标签、必要说明、就近错误；placeholder仅作示例。普通输入6px圆角、44px最小高度，桌面14px、手机16px。意图 textarea 72px起始高度可垂直调整，8px圆角与浅底。密码只保留页面内存；配置保存不表示模型已连通。

### Tabs / Navigation

顶栏是三个真实路由链接，非 Tabs：活动项钴蓝文字加底部2px线。风格使用 Radix ToggleGroup，白色选中块、6px圆角；手机选项44px。Agent/手动模式用有 `aria-pressed` 的按钮。没有独立 Tabs 组件，不把切换控件错误声明为 tabs 语义。

### Sidebar

没有全局 Sidebar；创作页右侧是任务设置面板，手机移到作品之前。保留顶部三入口，不为增加页面而自动引入后台侧栏。

### Dialog

复用 Radix：可见标题与关闭、焦点进入/约束/恢复、Escape、长内容内部滚动。桌面32px内边距，手机24px；最大高度扣除48/32px视口留白。犬种目录弹窗最大640px，手机单列；模型弹窗手机底部操作保持可见。浮层必须在真实内容下验证焦点与滚动。

### Card

没有通用 Card 组件。意图面板是单一白色任务容器，20px内边距；模型配置采用分隔行，输出直接展示图像与元信息。不要为每个字段单独包卡。

### Table

没有数据 Table 组件；模型配置用行，对比用图像列。后续若字段对照确有价值再引入表格，不把图片实验强行缩成表格单元格。

### Upload

点击和拖放等效，显示 JPG / PNG / WebP 与10MB限制；上传仅本地预览。V2上传区64px高、8px圆角，拖入时 accent-soft，照片以48px缩略图呈现并支持更换/删除。发送范围在主操作周围说明，与实际理解/绘图数据流一致。

### Empty State

缺照片显示等待输入，缺模型给接入下一步，目录搜索为空给清楚提示。示例始终带文字身份；上传真实照片后不残留示例输出。单一问题避免重复主按钮和大插画。

### AI Output

3:2完整照片，默认展示完整狗头结果。前后对照只保留左下缩略图按钮：“切回自己”显示完整原图，再点“看狗头效果”返回作品。缩略图显示将要切换到的图像；不再叠加滑杆、分界线或第二个切换入口。新作品默认显示结果，切换只影响预览，不改变原图、版本或下载。示例标“效果示例”“预制示例，非模型实测”；真实结果显示模型、耗时、尺寸，实际可用后才提供下载。版本与检查绑定；检查失败保留图像并说明不确定性。

2026-09-13 对照交互取舍：A 滑杆适合逐处比较但会切断完整犬头；B 单一按钮在相同位置切换完整画面，更适合本产品的造型展示与手机点击；C 两者并存重复且抢占画面。采用 B，保留人脸缩略图帮助首眼辨认变化，沿用现有尺寸、字体和颜色。

犬种参考图只是外观提示，非用户图片生成结果。现用AI素材为 `public/images/example-person.png`、`example-dog.png`、`breed-atlas-v3.png`（24 犬种、6 列 × 4 行）；对应精确提示词在 `docs/design/*.prompt.txt`，首批来源在 `docs/design/ASSETS.md`。设计概念图仅作内部参考，不能冒充页面截图或实测输出。

### Loading

使用后端真实状态与可访问 `role="status"`；停止等待、防重复提交、失败恢复都与实际可用能力一致。方案和调用记录可展开，展示简短动作和观察证据，不编造百分比、思考、评分或调用结果。

### 连续创作与必要澄清

保留摄影工作台，减少来回操作。比较 A 底部问题与跳转输入框、B 独立聊天侧栏、C 在现有输入框上方显示问题并直接回答：采用 C，避免分散创作入口。普通表情和造型细节由助手自主完成；仅目标人物不明或明确约束冲突时询问，并尽量一次问清。

首次「开始创作」；必要澄清时在原输入框上方显示问题和可选回答，选项点击即发送并继续。无选项时直接输入回答，Enter 发送、Shift+Enter 换行，中文输入法选字不触发发送。移动端保留唯一底部发送按钮。问题状态空白不能发送，防止原样重复请求。说明选择会继续执行原有次数上限，不静默追加绘图。

发送后的要求、助手提问保留当前照片的最近六轮会话上下文；输入框清空待下一次补充，失败恢复草稿。更换照片清除上下文。继续创作保留上次作品，失败也能查看旧图。提示、选择、输入及提交形成同一区域，已有方案与调用记录仍可展开查看。

已有作品且未输入补充时，按钮为「再生成一张」；输入后为「按这句调整」。空白 Enter 不触发再次绘图。快捷回答说明只解释点击结果，调用上限沿用主操作区说明，避免重复占据手机空间。

### 2026-09-13 犬种与理解模型接入增补

保留现有摄影工作台。犬种目录为全部 24 种提供摄影参考，区分口鼻、耳形、嘴型、舌头露出程度和方向；这些表情是创作建议，不是犬种固有性格。参考与提示词共享表情描述，用户明确要求优先。

接入方案比较：A 多厂商按钮平铺易挤占手机首屏；B 按能力分组先筛选会增加选择步骤；C 供应商与模型两个选择控件，紧接一段能力说明。采用 C，复用现有 Select/Dialog，不增加卡片。路径为供应商 → 模型 → 能力核对 → 密钥 → 保存。自定义模型入口与预设同级，可填写完整兼容接口。

视觉模型支持看图、策划、绘图和结果检查；文字模型仅按文字策划并调用绘图工具，不接收图片、不检查、不自动追加绘图。模式区别同时出现在接入表单、创作主操作和真实工具状态中。密钥仍只在会话内存保存，切换供应商清空。官方预设不等于已连通验证。

## Do's and Don'ts

### Do

- Do 让作品、任务标题和一个主操作形成清楚层级。
- Do 复用语义 tokens、shadcn/Radix 基础组件与 Lucide 图标。
- Do 保留示例来源标签、版本归属和真实工具状态。
- Do 为新内容检查中文换行、键盘焦点、手机滚动与减少动态偏好。
- Do 在1440 × 900与390 × 844实际浏览器中截图、批评、修正并复查。
- Do 同步维护字体许可、标题子集与图片精确提示词来源。

### Don't

- Don't 照搬参考站的配色、流程、爪印或装饰。
- Don't 用渐变、发光、大阴影、装饰眉题或卡片堆砌替代信息层级。
- Don't 把预制示例、本地模拟响应或一次试验包装成真实模型能力排名。
- Don't 让协议细节、密钥或接口参数占据创作首屏。
- Don't 隐藏原脸、遮挡手机最终内容或以小尺寸辅助动作代替主操作。
- Don't 把构建通过、文档完成或旧截图当作本轮真实供应商和公开上线验证。
