---
name: "狗头人工坊 · 项目创作工作台 V4"
description: "有趣的作品，克制的工具；在同一项目中创作、调整和保存狗头人。"
colors:
  background: "#f7f7f5"
  surface: "#fff"
  canvas: "#efefec"
  foreground: "#242622"
  secondary-text: "#62655e"
  border: "#e2e3dc"
  control-border: "#92958d"
  primary: "#242622"
  on-primary: "#fff"
  primary-hover: "#3c4038"
  focus: "#3658c9"
  accent-soft: "#edf0fb"
  muted: "#eeefea"
  error: "#b42318"
  warning: "#8a5900"
  composer-border: "#d4d6cc"
  composer-focus-border: "#9ea99a"
typography:
  display:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.025em"
  display-mobile:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-.025em"
  headline:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.4
  headline-mobile:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
  body-intro:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 500
  caption:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  chat-title:
    fontFamily: "\"Helvetica Neue\", \"PingFang SC\", \"Noto Sans SC\", \"Microsoft YaHei\", Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0"
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
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
  composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "12px"
  mode-selected:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  original-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px 4px 4px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "32px"
---

# 狗头人工坊 · 项目创作工作台

## Overview

**Creative North Star: "有趣的作品，克制的工具"**

### Product Personality
用户上传一张人像，得到狗头人，选中作品继续调整并下载。面试展示和跨模型研究是作者场景；普通创作者无需先理解协议。

工作台让图像成为视觉重心：温和的灰白底色承托作品，近黑主操作负责推进任务，蓝色只提示选中与焦点。对话与参数保持紧凑、平面，留白用来区分作品、说明与下一步。

**Key Characteristics:**

- 作品领先，完整展示图像，明确当前修改基底。
- 一个项目与一个常驻创作输入框，连续调整不跳转流程。
- 平面分组、轻边界、紧凑工具，保留必要状态和键盘操作。

### Visual Direction
2026-09-14：用户确认复现 Lovart 核心图片工作台，保留人像转狗头人的核心。此规范覆盖旧 V2；旧版归档在 docs/design/DESIGN-V2-archive.md。本轮在已确认 V4 方向上合并刷新，不重新选择视觉方向。

主对照 Lovart 的“入口 → 项目 → 对话与画布 → 编辑 → 导出”，依据其官方入门、模型选择文档和公开界面。登录内工作台未完成实测，不能宣称逐像素一致。Recraft 只用于校验基于当前作品编辑的流程，不混搭视觉。

三方向已比较：Lovart 对话画布最匹配连续创作；Pet To Human 的单次变身缺少持续编辑；Qwen Gradio 是低门槛实验台但不足以承担成熟产品。采用第一种。保留品牌、原创示例和犬种素材、真实模型接口、Radix 控件。替换原来的大表单与三入口平级导航。

此文件的实现数值取自 src/index.css、后加载的 src/workspace.css 及基础组件；frontmatter 是当前 V4 token 快照，新增实现应同步维护。保留以下用户要求章节，按通用 DESIGN.md 八节结构组织。本次文档刷新不构成浏览器验收；登录内 Lovart、真实供应商调用与真实生成效果均不在本次文档核验范围。

## Colors

### Color
灰白背景与画布建立柔和分层，近黑主操作与正文统一，蓝色用于选中和焦点。frontmatter 保留源 CSS 的颜色格式，不将旧 V2 颜色当作 V4 默认。

### Primary
- **近黑主操作**：primary / on-primary 用于推进当前任务；primary-hover 是真实悬停色。
- **焦点蓝**：focus 用于版本选中、键盘轮廓与活动状态；accent-soft 用于轻提示与次级操作悬停。

