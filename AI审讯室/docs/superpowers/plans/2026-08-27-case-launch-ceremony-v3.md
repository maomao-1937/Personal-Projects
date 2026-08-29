# AI 审讯室案件启动仪式 V3 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将首页重做为以正面中央收容舱为核心的半写实动漫场景，点击后只落下前方栅门，并保留与案件生成请求严格并行的 4 秒启动仪式。

**架构：** 保持 `useCaseLaunch` 的既有状态机和网络竞速逻辑不变；`CinematicCaseLaunch` 只负责 V3 语义图层和 GSAP 时间线。环境、人物使用独立静态资产，收容舱外框固定在环境底图中，前方栅门与锁扣使用独立 DOM 层动画；所有 V3 样式迁入 CSS Module，避免继续叠加 `globals.css` 中的 V1/V2 选择器。

**技术栈：** Next.js 16、React 19、TypeScript、CSS Modules、GSAP 3、Vitest、Testing Library、Playwright/Python E2E、WebP/PNG 静态资产

---

## 执行顺序修正

组件会同时导入 V3 资产和 CSS Module，因此实际执行顺序为：任务 1（红灯契约）→ 任务 3（资产）→ 任务 4 步骤 1–5（CSS Module）→ 任务 2（组件绿灯）→ 任务 4 步骤 6–7（静态验证与提交）→ 任务 5 → 任务 6。此修正只解决文件依赖顺序，不改变范围或设计。

## 文件职责

- 创建 `frontend/public/images/case-launch/v3/environment-desktop.webp`：16:9 空场景，包含黑暗空间、固定收容舱外框、地面与顶部机械槽，不含人物、活动栅门、文字和激活灯光。
- 创建 `frontend/public/images/case-launch/v3/environment-mobile.webp`：9:16 竖屏空场景，保持中央收容舱与移动端安全区。
- 创建 `frontend/public/images/case-launch/v3/ai-suspect.png`：透明背景、中性、侧身低头、坐在金属凳上的半写实动漫 AI 嫌疑人。
- 创建 `frontend/public/images/case-launch/v3/interrogator.png`：透明背景、中性、右侧近景、背对镜头的半写实动漫审讯者。
- 创建 `frontend/features/game/components/cinematic-case-launch.module.css`：V3 场景布局、材质、灯光、响应式、减少动态和状态样式的唯一责任文件。
- 修改 `frontend/features/game/components/cinematic-case-launch.tsx`：使用 V3 图层结构、CSS Module 类名和“固定舱体 + 活动栅门”时间线。
- 修改 `frontend/tests/cinematic-case-launch.test.tsx`：锁定 V3 语义结构、一次性触发、状态反馈和可选完成回调。
- 修改 `frontend/tests/landing-page.test.tsx`：锁定首页只保留品牌、一句话、一个启动动作和退出入口。
- 修改 `tests/web_smoke.py`：验证五档视口、V3 状态、无横向溢出和关键图层几何关系。

## 任务 1：锁定 V3 组件契约

**文件：**
- 修改：`frontend/tests/cinematic-case-launch.test.tsx`
- 修改：`frontend/tests/landing-page.test.tsx`

- [ ] **步骤 1：编写失败的 V3 结构测试**

在 `frontend/tests/cinematic-case-launch.test.tsx` 的首个测试中加入：

```ts
expect(scene).toHaveAttribute("data-scene-version", "v3");
expect(screen.getByTestId("containment-shell")).toBeInTheDocument();
expect(screen.getByTestId("containment-gate")).toBeInTheDocument();
expect(screen.getByTestId("containment-gate")).not.toBe(
  screen.getByTestId("containment-shell"),
);
expect(screen.getByTestId("ai-suspect")).toBeInTheDocument();
expect(screen.getByTestId("foreground-interrogator")).toBeInTheDocument();
```

再加入一次性触发测试：

