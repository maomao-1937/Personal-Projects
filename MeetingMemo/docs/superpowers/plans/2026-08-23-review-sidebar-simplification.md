# 审核侧栏精简实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 移除审核侧栏中的版本元信息和邮件、Slack 分发界面，同时保留摘要确认主动作。

**架构：** 从 `MeetingWorkspace` 删除对应渲染和属性，从 `MeetingMemoApp` 清理不再需要的集成加载与分发状态。后端和通用 API 客户端保持不变。

**技术栈：** React 19、TypeScript、Vitest、React Testing Library、CSS。

---

## 任务 1：以失败测试定义精简后的审核区

**文件：**

- 修改：`frontend/tests/meeting-workspace.test.tsx`
- 修改：`frontend/tests/meetingmemo-app.test.tsx`

- [ ] **步骤 1：修改工作台测试断言**

渲染草稿和已审批摘要，断言「当前版本」「发送邮件」「Slack」「确认摘要后可发送」「邮件与 Slack 均未配置」均不存在，并断言「确认摘要」或「已审批此版本」仍存在。

- [ ] **步骤 2：修改应用测试断言**

删除分发结果测试；审批成功后断言提示为「摘要已确认，现在可以导出。」且 `approveSummary()` 被调用。

- [ ] **步骤 3：运行聚焦测试并确认失败**

运行：`cd frontend && npm test -- --run tests/meeting-workspace.test.tsx tests/meetingmemo-app.test.tsx`

预期：测试因旧版本元信息、分发按钮和分发提示仍存在而失败。

## 任务 2：移除分发展示和无用前端状态

**文件：**

- 修改：`frontend/components/meeting-workspace.tsx`
- 修改：`frontend/components/meetingmemo-app.tsx`
- 修改：`frontend/app/globals.css`

- [ ] **步骤 1：精简 `MeetingWorkspace`**

删除 `integrations`、`onDeliver`、`deliveryPending` 属性及 `Mail`、`Send` 图标导入；删除 `.review-version`、`.delivery-grid` 和 `.integration-note` 对应 JSX，只保留确认按钮。

- [ ] **步骤 2：清理 `MeetingMemoApp`**

从工作台客户端类型中移除 `getIntegrations` 和 `deliverSummary`，删除集成状态、分发等待状态、启动时集成请求和 `deliver()`，并把审批成功提示改为「摘要已确认，现在可以导出。」

- [ ] **步骤 3：清理 CSS**

删除 `.review-version`、`.delivery-grid` 和 `.integration-note` 规则，保留 `.review-actions` 和全宽主按钮布局。

- [ ] **步骤 4：运行聚焦测试并确认通过**

运行：`cd frontend && npm test -- --run tests/meeting-workspace.test.tsx tests/meetingmemo-app.test.tsx`

预期：全部通过。

- [ ] **步骤 5：运行完整验证并提交**

运行：`cd frontend && npm run lint && npm run typecheck && npm test -- --run && npm run build`

预期：命令退出码为 0。提交：

```bash
git add frontend/components/meeting-workspace.tsx frontend/components/meetingmemo-app.tsx frontend/app/globals.css frontend/tests/meeting-workspace.test.tsx frontend/tests/meetingmemo-app.test.tsx
git commit -m "refactor(前端): 精简摘要审核侧栏"
```

## 计划自检

- 规格覆盖：3 组删除项、审批主按钮保留和提示同步均有对应步骤。
- 占位符扫描：无未定义接口或待定行为。
- 类型一致性：审批仍使用现有 `approveSummary(summaryId)`，后端契约不变。
