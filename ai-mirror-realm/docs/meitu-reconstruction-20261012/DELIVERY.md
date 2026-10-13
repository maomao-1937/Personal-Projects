# AI 镜界 · 美图参照还原交付

日期：2026-10-12。交付为本地可运行网站；本轮没有外部发布、部署或 Git push。

## 当前实现

公开 `/studio` 支持真实样片浏览、五类筛选和名称搜索。邀请码会话保护上传、私人档案、任务与媒体。面部档案支持 4–9 张上传、保存、重命名、删除和复用；快速路径可直接上传一张照片。主题或自由描述创建真实 Seedream 4.5 任务，完成后查看大图、逐张原图、保存和重新制作。

目录包含 153 张唯一公开样片，热门 61 / 求职证件照 42 / 女性 138 / 男性 15 / 儿童 8，保留分类内重复引用和原顺序。自有品牌为 AI 镜界；旧路由兼容跳转到现行页面，旧 `variant` 参数不产生另一套界面。原有 8 款及后续 48 款原创主题未进入当前可选目录。

## 工程验证

[本地验证记录](LOCAL-VERIFICATION.json) 记录：81 项后端测试、生产构建和 6 项描述框键盘断言通过。档案和任务 API 保留旧单图兼容性；新任务保存档案名称快照，旧记录仍可读取。最终结果页修改后已重新构建。

真实任务 `d217ca4c-3645-488b-88e8-f3ecd66deedb` 通过本地网页 Enter 提交一次，使用四张身份照片和“草原生命力”主题，完成后由浏览器保存为 JPEG：

- 路径：`/Users/liuxs/Downloads/草原生命力-d217ca4c.jpg`
- 尺寸：1728×2304；大小：903,021 字节。
- SHA256：`65a251156106648b33a295129b27df296d8c7fa92487fdeaf8728ef98a22cf99`
- 测试照片为已有 AI 生成 `zhichang.jpg` 的四份本地副本，档案名为“联调档案（AI示例）”；未使用真人私密照片。

## 真实页面检查

Chrome / REA 按桌面 1440×900 与手机 390×844 检查七组页面。完成四图上传、档案保存/重命名、草稿及完整照片数组恢复、Enter 生成和下载；页面记录无异常。最终修正了小型控件及占位文字对比度，并将完成页“保存写真”放到首屏标题区、限制结果画布高度，随后重新构建并采集全部页面。

| 页面 | 桌面 | 手机 |
| --- | --- | --- |
| 目录 | [desktop.png](../../.impeccable/review/desktop.png) | [mobile.png](../../.impeccable/review/mobile.png) |
| 创作 | [create-desktop.png](../../.impeccable/review/create-desktop.png) | [create-mobile.png](../../.impeccable/review/create-mobile.png) |
| 档案中心 | [profiles-desktop.png](../../.impeccable/review/profiles-desktop.png) | [profiles-mobile.png](../../.impeccable/review/profiles-mobile.png) |
| 新建档案 | [profile-dialog-desktop.png](../../.impeccable/review/profile-dialog-desktop.png) | [profile-dialog-mobile.png](../../.impeccable/review/profile-dialog-mobile.png) |
| 任务列表 | [works-desktop.png](../../.impeccable/review/works-desktop.png) | [works-mobile.png](../../.impeccable/review/works-mobile.png) |
| 结果 | [result-desktop.png](../../.impeccable/review/result-desktop.png) | [result-mobile.png](../../.impeccable/review/result-mobile.png) |
| 邀请码 | [access-desktop.png](../../.impeccable/review/access-desktop.png) | [access-mobile.png](../../.impeccable/review/access-mobile.png) |

确认记录：[桌面 REA](evidence/rea-local-confirm-desktop.json)、[手机 REA](evidence/rea-local-confirm-mobile.json)。工程验证与真实页面检查分别记录，均不能证明未观察的竞品状态。

## 设计与素材

规范：[PRODUCT.md](../../PRODUCT.md)、[DESIGN.md](../../DESIGN.md)、[设计扩展和组件示例](../../.impeccable/design.json)。视觉令牌来自当前写真外壳、组件与页面，包含最终控件中灰和结果画布规则；旧全局主题变量不作为本轮视觉来源。

公开样片的源 URL、分类顺序、尺寸、字节数和 SHA256 见 [目录素材清单](../../frontend/public/meitu-templates/catalog.json)；三张上传指导图来源见 [指导图清单](../../frontend/public/meitu-upload-guides/source.json)。竞品公开脚本只提供内部静态分析线索，未加入交付前端。

## 验收边界

- 竞品公开目录和登录后的上传弹窗已经直接观察。弹窗要求 4–9 张、建档消耗 50 美豆，观察账户余额 0。本轮未向美图上传照片、付费建档或生成结果；付费后流程与成片质量未实测。详见 [证据边界](evidence/README-observation-boundaries-20261012.md)。
- 本地使用 Seedream 4.5。四份相同测试照片验证多图传输和流程，不能证明多角度真实照片的身份一致性质量，也不证明与美图模型、训练或成片等价。
- 档案是私人照片引用集合，未训练模型。浏览器草稿仅保存按账户隔离的元数据与私有引用，不保存照片字节。
- 本地没有美豆、支付或充值；退出及跨会话账户恢复受现有邀请码机制限制。
- 最终 UI Finish Review：**ship**。两项已列出的实质问题均解决：指定小型文字对比度为 5.06–5.38:1；完成页首屏包含保存入口与全幅结果，画布独立于信息栏。审查确认 14 张最终截图尺寸正确，替换后的两份 REA 记录各 18 步、无页面异常。该结论针对这批修改和所提供截图，不扩大为全部功能或未观察状态的验收。见 [初审](../../.impeccable/review/finish-review.md) 与 [复核结论](../../.impeccable/review/finish-verdict.md)。