```ts
it("does not start a second generation while the ceremony is active", () => {
  vi.spyOn(gameApi, "generateCase").mockReturnValue(new Promise(() => {}));
  render(<CinematicCaseLaunch />);

  const button = screen.getByRole("button", { name: "生成案件" });
  fireEvent.click(button);
  fireEvent.click(button);

  expect(gameApi.generateCase).toHaveBeenCalledOnce();
  expect(button).toBeDisabled();
});
```

- [ ] **步骤 2：强化首页文案断言**

在 `frontend/tests/landing-page.test.tsx` 中保留现有品牌、说明、生成按钮和退出入口断言，并增加：

```ts
expect(screen.getAllByRole("button")).toHaveLength(2);
expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
expect(screen.queryByText(/SYSTEM|VERSION|CASE-/i)).not.toBeInTheDocument();
```

- [ ] **步骤 3：运行测试确认红灯**

运行：

```bash
cd frontend
npm test -- tests/cinematic-case-launch.test.tsx tests/landing-page.test.tsx
```

预期：FAIL；旧组件缺少 `data-scene-version="v3"`、固定收容舱和独立活动栅门测试标识。

- [ ] **步骤 4：提交测试契约**

```bash
git add frontend/tests/cinematic-case-launch.test.tsx frontend/tests/landing-page.test.tsx
git commit -m "test: 锁定 V3 收容舱首页契约"
```

## 任务 2：重建组件图层与一次性时间线

**文件：**
- 修改：`frontend/features/game/components/cinematic-case-launch.tsx`
- 测试：`frontend/tests/cinematic-case-launch.test.tsx`

- [ ] **步骤 1：定义 V3 引用和状态类**

在组件中导入 CSS Module 和 V3 资产，并只保留以下动画引用：

```ts
import styles from "./cinematic-case-launch.module.css";
import suspectAsset from "@/public/images/case-launch/v3/ai-suspect.png";
import interrogatorAsset from "@/public/images/case-launch/v3/interrogator.png";

const gateRef = useRef<HTMLDivElement>(null);
const latchRef = useRef<HTMLDivElement>(null);
const coldLightRef = useRef<HTMLDivElement>(null);
const warmLightRef = useRef<HTMLDivElement>(null);
const blackoutRef = useRef<HTMLDivElement>(null);
const suspectRef = useRef<HTMLDivElement>(null);
const copyRef = useRef<HTMLDivElement>(null);

const stateClass = styles[`state${launch.lifecycleState}` as keyof typeof styles];
```

- [ ] **步骤 2：把场景结构替换为固定舱体和独立栅门**

组件主结构应遵守以下边界；环境底图通过 `<picture>` 加载，文字保持真实 DOM：

```tsx
<section
  ref={scopeRef}
  className={`${styles.root} ${stateClass}`}
  data-launch-state={launch.lifecycleState}
  data-scene-version="v3"
  aria-label="AI 嫌疑人案件生成场景"
  aria-busy={launch.busy}
>
  <div className={styles.stage} aria-hidden="true">
    <picture className={styles.environment}>
      <source media="(max-width: 600px)" srcSet="/images/case-launch/v3/environment-mobile.webp" />
      <img src="/images/case-launch/v3/environment-desktop.webp" alt="" />
    </picture>
    <div ref={coldLightRef} className={styles.coldLight} />
    <div ref={suspectRef} className={styles.suspect} data-testid="ai-suspect">
      <Image src={suspectAsset} alt="" priority />
      <span className={styles.aiScanlines} />
      <span className={styles.aiNoise} />
    </div>
    <div className={styles.shell} data-testid="containment-shell" />
    <div ref={gateRef} className={styles.gate} data-testid="containment-gate">
      <div className={styles.gateBars} />
      <div ref={latchRef} className={styles.latch}><i /></div>
    </div>
    <div ref={warmLightRef} className={styles.warmLight} />
    <div className={styles.interrogator} data-testid="foreground-interrogator">
      <Image src={interrogatorAsset} alt="" priority />
    </div>
    <div className={styles.vignette} />
    <div className={styles.grain} />
    <div ref={blackoutRef} className={styles.blackout} />
  </div>
  {/* cinematic copy and feedback remain real HTML */}
</section>
```

