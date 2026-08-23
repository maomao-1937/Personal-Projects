# 前端文案精简实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除邀请码页和工作台中指定的辅助文案与额度展示，并让首屏主标题在桌面和移动端保持较小字号的单行布局。

**架构：** 只修改现有 `AccessGate`、`Workbench` 和全局样式，不改变 API、访问状态或额度判断。组件测试锁定删除后的可见文案；浏览器验收负责确认 390 px 与 1440 px 下的标题几何布局。

**技术栈：** Next.js 16、React 19、TypeScript、Vitest、Testing Library、Playwright、CSS。

---

## 文件范围

- 修改：`frontend/src/components/access-gate.test.tsx`，验证邀请码页只保留必要操作文案。
- 修改：`frontend/src/components/access-gate.tsx`，删除说明文案、隐私说明和无用属性。
- 修改：`frontend/src/components/workbench.test.tsx`，验证额度与「不保存原文」不再显示。
- 修改：`frontend/src/components/workbench.tsx`，删除额度和隐私标签 DOM。
- 修改：`frontend/src/app/globals.css`，缩小标题、固定单行并清理失效样式。
- 修改：`frontend/e2e/flow.spec.ts`，更新不再显示额度的端到端断言。

### 任务 1：用组件测试锁定精简后的文案

**文件：**
- 修改：`frontend/src/components/access-gate.test.tsx`
- 修改：`frontend/src/components/workbench.test.tsx`

- [ ] **步骤 1：编写邀请码页失败测试**

在 `access-gate.test.tsx` 中把额度文案测试替换为：

```tsx
it("shows only the essential invitation copy", () => {
  render(
    <AccessGate busy={false} error={null} onRedeem={vi.fn().mockResolvedValue(undefined)} />,
  );

  expect(screen.getByRole("heading", { name: "把判断，钉回原话。" })).toBeInTheDocument();
  expect(screen.queryByText(/六个维度不是一串孤立分数/)).not.toBeInTheDocument();
  expect(screen.queryByText(/每个邀请码可完成/)).not.toBeInTheDocument();
  expect(screen.queryByText(/原始聊天和完整报告不会保存/)).not.toBeInTheDocument();
});
```

同时从其他 `AccessGate` 渲染调用中删除 `inviteUsageLimit` 属性，使测试描述目标组件接口。

- [ ] **步骤 2：编写工作台失败测试**

在 `workbench.test.tsx` 中增加：

```tsx
it("hides quota and transcript retention labels", () => {
  render(
    <Workbench
      access={access}
      analyzing={false}
      config={publicConfig}
      error={null}
      onAnalyze={vi.fn().mockResolvedValue(undefined)}
      onLeave={vi.fn().mockResolvedValue(undefined)}
      report={null}
    />,
  );

  expect(screen.queryByText("剩余额度")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("剩余 50 次")).not.toBeInTheDocument();
  expect(screen.queryByText("不保存原文")).not.toBeInTheDocument();
});
```

- [ ] **步骤 3：运行定向测试并确认红灯**

运行：

```bash
cd frontend
npm test -- src/components/access-gate.test.tsx src/components/workbench.test.tsx
```

预期：测试因旧说明文案、额度 DOM 和「不保存原文」仍存在而失败；不得出现模块导入或测试环境错误。

### 任务 2：删除组件中的非必要内容

**文件：**
- 修改：`frontend/src/components/access-gate.tsx`
- 修改：`frontend/src/components/workbench.tsx`
- 修改：`frontend/src/components/inspector-app.tsx`

- [ ] **步骤 1：精简 `AccessGate`**

- 从 `lucide-react` 导入中删除 `ShieldCheck`。
- 从 `AccessGateProps` 和函数参数中删除 `inviteUsageLimit`。
- 将标题 JSX 改为连续内容：

```tsx
<h1 id="access-title">
  把判断，<span>钉回原话。</span>
</h1>
```

- 删除 `.access-lede`、`.card-description` 和 `.privacy-note` 对应的 JSX。
- 在 `inspector-app.tsx` 中删除传给 `AccessGate` 的 `inviteUsageLimit`。

- [ ] **步骤 2：精简 `Workbench`**

- 从 `lucide-react` 导入中删除 `ShieldCheck`。
- 删除 `.quota-readout` 容器；保留 `access.remaining_uses` 在 `canAnalyze` 和按钮状态中的使用。
- 删除 `.private-chip` 容器。
- 保留 `.header-actions` 和退出访问按钮，使页头结构不变。

- [ ] **步骤 3：运行定向测试并确认绿灯**

运行：

```bash
cd frontend
npm test -- src/components/access-gate.test.tsx src/components/workbench.test.tsx
```

预期：全部通过。

### 任务 3：收紧标题布局并更新端到端断言

**文件：**
- 修改：`frontend/src/app/globals.css`
- 修改：`frontend/e2e/flow.spec.ts`

- [ ] **步骤 1：调整标题和清理样式**

将桌面标题规则调整为：

```css
.access-thesis h1 {
  font-family: var(--display);
  font-size: clamp(34px, 5.2vw, 72px);
  font-weight: 560;
  letter-spacing: -0.055em;
  line-height: 1;
  margin: 24px 0 38px;
  max-width: none;
  white-space: nowrap;
}
```

删除移动端对 `.access-thesis h1` 的大字号覆盖，并删除 `.access-lede`、`.card-description`、`.privacy-note`、`.quota-readout`、`.private-chip` 的失效规则。

- [ ] **步骤 2：更新 E2E 额度断言**

将原有额度可见断言替换为：

```ts
await expect(page.getByLabel("剩余 49 次")).toHaveCount(0);
await expect(page.getByText("不保存原文", { exact: true })).toHaveCount(0);
```

分析返回中的 `remaining_uses` 仍保留，以验证数据契约未改变。

- [ ] **步骤 3：运行完整自动化门禁**

运行：

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

预期：四条命令全部退出码为 0。

- [ ] **步骤 4：浏览器验证响应式标题**

在已运行的 `http://127.0.0.1:3010` 上分别使用 390 × 844 和 1440 × 1000 视口：

- 获取标题元素的边界框和计算字号。
- 确认标题高度不超过计算字号的 1.1 倍。
- 确认 `document.documentElement.scrollWidth` 不大于视口宽度。
- 确认 5 段删除文案和额度展示均不存在。
- 截图检查邀请码卡片和证据轨道在文案删除后没有异常空洞。

- [ ] **步骤 5：提交实现**

```bash
git add frontend/src/components/access-gate.test.tsx \
  frontend/src/components/access-gate.tsx \
  frontend/src/components/workbench.test.tsx \
  frontend/src/components/workbench.tsx \
  frontend/src/components/inspector-app.tsx \
  frontend/src/app/globals.css \
  frontend/e2e/flow.spec.ts
git commit -m "refactor(前端): 精简访问页和工作台文案"
```

