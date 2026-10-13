---
name: "AI 镜界 · AI 写真"
description: "以真实写真照片为主体的浅色操作工作区"
colors:
  primary: "#171717"
  primary-hover: "#333333"
  primary-text: "#f9dbca"
  surface: "#fff"
  canvas: "#f7f8fa"
  canvas-task: "#f5f5f5"
  ink-task: "#222222"
  muted: "#6e737e"
  muted-control: "#646b76"
  muted-task: "#707070"
  line: "#e9e9ed"
  nav-current: "#f4f5f7"
  profile-selected: "#fff5f0"
  field-bg: "#f8f8fa"
  field-line: "#e2e4e9"
  upload-peach: "#fff0e9"
  upload-drag: "#ffe0cf"
  error: "#b3261e"
  error-task: "#ad3636"
  success-task: "#477257"
  pending-task: "#755447"
typography:
  display:
    fontFamily: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  title:
    fontFamily: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.6
  body:
    fontFamily: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  category:
    fontFamily: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.6
  label:
    fontFamily: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "22px"
  caption:
    fontFamily: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  field: "8px"
  tab: "9px"
  control: "10px"
  photo: "12px"
  modal-mobile: "14px"
  modal: "18px"
spacing:
  tight: "8px"
  control-gap: "12px"
  mobile-gutter: "16px"
  compact: "20px"
  panel: "22px"
  section: "24px"
  gallery-column: "26px"
  gallery-row: "28px"
  workspace-top: "30px"
  layout-gap: "32px"
  workspace-gutter: "36px"
components:
  button-primary:
    textColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.primary-text}"
  button-task-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-text}"
    rounded: "{rounded.field}"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-hover}"
    rounded: "{rounded.field}"
    padding: "0 16px"
  input-prompt:
    backgroundColor: "{colors.field-bg}"
    rounded: "{rounded.tab}"
    padding: "14px"
  input-name:
    backgroundColor: "{colors.surface}"
    textColor: "#202020"
    rounded: "{rounded.field}"
    padding: "0 12px"
  navigation-current:
    backgroundColor: "{colors.nav-current}"
    rounded: "{rounded.tab}"
  kind-tab-selected:
    backgroundColor: "{colors.primary-text}"
    rounded: "{rounded.control}"
    padding: "5px 20px"
  template-photo:
    rounded: "{rounded.photo}"
  profile-selected:
    backgroundColor: "{colors.profile-selected}"
    rounded: "{rounded.control}"
    padding: "8px"
---

# Design System: AI 镜界

## Overview

**Creative North Star: "写真选样工作区"**

以用户指定的美图 AI 写真真实页面为参照，照片承担主要视觉，白色固定页头与图标导航承载方向，浅灰工作区承载浏览、创作和任务。黑色动作与浅桃色文字形成明确的操作重心，界面保持中文工具的密度与可读性。

这份规范记录已实现的 `.portrait-app`、`.portrait-modal` 及档案、任务、邀请码页面。原始样片用于选择画面方向；用户原图和实际结果保持清晰身份。原有暗房、珊瑚红及双版本方案已由本轮授权替换，未进入当前规范。

**Key Characteristics:**

- 真实照片主导，名称紧随照片。
- 白与浅灰组织结构，黑与浅桃强调操作。
- 桌面固定导航与可折叠档案栏，手机底部导航与两列选样。
- 真实状态和恢复动作优先，浮层用于受保护的上传或集中选样。

## Colors

前置令牌记录当前页面的实际色值；渐变、遮罩与状态完整样式保存在 `.impeccable/design.json`。

### Primary

近黑用于文字、主动作和焦点；浅桃用于主动作文字及选中的写真类型。主按钮实际采用从深灰到近黑的轻微渐变，任务页采用实色近黑按钮，悬停收敛为深灰。

### Neutral

白色承载导航、档案栏、表单与浮层。浅灰区分工作区、任务画布和输入区域；中灰辅助文字与细分隔线让图片保持主导。小型未选控件、占位文字及创作提示使用 `muted-control`；档案选中使用浅桃白底和深色边线。

错误使用红色并附文字，任务成功使用低饱和绿，等待使用暖棕。颜色不单独表达状态。

**The Photo Truth Rule.** 主题样片、用户原图与实际生成结果必须有可识别的文字说明，不将预览或等待占位呈现为成片。

## Typography

所有页面沿用前置令牌中的中文无衬线字体栈；没有单独的展示字体或远程字体依赖。字号与字重直接建立浏览和操作层级。

- 横幅标题采用 `display`；桌面窄屏降至 36px，手机降至 32px。标题追踪保持克制，手机横幅说明取消字距。
- 档案与任务页标题桌面为 `headline`，手机为 24px。创作表单标题采用 `title`，手机为 20px；浮层标题桌面 21px、手机 18px。
- 正文以 `body` 为基准；分类采用 `category`，手机分类为 14px。照片名称采用 `label`，手机为 12px。
- 描述框桌面 13px、行高 1.75；手机提升到 16px。任务描述保留换行，并限制在 65ch 内。
- 数量、日期和字数采用等宽数字。名称过长时，侧栏与档案卡截断，任务详情和错误文案换行。

## Layout

