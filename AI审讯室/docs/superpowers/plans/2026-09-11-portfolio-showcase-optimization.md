# AI 审讯室作品集展示优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把已有的 AI 审讯游戏升级为可在作品集中快速理解、完整体验并体现产品与工程能力的电影化证据链工作台。

**架构：** 保持 Next.js/FastAPI 数据契约不变，在前端新增独立的 `EvidenceChain` 展示组件，并由审讯页组合真实 `GameSession` 数据。视觉层复用现有嫌疑人资产和设计 token，通过附加的作品集样式层改造桌面三栏与移动单任务布局；补丁升级 Next.js 以消除已确认的生产依赖风险。

**技术栈：** Next.js 16、React 19、TypeScript、Vitest、Testing Library、FastAPI、pytest、CSS、Lucide React。

---

## 文件结构

- 创建 `frontend/features/game/components/evidence-chain.tsx`：把会话中的证词、有效证据和矛盾组合为可访问的三段证据链。
- 创建 `frontend/tests/evidence-chain.test.tsx`：覆盖空状态和命中状态。
- 修改 `frontend/app/case/001/interrogate/page.tsx`：组合人物资产、对话与证据链。
- 修改 `frontend/app/case/001/report/page.tsx`：强化“组建证据链”的结案语义。
- 修改 `frontend/app/case/001/result/page.tsx`：强化命中/遗漏链路复盘语义。
- 修改 `frontend/features/game/components/cinematic-case-launch.tsx`：恢复首屏视觉版本标识。
- 修改 `frontend/app/globals.css`：新增工作台、矛盾链、报告和响应式视觉规则。
- 修改 `frontend/app/layout.tsx`：声明平滑滚动行为，消除 Next.js 兼容性警告。
- 修改 `frontend/package.json` 与 `frontend/package-lock.json`：升级 Next.js 安全补丁版本。

### 任务 1：恢复首页作品集视觉基线

**文件：**
- 修改：`frontend/features/game/components/cinematic-case-launch.tsx`
- 测试：`frontend/tests/cinematic-case-launch.test.tsx`

- [ ] **步骤 1：运行现有失败测试**

运行：`cd frontend && npm test -- cinematic-case-launch.test.tsx`

预期：FAIL，提示缺少 `data-scene-version="v3"`。

- [ ] **步骤 2：添加最小实现**

在主场景 `section` 上加入：

```tsx
data-scene-version="v3"
```

- [ ] **步骤 3：验证测试通过**

运行：`cd frontend && npm test -- cinematic-case-launch.test.tsx`

预期：5 个测试全部 PASS。

- [ ] **步骤 4：Commit**

```bash
git add frontend/features/game/components/cinematic-case-launch.tsx
git commit -m "fix: 恢复首页场景版本标识"
```

### 任务 2：新增实时矛盾链

**文件：**
- 创建：`frontend/features/game/components/evidence-chain.tsx`
- 创建：`frontend/tests/evidence-chain.test.tsx`
- 修改：`frontend/app/case/001/interrogate/page.tsx`

- [ ] **步骤 1：编写失败测试**

测试构造最小 `GameSession`，断言空状态显示“等待记录”、有效证据显示证据编号、矛盾 claim 显示“已击中”。

```tsx
render(<EvidenceChain session={session} />);
expect(screen.getByRole("region", { name: "实时矛盾链" })).toBeVisible();
expect(screen.getByText("E02")).toBeVisible();
expect(screen.getByText("已击中")).toBeVisible();
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend && npm test -- evidence-chain.test.tsx`

预期：FAIL，模块 `evidence-chain` 不存在。

- [ ] **步骤 3：实现最小组件**

组件从 `session.claims`、`session.effectiveEvidenceIds` 和 `session.evidence` 派生三类节点，不维护第二份游戏状态；节点使用 Lucide 图标与文本状态。

- [ ] **步骤 4：接入审讯页**

在 `interrogation-main` 中并列 `conversation-log` 与 `<EvidenceChain session={session} />`，保留表单、抽屉和 API 调用行为。

- [ ] **步骤 5：验证组件测试通过**

运行：`cd frontend && npm test -- evidence-chain.test.tsx`

预期：全部 PASS。

- [ ] **步骤 6：Commit**