固定 `shell` 不参与下落动画；只有 `gate` 从顶部机械槽进入画面。

- [ ] **步骤 3：改写 GSAP 4 秒时间线**

使用绝对时间点，保留网络状态机独立性：

```ts
timeline
  .to(copyRef.current, {
    autoAlpha: 0,
    y: 8,
    duration: 0.22,
    ease: "power2.out",
  }, 0)
  .to(coldLightRef.current, { opacity: 0.14, duration: 0.09, ease: "none" }, 0.25)
  .to(coldLightRef.current, { opacity: 0.72, duration: 0.08, ease: "none" }, 0.39)
  .to(coldLightRef.current, { opacity: 0.08, duration: 0.12, ease: "none" }, 0.53)
  .to(coldLightRef.current, { opacity: 0.48, duration: 0.08, ease: "none" }, 0.72)
  .to(coldLightRef.current, { opacity: 0.05, duration: 0.12, ease: "none" }, 0.88)
  .to(coldLightRef.current, { opacity: 0.32, duration: 0.07, ease: "none" }, 1.04)
  .to(coldLightRef.current, { opacity: 0, duration: 0.14, ease: "power1.in" }, 1.11)
  .set(blackoutRef.current, { autoAlpha: 1 }, 1.25)
  .set(suspectRef.current, { autoAlpha: 0 }, 1.25)
  .to(blackoutRef.current, { autoAlpha: 0, duration: 0.08, ease: "none" }, 1.55)
  .fromTo(gateRef.current, {
    autoAlpha: 1,
    yPercent: -135,
  }, {
    autoAlpha: 1,
    yPercent: 0,
    duration: 1.2,
    ease: "power3.in",
  }, 1.55)
  .to(gateRef.current, { y: -3, duration: 0.07, ease: "power2.out" }, 2.75)
  .to(gateRef.current, { y: 2, duration: 0.07, ease: "power2.in" }, 2.82)
  .to(gateRef.current, { y: -1, duration: 0.06, ease: "none" }, 2.89)
  .to(gateRef.current, { y: 0, duration: 0.06, ease: "none" }, 2.95)
  .fromTo(latchRef.current, { autoAlpha: 0, y: -10 }, {
    autoAlpha: 1,
    y: 0,
    duration: 0.18,
    ease: "back.out(2.2)",
  }, 2.97)
  .to(warmLightRef.current, {
    autoAlpha: 1,
    duration: 0.5,
    ease: "power2.out",
  }, 3.15)
  .to(suspectRef.current, {
    autoAlpha: 0.85,
    duration: 0.35,
    ease: "power1.out",
  }, 3.65);
```

- [ ] **步骤 4：实现减少动态模式终态**

当 `prefers-reduced-motion: reduce` 时，不创建闪烁或位移动画，直接设置：

```ts
gsap.set(copyRef.current, { autoAlpha: 0 });
gsap.set(coldLightRef.current, { autoAlpha: 0 });
gsap.set(blackoutRef.current, { autoAlpha: 0 });
gsap.set(gateRef.current, { autoAlpha: 1, y: 0, yPercent: 0 });
gsap.set(latchRef.current, { autoAlpha: 1, y: 0 });
gsap.set(warmLightRef.current, { autoAlpha: 1 });
gsap.set(suspectRef.current, { autoAlpha: 0.85 });
```

- [ ] **步骤 5：运行组件测试并修至通过**

运行：

```bash
cd frontend
npm test -- tests/cinematic-case-launch.test.tsx tests/landing-page.test.tsx
```

预期：全部 PASS；快速请求、慢速请求、错误回退和 `onComplete` 既有用例不回归。

- [ ] **步骤 6：提交组件重构**

```bash
git add frontend/features/game/components/cinematic-case-launch.tsx frontend/tests/cinematic-case-launch.test.tsx frontend/tests/landing-page.test.tsx
git commit -m "refactor: 改为固定收容舱与活动栅门"
```

