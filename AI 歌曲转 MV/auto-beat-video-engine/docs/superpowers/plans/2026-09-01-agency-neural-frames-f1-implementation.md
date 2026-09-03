# Agency Neural Frames F1 界面重做实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将现有 Storyboard 后台式三栏页面重做为 Neural Frames 风格的 Storyboard、Shot Editor、Preview 三工作区可操作 Fixture，并锁定响应式、无障碍与视觉基线。

**架构：** 在 `/projects/demo` 下建立共享 Demo Shell、领域 Fixture 与纯状态转换；三个工作区共享项目数据，但页面只渲染当前任务所需信息。F1 不接后端、SSE 或模型 API，所有演示行为必须明确标注为本地 Fixture，不伪装真实生成或持久化。

**技术栈：** Next.js 15 App Router、React 19、TypeScript strict、CSS Modules、Lucide React、Vitest、Testing Library、Playwright、axe-core。

---

## 文件结构

### 共享工作区

- 创建 `frontend/app/projects/demo/layout.tsx`：为 3 个工作区提供持久外壳。
- 创建 `frontend/app/projects/demo/_components/demo-shell.tsx`：应用栏、顶栏、工作区导航和移动底栏。
- 创建 `frontend/app/projects/demo/_components/demo-shell.module.css`：外壳布局与断点。
- 创建 `frontend/app/projects/demo/_components/workspace-sheet.tsx`：支持右侧、底部和全屏模式的可访问 Sheet。
- 创建 `frontend/app/projects/demo/_components/workspace-sheet.module.css`：Sheet、Backdrop 与 Reduced Motion。
- 创建 `frontend/app/projects/demo/_lib/types.ts`：Demo Project、Shot、Take、Preview、Model Tier 类型。
- 创建 `frontend/app/projects/demo/_lib/fixture.ts`：固定项目、镜头、模型档位与媒体清单。
- 创建 `frontend/app/projects/demo/_lib/state.ts`：Retry、Take、Preview Stale 与派生统计纯函数。
- 创建对应的 `*.test.ts` 与 `*.test.tsx`。

### Storyboard

- 重写 `frontend/app/projects/demo/storyboard/page.tsx`。
- 重写 `frontend/app/projects/demo/storyboard/_components/storyboard-workspace.tsx`。
- 创建 `storyboard-controls.tsx`、`storyboard-card.tsx`、`quick-edit-sheet.tsx`。
- 创建 `storyboard-workspace.module.css`。
- 重写 `storyboard-workspace.test.tsx`。

### Shot Editor

- 创建 `frontend/app/projects/demo/storyboard/shots/[shotId]/page.tsx`。
- 创建 `_components/shot-editor-workspace.tsx`。
- 创建 `_components/shot-settings-panel.tsx`。
- 创建 `_components/take-viewer.tsx`。
- 创建 `_components/readonly-timeline.tsx`。
- 创建 `_components/shot-editor.module.css`。
- 创建 `_components/shot-editor-workspace.test.tsx`。

### Preview

- 创建 `frontend/app/projects/demo/preview/page.tsx`。
- 创建 `_components/preview-workspace.tsx`。
- 创建 `_components/export-sheet.tsx`。
- 创建 `_components/preview-timeline.tsx`。
- 创建 `_components/preview-workspace.module.css`。
- 创建 `_components/preview-workspace.test.tsx`。

### 资产与验收

- 创建 `frontend/public/demo/after-rain/posters/scene-01.webp` 至 `scene-08.webp`。
- 创建对应 400、800、1200 px WebP 变体。
- 创建无声演示视频时，严格限定为 `frontend/public/demo/after-rain/media/*.mp4`。
- 重写 `frontend/e2e/representative.spec.ts`。
- 创建 `frontend/e2e/accessibility.spec.ts` 与 `frontend/e2e/visual.spec.ts`。
- 更新 `frontend/app/globals.css`、`frontend/app/layout.tsx`、`frontend/package.json`、`frontend/package-lock.json`。
- 更新 `docs/frontend/fidelity-ledger.md`，保留旧截图作为历史证据。

旧 Route Local `_lib` 与 7 个旧组件只有在替代测试转绿后删除。

