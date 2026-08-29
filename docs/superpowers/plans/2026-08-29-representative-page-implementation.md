# Storyboard + Cut 代表页实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将旧 Vite 演示前端迁移为 Next.js + TypeScript strict，并实现与已批准视觉概念一致、可在浏览器操作的 Storyboard + Cut 代表页 UI。

**架构：** 使用 Next.js App Router 承载单一代表页路由；业务展示数据放在类型化 Fixture 中，交互集中在页面级 Client Component，布局组件保持专注。F1 不访问 FastAPI，所有本地演示状态明确标为界面预览，避免与真实服务状态混淆。

**技术栈：** Next.js、React、TypeScript strict、Tailwind CSS、Lucide React、Vitest、Testing Library、Playwright 或 Browser/IAB。

---

## 全局约束

- 视觉依据：`docs/frontend/concepts/storyboard-cut-workspace-v1.png`。
- 设计依据：`docs/superpowers/specs/2026-08-29-formal-frontend-design.md`。
- 只实现 `/projects/demo/storyboard` 代表页和必要根路由跳转。
- 不调用真实后端、Qwen、Wan、ASR 或 Render Provider。
- 不实现登录、上传、Preview/Export 生成或其他正式页面。
- 成功 Cut 必须在失败 Cut 重试时保持不变。
- 页面必须明确展示这是“UI 预览数据”，不可把本地状态伪装成服务端结果。
- 所有 UI 文本和控件用代码实现，不把设计稿截图嵌入页面。
- 先测试、确认失败，再写最少实现；每个任务独立提交。

## 文件结构

### 创建

- `frontend/next.config.ts`：Next.js 配置。
- `frontend/tsconfig.json`：TypeScript strict 配置。
- `frontend/postcss.config.mjs`：Tailwind PostCSS 配置。
- `frontend/vitest.config.ts`：Vitest + jsdom 配置。
- `frontend/vitest.setup.ts`：Testing Library matcher 配置。
- `frontend/app/layout.tsx`：全局布局和元数据。
- `frontend/app/page.tsx`：跳转到代表页。
- `frontend/app/globals.css`：设计 Token、基础样式、响应式规则。
- `frontend/app/projects/demo/storyboard/page.tsx`：代表页入口。
- `frontend/app/projects/demo/storyboard/_components/storyboard-workspace.tsx`：页面状态与组合。
- `frontend/app/projects/demo/storyboard/_components/app-header.tsx`：顶栏。
- `frontend/app/projects/demo/storyboard/_components/project-progress.tsx`：六步流程。
- `frontend/app/projects/demo/storyboard/_components/audio-context-bar.tsx`：播放器、波形、Beat。
- `frontend/app/projects/demo/storyboard/_components/scene-navigator.tsx`：Scene 导航。
- `frontend/app/projects/demo/storyboard/_components/cut-card.tsx`：Cut 状态卡片。
- `frontend/app/projects/demo/storyboard/_components/cut-inspector.tsx`：选中 Cut 编辑区。
- `frontend/app/projects/demo/storyboard/_components/preview-status-bar.tsx`：底部任务汇总。
- `frontend/app/projects/demo/storyboard/_lib/types.ts`：页面类型。
- `frontend/app/projects/demo/storyboard/_lib/fixtures.ts`：本地预览数据。
- `frontend/app/projects/demo/storyboard/_lib/state.ts`：纯状态转换函数。
- `frontend/app/projects/demo/storyboard/_lib/state.test.ts`：状态行为测试。
- `frontend/app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx`：代表页交互测试。

### 修改

- `frontend/package.json`：Next.js、测试和检查脚本。
- `frontend/package-lock.json`：锁定依赖。
- `frontend/.gitignore`：忽略 `.next`、coverage 和本地环境文件。

### 删除

- `frontend/index.html`
- `frontend/vite.config.js`
- `frontend/eslint.config.js`
- `frontend/src/App.css`
- `frontend/src/App.jsx`
- `frontend/src/index.css`
- `frontend/src/main.jsx`
- `frontend/src/components/ASCIIBackground.jsx`
- `frontend/src/components/AmbientScene.jsx`
- `frontend/src/components/ControlPanel.jsx`
- `frontend/src/components/ParticleField.jsx`
- `frontend/src/components/UploadCard.jsx`

旧 Vite 实现保留在 Git 历史中，不复制到新应用。

### 任务 1：建立 Next.js strict 与测试基线

