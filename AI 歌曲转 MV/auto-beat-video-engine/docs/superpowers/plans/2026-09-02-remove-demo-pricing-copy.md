# 去除演示与价格文案实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 从 Storyboard、镜头编辑器和 Preview 的用户可见界面中移除价格、Fixture、Local fixture 和“演示”措辞，同时保留已有布局、模型选择和可体验交互。

**架构：** 删除 `ModelTier.costRange`，让模型档位只描述速度、分辨率、视频覆盖率、一致性和实际模型路线。把本地演示提示改为中性的产品状态/操作文案，不改 `/projects/demo` 路由、fixture 文件名或测试辅助函数等内部实现名称。

**技术栈：** Next.js 15、React 19、TypeScript、Vitest、Playwright。

---

### 任务 1：清理用户可见的演示与价格信息

**文件：**
- 修改：`frontend/app/projects/demo/_lib/types.ts`
- 修改：`frontend/app/projects/demo/_lib/fixture.ts`
- 修改：`frontend/app/projects/demo/_lib/fixture.test.ts`
- 修改：`frontend/app/projects/demo/_components/demo-shell.tsx`
- 修改：`frontend/app/projects/demo/_components/demo-shell.test.tsx`
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-controls.tsx`
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.tsx`
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-settings-panel.tsx`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.tsx`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/take-viewer.tsx`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.test.tsx`
- 修改：`frontend/app/projects/demo/preview/_components/export-sheet.tsx`
- 修改：`frontend/app/projects/demo/preview/_components/preview-workspace.test.tsx`
- 修改：`frontend/e2e/accessibility.spec.ts`

- [x] **步骤 1：先写失败测试**

  更新现有单元测试，使其要求：顶栏不出现 `Fixture`；Storyboard 和 Shot Editor 不出现 `¥`、`价格`、`成本`、`预计预算`；可见操作反馈不出现 `Fixture`、`Local fixture` 或 `演示`；导出按钮使用 `保存导出设置`。同时保留三档模型切换、生成全部、生成新版本、参考图禁用说明和导出配置持久化的行为断言。

- [x] **步骤 2：运行测试验证 RED**

  运行：

  ```bash
  cd frontend && npm test -- --run app/projects/demo/_components/demo-shell.test.tsx app/projects/demo/_lib/fixture.test.ts app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx 'app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.test.tsx' app/projects/demo/preview/_components/preview-workspace.test.tsx
  ```

  预期：测试因为现有价格和演示文案仍然可见而失败，不是因为导入或语法错误失败。

- [x] **步骤 3：最小实现**

  - 从 `ModelTier` 与三档模型数据中移除 `costRange`。
  - 从桌面和移动端生成摘要中移除价格及 Coins 图标，保留分辨率、覆盖率、一致性和模型路线。
  - 顶栏只保留连接状态和账户标记，不显示 Fixture 标签。
  - “生成全部”反馈只展示档位、镜头数和预计耗时；“生成新版本”反馈改为 `新版本已创建`。
  - 把上传说明改为 `当前版本暂不支持上传参考图`；镜头编辑器状态改为 `草稿模式` 与中性说明；空版本/缺失视频说明不再出现“演示”。
  - 导出说明改为产品化描述，提交按钮改为 `保存导出设置`。
  - 不修改路由、内部 fixture 文件名、测试辅助函数名或媒体资源路径。

- [x] **步骤 4：验证 GREEN 与回归**

  运行聚焦测试，然后运行：

  ```bash
  cd frontend && npm test -- --run && npm run typecheck && npm run lint && npm run build
  ```

  预期：所有命令退出码为 0，单元测试 0 failures。

- [x] **步骤 5：浏览器体验验证**

  启动本地开发服务器，检查 Storyboard、Shot Editor、Preview；确认页面无 `¥`、`成本`、`预计预算`、`Fixture`、`Local fixture`、`演示` 可见文案，并验证三处主流程仍可操作。

- [x] **步骤 6：提交**

  ```bash
  git add frontend docs/superpowers/plans/2026-09-02-remove-demo-pricing-copy.md
  git commit -m "fix(前端): 移除演示与价格信息"
  ```
