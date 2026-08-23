# 历史会议删除按钮实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 在最近会议列表提供可确认、可恢复错误的删除操作，并清理左栏中的「处理中」入口和条目状态文案。

**架构：** 复用现有 `ApiClient.deleteMeeting()` 和后端软删除端点，在 `MeetingMemoApp` 内维护删除中的会议 ID。删除成功后以本地状态更新列表，并在删除当前会议时加载下一条记录；现有主内容区任务状态保持不变。

**技术栈：** React 19、TypeScript、Lucide React、Vitest、React Testing Library、CSS。

---

## 文件结构

- 修改：`frontend/tests/meetingmemo-app.test.tsx`，覆盖删除交互、错误恢复及左栏文案移除。
- 修改：`frontend/components/meetingmemo-app.tsx`，实现会议删除状态与侧栏入口。
- 修改：`frontend/app/globals.css`，为会议行操作区和危险按钮提供响应式样式。

## 任务 1：以失败测试定义删除行为和左栏精简

**文件：**

- 修改：`frontend/tests/meetingmemo-app.test.tsx`

- [ ] **步骤 1：编写删除当前会议的失败测试**

测试渲染两条会议，模拟 `window.confirm()` 返回 `true`，点击「删除会议 产品体验复盘」，并断言：

```typescript
expect(deleteMeeting).toHaveBeenCalledWith("meeting-1");
expect(screen.queryByRole("button", { name: "打开会议 产品体验复盘" })).not.toBeInTheDocument();
expect(await screen.findByRole("heading", { name: "客户访谈" })).toBeInTheDocument();
```

- [ ] **步骤 2：编写取消与失败恢复测试**

取消确认时断言 API 未调用且会议保留；API 拒绝时断言会议保留并显示「删除会议失败」错误。

- [ ] **步骤 3：编写左栏文案移除测试**

创建带有 `queued` Job 的会议后断言左侧不存在精确文本「处理中」，同时主内容区继续显示「正在排队」。

- [ ] **步骤 4：运行聚焦测试并确认正确失败**

运行：`cd frontend && npm test -- --run tests/meetingmemo-app.test.tsx`

预期：删除按钮不存在，且左栏仍渲染「处理中」，测试失败。

## 任务 2：实现删除入口与状态切换

**文件：**

- 修改：`frontend/components/meetingmemo-app.tsx`
- 修改：`frontend/app/globals.css`

- [ ] **步骤 1：实现最少删除状态与处理函数**

新增 `deletingId` 状态。`deleteHistoricalMeeting()` 先调用 `window.confirm()`；确认后调用 `stableClient.deleteMeeting()`，清理 Job，更新会议数组。删除当前会议时使既有请求失效并加载剩余首条，若无会议则清空详情与摘要。

- [ ] **步骤 2：重构会议列表 DOM**

每条记录使用 `.meeting-row-shell` 包裹现有打开按钮和独立删除按钮，避免按钮嵌套。删除按钮使用 `Trash2` 图标、动态 `aria-label` 和 `title`，请求期间禁用。

- [ ] **步骤 3：移除左栏处理中文案**

删除 `FolderClock`、`activeCount`、侧栏「处理中」导航项、会议条目中的 `.meeting-processing` 分支及对应 CSS。主内容区 `jobLabel()` 不变。

- [ ] **步骤 4：运行聚焦测试并确认通过**

运行：`cd frontend && npm test -- --run tests/meetingmemo-app.test.tsx`

预期：全部通过。

- [ ] **步骤 5：运行完整前端验证**

运行：`cd frontend && npm run lint && npm run typecheck && npm test -- --run && npm run build`

预期：命令退出码为 0，无测试失败、类型错误或构建错误。

- [ ] **步骤 6：浏览器核验并提交**

在本地真实后端创建临时会议，从左栏删除并刷新页面，确认记录不会恢复；同时确认左栏无「处理中」框。提交：

```bash
git add frontend/components/meetingmemo-app.tsx frontend/app/globals.css frontend/tests/meetingmemo-app.test.tsx
git commit -m "feat(前端): 添加历史会议删除入口"
```

## 计划自检

- 规格覆盖：删除入口、确认、成功切换、失败保留、处理中清理和主内容进度保留均有对应步骤。
- 占位符扫描：无待定实现或未定义接口。
- 类型一致性：复用现有 `deleteMeeting(meetingId: string): Promise<void>`，不改变后端契约。