---

### 任务 1：共享 Fixture、纯状态与连续视觉资产

**文件：**

- 创建：`frontend/app/projects/demo/_lib/types.ts`
- 创建：`frontend/app/projects/demo/_lib/fixture.ts`
- 创建：`frontend/app/projects/demo/_lib/state.ts`
- 创建：`frontend/app/projects/demo/_lib/fixture.test.ts`
- 创建：`frontend/app/projects/demo/_lib/state.test.ts`
- 创建：`frontend/public/demo/after-rain/posters/*.webp`
- 删除：`frontend/app/projects/demo/storyboard/_lib/types.ts`
- 删除：`frontend/app/projects/demo/storyboard/_lib/fixtures.ts`
- 删除：`frontend/app/projects/demo/storyboard/_lib/state.ts`
- 删除：`frontend/app/projects/demo/storyboard/_lib/state.test.ts`

- [ ] **步骤 1：使用 imagegen 生成 8 张连续场景母图**

统一人物、服装、夜雨城市、紫蓝色调和电影镜头语言。每张母图为 1600 × 900 px，并预留 9:16 安全区；不得使用 CSS 渐变、竞品截图或品牌素材。

- [ ] **步骤 2：生成固定尺寸 WebP**

从每张母图生成 400、800、1200 px 变体，文件名固定为：

```text
scene-01-400.webp
scene-01-800.webp
scene-01-1200.webp
...
scene-08-1200.webp
```

- [ ] **步骤 3：编写失败的 Fixture 测试**

```ts
it("provides eight shots with real responsive posters", () => {
  expect(demoProject.shots).toHaveLength(8);
  for (const shot of demoProject.shots) {
    expect(shot.poster).toEqual(
      expect.objectContaining({ width400: expect.any(String), width1200: expect.any(String) }),
    );
    for (const path of Object.values(shot.poster)) {
      expect(existsSync(join(process.cwd(), "public", path))).toBe(true);
    }
  }
});
```

- [ ] **步骤 4：运行测试并确认失败**

运行：

```bash
npm test -- app/projects/demo/_lib/fixture.test.ts
```

预期：FAIL，原因是共享 Fixture 与类型尚不存在。

- [ ] **步骤 5：定义领域类型与固定 Fixture**

```ts
export type ShotStatus = "draft" | "queued" | "running" | "succeeded" | "failed_retryable";

export interface MediaVariants {
  width400: string;
  width800: string;
  width1200: string;
}

export interface Take {
  id: string;
  label: string;
  poster: MediaVariants;
  selected: boolean;
}

export interface Shot {
  id: string;
  number: number;
  title: string;
  range: string;
  durationSec: number;
  description: string;
  prompt: string;
  cameraMotion: string;
  status: ShotStatus;
  progress?: number;
  error?: string;
  overridesGlobalStyle: boolean;
  activeTakeId?: string;
  takes: Take[];
  poster: MediaVariants;
}
```

Fixture 必须覆盖 Draft、Queued、Running、Succeeded、Failed Retryable 5 种状态，并提供经济、平衡、质量 3 个模型档位。

- [ ] **步骤 6：编写失败的纯状态测试**

```ts
it("creates a take without discarding the accepted take", () => {
  const next = createTake(demoProject, "shot-06");
  const shot = next.shots.find((item) => item.id === "shot-06");
  expect(shot?.takes).toHaveLength(2);
  expect(shot?.activeTakeId).toBe("shot-06-take-02");
  expect(next.preview.status).toBe("stale");
});
```

- [ ] **步骤 7：实现纯状态转换**

实现并导出：

```ts
retryShot(project, shotId)
createTake(project, shotId)
selectTake(project, shotId, takeId)
deriveShotSummary(project.shots)
```

统计必须从 `shots` 派生，不保存重复的 `projectStats`。

- [ ] **步骤 8：运行共享模型测试**

运行：

```bash
npm test -- app/projects/demo/_lib
```

预期：所有 Fixture 与状态测试 PASS。

- [ ] **步骤 9：提交**

