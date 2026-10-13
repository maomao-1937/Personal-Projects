# AI 写真完整目录与链路：公开观察记录

日期：2026-10-12。用户要求扩大两版工作台，不再局限原有 8 款主题。此记录区分公开观察、产品实现与未见到的竞品内部步骤。

## 美图 AI 写真

以 [美图 AI 写真公开网页](https://aiportrait.meitu.com/home)为观察对象，用 [REA](https://github.com/morluto/rea) 的 `list-browser-targets` 和 `inspect-web-page` 检查浏览器目标与页面结构。新一轮 REA 记录的证据 ID 为 `ev_a71b7f4f02b39efc24b8839912aa406bb421f237d92726a30fae78025087daab`。另在 1440×900 桌面和 390×844 手机视口截图并手动切换公开分类。

| 直接观察 | 本地证据 | 本项目采用方式 |
| --- | --- | --- |
| 白色页头、左侧导航、宽幅写真横幅、分类标签、约五列的 3:4 样片网格，名称置于图下 | [桌面目录](evidence/meitu-full-20261012-catalog-desktop.png) | 美图式目录沿用相同浏览节奏与信息层级 |
| 公开分类包括热门、求职证件照、女性、男性、儿童；当前页面分别可读到 61、42、138、15、8 个样片名称 | [分类名称采样](evidence/meitu-full-20261012-categories.json)、[女性分类](evidence/meitu-full-20261012-category-女性.png) | 建立职业、女性、男性、儿童、创意分类，服务端提供 48 款可创作主题；数量并未伪装成与竞品完全相同 |
| 未登录点击样片没有观察到生成页面、请求或结果；“概念写真”标签下当次未见内容 | [概念写真状态](evidence/meitu-full-20261012-concept.png) | 后续上传与生成使用 AI 镜界已验证的私有链路 |
| 该公开网页的手机视口当次未呈现正常的主题网格 | [手机首屏](evidence/meitu-full-20261012-mobile-top.png) | 手机布局按本项目真实可用性优化，不能称作美图手机端一比一复刻 |

### REA 后续验证

再次用 REA 6.4.0 的 `capture-browser-scenario` 实际点击首页“去登录”。点击后短暂出现遮罩和账号 iframe，浏览器请求 `account.meitu.com`；等待 5 秒后登录层消失，仍停留在首页，没有进入写真编辑器。[点击时截图](evidence/meitu-rea-login-gate.png)与[筛选后的 REA 证据](evidence/rea-meitu-login-and-bundle-followup.json)记录了步骤和证据 ID。继续点击“档案中心”会进入 `/profile-center`，未登录时主区只显示“去登录”，见[页面截图](evidence/meitu-rea-profile-logged-out.png)。这两次操作证实公开浏览器会话的登录门槛，无法从中观察档案创建或生成结果。

REA 的 `analyze-web-bundle` 还从公开加载的前端脚本中识别出 `/quality_analysis.json`、`/create_profile.json`、`/web_profile_list.json`、`/web_inference.json`、`/web_task_list.json` 等**静态接口名称**。这是代码线索，未调用这些接口，也不能据此确认实际步骤、参数、计费或界面行为。该分析证据 ID 为 `ev_4fea7d34bcc8e79c0d4ac7463ee42595381e0af56b3416775c3cdbb08127e7dc`。

本轮再次运行 REA 的 `capture-browser-scenario`，点击公开页面的“女性”分类。可访问性记录显示该 tab 变为已选中，并出现对应 tabpanel，URL 保持 `/home`。[筛选后的场景记录](evidence/rea-meitu-category-followup.json)只保留这次交互的可核实部分；证据 ID 为 `ev_e5d284d67476ebb6cae12e80c776413283ff7b75849d603dd9f2f413e243233c`。

## 醒图

[醒图官网](https://www.retouchpics.com/)公开展示深色照片工具界面与荧绿主操作；[官方 App Store 页面](https://apps.apple.com/cn/app/id1500526240)介绍 AI 写真与丰富模板。官网是产品介绍和下载入口，没有提供 App 内写真选择、上传、生成、结果或下载的可操作页面。本轮截取[官网桌面](evidence/xingtu-full-20261012-desktop.png)与[手机](evidence/xingtu-full-20261012-mobile.png)画面。本项目的醒图式效果库与编辑台是根据这些公开视觉特征，加上 AI 镜界真实功能组织的版本。

REA 支持连接 Android 设备和本机应用；此轮本机未找到醒图或美图桌面 App，也没有 `adb` 可连接的 Android 运行环境。因此当前没有醒图 App 内可观察目标，不能把官网介绍页当成 App 内写真链路。

## 本地实现

- 原有 8 款主题已从可选目录下架；48 款主题按职业、女性、男性、儿童与创意分组。它们均有真实服务端 ID、描述和 Seedream 提示词。样片存放在 `frontend/public/catalog-sheets/`；其中两张联系表的单格为竖长比例，现按原始格子比例裁切到 3:4 卡片，不再横向拉伸。旧主题记录保留在数据库中，仅用于显示已有 4 条历史作品的名称和结果。
- 两版均可浏览分类、搜索名称/描述、选中样片或自由描述，然后上传一张自拍、创建真实任务、等待结果、下载、从作品页返回。切换版本时不会清除本轮照片或文字；切换分类时清空旧搜索条件，避免筛选状态与列表不符。主题弹层点击样片即选用并关闭。
- 美图式目录按观察到的白色导航与密集照片网格；醒图式目录按公开深色与荧绿视觉语言。两个版本的编辑器与结果页保留同一 API，作品页也会沿用所选版本。

## 验收证据

- `npm run build` 通过。后端 `/api/styles` 当前返回 48 款主题，旧 8 款不在列表中，首个主题预览值为 `catalog:career:0`。
- 前一轮以 1440×900 与 390×844 检查两版目录与真实生成链路，截图为[美图桌面](evidence/local-full-meitu-catalog-final-desktop.png)、[美图手机](evidence/local-full-meitu-catalog-final-mobile.png)、[醒图桌面](evidence/local-full-xingtu-catalog-final-desktop.png)、[醒图手机](evidence/local-full-xingtu-catalog-final-mobile.png)，这些截图显示的是当时的 56 款版本。本轮重新打开现行 48 款版本：美图式热门显示 10 款，更换主题弹层显示 48 款；两版在 390px 手机视口没有页面横向溢出，主题卡片未见横向拉伸。切换版本仍保留选择。
- 使用项目内合成测试头像，从醒图式目录选中新增的“经典证件照”后，实际上传、创建任务并等待 Seedream 4.5 返回结果；页面下载得到 699,948 字节 JPEG，作品页读取到同一结果。[实际生成图](evidence/local-full-new-style-live-image.jpg)、[醒图式真实结果页](evidence/local-full-new-style-live-result-xingtu.png)、[美图式同一结果页](evidence/local-full-new-style-live-result-meitu.png)、[醒图式作品页](evidence/local-full-new-style-live-works-xingtu.png)。测试任务随后从界面删除。
- 本轮后端写真与登录相关的 21 个测试通过，包含已下架主题在历史作品中保留名称的验证；前端再次完整构建通过。前一轮本地模型调用成功只证明当次配置可用，不保证外部服务持续可用。

上述公开观察没有覆盖闭源软件的登录后私有链路、模型参数、价格或内部实现；本项目只声称已验证自己的真实链路。
