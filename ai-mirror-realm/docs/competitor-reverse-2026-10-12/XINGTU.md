# 醒图公开界面观察与版本映射

日期：2026-10-12。参照范围为[醒图官网](https://www.retouchpics.com/)与[官方 App Store 页面](https://apps.apple.com/cn/app/id1500526240)。使用 `morluto/rea` 连接独立 Chrome，记录公开网页 DOM、可访问性结构和截图。没有进入 App、登录、上传照片、生成或探测非公开接口。

| 证据 | 直接观察 | AI 镜界的映射 |
| --- | --- | --- |
| [官网桌面截图](evidence/xingtu-official-home-1440.png) | 黑色桌面应用画布、大照片区、右侧调节工具区、荧绿色主要动作 | 深色编辑台、清晰的操作面板与高对比主按钮 |
| [App Store 截图](evidence/xingtu-app-store-1440.png) | 公开展示荧绿与黑色的视觉识别、照片效果示例 | 用胶片带浏览现有写真主题；不复制官方截图素材 |
| [REA 官网记录](evidence/rea-xingtu-official-baseline.json) | `ev_7e7fa032d3030b414afa49c95ed38084e21ac9875fdd5036e8b9d018dcd92112`；公开页面与下载/产品介绍结构 | 仅作公开视觉与信息层级依据 |
| [REA App Store 记录](evidence/rea-xingtu-app-store.json) | 官方商店详情页及公开图片元素 | 确认产品身份与公开呈现，不推断 App 内交互 |

App Store 文案介绍了 AI 写真与模板选择，但这里没有观察到醒图 App 内的 AI 写真创作步骤。“醒图式”版本是基于已观察视觉语言与 AI 镜界已有能力做的编辑台设计，不声称复刻了其内部实现。美图式版本的依据见 [主拆解记录](README.md)。

## 本地实现与验证

- `/studio?variant=xingtu` 使用深色画布、左侧三个真实操作入口、下方服务端写真效果带、右侧控制区与荧绿生成按钮；`/studio?variant=meitu` 保留样片画廊。两版共享当前自拍、所选主题和描述，切换时不会清空。任务页也延续所选版本，点击“再做一张”会回到该版本。
- 桌面 1440×900 与手机 390×844 实际点击上传、主题选择、弹层、Esc 关闭和版本切换；页面无脚本异常及横向溢出。见 `evidence/dual-meitu-*`、`evidence/dual-xingtu-*`。任务页深色版的截图 `evidence/dual-xingtu-result-*-visual.png` 使用了本地真实生成图和接口测试夹具验证排版，不能当成第二次端到端生成证据。
- 项目示例图经 DeepSeek `deepseek-flash` 实际整理描述，再由 Seedream `doubao-seedream-4-5-251128` 生成 1728×2304 JPEG，见 [公开示例结果](evidence/seedream45-live-public-example.jpg)。另从醒图式页面实际上传、创建任务、等待完成并显示 1728×2304 结果，见 [端到端结果页](evidence/dual-xingtu-real-result.png)。这些测试只证明本地当次调用成功，不保证外部服务持续可用。
- `npm run build` 通过，Seedream 请求与 DeepSeek 整理相关的 5 个后端测试通过；正式构建在本机 3000 端口运行后，又复查两版切换、手机布局、弹层与错误日志。