```bash
git add frontend/features/game/components/evidence-chain.tsx frontend/tests/evidence-chain.test.tsx frontend/app/case/001/interrogate/page.tsx
git commit -m "feat: 添加实时矛盾链工作台"
```

### 任务 3：统一电影化内页与响应式体验

**文件：**
- 修改：`frontend/app/case/001/interrogate/page.tsx`
- 修改：`frontend/app/case/001/report/page.tsx`
- 修改：`frontend/app/case/001/result/page.tsx`
- 修改：`frontend/app/globals.css`

- [ ] **步骤 1：为作品集关键语义补测试**

在矛盾链测试中断言进度文案和三段轨道都存在，确保视觉改造仍由真实数据驱动。

- [ ] **步骤 2：运行测试验证新增断言失败**

运行：`cd frontend && npm test -- evidence-chain.test.tsx`

预期：FAIL，缺少三段轨道或进度文案。

- [ ] **步骤 3：实现人物舞台和三栏工作台**

使用现有 `ai-suspect.png` 作为嫌疑人图像；CSS 在宽屏采用资料/对话/矛盾链结构，在 1100px 以下隐藏右轨，在 767px 以下切换为移动抽屉与横向链摘要。

- [ ] **步骤 4：强化报告和结果页**

将步骤 2 的可见文案调整为“组建关键证据链”，结果页的矛盾列表使用统一链路视觉类；不改变提交 payload 和评分字段。

- [ ] **步骤 5：验证前端全量检查**

运行：`cd frontend && npm run lint && npm run typecheck && npm test`

预期：0 个 lint 错误、0 个类型错误、全部测试 PASS。

- [ ] **步骤 6：Commit**

```bash
git add frontend/app/case/001/interrogate/page.tsx frontend/app/case/001/report/page.tsx frontend/app/case/001/result/page.tsx frontend/app/globals.css frontend/tests/evidence-chain.test.tsx
git commit -m "feat: 统一作品集内页视觉与交互"
```

### 任务 4：修复框架兼容性与生产依赖风险

**文件：**
- 修改：`frontend/app/layout.tsx`
- 修改：`frontend/package.json`
- 修改：`frontend/package-lock.json`

- [ ] **步骤 1：记录当前审计结果**

运行：`cd frontend && npm audit --omit=dev`

预期：Next.js 16.3.2 报告 critical，sharp 报告 high。

- [ ] **步骤 2：升级补丁版本并声明滚动行为**

运行：`cd frontend && npm install next@16.3.4 eslint-config-next@16.3.4`

在 `<html>` 上加入：

```tsx
data-scroll-behavior="smooth"
```

- [ ] **步骤 3：验证构建与生产审计**

运行：`cd frontend && npm run build && npm audit --omit=dev`

预期：构建退出码 0；已知 Next.js critical 不再出现。若 sharp 仍由 Next.js 间接依赖带入，准确记录而不强制破坏性升级。

- [ ] **步骤 4：Commit**

```bash
git add frontend/app/layout.tsx frontend/package.json frontend/package-lock.json
git commit -m "chore: 升级 Next.js 安全补丁"
```

### 任务 5：全链路验证与视觉终验

**文件：**
- 验证：`frontend/`、`backend/`
- 创建：`docs/audit/2026-09-11/portfolio-*.png`

- [ ] **步骤 1：运行后端测试**

运行：`cd backend && .venv/bin/pytest`

预期：93 个测试 PASS。

- [ ] **步骤 2：运行前端最终检查**

运行：`cd frontend && npm run lint && npm run typecheck && npm test && npm run build`

预期：全部退出码 0。

- [ ] **步骤 3：内置浏览器走通真实流程**

在 1440×900 与 390×844 验证首页、简报、审讯、报告和结果；检查真实证据选择、提问、矛盾命中与结案提交。

- [ ] **步骤 4：视觉比对**

以 `docs/audit/2026-09-11/` 中的优化前截图为基线，与相同视口的优化后截图一起使用 `view_image` 检查：层级、人物资产、证据链、字体、配色、容器、响应式和裁切。

- [ ] **步骤 5：记录偏差并提交验证证据**

只保留最终截图和简短验证账本；删除临时数据库与测试状态。若没有可修复的视觉问题，再提交对应文档。