桌面页头固定，高 64px；左侧图标导航宽 100px，位于页头下方。工作台可显示宽 294px、内部滚动的档案栏；折叠后主区收回该宽度。主区默认留白为顶部 30px、左右 36px、底部 50px。

目录由高 180px 的照片横幅、写真类型、分类/搜索和 3:4 网格组成。默认五列，列距 26px、行距 28px；1600px 及以上六列，1024–1279px 四列，640–1023px 四列且隐藏档案栏。搜索有输入时覆盖全部名称，分类切换清空搜索。

小于 640px 时页头高 56px，图标导航转为底部，导航高 64px 加安全区；主区边距 16px，目录两列，分类横向滚动、搜索独占一行。底部内容预留 70px 加安全区，避免导航遮挡。

创作区最大宽 1100px，桌面样片与表单按 0.9:1.1 分栏，间距 32px；手机纵向排列，样片宽为可用区的 66%，原比例展示。档案页最大宽 1320px，照片由手机两列逐步增至五列。任务内容最大宽 1400px，列表逐条展开照片与信息，详情在桌面将信息栏置于结果右侧，手机按顺序堆叠。完成页将“保存写真”放在标题区，手机状态与保存独占一行；结果画布手机高 min(48dvh,440px)、640px 及以上高 min(60dvh,560px)，独立于信息栏内容长度。邀请码表单最大宽 440px。

## Elevation & Depth

工作区以底色和细边线区分，照片卡和表单平放。浮层、账户菜单与帮助按钮使用带柔和模糊的偏移阴影；遮罩将当前任务置于前景。

- 账户菜单：`0 8px 30px #0002`。
- 通用浮层：`0 15px 50px #0003`，遮罩 `#0006`。
- 帮助按钮：`0 4px 18px #0001`。
- 原生大图对话框使用黑色 55% 遮罩；删除确认使用 45% 遮罩。

照片悬停缓慢放大至 1.025，并显露“制作同款”；按下主按钮下移 1px。渐变属于已选定参照的按钮、品牌图标和横幅，不扩展为文字渐变或装饰发光。减少动态效果偏好下禁用过渡及加载动画。

## Shapes

照片和内容容器以 `photo` 圆角为主体；输入采用 `field`，主动作采用 `control`。通用浮层桌面采用 `modal`、手机采用 `modal-mobile`。只有小型帮助和页头快捷入口采用圆形或胶囊。

主题网格用 3:4 图片窗口和 `object-fit: cover` 保持一致节奏；实际结果与原图大图使用 `object-fit: contain`，保留全幅。图片不拉伸，来源尺寸和字节摘要保留在素材清单。

## Components

### Buttons

主按钮最小高 50px，近黑渐变配浅桃文字、600 字重；悬停深灰、按下位移、禁用变灰并阻止点击。任务按钮最小高 44px，实色近黑或白底细边；结果页“保存写真”最小高 48px。页头账户按钮更紧凑，超长昵称截断。

### Chips / Tabs

写真类型是白底圆角控件，选中切为浅桃底；分类用文字和底边表达选中，任务筛选同时显示真实数量。分类在手机横向滚动，不能为了装饰增加无数据依据的标签。

### Cards / Containers

主题卡直接展示照片和图下名称，不增加文字说明卡壳；悬停和键盘焦点都显露动作。档案选项是照片、名称与勾选的紧密行。任务以白色条目组织照片、真实状态、档案名、照片数量与操作。

### Inputs / Fields

单张上传使用虚线边界，拖入时切换为暖浅色；已上传后显示缩略图和更换入口。多图上传使用浅桃色区域，最多九张三列缩略图；每张有状态、移除与失败重试。名称字段聚焦时使用黑色边线和细焦点环，错误提示紧随字段。

描述框使用浅灰填充与细边线，焦点在外框体现；底部呈现键盘说明和字数。上传、恢复与生成中使用明确文字和禁用状态，不能用静态示意替代过程。

### Navigation

页头是品牌、写真入口及邀请码或账户动作；左侧三项为首页、档案中心、任务列表。Lucide 图标保持统一笔画，当前项深色文字与浅灰底。手机底部仍保持这三项及当前页指示。

### Dialogs

通用浮层默认最大宽 560px，宽版 1000px，最大高为 90dvh 与 900px 中较小值；标题栏粘顶，关闭按钮为 44px。新建档案桌面为指导图与上传区两列，手机指导图并排、上传区在下。浮层维护焦点圈、Esc、滚动锁与关闭后焦点恢复；上传和保存进行中阻止关闭。原图/结果大图使用原生对话框和全幅显示，多张原图可逐张切换。

## Do's and Don'ts

### Do:

- **Do** 使用当前浅色外壳、近黑动作和真实写真照片建立层级。
- **Do** 将名称放在照片附近，明确区分主题示例、原图和实际结果。
- **Do** 保留真实加载、空态、失败、禁用、焦点与恢复动作。
- **Do** 在桌面和手机核对导航、档案浮层、创作输入及结果保存。

### Don't:

- **Don't** 将旧暗房、珊瑚红或双版本方案混入当前界面。
- **Don't** 将公开参考样片标为原创或作为用户生成结果。
- **Don't** 增加虚构评分、百分比、任务数量、美豆或支付界面。
- **Don't** 用文字渐变、装饰发光或无业务依据的徽章替代照片和操作层级。