## 任务 3：制作并接入 V3 半写实动漫资产

**文件：**
- 创建：`frontend/public/images/case-launch/v3/environment-desktop.webp`
- 创建：`frontend/public/images/case-launch/v3/environment-mobile.webp`
- 创建：`frontend/public/images/case-launch/v3/ai-suspect.png`
- 创建：`frontend/public/images/case-launch/v3/interrogator.png`

- [ ] **步骤 1：生成桌面环境底图**

使用图片生成工具，提示词必须包含以下完整约束：

```text
16:9 full-screen environment plate for an AI interrogation web experience,
semi-realistic anime cinematic concept art, almost-black sealed unknown space,
a massive front-facing containment chamber centered in frame, fixed thick metal
outer shell, visible shallow right inner wall, ceiling gate slot and grounded base,
front opening completely empty and unobstructed, subtle rough wall and floor seams,
left side clean negative space for one sentence and a button, no people, no bars,
no active spotlight, no text, no signage, no UI, no police symbols, restrained
charcoal black and desaturated steel palette, strong depth, premium game key art,
camera at standing eye level, symmetrical central device, no horror gore.
```

生成后检查：收容舱居中、正面敞开、顶部槽存在、左侧留白、无人物和文字。保存为 WebP。

- [ ] **步骤 2：生成竖屏环境底图**

使用相同视觉语言生成 9:16 版本，额外约束：收容舱宽度占画面约 80%，顶部和底部均留出安全区，左上至中部保留文案空间。不得直接裁切桌面图导致装置或基座缺失。

- [ ] **步骤 3：生成嫌疑人透明资产**

```text
Transparent PNG, full-body anonymous gender-neutral adult AI suspect seated on a
simple metal stool, 35-degree side view, head bowed, face at least 75 percent in
shadow with no readable eyes, loose straight dark workwear with no gender cues,
semi-realistic anime cinematic concept art matching a restrained charcoal steel
environment, quiet neutral posture, no restraints, no wounds, no weapon, no text,
no cage, no light beam, isolated subject, clean transparent edges.
```

- [ ] **步骤 4：生成审讯者透明资产**

```text
Transparent PNG, anonymous gender-neutral adult interrogator seen from three-quarter
back, loose long straight dark coat, no face visible, no badge, no weapon, no police
insignia, semi-realistic anime cinematic concept art, designed as a large right-side
foreground shoulder-and-back silhouette looking toward a central subject, isolated
subject, clean transparent edges, no text and no background.
```

- [ ] **步骤 5：视觉检查并只重做不合格资产**

逐张确认：

- 环境没有活动栅门、人物、文字和无来源亮光。
- 嫌疑人无法判断性别，正脸不可辨认，凳子和肢体无畸变。
- 审讯者适合放在右侧近景，背部朝向用户且没有现实执法标识。
- 四张资产的线条锐度、噪点、黑位和金属色温一致。

- [ ] **步骤 6：提交资产**

```bash
git add frontend/public/images/case-launch/v3
git commit -m "feat: 加入 V3 收容舱半写实场景资产"
```

## 任务 4：建立 V3 CSS Module 视觉系统

**文件：**
- 创建：`frontend/features/game/components/cinematic-case-launch.module.css`
- 修改：`frontend/features/game/components/cinematic-case-launch.tsx`

- [ ] **步骤 1：写入根布局与色彩令牌**

CSS Module 根节点从以下令牌开始：

```css
.root {
  --space-black: #020303;
  --charred-wall: #080a0b;
  --metal-dark: #141718;
  --cold-light: #c5cbd3;
  --tungsten-core: #ffe8d6;
  --warning-gold: #d9a74a;
  --copy: #d8d5cf;
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--copy);
  background: var(--space-black);
}

.stage,
.environment {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.environment img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
}
```

- [ ] **步骤 2：定位中央装置、嫌疑人和右侧审讯者**

桌面构图使用统一焦点变量：

