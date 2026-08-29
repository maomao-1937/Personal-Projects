# AI 审讯室首页电影化案件启动实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将现有首页改造成单屏电影化案件启动场景，在不改变 API、Session、鉴权和后续案件流程的前提下，以约 4 秒的灯光、牢笼和聚光灯动画承接真实案件生成。

**架构：** 从现有 `StartCaseButton` 中抽出可复用的案件启动 Hook，统一管理生成、固定案回退、Session 创建、路由和视觉状态。首页使用新的电影化启动组件消费该 Hook，并通过语义化 DOM、内联 SVG 和 CSS 状态类完成全部场景与动画；原有结果页按钮继续使用同一 Hook 的零延迟模式。端到端测试只扩展首页断言和视口覆盖，不改变后端测试夹具。

**技术栈：** Next.js 16 App Router、React 19、TypeScript、Tailwind CSS 4 项目全局 CSS、Lucide React、Vitest、Testing Library、Playwright、Python smoke runner

---

## 文件结构

### 新增文件

- `frontend/features/game/use-case-launch.ts`
  - 封装动态案件生成、固定案回退、Session 创建、路由跳转和定时视觉状态。
  - 对外暴露 `idle | intro | generating | locked | error`，供不同入口复用。
- `frontend/features/game/components/cinematic-case-launch.tsx`
  - 首页唯一主交互组件。
  - 渲染人物、光束、牢笼、聚光灯、艺术字、按钮、生成状态、成功封存和失败回退。
- `frontend/tests/use-case-launch.test.tsx`
  - 覆盖 API 与 4 秒动画并行、最短展示时长、Session、成功停留、失败和防重复点击。
- `frontend/tests/cinematic-case-launch.test.tsx`
  - 覆盖首页 CTA、状态文案、封存文案、无障碍状态和固定案回退。
- `frontend/tests/landing-page.test.tsx`
  - 覆盖单屏首页的必要文案以及旧仪表盘信息完全移除。

### 修改文件

- `frontend/features/game/components/start-case-button.tsx`
  - 改用共享 Hook，保留既有按钮标签、加载提示和固定案回退体验。
- `frontend/app/page.tsx`
  - 删除营销型 Hero、产品预览和三步流程，只保留极简导航与电影化启动组件。
- `frontend/app/globals.css`
  - 删除首页旧布局样式并新增电影化场景、状态动画、响应式布局和减少动态效果规则。
- `frontend/tests/start-case-button.test.tsx`
  - 确认共享 Hook 重构后原入口仍可立即进入生成案件。
- `tests/web_smoke.py`
  - 更新首页文案与按钮定位，并新增 1440、1280、1024、768、390 五档首页截图和无横向溢出断言。

### 明确不修改

- `backend/**`
- `frontend/features/game/api.ts`
- `frontend/features/game/types.ts`
- `frontend/features/game/session.ts`
- `frontend/app/access/**`
- `frontend/app/case/**`
- `deploy/**`
- 线上服务器、容器、域名和环境变量

## 任务 0：确认框架约束和建立基线

**文件：**

- 读取：`frontend/AGENTS.md`
- 读取：`frontend/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- 读取：`frontend/node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
- 读取：`frontend/node_modules/next/dist/docs/03-architecture/accessibility.md`
- 验证：`frontend/tests/start-case-button.test.tsx`

- [ ] **步骤 1：阅读本地 Next.js 16 指南**

运行：

```bash
sed -n '1,260p' frontend/node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
sed -n '1,240p' frontend/node_modules/next/dist/docs/01-app/01-getting-started/11-css.md
sed -n '1,260p' frontend/node_modules/next/dist/docs/03-architecture/accessibility.md
```

预期：确认 `page.tsx` 保持 Server Component，只有电影化启动组件和 Hook 标记 `"use client"`；全局样式继续从现有根布局导入；交互状态用可访问文本而非只靠颜色表达。

- [ ] **步骤 2：运行当前按钮测试建立基线**

运行：

```bash
cd frontend && npm test -- tests/start-case-button.test.tsx
```

预期：测试通过，证明已有动态案件、Session 与路由行为在改动前正常。

- [ ] **步骤 3：记录工作树边界**

运行：

```bash
git status --short
git diff -- frontend/app/page.tsx frontend/app/globals.css frontend/features/game/components/start-case-button.tsx frontend/tests/start-case-button.test.tsx tests/web_smoke.py
```