**文件：**
- 修改：`frontend/package.json`
- 修改：`frontend/package-lock.json`
- 修改：`frontend/.gitignore`
- 创建：`frontend/next.config.ts`
- 创建：`frontend/tsconfig.json`
- 创建：`frontend/postcss.config.mjs`
- 创建：`frontend/vitest.config.ts`
- 创建：`frontend/vitest.setup.ts`
- 创建：`frontend/app/layout.tsx`
- 创建：`frontend/app/page.tsx`
- 创建：`frontend/app/globals.css`
- 删除：旧 Vite 入口与旧 `src/` 文件

- [ ] **步骤 1：更新依赖与脚本**

`package.json` 至少包含：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

运行：`npm install`

预期：生成与 Next.js、TypeScript、Tailwind、Lucide、Vitest、Testing Library 一致的锁文件。

- [ ] **步骤 2：建立 strict 配置与最小 App Router**

`tsconfig.json` 必须包含：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "jsx": "preserve"
  }
}
```

根页面只执行服务端重定向：

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/projects/demo/storyboard");
}
```

- [ ] **步骤 3：运行基线检查**

运行：`npm run typecheck && npm run test && npm run build`

预期：全部退出码 0；此时还没有代表页。

- [ ] **步骤 4：Commit**

```bash
git add frontend
git commit -m "build: migrate frontend to Next.js"
```

### 任务 2：用 TDD 建立页面类型和状态转换

**文件：**
- 创建：`frontend/app/projects/demo/storyboard/_lib/types.ts`
- 创建：`frontend/app/projects/demo/storyboard/_lib/fixtures.ts`
- 创建：`frontend/app/projects/demo/storyboard/_lib/state.ts`
- 创建：`frontend/app/projects/demo/storyboard/_lib/state.test.ts`

- [ ] **步骤 1：先写失败测试**

测试至少覆盖：

```ts
it("retries only the selected failed cut", () => {
  const next = retryCut(workspaceFixture, "cut-06");
  expect(next.cuts.find((cut) => cut.id === "cut-06")?.status).toBe("queued");
  expect(next.cuts.find((cut) => cut.id === "cut-04")?.status).toBe("succeeded");
});

it("marks preview stale after saving a cut revision", () => {
  const next = saveCutDraft(workspaceFixture, "cut-06", {
    prompt: "新的镜头提示词",
  });
  expect(next.preview.status).toBe("stale");
});
```

- [ ] **步骤 2：验证红灯**

运行：`npm test -- _lib/state.test.ts`

预期：FAIL，原因是状态函数尚不存在。

- [ ] **步骤 3：实现最少类型和状态函数**

状态联合类型至少为：

```ts
export type CutStatus = "succeeded" | "running" | "failed_retryable" | "queued";
export type PreviewStatus = "ready" | "building" | "stale" | "failed";
```

Fixture 必须包含 3 个 Scene 和 4 个当前 Scene Cut；时间范围与批准概念一致。

- [ ] **步骤 4：验证绿灯**

运行：`npm test -- _lib/state.test.ts`

预期：全部测试通过。

- [ ] **步骤 5：Commit**

```bash
git add frontend/app/projects/demo/storyboard/_lib
git commit -m "test: define storyboard preview state"
```

### 任务 3：实现静态视觉骨架

**文件：**
- 创建：`frontend/app/projects/demo/storyboard/page.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/app-header.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/project-progress.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/audio-context-bar.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/scene-navigator.tsx`
- 修改：`frontend/app/globals.css`

- [ ] **步骤 1：先写结构测试**

在 `storyboard-workspace.test.tsx` 中断言：

```tsx
expect(screen.getByRole("banner")).toHaveTextContent("声画");
expect(screen.getByLabelText("项目进度")).toHaveTextContent("镜头");
expect(screen.getByLabelText("音频波形")).toHaveTextContent("BPM 124");
expect(screen.getByRole("navigation", { name: "场景" })).toHaveTextContent("霓虹街区");
```

- [ ] **步骤 2：验证红灯**

运行：`npm test -- storyboard-workspace.test.tsx`

预期：FAIL，原因是组件尚不存在。

- [ ] **步骤 3：实现骨架和 Token**

实现顶栏、六步进度、深色音频条、Scene 导航和桌面三栏网格。波形使用确定性 CSS 柱状序列和 Beat Marker，不能使用随机数，避免 Hydration 差异。