```bash
git add frontend/app/projects/demo/_lib frontend/public/demo/after-rain frontend/app/projects/demo/storyboard/_lib
git commit -m "feat(前端): 添加 Agency 演示领域模型与连续场景资产"
```

---

### 任务 2：64 px 应用壳与三工作区导航

**文件：**

- 创建：`frontend/app/projects/demo/layout.tsx`
- 创建：`frontend/app/projects/demo/_components/demo-shell.tsx`
- 创建：`frontend/app/projects/demo/_components/demo-shell.module.css`
- 创建：`frontend/app/projects/demo/_components/demo-shell.test.tsx`
- 修改：`frontend/app/globals.css`
- 修改：`frontend/app/layout.tsx`

- [ ] **步骤 1：编写失败的 Shell 测试**

Mock `next/navigation` 的 `usePathname()`，断言：

```ts
expect(screen.getByRole("link", { name: "故事板" })).toHaveAttribute("aria-current", "page");
expect(screen.getByRole("link", { name: "镜头编辑" })).toHaveAttribute(
  "href",
  "/projects/demo/storyboard/shots/shot-06",
);
expect(screen.getByRole("link", { name: "预览" })).toHaveAttribute("href", "/projects/demo/preview");
expect(screen.getByRole("link", { name: "跳到主内容" })).toHaveAttribute("href", "#main-content");
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
npm test -- app/projects/demo/_components/demo-shell.test.tsx
```

预期：FAIL，原因是 Demo Shell 尚不存在。

- [ ] **步骤 3：实现最小 Demo Shell**

`layout.tsx` 只负责：

```tsx
export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoShell>{children}</DemoShell>;
}
```

`DemoShell` 只读取当前路径，不保存业务状态。桌面使用 64 px 左栏与 64 px 顶栏；小于 768 px 使用 52 px 顶栏和底部导航。

- [ ] **步骤 4：重写全局 Token 与 Focus 基线**

将规格中的 `--bg-app`、`--bg-panel`、`--brand-primary` 等 Token 写入 `globals.css`。增加：

```css
:focus-visible {
  outline: 2px solid var(--brand-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **步骤 5：验证 Shell**

运行：

```bash
npm test -- app/projects/demo/_components/demo-shell.test.tsx
npm run typecheck
```

预期：PASS，TypeScript 0 错误。

- [ ] **步骤 6：提交**

```bash
git add frontend/app/projects/demo frontend/app/globals.css frontend/app/layout.tsx
git commit -m "feat(前端): 建立 Neural Frames 风格工作区外壳"
```

---

### 任务 3：可访问的通用 Workspace Sheet

**文件：**

- 创建：`frontend/app/projects/demo/_components/workspace-sheet.tsx`
- 创建：`frontend/app/projects/demo/_components/workspace-sheet.module.css`
- 创建：`frontend/app/projects/demo/_components/workspace-sheet.test.tsx`
- 修改：`frontend/vitest.setup.ts`

- [ ] **步骤 1：编写失败的 Sheet 测试**

覆盖：`role="dialog"`、`aria-modal="true"`、标题关联、初始焦点、Tab 循环、Shift + Tab 循环、Escape 关闭、关闭后焦点恢复、Body 滚动锁和卸载恢复。

```ts
expect(screen.getByRole("dialog", { name: "镜头设置" })).toHaveAttribute("aria-modal", "true");
await user.keyboard("{Escape}");
expect(onOpenChange).toHaveBeenCalledWith(false);
expect(trigger).toHaveFocus();
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
npm test -- app/projects/demo/_components/workspace-sheet.test.tsx
```

预期：FAIL，原因是组件不存在。

- [ ] **步骤 3：实现最小 Sheet**

组件接口固定为：

```ts
interface WorkspaceSheetProps {
  open: boolean;
  title: string;
  side: "right" | "bottom" | "full";
  triggerRef: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}
```

使用 Portal 和原生 Focus Trap，不引入整套 UI 库。Backdrop 支持点击关闭。

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
npm test -- app/projects/demo/_components/workspace-sheet.test.tsx
```

预期：PASS。

- [ ] **步骤 5：提交**

```bash
git add frontend/app/projects/demo/_components/workspace-sheet* frontend/vitest.setup.ts
git commit -m "feat(前端): 添加可访问的工作区 Sheet"
```