### Neutral
- **暖白背景**：background 是应用外底，surface 是输入、对话与浮层表面，canvas 承托完整作品。
- **灰黑文字**：foreground 表示主要内容，secondary-text 承载元数据与辅助说明。
- **轻灰边界**：border 分隔区域，control-border 用于独立表单控件；composer-border 与 composer-focus-border 对应常驻输入容器的默认与聚焦状态。
- **浅灰选中底**：muted 用于创作模式的选中背景。

### Semantic States
error 表示可恢复错误，warning 表示缺少连接等提示；不把成功状态伪装成模型质量评分。

**The Quiet Accent Rule.** 黑色主要按钮，蓝色仅用于选中和焦点，同屏最多一个彩色强调。

## Typography

### Typography
**Display Font / Body Font:** frontmatter 中的同一系统字体栈，以 Helvetica Neue、PingFang SC、Noto Sans SC、Microsoft YaHei、Arial 和 sans-serif 回退。旧标题字体子集不足以覆盖新标题，新界面明确采用系统中文回退，不虚报已补字体；字体许可与素材来源仍由 docs/design/ASSETS.md 维护。

首页标题用 display / display-mobile；设置与实验页用 headline / headline-mobile。实际首页为桌面36px、手机28px，工具页为28px、手机26px；替换旧草案32px/26px的笼统定义。标题字重600，避免巨型 H1 与全屏粗体。

Body 基线是16px/400/1.65；首页描述为15px，手机描述13px/1.8。聊天段落以13px、辅助说明以12px为主，长内容允许换行。按钮采用 label，项目对话标题采用 chat-title；顶栏品牌是16px/650，手机14px。保留实际角色差异，不把所有正文统一成15px。

独立表单控件默认14px/1.5，手机16px；常驻输入框首页16px、桌面对话14px、手机16px，以避免移动输入缩放。Caption 用于模型、版本和辅助说明，继承所在组件的行高。

## Layout

### Spacing
frontmatter 的 s1 至 s24 对应现有4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96节奏。组内8–16；工作区24；首页标题与输入32，手机24；示例区距输入32。作品与输入由画布和对话区域关系分隔，不要求固定48px间隔。

### Container
全宽应用顶栏桌面64px、手机56px；首页最大960px、输入最大680px、示例最大620px，桌面左右24px，手机16px。设置/实验内容最大1080px。

桌面项目：剩余空间为画布，右侧384px对话栏；768–1050px右侧缩至350px。项目高度为视口减64px、最小620px，画布网格行允许内部收缩，图像完整 contain，版本横向滚动。1600px起画布增加留白、作品最大1100px，首页上边距96px。

767px及以下改为作品在上、修改框在下的单列，页面自然滚动。顶栏保留可访问名称、收起文字导航；作品区高度经精修为260px。对话默认收起，作品与版本之后直接进入修改输入；“查看创作对话”展开旧对话，展开区最大220px并可滚动。输入不以固定定位遮挡结果，底部留安全区空间。移动端仍可选择版本、切换原图、下载和访问设置。

## Elevation & Depth

### Shadow
静态区域不用阴影，以底色和边界区分画布、对话、输入与作品。浮层使用现有阴影（0 8px 24px rgb(20 30 24 / 12%)），避免把聊天分组做成悬浮卡片。完整阴影词汇由 .impeccable/design.json extensions.shadows 承载。

交互颜色过渡沿用160ms；忙碌旋转使用1.4s线性循环，只表达等待，不暗示进度百分比。减少动态偏好关闭连续动画与滚动过渡。

## Shapes

### Radius
Button 使用 lg；独立 Input、选择器及缩略图切换使用 md；常驻输入容器与 Modal 使用 xl；照片内层与小标签保留较小圆角。基础 Input 的实际圆角为6px，区别于旧草案8px；作品示例边界为8px，不统一包装成12px卡片。图像不做圆形裁切，分组不用重复卡片。

## Components

