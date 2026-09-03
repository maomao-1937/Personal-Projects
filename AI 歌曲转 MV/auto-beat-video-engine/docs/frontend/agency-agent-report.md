# Agency Agent F1 交付报告

- 日期：2026-09-02
- 分支：`agency-neural-frames-redesign`
- 工作树：`auto-beat-video-engine/.worktrees/agency-neural-frames-redesign`
- Task 13 实现边界：`aef547d test(前端): 刷新全量视觉基线`
- 范围：Neural Frames 风格的 Storyboard、Shot Editor、Preview 三工作区，以及本地 Fixture、响应式、无障碍、视觉基线和 GitHub Actions 工作流定义。
- 发布状态：**HOLD，不可称为 Ready。**

## 交付结果

F1 已将旧三栏代表页替换为三工作区本地 Fixture：Storyboard 负责全局镜头序列与批量生成入口，Shot Editor 负责单镜头 / Take 与只读节奏时间线，Preview 负责连续播放检查、缺失片段修复回链与导出配置 Sheet。

跨工作区共享一个客户端 `DemoProjectProvider`。Artifact 可用性、Preview 就绪度、模型档位、Retry、Repair、Take 与播放头返回均由同一份项目状态和纯派生函数驱动；不会以页面各自的硬编码状态伪造一致性。完整的实现边界和逐项保真结论见 `docs/frontend/fidelity-ledger.md`。

## Agency 角色分工

| 角色 | 负责内容 | 本轮产出 |
| --- | --- | --- |
| UI Designer | 竞品结构拆解、视觉层级、Token、桌面与移动布局 | Neural Frames 的三工作区骨架、媒体优先卡片、Stage、Sheet 与紫色品牌替代。 |
| UX Researcher | 任务流、信息优先级、失败恢复、键盘与移动可达性 | Storyboard → Shot Editor → Preview 路径、Retry / Repair 回链、44 px 目标、连续 Tab 路径与只读时间线边界。 |
| Frontend Developer | Next / React 组件、状态、媒体合同、测试与 CI 配置 | Provider 单源状态、响应式断点、合法卡片 Link、`<420 px` Sheet、媒体 `sizes` / LCP / CLS 门禁、GitHub Actions 定义。 |
| AI Engineer | 内部生成合同设计 | 保留 `modelTierId` 与 Take generation snapshot 的内部合同；当前 UI 的分辨率 / 覆盖率 / 一致性 / 预计耗时反馈，以及 F2 对真实 Provider / 队列 / SSE 的接入边界。 |

## 内部档位数据合同（F1，非真实调用）

| 内部数据 | F1 UI 行为 | Take 与 F2 接入边界 |
| --- | --- | --- |
| `modelTierId` | 不展示模型选择、档位标签或具体模型路线。Storyboard 仅展示分辨率、视频覆盖率、一致性和预计耗时；Shot Editor 不展示档位控件。 | 内部默认值与已有 Take 快照继续保留，F2 再映射真实 Provider / model ID、队列与估时。 |
| Take generation snapshot | 创建 Take 时冻结草稿，切换 Take 恢复 Prompt、运镜和高级设置，不暴露模型配置。 | 保持版本可复现的内部合同；F2 接入真实任务状态、SSE 进度与失败分类。 |

F1 中的任何「生成」都只变更内存 Fixture，未选择、调用或模拟某个真实模型接口。

## 当前验证证据

以下命令于 2026-09-02 在 Task 13 实现边界 `aef547d`、本工作树中重新运行。浏览器结果为本机 Darwin Chromium；GitHub 远端 CI（GitHub Actions）尚未实际运行。

其中可访问性用例所称的 200% zoom，是通过将 layout viewport 宽高减半进行的等效近似，不是对真实浏览器 zoom 行为或完整设备矩阵的验证。

| 命令 | 结果 |
| --- | --- |
| `npm run lint` | 通过，0 错误。 |
| `npm run typecheck` | 通过，`tsc --noEmit` 退出码 0。 |
| `npm test -- --run` | 10 个测试文件、110 / 110 测试通过。 |
| `npm run build` | Next.js 15.5.24 production build 通过，生成 6 / 6 页面。 |
| `PLAYWRIGHT_PORT=3405 npm run test:e2e -- --update-snapshots=all` | 强制重建全部 11 张 Darwin Golden；任务 13 实际变化 9 张，并已逐张人工审图。 |
| `PLAYWRIGHT_PORT=3405 npm run test:e2e` | 无更新完整 Chromium E2E：44 / 44 通过。 |
| `npm audit --omit=dev --json` | 失败（退出码 1）：1 个 moderate、1 个 high；发布 HOLD。 |

仓库已经定义 Linux 质量 / 非视觉 E2E job 与 macOS Darwin 视觉 job，含失败 trace、报告与 screenshot diff 上传；这证明工作流配置可被审阅，**不证明 GitHub 远端执行已通过**。

## F1 的停止边界

1. 本轮只交付本地 UI Fixture。未接真实 API、SSE、生成模型、任务队列、持久化、鉴权、签名媒体 URL、真实导出或部署。
2. Preview 在桌面首屏优先保留大媒体 Stage；完整时间线下部需要滚动才能看到。这是已接受的 F1 首屏取舍，并由时间线完整结构与视觉基线覆盖。
3. 性能相关测试只覆盖本地静态媒体的 `sizes`、首图优先级、单 video 挂载、LCP 和 CLS 观察；不替代生产网络或真实用户性能数据。
4. F2 开始真实后端集成前，应为 Provider 路由、任务幂等、SSE 断线恢复、Artifact 签名与失效、导出任务、可观测性和真实权限补充端到端合同测试。

## 发布依赖 HOLD（未修复）

本地依赖树为 `next@15.5.24 → postcss@8.4.31`。最新 `npm audit --omit=dev --json` 指出 PostCSS 相关 1 个 moderate 与 1 个 high；审计的修复目标为 `next@16.3.4`，属于 major 升级。不存在审计可提供的安全 Next 15 修复版本。

- 官方一手公告：[GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)、[GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q)、[GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)、[GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)。
- F1 当前只处理仓库内受信 CSS，并且未部署，暴露面相对较低；这是风险例外，不是漏洞已修复的结论。
- 部署或处理不可信 CSS / source map 前必须升级并适配 Next 16.3.4，重新跑完整本地门禁，并让 GitHub 的 Linux 与 macOS 工作流实际完成。