---

### 任务 4：Storyboard 媒体优先工作区

**文件：**

- 重写：`frontend/app/projects/demo/storyboard/page.tsx`
- 重写：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.tsx`
- 重写：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/storyboard-controls.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/storyboard-card.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/quick-edit-sheet.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.module.css`
- 删除：7 个被替代的旧组件文件。

- [ ] **步骤 1：编写失败的页面结构测试**

断言：

```ts
expect(screen.getByRole("heading", { name: "故事板" })).toBeVisible();
expect(screen.getByLabelText("视觉概念")).toBeVisible();
expect(screen.getByRole("button", { name: "生成全部" })).toBeEnabled();
expect(screen.queryByLabelText("音频波形")).not.toBeInTheDocument();
expect(screen.queryByRole("complementary", { name: "Cut 编辑" })).not.toBeInTheDocument();
expect(screen.queryByLabelText("Preview 状态")).not.toBeInTheDocument();
```

- [ ] **步骤 2：编写失败的媒体卡状态测试**

8 张卡必须使用真实 `<picture>` / `<img>`、16:9 媒体区、画面层状态。Running 使用 `progressbar`；Failed 只显示底部错误栏；Override 同时有文字和紫点。

- [ ] **步骤 3：运行测试并确认失败**

运行：

```bash
npm test -- app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx
```

预期：旧版测试与新结构不匹配，FAIL。

- [ ] **步骤 4：实现 Storyboard 控制栏与卡片**

主 CTA 只有「生成全部」。模型选择显示平衡档、¥80–140、720p 和约 60% 生成视频。所有 Poster 使用：

```tsx
<picture>
  <source srcSet={`${poster.width400} 400w, ${poster.width800} 800w, ${poster.width1200} 1200w`} />
  <img src={poster.width800} alt={shot.title} loading="lazy" />
</picture>
```

- [ ] **步骤 5：实现 Quick Edit 与导航交互**

- 桌面单击卡片打开 380 px Sheet；
- Enter 或双击进入 `/projects/demo/storyboard/shots/[shotId]`；
- 小于 768 px 单击直接进入 Shot Editor；
- 未 Hover / Focus 时 DOM 不挂载卡片 `<video>`；
- 同时最多挂载 1 段 Muted Preview。

- [ ] **步骤 6：删除已替代旧组件**

删除 `app-header.tsx`、`audio-context-bar.tsx`、`cut-card.tsx`、`cut-inspector.tsx`、`preview-status-bar.tsx`、`project-progress.tsx`、`scene-navigator.tsx`。

- [ ] **步骤 7：验证 Storyboard**

运行：

```bash
npm test -- app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx
npm run lint
npm run typecheck
```

预期：全部 PASS。

- [ ] **步骤 8：提交**

```bash
git add frontend/app/projects/demo/storyboard
git commit -m "feat(前端): 重做媒体优先故事板工作区"
```

---

### 任务 5：Shot Editor 左右分屏与只读时间线

**文件：**

- 创建：`frontend/app/projects/demo/storyboard/shots/[shotId]/page.tsx`
- 创建：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.tsx`
- 创建：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-settings-panel.tsx`
- 创建：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/take-viewer.tsx`
- 创建：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/readonly-timeline.tsx`
- 创建：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor.module.css`
- 创建：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.test.tsx`

- [ ] **步骤 1：编写失败的 Shot Editor 测试**

断言存在 Scene / 时间范围、前后镜头链接、参考图、Prompt、6 个运动预设、折叠高级设置、模型与预计成本，以及唯一主 CTA「生成新版本」。

```ts
expect(screen.getByRole("button", { name: "生成新版本" })).toBeVisible();
expect(screen.getByLabelText("只读时间线")).toBeVisible();
expect(screen.queryByRole("slider")).not.toBeInTheDocument();
```

- [ ] **步骤 2：编写失败的 Take 与键盘测试**

Stage 聚焦时 Space 切换播放态，左右键切换 Take；输入框内按键不得触发 Stage 快捷键。生成新版本后旧 Take 仍可选择，Preview 变为 Stale。

- [ ] **步骤 3：运行测试并确认失败**

