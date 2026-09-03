# Agency Neural Frames F1 保真核对台账

- 核对日期：2026-09-02
- 规格：`docs/superpowers/specs/2026-09-01-agency-neural-frames-redesign.md`
- 实施计划：`docs/superpowers/plans/2026-09-01-agency-neural-frames-f1-implementation.md`
- Task 13 实现边界：`aef547d test(前端): 刷新全量视觉基线`
- 范围：`/projects/demo/storyboard`、`/projects/demo/storyboard/shots/[shotId]`、`/projects/demo/preview` 的 F1 本地 Fixture。
- 结论：F1 界面与本地交互验收已完成，但并不构成真实生成链路或可发布产品的验收；发布状态为 **HOLD**。

## 对规格的最终核对

| 比较点 | 规格要求 | 当前实现与证据 | 结论 / 边界 |
| --- | --- | --- | --- |
| 三工作区与壳层 | Storyboard、Shot Editor、Preview 分离；窄应用栏与移动底部导航 | 共享 Demo Shell 覆盖三个路由；桌面为应用栏，`<768 px` 为移动底栏。 | 已解决。 |
| 项目状态单一来源 | 三个工作区共享项目数据，不应有缺失镜头或 Preview 就绪度的硬编码副本 | `DemoProjectProvider` 只在 `/projects/demo` layout 挂载一次；`Shot.artifactStatus` 是 Artifact 可用性的唯一来源，`derivePreviewReadiness` 从 Preview 状态和全部 Artifact 派生最终就绪度。 | 已解决；仅在客户端内存保存，刷新页面即回到 Fixture。 |
| 内部档位快照与生成反馈 | 档位只作为 `modelTierId` / Take generation snapshot 的内部数据合同；不应形成用户可选的模型路线 | 当前 UI 不展示模型选择、档位标签或具体模型路线；Storyboard 仅展示分辨率、视频覆盖率、一致性和预计耗时，Shot Editor 保留 Prompt、运镜、高级设置与 Take。 | 已解决 UI / 状态合同；未调用真实 Provider。 |
| Retry、Repair 与 Take | 失败卡可重试；缺失片段可进编辑器修复；新生成不得覆盖旧 Take；返回 Preview 保留播放头 | Retry 仅改变目标 `failed_retryable` 镜头；Repair 从 `?t=…` 进入 Shot Editor，创建新 Take 后返回原时间点，缺失占位消失。 | 已解决本地闭环；不是队列、任务重试或服务端修复。 |
| 精确响应式断点 | `≥1600` / `1280–1599` 为 4 列，`1024–1279` 为 3 列，`768–1023` 为 2 列，`<768` 为 1 列 | Chromium E2E 锁定 `1279 / 1023 / 768 / 767 px` 边界、390 px 首屏与根节点无横溢。 | 已解决。 |
| 合法整卡交互 | 卡片须保留文章、标题和说明语义，不能由 `button` 包裹非 phrasing 内容 | 整卡改为合法覆盖 `Link`；桌面单击打开 Quick Edit，双击或 Enter 进入 Shot Editor。 | 已解决。 |
| 移动端视觉与 Tab 顺序 | `<768 px` 全屏 Shot Editor；可见顺序、DOM 顺序和 Tab 顺序一致；操作目标不小于 44 px | Shot Editor DOM 顺序为 Stage → 只读时间线 → 设置，桌面用 grid areas 恢复左右布局；390 px E2E 验证连续 Tab、主 CTA、Stage、时间线与 44 px 命中区。 | 已解决。 |
| 完整 Shot 时间线 | 204 px；28 px 标尺、72 px 镜头轨、56 px 波形、32 px 工具栏；Beat、段落、歌词节点；F1 不做拖拽时必须说明只读 | 类型化 `project.timelineAnalysis` 同时驱动 Shot Editor 与 Preview；所有标尺、波形、Beat、段落、歌词按 `timeSec / 派生总时长` 定位；无 slider、拖拽或额外 Tab stop。 | 已解决；它是节奏参考而非剪辑器。 |
| `<420 px` 全局控制 | 收进带 Backdrop 的 Sheet；页面保留生成参数摘要和打开入口；描述默认一行 | 共享 `WorkspaceSheet` 承载全局控制；390 px 摘要与展开 Sheet 仅保留分辨率、视频覆盖率、一致性和生成入口，44 px 入口、焦点闭环、Escape、滚动锁定与关闭后焦点恢复均有测试。 | 已解决。 |
| 真实媒体与性能合同 | 响应式 400 / 800 / 1200 px Poster；首图优先；未选卡不批量挂视频；控制 LCP 与 CLS | `<picture>` 的 `sizes` 对应四种列数；首图 `eager + fetchpriority=high`，其余 `lazy`；hover / focus 最多挂载一个 `preload="metadata"` video。E2E 检查 `currentSrc`、请求数量、LCP 与 CLS。 | 已解决本地静态媒体合同；未验证带签名 URL、CDN 或真实生产 RUM。 |
| 可访问性 | AA 状态色、Skip Link、键盘路径、Sheet 焦点管理、等效缩小 layout viewport 近似 200% zoom 时无横溢 | 1440 / 390 下三个工作区 axe serious / critical 均为 0；真实连续 Tab 覆盖 Skip Link、CTA、Stage、时间线、Sheet、Enter / Escape / Space / 方向键；将 layout viewport 宽高减半近似 200% zoom 后无根节点横溢，并非真实浏览器 zoom 验证。 | 已解决。`axe color-contrast` 的 incomplete 项不计入 PASS，并由纯色 token、计算对比度与人工 JSON 证据补强。 |
| CI | Linux 质量与非视觉 E2E；macOS Darwin 视觉基线；失败产物 | `.github/workflows/frontend-ci.yml` 定义两个 job，分别运行质量/非视觉 E2E 与 Darwin Golden，并保留失败 trace、报告和 diff。 | 工作流已入库；**GitHub 远端 CI 尚未实际运行**，不能把配置存在视为远端通过。 |