```css
.root { --focus-x: 52%; --floor-y: 7%; }
.shell,
.gate {
  position: absolute;
  left: var(--focus-x);
  bottom: var(--floor-y);
  width: clamp(390px, 48vw, 720px);
  height: min(76vh, 760px);
  transform: translateX(-50%);
}
.suspect {
  position: absolute;
  left: var(--focus-x);
  bottom: calc(var(--floor-y) + 2%);
  width: clamp(180px, 18vw, 290px);
  transform: translateX(-50%);
}
.interrogator {
  position: absolute;
  right: -8%;
  bottom: -18%;
  width: clamp(430px, 39vw, 680px);
  filter: brightness(.24) saturate(.45) drop-shadow(-22px 18px 34px #000);
}
```

`.shell` 只负责必要的 DOM 对齐锚点，不重复绘制环境底图中已有的厚重外框。

- [ ] **步骤 3：制作独立栅门和可追溯灯光**

栅门使用深色金属边框、规则竖条和中央锁扣；其初始状态位于顶部槽内。冷光位于右后方，使用局部斜向 clip-path；暖光只存在于收容舱内部：

```css
.coldLight {
  position: absolute;
  z-index: 4;
  right: 7%;
  top: 4%;
  width: 48%;
  height: 82%;
  opacity: .74;
  clip-path: polygon(72% 0, 88% 0, 47% 100%, 4% 100%);
  background: linear-gradient(180deg, rgba(197,203,211,.16), rgba(197,203,211,.025) 72%, transparent);
  filter: blur(10px);
}
.warmLight {
  position: absolute;
  z-index: 11;
  left: var(--focus-x);
  top: 7%;
  width: clamp(360px, 38vw, 590px);
  height: 80%;
  opacity: 0;
  transform: translateX(-50%);
  clip-path: polygon(44% 0, 56% 0, 78% 100%, 22% 100%);
  background: linear-gradient(180deg, rgba(255,232,214,.20), rgba(215,169,123,.025) 76%, transparent);
  filter: blur(9px);
}
```

禁止在 `.root`、`.stage` 或 `.environment` 上增加大面积浅灰 radial-gradient。

- [ ] **步骤 4：实现克制文案与完成态**

- 文案位于左侧负空间，桌面宽度不超过 `36vw`。
- “会撒谎”和“AI 嫌疑人”只在 `#758089` 与 `#7B4A48` 之间缓慢变化。
- “真相”固定为 `#D9A74A`，不加外发光。
- 启动入口最小高度 `44px`，使用细边框和半透明黑底。
- `LOCKING` / `COMPLETED` 仅让锁扣边缘和中心小范围转为警戒暗金。

- [ ] **步骤 5：实现三档响应式与减少动态**

```css
@media (max-width: 900px) {
  .root { --focus-x: 57%; --floor-y: 14%; }
  .shell, .gate { width: min(66vw, 570px); height: 68vh; }
  .interrogator { right: -24%; width: min(62vw, 560px); }
}

@media (max-width: 600px) {
  .root { --focus-x: 52%; --floor-y: 21%; }
  .shell, .gate { width: 82vw; height: 58vh; }
  .suspect { width: min(38vw, 190px); }
  .interrogator { right: -58%; bottom: -8%; width: 108vw; }
  .copy { left: 18px; right: 18px; top: max(88px, calc(env(safe-area-inset-top) + 70px)); bottom: auto; width: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .aiScanlines, .aiNoise, .grain, .shift { animation: none !important; }
  .shift { color: #758089; background: none; }
}
```

- [ ] **步骤 6：运行静态测试、类型检查和构建**

运行：

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

预期：全部 PASS；生产构建能解析 CSS Module 和四张静态资产。

- [ ] **步骤 7：提交视觉系统**

```bash
git add frontend/features/game/components/cinematic-case-launch.module.css frontend/features/game/components/cinematic-case-launch.tsx
git commit -m "style: 重建中央收容舱 V3 视觉系统"
```