- [ ] **步骤 4：验证绿灯与类型**

运行：`npm test -- storyboard-workspace.test.tsx && npm run typecheck`

预期：全部退出码 0。

- [ ] **步骤 5：Commit**

```bash
git add frontend/app
git commit -m "feat: add storyboard workspace shell"
```

### 任务 4：实现 Cut、Inspector 和本地交互

**文件：**
- 创建：`frontend/app/projects/demo/storyboard/_components/cut-card.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/cut-inspector.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/preview-status-bar.tsx`
- 创建：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.tsx`
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx`

- [ ] **步骤 1：先写交互测试**

测试必须验证：

```tsx
await user.click(screen.getByRole("button", { name: /选择 Cut 06/ }));
expect(screen.getByRole("complementary", { name: "Cut 编辑" })).toHaveTextContent("生成失败");

await user.click(screen.getByRole("button", { name: "重试 Cut 06" }));
expect(screen.getByTestId("cut-cut-06")).toHaveTextContent("排队中");
expect(screen.getByTestId("cut-cut-04")).toHaveTextContent("已完成");

await user.clear(screen.getByLabelText("视频提示词"));
await user.type(screen.getByLabelText("视频提示词"), "新的镜头提示词");
await user.click(screen.getByRole("button", { name: "保存修改" }));
expect(screen.getByRole("status")).toHaveTextContent("修改已保存到界面预览");
expect(screen.getByText("预览需要更新")).toBeInTheDocument();
```

- [ ] **步骤 2：验证红灯**

运行：`npm test -- storyboard-workspace.test.tsx`

预期：FAIL，原因是交互组件尚未实现。

- [ ] **步骤 3：实现最少交互**

- Scene 和 Cut 使用稳定 ID 选择；
- 重试只调用纯函数更新目标 Cut；
- 保存修改更新本地 Fixture 副本并将 Preview 标为 stale；
- 可见反馈必须写明“界面预览”，不暗示服务端已保存；
- 运行中进度条提供 `aria-valuenow="62"`；
- 状态文本与图标共同表达，不能只使用颜色。

- [ ] **步骤 4：验证绿灯**

运行：`npm test -- storyboard-workspace.test.tsx && npm run typecheck`

预期：全部退出码 0。

- [ ] **步骤 5：Commit**

```bash
git add frontend/app/projects/demo/storyboard
git commit -m "feat: implement interactive cut workspace"
```

### 任务 5：响应式、可访问性与视觉核对

**文件：**
- 修改：`frontend/app/globals.css`
- 修改：代表页组件中的可访问属性
- 创建：`docs/frontend/fidelity-ledger.md`

- [ ] **步骤 1：补充可访问测试**

测试至少确认活动步骤包含 `aria-current="step"`、选中 Scene / Cut 包含 `aria-current` 或 `aria-pressed`、抽屉和按钮有可访问名称。

- [ ] **步骤 2：验证红灯**

运行：`npm test`

预期：新增断言在缺少属性时失败。

- [ ] **步骤 3：实现响应式与焦点状态**

- `>= 1200px`：Scene / Cut / Inspector 三栏；
- `768–1199px`：Scene 收窄，Inspector 变为可展开侧栏；
- `< 768px`：单列，Scene 与 Inspector 使用页面内折叠区，不做专业时间线；
- 所有交互目标最小 44px；
- `:focus-visible` 明确；
- `prefers-reduced-motion` 关闭非必要动画。

- [ ] **步骤 4：运行完整自动验证**

运行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

预期：四条命令均退出码 0，无测试失败。

- [ ] **步骤 5：浏览器视觉验证**

启动：`npm run dev`

检查：

- `http://127.0.0.1:3000/projects/demo/storyboard`
- 视口：390×844、768×1024、1280×800、1440×900；
- 点击 Scene、Cut、重试、保存、重新构建预览；
- 截取 1440×900 最新实现图；
- 同时用 `view_image` 检查设计概念与实现截图；
- 在 `docs/frontend/fidelity-ledger.md` 记录至少五个比较点：布局、颜色、排版、Cut 状态、Inspector、底部状态条、响应式。

- [ ] **步骤 6：Commit**

```bash
git add frontend docs/frontend
git commit -m "feat: finish representative storyboard UI"
```

## 阶段结束

任务 1–5 完成并通过审查后停止。只向用户提供本地访问地址、截图、验证结果和 UI 优化入口；不得开始真实 API 接入或其他页面。