预期：明确上述目标文件是否已有用户改动。任何非本任务改动都必须保留，提交时只精确暂存本计划列出的首页文件。

## 任务 1：以测试驱动方式抽取案件启动状态机

**文件：**

- 新增：`frontend/features/game/use-case-launch.ts`
- 新增：`frontend/tests/use-case-launch.test.tsx`

- [ ] **步骤 1：编写 4 秒最短开场与 0.5 秒封存停留的失败测试**

在 `frontend/tests/use-case-launch.test.tsx` 中创建测试 Harness，渲染 Hook 返回的 `visualState`、`phaseText` 和启动按钮。使用 `vi.useFakeTimers()`，将 `generateCase` 与 `createSession` mock 为立即成功：

```tsx
function Harness() {
  const launch = useCaseLaunch({ introDurationMs: 4_000, lockedDurationMs: 500 });
  return (
    <>
      <button onClick={() => void launch.startGenerated()}>start</button>
      <output>{launch.visualState}</output>
      <span>{launch.phaseText}</span>
    </>
  );
}
```

断言顺序：点击后立即是 `intro` 且 `generateCase` 已调用；推进至 3999ms 不创建 Session；推进 1ms 后创建 Session；状态进入 `locked` 后再过 499ms 不跳转；满 500ms 才跳到动态案件简报。

- [ ] **步骤 2：运行测试确认因模块缺失而失败**

运行：

```bash
cd frontend && npm test -- tests/use-case-launch.test.tsx
```

预期：FAIL，提示无法找到 `@/features/game/use-case-launch`。

- [ ] **步骤 3：实现最小共享 Hook**

在 `frontend/features/game/use-case-launch.ts` 中定义：

```ts
export type CaseLaunchVisualState =
  | "idle"
  | "intro"
  | "generating"
  | "locked"
  | "error";

export type UseCaseLaunchOptions = {
  introDurationMs?: number;
  lockedDurationMs?: number;
};
```

Hook 返回：

```ts
{
  busy,
  error,
  phaseText,
  visualState,
  startGenerated,
  startFallback,
}
```

实现约束：

- 使用 `useRef` 同步防止快速双击，而不只依赖异步 `setBusy`。
- 点击后先设置 `intro`，再立即启动 `gameApi.generateCase()`，同时等待 `introDurationMs`。
- 生成 API 即使提前成功，也必须等开场时长结束才创建 Session。
- 开场结束而 API 尚未完成时，状态进入 `generating`。
- 动态案件与固定案都调用同一个 `openCase(caseId)`，保持 `clearSessionId → storeSessionId → router.push`。
- Session 创建成功后设置 `locked`，等待 `lockedDurationMs` 再跳转。
- 8 秒、24 秒分别切换为 `正在核验证据链`、`正在封存真相`；初始为 `正在生成案件`。
- 出错后设置 `error`、释放 busy 锁并进入 `error`；错误默认文本沿用现有实现。
- 组件卸载时清理所有定时器并阻止后续状态更新。
- 默认 `introDurationMs` 和 `lockedDurationMs` 均为 0，使非首页入口保持当前速度。

- [ ] **步骤 4：运行成功路径测试确认通过**

运行：

```bash
cd frontend && npm test -- tests/use-case-launch.test.tsx
```

预期：PASS。

- [ ] **步骤 5：补充状态机边界测试**

新增并确认以下断言：

- 生成请求超过 4 秒时，4 秒后状态为 `generating`，API 完成后才创建 Session。
- 快速连续点击两次只调用一次 `generateCase`。
- 动态生成失败时不调用 `createSession`，状态为 `error`，展示原始错误。
- 固定案回退调用 `getFallbackCase`，成功后进入 `CASE-001` 简报。
- 8 秒和 24 秒只显示一条对应状态文案。

- [ ] **步骤 6：运行状态机测试与类型检查**

运行：

```bash
cd frontend && npm test -- tests/use-case-launch.test.tsx
cd frontend && npm run typecheck
```

预期：两条命令均通过。

- [ ] **步骤 7：提交共享状态机**

运行：

```bash
git add frontend/features/game/use-case-launch.ts frontend/tests/use-case-launch.test.tsx
git commit -m "feat: 抽取案件启动状态机"
```

预期：提交只包含 Hook 与对应测试。

## 任务 2：让现有按钮复用状态机并保持兼容

**文件：**

- 修改：`frontend/features/game/components/start-case-button.tsx`
- 修改：`frontend/tests/start-case-button.test.tsx`

- [ ] **步骤 1：先补充兼容性测试**