## 任务 5：浏览器关键帧与五档视口验收

**文件：**
- 修改：`tests/web_smoke.py`

- [ ] **步骤 1：增加 V3 E2E 结构断言**

在首页测试中加入：

```python
scene = page.locator('[data-scene-version="v3"]')
expect(scene).to_have_attribute("data-launch-state", "IDLE")
expect(page.get_by_test_id("containment-shell")).to_be_visible()
expect(page.get_by_test_id("containment-gate")).to_be_attached()
expect(page.get_by_test_id("ai-suspect")).to_be_visible()
expect(page.get_by_test_id("foreground-interrogator")).to_be_visible()
```

点击后等待并断言：

```python
page.get_by_role("button", name="生成案件").click()
expect(scene).to_have_attribute("data-launch-state", "CEREMONY")
page.wait_for_timeout(2850)
gate_box = page.get_by_test_id("containment-gate").bounding_box()
suspect_box = page.get_by_test_id("ai-suspect").bounding_box()
assert gate_box and suspect_box
assert gate_box["x"] <= suspect_box["x"]
assert gate_box["x"] + gate_box["width"] >= suspect_box["x"] + suspect_box["width"]
```

- [ ] **步骤 2：增加五档视口无溢出检查**

对 `1440×900`、`1024×768`、`768×1024`、`390×844`、`360×800` 逐个运行：

```python
overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
assert overflow <= 1
expect(page.get_by_role("button", name="生成案件")).to_be_in_viewport()
expect(page.get_by_test_id("ai-suspect")).to_be_in_viewport()
```

- [ ] **步骤 3：运行 E2E 确认失败或视觉偏差**

运行：

```bash
PYTHON_BIN=/Users/liuxs/Desktop/AIPM/Personal-Projects/AI审讯室/.venv/bin/python ./scripts/test-e2e.sh
```

预期：如果几何或移动端裁切不符合契约则 FAIL；根据失败视口只调整 CSS Module，不改状态机。

- [ ] **步骤 4：截取四个关键帧并人工检查**

每个桌面和手机视口至少截取：

- `IDLE`：固定舱体敞开，嫌疑人处于冷光暗部，右侧审讯者不遮文案。
- `1.40s`：局部黑场，不出现整屏白闪。
- `2.85s`：栅门已包围嫌疑人，固定舱体没有移动。
- `4.10s`：暖光只落在舱内，审讯者仍在暗部。

- [ ] **步骤 5：运行完整验证**

```bash
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
cd ..
PYTHON_BIN=/Users/liuxs/Desktop/AIPM/Personal-Projects/AI审讯室/.venv/bin/python ./scripts/test-e2e.sh
```

预期：单元测试、类型检查、Lint、生产构建和完整 E2E 全部 PASS。

- [ ] **步骤 6：提交验收更新**

```bash
git add tests/web_smoke.py
git commit -m "test: 验证 V3 收容舱关键帧与五档视口"
```

## 任务 6：最终范围审计

**文件：**
- 检查：本计划列出的全部文件

- [ ] **步骤 1：检查提交与工作区范围**

```bash
git log --oneline -8
git status --short
git diff main...HEAD -- frontend/features/game/components frontend/public/images/case-launch/v3 frontend/tests/cinematic-case-launch.test.tsx frontend/tests/landing-page.test.tsx tests/web_smoke.py
```

预期：V3 提交只涉及首页场景、对应资产与测试；工作区中其他既有未提交改动仍保持原样。

- [ ] **步骤 2：对照规格逐项复核**

确认以下要求均能在代码、资产或测试中找到对应实现：固定收容舱、独立落栅门、右侧近景审讯者、中性无脸嫌疑人、局部冷光、舱内暖光、极简文案、快速/慢速请求、减少动态、五档视口和失败重试。

- [ ] **步骤 3：记录最终验证结果**

最终交付信息必须包含：实现分支、关键文件、图片生成方式与最终提示词摘要、全部验证命令及结果、尚未部署说明。