运行：

```bash
npm test -- 'app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.test.tsx'
```

预期：FAIL，原因是动态路由与组件尚不存在。

- [ ] **步骤 4：实现 Shot Editor**

- 左侧设置区约 580 px；
- 右侧 Stage 约 732 px；
- 底部时间线 204 px；
- 只挂载 1 个 `<video preload="metadata">`；
- 本地生成动作调用 `createTake()`，并使用 `role="status"` 显示「已创建本地演示版本」。

- [ ] **步骤 5：实现有效与无效动态路由**

有效 Shot 传入 Fixture；无效 `shotId` 调用 `notFound()`。动态路径在 Shell 命令中始终使用引号。

- [ ] **步骤 6：验证 Shot Editor**

运行：

```bash
npm test -- 'app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.test.tsx'
npm run typecheck
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add 'frontend/app/projects/demo/storyboard/shots/[shotId]'
git commit -m "feat(前端): 添加单镜头编辑与版本工作区"
```

---

### 任务 6：Preview 大画面、缺失片段与导出 Sheet

**文件：**

- 创建：`frontend/app/projects/demo/preview/page.tsx`
- 创建：`frontend/app/projects/demo/preview/_components/preview-workspace.tsx`
- 创建：`frontend/app/projects/demo/preview/_components/export-sheet.tsx`
- 创建：`frontend/app/projects/demo/preview/_components/preview-timeline.tsx`
- 创建：`frontend/app/projects/demo/preview/_components/preview-workspace.module.css`
- 创建：`frontend/app/projects/demo/preview/_components/preview-workspace.test.tsx`

- [ ] **步骤 1：编写失败的 Preview 测试**

断言：16:9 大 Stage、画幅、分辨率、唯一 CTA「导出」、视频轨、音频轨、Beat、歌词与转场层。

- [ ] **步骤 2：编写失败的状态与导航测试**

```ts
expect(screen.getByText("预览需要更新")).toBeVisible();
expect(screen.queryByText("预览已就绪")).not.toBeInTheDocument();
expect(screen.getByRole("link", { name: /修复 Scene 06/ })).toHaveAttribute(
  "href",
  "/projects/demo/storyboard/shots/shot-06?returnTo=%2Fprojects%2Fdemo%2Fpreview%3Ft%3D58",
);
```

- [ ] **步骤 3：运行测试并确认失败**

运行：

```bash
npm test -- app/projects/demo/preview/_components/preview-workspace.test.tsx
```

预期：FAIL，Preview 路由尚不存在。

- [ ] **步骤 4：实现 Preview 与时间线**

- 主预览最大宽度约 960 px；
- 时间线 236 px；
- 缺失 Clip 使用斜线纹理与文本，不整段染红；
- `?t=58` 初始化播放头；
- 从 Shot Editor 返回时保留该参数。

- [ ] **步骤 5：实现 Export Sheet**

点击「导出」打开 360 px Sheet，提供格式、分辨率、字幕和平台预设。确认按钮必须标注「演示配置，不会生成文件」。

- [ ] **步骤 6：验证 Preview**

运行：

```bash
npm test -- app/projects/demo/preview/_components/preview-workspace.test.tsx
npm run typecheck
```

预期：PASS。

- [ ] **步骤 7：提交**

```bash
git add frontend/app/projects/demo/preview
git commit -m "feat(前端): 添加整片预览与导出工作区"
```

---

### 任务 7：五档响应式与跨工作区 E2E

**文件：**

- 重写：`frontend/e2e/representative.spec.ts`
- 修改：各工作区 CSS Module。

- [ ] **步骤 1：编写失败的响应式 E2E**

验证 Storyboard 网格列数：

```ts
const expectedColumns = new Map([
  [1440, 4], [1280, 4], [1024, 3], [768, 2], [390, 1],
]);
```

每个视口都检查根节点无横向溢出。390 × 844 首屏同时显示首张画面、当前镜头和「生成全部」。

- [ ] **步骤 2：编写失败的跨工作区 E2E**

覆盖：Storyboard 按 Enter → Shot Editor；Shot Editor 切镜头、切 Take、Space 播放；Preview 缺失片段 → Shot Editor → 保留 `?t=` 返回 Preview。

