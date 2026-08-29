# AI 审讯室案件启动仪式 V2 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 用半写实动画人物分层资产、GSAP 精准时间线和严格异步状态机重做首页案件启动仪式。

**架构：** `useCaseLaunch` 只管理后端生成、4 秒最短演播门槛、500ms 封存和跳转；`CinematicCaseLaunch` 只根据生命周期状态驱动 GSAP 视觉层。透明人物资产与 DOM 金属牢笼分层，保证灯光、扫描与机械运动可独立控制。

**技术栈：** Next.js 16、React 19、TypeScript、Tailwind CSS 4、GSAP 3、Vitest、Testing Library、Playwright

---

## 文件职责

- 创建 `frontend/public/images/case-launch/interrogator.png`：背向镜头、无法辨别性别的近景审讯者透明资产。
- 创建 `frontend/public/images/case-launch/ai-suspect.png`：侧脸低头、面部模糊且无法辨别性别的 AI 嫌疑人透明资产。
- 修改 `frontend/features/game/use-case-launch.ts`：实现大写生命周期状态及请求/演播竞速。
- 修改 `frontend/features/game/components/cinematic-case-launch.tsx`：实现分层场景、GSAP 时间线和反馈语义。
- 修改 `frontend/app/globals.css`：实现电影级光影、金属材质、扫描噪点和响应式构图。
- 修改 `frontend/tests/use-case-launch.test.tsx`：验证早请求、慢请求、500ms 封存、互斥和错误门槛。
- 修改 `frontend/tests/cinematic-case-launch.test.tsx`：验证完整状态呈现、可访问性和单行反馈。
- 修改 `frontend/tests/landing-page.test.tsx`：锁定首页简洁文案与结构。
- 修改 `frontend/package.json`、`frontend/package-lock.json`：加入 GSAP 运行时依赖。
- 修改 `tests/web_smoke.py`：更新五档视口与新状态类名的 E2E 验收。

### 任务 1：锁定状态机契约

- [ ] **步骤 1：编写失败测试**

在 `frontend/tests/use-case-launch.test.tsx` 中把预期状态改为 `IDLE`、`CEREMONY`、`GENERATING`、`LOCKING`、`COMPLETED`，并断言快速请求 3999ms 时仍未创建会话，4000ms 时进入 `LOCKING`，4500ms 时进入 `COMPLETED` 并跳转。

- [ ] **步骤 2：验证红灯**

运行：`npm test -- frontend/tests/use-case-launch.test.tsx`

预期：FAIL，现有 hook 仍返回小写 `intro/locked` 且没有 `COMPLETED`。

- [ ] **步骤 3：最小实现**

将公开类型改为：

```ts
export type CaseLaunchState =
  | "IDLE"
  | "CEREMONY"
  | "GENERATING"
  | "LOCKING"
  | "COMPLETED"
  | "ERROR";
```

点击时同步设置互斥锁并立即调用 `gameApi.generateCase()`；用一个 4000ms Promise 与请求并行，先等待演播 Promise，再等待请求结果；请求未完成时进入 `GENERATING`。会话创建成功后进入 `LOCKING`，500ms 后进入 `COMPLETED` 并执行路由跳转。

- [ ] **步骤 4：验证绿灯**

运行：`npm test -- frontend/tests/use-case-launch.test.tsx`

预期：全部 PASS。

- [ ] **步骤 5：提交**

```bash
git add frontend/features/game/use-case-launch.ts frontend/tests/use-case-launch.test.tsx
git commit -m "refactor: 严格化案件启动状态机"
```

### 任务 2：引入 GSAP 并锁定组件行为

- [ ] **步骤 1：安装依赖**

运行：`npm install gsap@3`（工作目录 `frontend`）。

- [ ] **步骤 2：编写失败测试**

在 `frontend/tests/cinematic-case-launch.test.tsx` 中断言：区域包含 `data-launch-state="IDLE"`；点击立即调用生成接口并进入 `CEREMONY`；慢请求 4000ms 后只显示一条状态；快速请求 4000ms 后显示封存字样；4500ms 后完成跳转。

- [ ] **步骤 3：验证红灯**

运行：`npm test -- frontend/tests/cinematic-case-launch.test.tsx`

预期：FAIL，旧组件没有大写状态、数据属性和新的结构。

- [ ] **步骤 4：最小组件实现**

使用 `useLayoutEffect` 在状态首次进入 `CEREMONY` 时创建 `gsap.context()`，并以绝对位置写入：

```ts
timeline
  .to(copy, { autoAlpha: 0, y: 8, filter: "blur(5px)", duration: 0.22 }, 0)
  .to(rearLight, { keyframes: [/* 三次不规则闪烁 */], duration: 1 }, 0.25)
  .fromTo(cage, { yPercent: -145 }, { yPercent: 0, duration: 1.2, ease: "power3.in" }, 1.55)
  .to(cage, { keyframes: [{ y: -3 }, { y: 2 }, { y: 0 }], duration: 0.4 }, 2.75)
  .to(spotlight, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 3.15)
  .to(suspectReveal, { autoAlpha: 0.85, duration: 0.35 }, 3.65);
```

