# 去除模型界面实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 从 Storyboard 和 Shot Editor 的用户界面移除模型选择、模型档位与具体模型路线，同时保持生成、镜头编辑、Take 和导出体验可用。

**架构：** 只收敛用户可见界面：Storyboard 不再提供模型下拉框或展示 Qwen/Wan/Kling/Vidu 路线；Shot Editor 不再提供模型档位卡片。内部默认档位与 Take 快照字段暂时保留，避免重构生成状态合同；无运行时消费者的 `modelRoute` 字段应删除。

**技术栈：** Next.js 15、React 19、TypeScript、Vitest、Playwright。

---

### 任务 13：移除用户可见模型控件

**文件：**
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-controls.tsx`
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.tsx`
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.module.css`
- 修改：`frontend/app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-settings-panel.tsx`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor.module.css`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.tsx`
- 修改：`frontend/app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.test.tsx`
- 修改：`frontend/app/projects/demo/_components/demo-project-provider.tsx`（若 `selectModelTier` 无运行时消费者）
- 修改：`frontend/app/projects/demo/_lib/types.ts`
- 修改：`frontend/app/projects/demo/_lib/fixture.ts`
- 修改：`frontend/app/projects/demo/_lib/fixture.test.ts`
- 修改：`frontend/e2e/accessibility.spec.ts`
- 修改：`frontend/e2e/representative.spec.ts`
- 修改：受影响的 `frontend/e2e/visual.spec.ts-snapshots/*.png`

- [x] **步骤 1：编写失败测试**

  更新测试，要求 Storyboard 与 Shot Editor 的用户可见 DOM 不出现 `生成模型`、`模型档位`、具体模型名（Qwen、Wan、Kling、Vidu）或模型选择下拉框；Storyboard 仍展示分辨率、视频覆盖率、一致性和预计耗时反馈；Shot Editor 仍能编辑 Prompt、运镜、高级设置并生成 Take。

- [x] **步骤 2：运行聚焦测试验证 RED**

  ```bash
  cd frontend && npm test -- --run app/projects/demo/_lib/fixture.test.ts app/projects/demo/storyboard/_components/storyboard-workspace.test.tsx 'app/projects/demo/storyboard/shots/[shotId]/_components/shot-editor-workspace.test.tsx'
  ```

  预期：因现有模型下拉框、模型档位卡片和具体模型路线仍存在而失败；不得因语法或导入错误失败。

- [x] **步骤 3：最小实现**

  - Storyboard 删除模型下拉框、档位标签和具体模型路线；保留 720p、视频覆盖率、一致性与“生成全部”。
  - “生成全部”反馈改为仅包含镜头数和预计耗时，不包含档位或模型词。
  - Shot Editor 删除整个模型档位区块；Prompt、运镜、高级设置、应用和生成新版本保持不变。
  - 删除无运行时消费者的 `modelRoute` 类型和 fixture 数据；清理只服务于被删除 UI 的 CSS、props、imports 和 Provider 回调。
  - 内部 `modelTierId`、`modelTiers` 和 Take 快照合同暂时保留，不进行与界面无关的状态重构。

- [x] **步骤 4：验证 GREEN 与回归**

  ```bash
  cd frontend && npm test -- --run && npm run typecheck && npm run lint && npm run build
  ```

  预期：所有命令退出码 0。

- [x] **步骤 5：更新并复验视觉基线**

  先审查视觉差异确实来自模型 UI 删除，再更新受影响 Golden；随后用无更新参数运行 `PLAYWRIGHT_PORT=3405 npm run test:e2e`，预期全部通过。

- [x] **步骤 6：提交**

  ```bash
  git add frontend docs/superpowers/plans/2026-09-02-remove-model-ui.md .superpowers/sdd/
  git commit -m "fix(前端): 移除模型选择界面"
  ```