- [ ] **步骤 3：运行 E2E 并确认失败**

运行：

```bash
npm run test:e2e -- e2e/representative.spec.ts
```

预期：至少 1 个断点或导航断言 FAIL。

- [ ] **步骤 4：补充最小断点与导航 Glue**

本任务只补 CSS 断点和路由衔接，不添加新功能。固定 CTA 与移动底栏使用 `env(safe-area-inset-bottom)`，正文增加等高 Padding，避免遮挡。

- [ ] **步骤 5：运行 E2E 并确认通过**

运行：

```bash
npm run test:e2e -- e2e/representative.spec.ts
```

预期：PASS。

- [ ] **步骤 6：提交**

```bash
git add frontend/e2e/representative.spec.ts frontend/app/projects/demo
git commit -m "test(前端): 覆盖 Agency 工作区响应式与导航"
```

---

### 任务 8：axe、视觉基线与最终门禁

**文件：**

- 创建：`frontend/e2e/accessibility.spec.ts`
- 创建：`frontend/e2e/visual.spec.ts`
- 创建：`frontend/e2e/visual.spec.ts-snapshots/*`
- 修改：`frontend/package.json`
- 修改：`frontend/package-lock.json`
- 修改：`docs/frontend/fidelity-ledger.md`

- [ ] **步骤 1：编写 axe 测试并确认缺少依赖**

```ts
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
```

运行：

```bash
npm run test:e2e -- e2e/accessibility.spec.ts
```

预期：FAIL，`@axe-core/playwright` 尚未安装。

- [ ] **步骤 2：安装 axe Playwright 集成**

```bash
npm install -D @axe-core/playwright
```

- [ ] **步骤 3：补齐无障碍测试**

3 个路由在 1440 和 390 px 下必须达到：

- Serious / Critical 为 0；
- Tab、Shift + Tab、Enter、Escape、Space、方向键流程通过；
- 200% Zoom 根节点无横向溢出；
- Sheet 焦点闭环和焦点恢复通过。

- [ ] **步骤 4：编写视觉回归测试**

Storyboard 覆盖 1440、1280、1024、768、390；Shot Editor 与 Preview 覆盖 1440、768、390。使用固定 Fixture、关闭动画，`maxDiffPixelRatio: 0.01`。

- [ ] **步骤 5：首次生成快照并人工审图**

```bash
npm run test:e2e -- e2e/visual.spec.ts --update-snapshots
```

逐张检查布局、裁切、文字、边框、圆角、焦点和媒体加载。不得用更新快照掩盖可见回归。

- [ ] **步骤 6：更新 Fidelity Ledger**

记录每个视口的竞品结构对照、实现截图、已知差异和接受理由。旧截图保留为历史，不覆盖。

- [ ] **步骤 7：运行完整门禁**

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
git diff --check
```

预期：功能、构建和测试命令均为 0；视觉差异 ≤1%。依赖审计若仍失败，必须保留原始报告并作为发布门禁，不能使用 `npm audit fix --force` 跨主版本升级。

- [ ] **步骤 8：提交**

```bash
git add frontend/e2e frontend/package.json frontend/package-lock.json docs/frontend/fidelity-ledger.md
git commit -m "test(前端): 锁定 Agency 视觉与无障碍基线"
```

---

## 规格覆盖自检

- Storyboard、Shot Editor、Preview 3 个工作区均有独立任务；
- Neural Frames 的窄应用栏、媒体优先卡片、左右分屏和时间线均有实现任务；
- 真实连续视觉资产在任务 1 固定，不使用动态图片做 Golden；
- 经济、平衡、质量模型档位只作为 F1 Fixture 文案，不接 Provider；
- Retry、Take、Preview Stale 与缺失片段均有纯状态和交互测试；
- 390、768、1024、1280、1440 px 均进入响应式矩阵；
- Sheet、键盘、焦点、Reduced Motion、axe 与 200% Zoom 均有验收；
- F1 明确不接真实 API、SSE、模型、拖拽、Modulation 或多轨剪辑；
- 计划无未决占位符或未定义接口。