组件卸载时调用 `context.revert()`；生命周期离开 `CEREMONY` 后保留终态，不重新创建时间线。

- [ ] **步骤 5：验证绿灯并提交**

运行：`npm test -- frontend/tests/cinematic-case-launch.test.tsx`

```bash
git add frontend/package.json frontend/package-lock.json frontend/features/game/components/cinematic-case-launch.tsx frontend/tests/cinematic-case-launch.test.tsx
git commit -m "feat: 用 GSAP 编排案件启动仪式"
```

### 任务 3：制作并接入半写实动画人物资产

- [ ] **步骤 1：生成两张透明资产**

分别生成人物，不把文字、牢笼、灯光烘焙进图片：审讯者为背对镜头或三分之二背影的宽松深色外套站姿；嫌疑人为 30°–45° 侧脸低头、面部至少 70% 隐入阴影的中性人物，穿无性别版型深色工作服。参考图只用于暗部遮蔽、顶灯关系和压迫感，不复制具体人物与界面。两张图必须是透明背景、无水印、无额外道具，且不能一眼辨别男性或女性。

- [ ] **步骤 2：视觉检查**

用图片查看工具确认透明边缘、人体比例、手脚和金属凳无明显畸变；不合格则只针对单一问题重生成对应资产。

- [ ] **步骤 3：接入场景**

用 Next `Image` 将资产放入独立人物层，设置固定宽高和 `aria-hidden`。人物不添加独立动作，只在 3.65–4.00 秒执行 `opacity: 0 → 0.85`；AI 扫描线、数字节点和粒子作为 DOM 叠层，不写入人物图片。

- [ ] **步骤 4：提交**

```bash
git add frontend/public/images/case-launch frontend/features/game/components/cinematic-case-launch.tsx
git commit -m "feat: 接入写实审讯人物资产"
```

### 任务 4：重建光影、牢笼和响应式构图

- [ ] **步骤 1：更新首页结构测试**

在 `frontend/tests/landing-page.test.tsx` 中断言首页只保留品牌、访问入口、一句说明和一个“生成案件”主动作，不出现 `CASE SYSTEM` 等装饰性杂文。

- [ ] **步骤 2：验证红灯**

运行：`npm test -- frontend/tests/landing-page.test.tsx`

预期：新结构断言在旧样式/标记上失败。

- [ ] **步骤 3：实现材质与光影**

在 `frontend/app/globals.css` 中用以下层级重建视觉：黑色水泥墙和地面、后方冷光、前景审讯者、嫌疑人、顶灯光锥、金属牢笼、空气粉尘、暗角和胶片颗粒。生成态只循环粉尘、扫描线和低幅度噪点；封存态通过状态类暂停这些动画并把锁扣改为 `#D9A74A`。

- [ ] **步骤 4：实现响应式和减弱动态**

为 1440×900、1024×768、768×1024、390×844、360×800 设置构图边界；`prefers-reduced-motion` 关闭闪烁和位移动画，但保持状态机计时与最终构图。

- [ ] **步骤 5：验证并提交**

运行：`npm test -- frontend/tests/landing-page.test.tsx frontend/tests/cinematic-case-launch.test.tsx`

```bash
git add frontend/app/globals.css frontend/tests/landing-page.test.tsx
git commit -m "style: 重建电影级审讯空间与材质"
```

### 任务 5：浏览器验收与回归

- [ ] **步骤 1：运行静态验证**

运行：`npm test && npm run typecheck && npm run lint && npm run build`

预期：测试、类型检查、Lint 和生产构建全部通过且无警告。

- [ ] **步骤 2：更新 E2E 断言并验证红灯**

在 `tests/web_smoke.py` 中将旧 `intro/generating/locked` 选择器改为 `CEREMONY/GENERATING/LOCKING`，增加页面无横向滚动、牢笼包围嫌疑人、主按钮未被遮挡的断言。运行对应测试，预期旧实现 FAIL。

- [ ] **步骤 3：在五档视口检查关键帧**

分别截取 `IDLE`、约 1.4 秒黑场、约 2.8 秒触底、约 4 秒生成/封存态；检查人物比例、牢笼位置、光锥焦点和移动端安全区。

- [ ] **步骤 4：运行完整 E2E**

运行：`npm run test:e2e`

预期：五档视口和完整案件跳转流程全部 PASS。

- [ ] **步骤 5：最终提交**

```bash
git add tests/web_smoke.py frontend/tests
git commit -m "test: 验证案件启动仪式时间线与五档视口"
```