### Components
- **Button**：复用现有 Button，主操作近黑、次级文字或轻描边；常规按钮最小高度44px；忙碌不可重复提交。手机版顶栏图标按钮宽40px、高至少44px；创作模式按钮高40px，记录实际例外，不声称所有控件已达到44×44。
- **Input**：一个常驻创作输入框；上传、犬种与发送在同一区域。中文 IME 不误提交，Shift+Enter换行。未指定细节采用默认值。输入容器通过边界变化表达聚焦；键盘轮廓用焦点蓝，错误与禁用保留基础组件状态。
- **Tabs**：Agent 创作 / 自己控制，同一项目与连接，不复制接入流程；选中模式以浅灰底与深色文字呈现。
- **Sidebar**：桌面项目右侧对话栏；手机旧对话默认收起，展开按钮含 aria-expanded / aria-controls，可键盘操作。历史用可键盘操作的 Radix Dialog。没有假工具栏。
- **Dialog**：上传替换、犬种目录、历史和设置均复用 Radix。焦点约束、Escape、恢复焦点、内部滚动。桌面内边距32px，手机通常24px；大图弹窗按可视空间调整。
- **Card**：作品缩略图、参考图、输入框有必要边界；聊天说明和参数分组保持平面。sidecar 的容器预览取实际常驻输入容器，不合成通用卡片。
- **Table**：模型列表与对比记录，图像保持足够面积。
- **Upload**：支持点击拖放、图片格式与大小验证；上传仅本地预览。换图开新项目并保留旧项目。
- **Empty State**：首页直接看到变身示例、上传、开始创作；未配置提前提示，在生成前解决，不丢输入。
- **AI Output**：完整图像；仅保留“切回自己 / 看狗头效果”对照按钮；版本标识、编辑基底、下载、模型对比紧邻作品。明确示例身份。
- **Loading**：真实阶段文案，无假百分比；旧结果保留，可停止等待，告知供应商可能继续处理。
- **Success**：显示新版本并选中；输入框可直接发修改要求。旧版本可选、可下载。
- **Error**：就近报错、保留作品与草稿、支持重试；检查失败不能丢失生成图。

### Workflow
新创作：上传 → 选犬种或交给 Agent → 可选一句要求 → 一次发送 → 作品。

继续：选择版本 → 输入修改 → 以该版本图像为输入 → 新版本。明确“从原图再创作”可回原人像，原图始终保留。

对比：冻结某次真实调用的图片、提示词 → 选2–3模型 → 同任务执行。不会各自改写方案。

历史：图片与作品保存在当前浏览器 IndexedDB，仅本机；不含密钥。服务端托管连接独立认证与保存，不把密钥下发前台。会话模式继续支持。

## Do's and Don'ts

### Do
- **Do** 主对象统一复现；作品领先；改哪张必须看得见；版本与实际输入绑定。
- **Do** 状态和能力可验证；示例持续标注；首轮与后续编辑使用正确图像来源。
- **Do** 桌面1440×900、手机390×844实测；至少5条具体 critique 并修正复查。

### Don't
- **Don't** 蓝紫渐变、营销长页、虚假任务、假模型评分、Card堆叠、无效画布工具。
- **Don't** 伪造思考、上传即付费调用、隐式重绘、把静态示例当实测。
- **Don't** 凭参考界面宣传尚未实现的局部编辑或无限画布；截图不代表真实模型效果。

### 2026-09-14：模型手填与提示词生成器

所有新增绘图/理解模型的 ID 留空，选择供应商只填地址，不选择型号；编辑已有配置保留用户已保存 ID。文本框有可见标签、用途提示、必填验证。提示词生成器从创作输入区的文字按钮打开；沿用 Radix Dialog、白底、近黑主要操作、16px移动输入、现有间距与边框。单列显示创意输入和可编辑生成结果，连接设置默认收起（未配置时展开）。只在明确点击时调用 DeepSeek 一次；失败保留想法与上次结果。复制或应用均不触发绘图，关闭中止等待，过期响应不能覆盖新项目。只发送文字、犬种与编辑范围，不发送照片。