在现有测试中增加：

- 默认标签仍为 `开始免费案件`。
- 点击后仍出现 `AI 正在创建本局专属案件`。
- 默认零延迟模式在 API 成功后立即创建 Session 并跳转。
- 生成失败后仍出现 `改用精修固定案继续体验`。
- 回退成功后仍跳转到 `/case/001/briefing?session=...`。

- [ ] **步骤 2：运行测试并确认新增回退断言失败**

运行：

```bash
cd frontend && npm test -- tests/start-case-button.test.tsx
```

预期：至少新增的回退场景在重构前尚未满足新测试结构或 spy 断言。

- [ ] **步骤 3：替换组件内部业务逻辑**

删除组件内的 `useRouter`、`useState`、`openCase`、`start` 和 `startFallback`，改为：

```tsx
const launch = useCaseLaunch();
```

保留现有 DOM 与视觉语义，只把数据绑定替换为：

```tsx
onClick={() => void launch.startGenerated()}
disabled={launch.busy}
```

加载按钮显示 `launch.phaseText`；错误显示 `launch.error`；固定案按钮调用 `launch.startFallback()`。

- [ ] **步骤 4：运行按钮与 Hook 测试**

运行：

```bash
cd frontend && npm test -- tests/start-case-button.test.tsx tests/use-case-launch.test.tsx
```

预期：全部通过，且现有结果页入口没有 4 秒延迟。

- [ ] **步骤 5：提交兼容重构**

运行：

```bash
git add frontend/features/game/components/start-case-button.tsx frontend/tests/start-case-button.test.tsx
git commit -m "refactor: 复用案件启动流程"
```

预期：提交只包含现有按钮及其测试。

## 任务 3：以测试驱动方式创建电影化启动组件

**文件：**

- 新增：`frontend/features/game/components/cinematic-case-launch.tsx`
- 新增：`frontend/tests/cinematic-case-launch.test.tsx`

- [ ] **步骤 1：编写首页启动组件失败测试**

Mock `useCaseLaunch`，分别返回 `idle`、`intro`、`generating`、`locked`、`error`。断言：

- `idle` 有按钮 `生成案件`。
- 页面句子完整可读：`用 8 次提问，审讯一个会撒谎、却无法改写真相的 AI 嫌疑人。`
- `会撒谎`、`无法改写真相`、`AI 嫌疑人` 分别有独立类名，不靠拆字后的 `aria-label` 猜测内容。
- 点击按钮只调用 `startGenerated`。
- `intro` 根节点有 `aria-busy="true"`，且 CTA/说明淡出。
- `generating` 使用 `role="status"` 且只显示当前 `phaseText`。
- `locked` 显示 `TRUTH LOCKED` 和 `真相已封存`。
- `error` 使用 `role="alert"` 显示错误并提供固定案回退按钮。

- [ ] **步骤 2：运行测试确认组件缺失**

运行：

```bash
cd frontend && npm test -- tests/cinematic-case-launch.test.tsx
```

预期：FAIL，提示电影化启动组件模块不存在。

- [ ] **步骤 3：实现语义骨架和可动画图层**

组件根节点：

```tsx
<section
  className={`cinematic-launch cinematic-launch--${launch.visualState}`}
  aria-label="AI 嫌疑人案件生成场景"
  aria-busy={launch.busy}
>
```

内部只包含以下图层：

1. `cinematic-stage`：场景容器。
2. `rear-light`：点击前冷灰白逆光。
3. `interrogator-silhouette`：前景站立审讯者背影。
4. `suspect-seat`：凳子与坐姿 AI 嫌疑人。
5. `ai-reconstruction`：头颈和单侧肩部网格、粒子与边缘错位。
6. `containment-frame`：顶部横梁、左右立柱、底部锁扣，不画密集监狱铁栏。
7. `overhead-light`：点击后约 3000K 暖白顶灯。
8. `cinematic-copy`：一句话与 `生成案件`。
9. `cinematic-feedback`：生成、封存或失败时只显示当前一种反馈。

人物使用轻量内联 SVG 或 CSS 形状，所有装饰 SVG 设 `aria-hidden="true"`，可见文案保持真实文本节点。

- [ ] **步骤 4：接入首页专属时长**

组件调用：

```tsx
const launch = useCaseLaunch({
  introDurationMs: 4_000,
  lockedDurationMs: 500,
});
```

按钮禁用时不替换为技术型长文案；反馈区只显示 Hook 当前状态。

