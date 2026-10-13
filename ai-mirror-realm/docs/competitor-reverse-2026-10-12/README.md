# AI 镜界：美图 AI 写真公开界面拆解

日期：2026-10-12。主参照是美图公司的[美图 AI 写真网页工作台](https://aiportrait.meitu.com/home)。它是公开可访问的产品页面，官网没有提供对应产品的公开源码入口；无法由此证明其代码在任何地方都未开源。用户指定“直接参考美图秀秀这个功能”，因此此轮只提炼与 AI 镜界相关的样片选择、上传和创作入口。

## REA 证据与观察边界

使用 [morluto/rea](https://github.com/morluto/rea) 的 `list-browser-targets` 和 `inspect-web-page` 连接独立 Chrome 会话，记录公开页面结构、可访问性树与一次样片点击。没有登录、上传私人照片、购买、生成或探测非公开接口。

| 证据 | 直接观察 | 对 AI 镜界的用途 |
| --- | --- | --- |
| [美图工作台截图](evidence/meitu-ai-portrait-gallery-1440.png) | 顶部大幅写真示例，下面用照片网格呈现主题；样片名称直接放在图下，主题与概念两种入口突出 | 让风格可见、可比较，不把全部样片藏在说明文字里 |
| [美图首次弹层](evidence/meitu-ai-portrait-home-desktop.png) | 首次访问有“上传图片”入口与前后示意 | 上传入口要清楚，但不能把不同示例人物误说成同一个人的效果对照 |
| [REA 首页记录](evidence/rea-meitu-baseline.json) | `ev_341681877ea87b07223feb006d09b47f277f5f0e5a9ac7373005658f2e8a91b1`；766 个 DOM 节点；附着后的短观察窗无请求 | 只能确认公开界面结构，不能说明生成管线 |
| [REA 样片动作记录](evidence/rea-meitu-style-action.json) | `ev_598ccc17e6b935948a9a8ac92abe38fe6122d69df23472cb78331e68c8161ca1`；未登录点击一个样片时没有观察到导航、对话框或业务请求 | 不能声称已经拆到选中样片后的完整流程；公开界面有登录门槛 |

[美图秀秀官方 App Store 页面](https://apps.apple.com/cn/app/%E7%BE%8E%E5%9B%BE%E7%A7%80%E7%A7%80-%E8%A7%86%E9%A2%91-%E5%9B%BE%E7%89%87-live%E4%BA%BA%E5%83%8F%E7%B2%BE%E4%BF%AE%E5%B7%A5%E5%85%B7/id416048305)介绍了 AI 写真可生成场景妆造、轻写真、概念写真和形象照，但这属于官方能力描述，不是本轮登录后实测结果。

为补足单图上传入口，另观察了 [FreeHeadshot Studio](https://freeheadshot.org/studio) 的公开首屏和风格浮层：[首屏](evidence/freeheadshot-desktop.png)、[浮层](evidence/freeheadshot-style-picker-desktop.png)、[REA 页面记录](evidence/rea-freeheadshot-baseline.json)、[REA 风格动作记录](evidence/rea-freeheadshot-style-action.json)。它的大上传区、当前风格摘要和按需展开的选样方式可用作交互参考；该站[条款](https://freeheadshot.org/terms)限制逆向与超出普通用户行为的自动化，因此没有继续分析其模型、提示词或私有 API。竞争产品脚本没有复制进 AI 镜界。

## 实现映射

1. 工作台左侧让单张自拍的上传和原图成为主要画面；右侧露出三张真实主题样片，一点即可选中。用户也能先选样片再上传。
2. 完整主题选择使用浅色照片网格，名称在图片下方，选中描边和勾选清楚；8 个主题来自现有服务端数据，没有伪造目录数量。
3. 自拍始终是主图，所选主题仅显示带“效果示例”标签的缩略图；不能把样片冒充结果。
4. 上传、定画面、生成、任务等待和结果保持同一工作区的视觉语法；实际生成逻辑、邀请码、私有作品和下载契约未改。
5. 邀请码进入后去掉重复路由跳转，页面切换保留轻量入场动画，但不等待旧页面退场后再挂载工作台；快速上传后立即选样片也不会清空照片。连续更换自拍只接收最后一次上传结果。

没有移植美图名称、Logo、人物素材、脚本、会员体系、批量生成或未经验证的能力声明。

## 本地验证

`npm run build` 完成，包含 TypeScript 与 Next.js 的静态检查。使用项目内样片在 1440×900 与 390×844 实际操作：上传前选主题、上传后保留选择、完整主题弹层、Esc 关闭、固定主按钮和响应式布局均通过；两个尺寸都没有横向溢出，浏览器无页面异常。截图见 `evidence/local-studio-meitu-*`。

先用隔离 SQLite 和空模型密钥验证了任务失败、重试入口与作品列表。随后切回项目原有本地后端配置，用项目内示例图实际创建写真任务：第一次模型调用失败，失败页面正确显示；之后两次端到端任务完成并返回实际图片，见 `evidence/local-real-generation-completed.png`。还通过页面“下载写真”取得约 2.96 MB 的 PNG。测试任务随后删除。成功试跑只证明本地配置当时可用，不能保证外部模型服务持续可用。