## 当前本地验证记录

以下命令在当前工作树、Task 13 实现边界 `aef547d` 上于 2026-09-02 运行；浏览器使用本机 Darwin Chromium。它们是本地证据，不替代远端 GitHub Actions。

| 命令 | 最新结果 |
| --- | --- |
| `npm run lint` | 通过，0 错误。 |
| `npm run typecheck` | 通过，`tsc --noEmit` 退出码 0。 |
| `npm test -- --run` | 10 个测试文件、110 / 110 通过。 |
| `npm run build` | Next.js 15.5.24 production build 通过，生成 6 / 6 页面。 |
| `PLAYWRIGHT_PORT=3405 npm run test:e2e -- --update-snapshots=all` | 强制重建全部 11 张 Darwin Golden；任务 13 实际变化 9 张，并已逐张人工审图。 |
| `PLAYWRIGHT_PORT=3405 npm run test:e2e` | 无更新完整 Chromium E2E：44 / 44 通过。 |
| `npm audit --omit=dev --json` | 退出码 1：1 个 moderate、1 个 high；见下方发布 HOLD。 |

视觉 Golden 位于 `frontend/e2e/visual.spec.ts-snapshots/`：Storyboard 为 1440 / 1280 / 1024 / 768 / 390，Shot Editor 与 Preview 各为 1440 / 768 / 390，共 11 张。已用强制更新模式重建全部 11 张，任务 13 实际变化 9 张并逐张人工审图；Golden 使用固定 Fixture，关闭动画、过渡和光标，且 `maxDiffPixelRatio` 为 `0.01`。强制重建用于避免容差遮蔽陈旧基线，最终验收使用无更新完整 E2E 44 / 44。

## 有意接受的 F1 边界

1. 这是本地 Fixture：没有真实 API、SSE、生成队列、模型 Provider、持久化、认证、签名媒体 URL 或真实导出任务。
2. 「生成全部」、Retry、Repair、Take、Preview stale / building / ready 与 Export Sheet 均是可测试的本地状态转换；它们不发起网络请求，也不产生视频文件。
3. Preview 1440 × 900 首屏优先保留约 960 × 540 的媒体主视图，因此完整 236 px 时间线的下部需要向下滚动。这是 F1 的信息优先级取舍，不是时间线被省略；移动端时间线仅内部横向滚动，页面根节点不横溢。
4. 本地性能门禁验证了静态资源选择、单 video 挂载和浏览器 LCP / CLS 观察值，不能替代真实网络、CDN、签名地址、设备矩阵或生产 RUM。

## 发布依赖 HOLD（未修复）

当前安装的 `next@15.5.24` 传递解析到 `postcss@8.4.31`。本次 `npm audit --omit=dev --json` 仍报告 2 项漏洞：1 个 moderate、1 个 high。审计的唯一自动修复路径是跨主版本升级到 `next@16.3.4`；审计没有提供可消除问题的安全 Next 15 版本。

| 结论 | 证据 |
| --- | --- |
| 受影响依赖 | `next@15.5.24 → postcss@8.4.31`。 |
| 审计修复建议 | `next@16.3.4`，且 `isSemVerMajor: true`。 |
| 官方一手公告 | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)、[GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q)、[GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)、[GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)。 |
| 当前风险判断 | F1 只构建仓库内受信 CSS、仅作本地 Fixture，因而当前可信 CSS 构建链路的实际暴露面较低。此判断只是有限的风险例外，不能称为修复。 |
| 发布要求 | 在部署、处理不可信 CSS / source map，或接入真实用户内容前，升级并适配 Next 16.3.4，重新执行审计、lint、类型检查、单测、production build、Linux 非视觉 E2E、macOS 视觉回归及远端 GitHub CI。 |

## 历史证据

`docs/frontend/screenshots/implementation-390x844.png`、`implementation-768x1024.png`、`implementation-1280x800.png` 与 `implementation-1440x900.png` 保留为 2026-08-29 三栏 Storyboard + Cut 方向的历史记录，不与本页的 Neural Frames F1 Golden 混用。