- [ ] **步骤 5：运行组件测试确认通过**

运行：

```bash
cd frontend && npm test -- tests/cinematic-case-launch.test.tsx
```

预期：全部通过。

- [ ] **步骤 6：提交电影化组件**

运行：

```bash
git add frontend/features/game/components/cinematic-case-launch.tsx frontend/tests/cinematic-case-launch.test.tsx
git commit -m "feat: 新增电影化案件启动场景"
```

预期：提交只包含组件和组件测试。

## 任务 4：将首页收敛为单屏叙事

**文件：**

- 修改：`frontend/app/page.tsx`
- 新增：`frontend/tests/landing-page.test.tsx`

- [ ] **步骤 1：编写页面结构失败测试**

Mock `CinematicCaseLaunch` 为可识别测试替身，渲染 `LandingPage` 并断言：

- 有链接 `AI 审讯室`，指向首页顶部。
- 有 `AccessMenu` 的退出按钮。
- 有电影化启动区域。
- 不存在 `CASE SYSTEM / 12+`。
- 不存在 `INTERROGATION READY`。
- 不存在 `CASE-001`、`EVIDENCE`、`三步完成一次审讯`。
- 页面只有一个主场景，不再渲染下方流程 Section。

- [ ] **步骤 2：运行测试确认旧页面失败**

运行：

```bash
cd frontend && npm test -- tests/landing-page.test.tsx
```

预期：FAIL，旧页面仍包含被禁止的仪表盘与营销文案。

- [ ] **步骤 3：精简 `LandingPage`**

将页面缩减为：

```tsx
<main className="landing-page" id="top">
  <header className="landing-nav">...</header>
  <CinematicCaseLaunch />
</main>
```

保留左上角小尺寸产品名和右上角弱化退出入口。删除旧 Lucide 图标导入、`STEPS` 常量、预览面板和底部流程。

- [ ] **步骤 4：运行页面和组件测试**

运行：

```bash
cd frontend && npm test -- tests/landing-page.test.tsx tests/cinematic-case-launch.test.tsx
```

预期：全部通过。

- [ ] **步骤 5：提交首页结构**

运行：

```bash
git add frontend/app/page.tsx frontend/tests/landing-page.test.tsx
git commit -m "feat: 首页改为单屏案件启动叙事"
```

预期：提交只包含首页结构和页面测试。

## 任务 5：实现电影化视觉、4 秒节奏和响应式构图

**文件：**

- 修改：`frontend/app/globals.css`

- [ ] **步骤 1：建立首页独立视觉变量**

在首页样式段定义局部变量，不污染游戏工作台：

```css
.landing-page {
  --cinema-black: #090a0b;
  --cinema-ink: #121315;
  --cinema-paper: #eee9df;
  --cinema-muted: #85827d;
  --cinema-red: #7f2e2e;
  --cinema-truth: #b79a57;
  --cinema-tungsten: #f1d0a0;
}
```

页面固定为 `100svh` 单屏，使用 `overflow: hidden`；导航以绝对定位避开场景轴线；主按钮最小高度 48px。

- [ ] **步骤 2：完成桌面构图**

桌面端满足：

- 场景轴线为后光源 → 站立者 → 坐着的嫌疑人，镜头横向偏移约 10–15°。
- 站立者占场景高度约 70%，视觉体量约为嫌疑人的 1.6–1.8 倍。
- 站立者只显示有结构的深色外套、肩背和微低头轮廓，不出现制服、徽章、帽子、武器。
- 嫌疑人位于画面中下部，身形偏瘦、中性，双脚落地、身体微前倾、手位于膝间或腿面。
- 逆光为低饱和冷灰白，站立者投影覆盖嫌疑人约一半，但嫌疑人仍可辨识。
- AI 特征只占约 20%，集中在头颈与单侧肩部的网格、少量粒子、边缘错位和影子滞后。
- 牢笼表现为机械封存框架，不使用密集铁条，避免俗套监狱图标感。

- [ ] **步骤 3：实现艺术字**

使用一个 7 秒循环的低饱和内部色流：

```css
.cinematic-copy__shift {
  background: linear-gradient(100deg, #e9e3d8 5%, #843838 48%, #8c9298 78%, #e9e3d8 100%);
  background-size: 240% 100%;
  background-clip: text;
  color: transparent;
  animation: cinematic-copy-shift 7s ease-in-out infinite;
}
```

`会撒谎` 与 `AI 嫌疑人` 共用该类；`无法改写真相` 使用固定 `--cinema-truth`；其余文字为暖白。不得添加彩虹或蓝紫霓虹。

- [ ] **步骤 4：实现点击后的精确时间轴**

所有关键帧由 `.cinematic-launch--intro` 触发，时间轴以 4 秒为基准：

- 0–0.25s：文案与按钮淡出。
- 0.25–1.25s：逆光发生三次不规则、低频亮度下降后熄灭。
- 1.25–1.55s：场景近黑停顿。
- 1.55–2.75s：机械封存框架落下。
- 2.75–3.15s：框架轻微回弹并闭锁。
- 3.15–3.65s：约 3000K 暖白顶灯渐亮。
- 3.65–4.0s：AI 网格、粒子和边缘错位逐渐显现。

`.cinematic-launch--generating` 保持逆光熄灭、牢笼闭合、顶灯稳定，AI 边缘仅做缓慢构建；`.cinematic-launch--locked` 停止 AI 变化并将锁扣变为警戒黄。

- [ ] **步骤 5：实现平板和手机独立构图**

至少设置两档独立布局：

- `max-width: 1024px`：收紧导航、人物和文字比例，保持完整站立者与坐姿关系。
- `max-width: 767px`：站立者裁切为肩背片段；嫌疑人上移到视觉中上部；一句话与按钮放在下方安全区；牢笼改为更窄的纵向框架。
- `max-width: 480px`：确保 390px 宽度无横向滚动，按钮和退出入口触控区域至少 44px。

使用 `svh` 与安全区 inset，避免移动浏览器地址栏使按钮被裁切。

- [ ] **步骤 6：实现减少动态效果模式**

在 `@media (prefers-reduced-motion: reduce)` 中：

- 禁用艺术字循环、三次闪烁、回弹和粒子漂移。
- 将逆光、牢笼、顶灯和 AI 显现改为短淡入淡出。
- 不改变 Hook 的 4 秒业务等待，因此 API/Session 顺序与普通模式一致。

- [ ] **步骤 7：运行静态质量检查**

运行：

```bash
cd frontend && npm run typecheck
cd frontend && npm run lint
```

预期：无 TypeScript 错误、无 ESLint warning。

- [ ] **步骤 8：提交视觉实现**

运行：

```bash
git add frontend/app/globals.css
git commit -m "style: 实现首页电影化光影与封存动画"
```

预期：提交只包含全局样式文件中的首页相关改动。

## 任务 6：更新端到端验收与五档首页截图

**文件：**

- 修改：`tests/web_smoke.py`

- [ ] **步骤 1：先更新首页核心断言**

将旧断言替换为：

```python
expect(page.get_by_text(
    "用 8 次提问，审讯一个会撒谎、却无法改写真相的 AI 嫌疑人。",
    exact=True,
)).to_be_visible()
expect(page.get_by_role("button", name="生成案件")).to_be_visible()
```

同时断言 body 文本不包含 `CASE SYSTEM / 12+`、`INTERROGATION READY`、`三步完成一次审讯`。

- [ ] **步骤 2：新增首页视口验收函数**

创建 `verify_landing_viewports(context)`，依次使用：

```python
for width, height, name in (
    (1440, 900, "1440-landing"),
    (1280, 800, "1280-landing"),
    (1024, 768, "1024-landing"),
    (768, 1024, "768-landing"),
    (390, 844, "390-landing"),
):
```

每档检查：

- 页面无横向溢出。
- 页面总滚动高度不超过视口超过 1px 的容差。
- 产品名、退出、完整句子和 `生成案件` 可见。
- 按钮 bounding box 高度不少于 44px。
- 截图写入 `artifacts/ui/<name>.png`。

- [ ] **步骤 3：适配失败回退流程的 4 秒开场**

在主流程中点击 `生成案件` 后，将错误断言 timeout 调整到至少 7 秒：

```python
expect(page.get_by_text("新案件暂时无法生成", exact=False)).to_be_visible(timeout=7_000)
```

继续点击原固定案回退按钮并确认进入 `/case/001/briefing?session=`。不得绕开真实前端状态机。

- [ ] **步骤 4：运行端到端测试**

运行：

```bash
cd frontend && npm run test:e2e
```

预期：主流程、动态案、边界规则、登出和五档首页均通过，输出截图到 `artifacts/ui/`。

- [ ] **步骤 5：提交端到端覆盖**

运行：

```bash
git add tests/web_smoke.py
git commit -m "test: 覆盖电影化首页与五档视口"
```

预期：提交只包含 smoke 测试，不提交截图产物。

## 任务 7：完整验证与视觉验收

**文件：**

- 验证：`frontend/**`
- 验证：`tests/web_smoke.py`
- 检查：`artifacts/ui/*.png`

- [ ] **步骤 1：运行前端全量测试**

运行：

```bash
cd frontend && npm test
```

预期：全部 Vitest 测试通过。

- [ ] **步骤 2：运行类型、Lint 和生产构建**

运行：

```bash
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm run build
```

预期：三条命令全部成功；构建不新增依赖警告或运行时错误。

- [ ] **步骤 3：运行完整本地 smoke**

运行：

```bash
cd frontend && npm run test:e2e
```

预期：退出码 0，且最终信息包含主流程、规则边界、关键布局和视口通过。

- [ ] **步骤 4：逐张检查首页截图**

检查：

- `artifacts/ui/1440-landing.png`
- `artifacts/ui/1280-landing.png`
- `artifacts/ui/1024-landing.png`
- `artifacts/ui/768-landing.png`
- `artifacts/ui/390-landing.png`

视觉验收清单：

- 第一眼焦点是站立者与 AI 嫌疑人的权力关系，而不是文字或面板。
- 站立者没有完全遮住嫌疑人。
- 嫌疑人具有人形和少量 AI 重构痕迹，不像机器人或赛博朋克角色。
- 只有一句产品说明和一个主要按钮。
- 艺术字低饱和，`真相`相关片段是固定警戒黄。
- 桌面无空洞大块，手机文案与按钮不压住嫌疑人头部。
- 所有尺寸无横向滚动、无被裁切按钮、无第二屏内容。

- [ ] **步骤 5：浏览器手动检查动画状态**

本地打开首页，使用网络限速分别检查快速和慢速响应：

- 快速响应仍完整播放约 4 秒开场。
- 慢速响应在 4 秒后保持封存框架与顶灯，并按 8 秒、24 秒切换单行状态。
- 成功后出现 `TRUTH LOCKED / 真相已封存`，约 0.5 秒后进入简报。
- 失败后出现原始错误和固定案回退。
- 开启系统“减少动态效果”后无闪烁和回弹。

- [ ] **步骤 6：核对改动边界**

运行：

```bash
git status --short
git diff --stat HEAD~6..HEAD
git diff HEAD~6..HEAD -- backend frontend/features/game/api.ts frontend/features/game/types.ts frontend/features/game/session.ts deploy
```

预期：本任务提交未触碰后端、API、类型、Session、案件页面或部署配置；工作树原有未提交改动仍在且未被覆盖。

- [ ] **步骤 7：如有验证修正，单独提交**

仅在发现并修复首页问题时运行：

```bash
git add <本轮实际修正的首页文件>
git commit -m "fix: 完善首页电影化启动体验"
```

预期：不使用 `git add .`，不夹带原有脏工作树文件。

## 任务 8：交付本地结果，等待上线授权

- [ ] **步骤 1：汇总证据**

输出以下内容：

- 改动结果与用户可见行为。
- Vitest、typecheck、lint、build、E2E 的最新命令与通过结果。
- 五档首页截图路径。
- 本任务提交列表。
- 明确说明后端、鉴权、Session、API 和部署未修改。

- [ ] **步骤 2：停止在本地完成状态**

不得自动 SSH、构建生产镜像、替换容器或修改线上环境。只有用户查看本地效果并明确授权上线后，才另行制定仅替换 `web` 容器的发布步骤。

## 计划自检

- [ ] 设计中的单屏、极简文字、一个 CTA 已映射到任务 3–5。
- [ ] 站立者、坐姿 AI 嫌疑人、逆光遮挡、机械框架和暖白顶灯已映射到任务 5。
- [ ] 0–4 秒七段动画与成功后 0.5 秒停留已映射到任务 1、3、5。
- [ ] 生成期间三条单行状态、成功封存、失败回退已映射到任务 1、3、6。
- [ ] 1440、1280、1024、768、390 五档验收已映射到任务 6、7。
- [ ] `prefers-reduced-motion` 已映射到任务 5、7。
- [ ] API、Session、鉴权、后端、案件页面和部署的非目标边界已明确。
- [ ] 所有新增类型、状态名、测试名和文件路径前后一致。
- [ ] 全文无待补内容或未决设计选择。
- [ ] 每个实现任务都有先失败测试、最小实现、验证和精确提交步骤。
