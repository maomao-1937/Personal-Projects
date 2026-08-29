# AI 审讯室实现计划

> **面向 AI 代理的工作者：** 在当前会话内按测试驱动开发逐项执行；开发阶段不派生子代理，完成阶段按审查规范使用只读代码审查代理。步骤使用复选框跟踪。

**目标：** 交付一个由 FastAPI 确定性规则后端驱动、Next.js 响应式前端承载、可以完整玩完 CASE-001 的 AI 审讯室 Demo。

**架构：** 后端独占案件真相、规则、Session 和评分，通过 `/api/v1` 提供稳定契约；前端只管理视图临时状态并同源调用 API。SQLite 保证本地恢复，部署时可切换 `/tmp` 或 PostgreSQL。

**技术栈：** Python 3.11、FastAPI、Pydantic、SQLAlchemy、Alembic、pytest；Next.js、React、TypeScript、Tailwind CSS、Lucide、Vitest、Testing Library、Python Playwright。

---

## 文件结构

- `backend/app/domain/`：案件类型、CASE-001、规则与评分纯函数。
- `backend/app/repositories/`：SQLAlchemy Session 持久化。
- `backend/app/services/`：编排创建、回合、恢复和报告。
- `backend/app/api/`：`/api/v1` 路由和安全错误映射。
- `backend/tests/`：规则、评分和 API 测试。
- `frontend/app/`：五个页面和全局样式。
- `frontend/features/game/`：API、状态恢复和业务组件。
- `frontend/components/ui/`：少量基础组件。
- `frontend/tests/`：纯函数与组件测试。
- `tests/web_smoke.py`：真实闭环、边界流程与响应式检查。

### 任务 1：搭建后端测试运行环境

- [x] 创建 `backend/requirements.txt`、pytest 配置和空包结构。
- [x] 创建 `backend/tests/test_rules.py`，导入尚不存在的 `evaluate_turn`，写下有效命中、无关证据、重复问题和无证据施压断言。
- [x] 运行 `pytest backend/tests/test_rules.py -q`，预期因模块缺失而失败。
- [x] 记录红灯原因，只实现测试要求的领域接口。

### 任务 2：实现 CASE-001 与回合规则

- [x] 创建 `backend/app/domain/types.py`，定义策略、证据状态、防线带、消息、Session 和回合结果类型。
- [x] 创建 `backend/app/domain/case_001.py`，写入 5 条证据、3 个谎言节点、固定真相、选项和回答模板。
- [x] 创建 `backend/app/domain/rules.py`，实现问题归一化、主题识别、重复检测、命中、解锁、心理状态和结案门槛。
- [x] 运行规则测试，预期全部通过；再补空输入、200 字、共情和第 8 回合边界测试并经历一次红灯到绿灯。

### 任务 3：实现确定性评分

- [x] 创建 `backend/tests/test_scoring.py`，先写满分、部分分、错误报告仍返回完整真相、相同输入一致四个失败测试。
- [x] 创建 `backend/app/domain/scoring.py`，按 35/20/20/20/5 计算，并返回 S/A/B/C/D。
- [x] 运行 `pytest backend/tests/test_scoring.py -q`，预期通过。

### 任务 4：实现持久化与应用服务

- [x] 创建 `backend/tests/test_session_service.py`，先写创建后恢复、回合事务更新、报告门槛、报告幂等测试。
- [x] 创建配置、数据库模型、Repository 和 Service；Session 状态序列化为版本化 JSON，并使用 revision 乐观锁防止并发覆盖。
- [x] 运行服务测试并修到通过。
- [x] 创建 Alembic 初始迁移和 revision 迁移，确认 `upgrade head` 可重复执行。

### 任务 5：实现 FastAPI 契约

- [x] 创建 `backend/tests/test_api.py`，先写 health、case、create/get session、turn、report、404 与 422 失败测试。
- [x] 创建 Pydantic schemas、v1 路由、统一业务错误处理和 `main.py`。
- [x] 运行 `pytest -q`，预期全部通过。
- [x] 启动 8011 端口，用 HTTP 请求完成一条 API 闭环并停止临时服务。

### 任务 6：搭建前端测试与应用骨架

- [x] 创建 `frontend/package.json`、Next/Tailwind/TypeScript/ESLint/Vitest 配置和 Python Playwright 验收脚本。
- [x] 安装依赖并生成锁文件。
- [x] 创建 API 适配层测试，验证统一错误、Session ID 恢复与分享文案不剧透，先看到失败。
- [x] 实现最少的 API 客户端和工具函数使测试通过。

### 任务 7：实现视觉系统与共享组件

- [x] 在 `globals.css` 落实 `DESIGN_SPEC.md` 的颜色、字体、间距、边框、圆角、焦点和减少动态规则。
- [x] 先写 Button、StatusLabel、EvidenceCard、Dialog、MobileDrawer 的组件测试。
- [x] 实现组件并验证键盘、禁用、标签和状态文本。

### 任务 8：实现落地页和案件简报

- [x] 通过真实浏览器集成测试验证落地 CTA 创建 Session 并导航、简报展示 2 条公开证据与任务。
- [x] 实现 `/` 的左右分栏和真实审讯预览。
- [x] 实现 `/case/001/briefing` 的灰米白档案卡与暗红档案章。
- [x] 在 1440 和 390 宽度检查基本布局。

### 任务 9：实现审讯工作台

- [x] 通过规则、组件与真实浏览器测试验证策略、证据、1–200 字、提交锁定、错误保留和第 3 回合前结案状态。
- [x] 实现桌面双栏、对话记录、输入区、证据选择、自动笔记与状态反馈。
- [x] 实现移动端底部抽屉和 sticky 输入区。
- [x] 实现第 8 回合响应后自动导航报告，并覆盖刷新恢复路径。

### 任务 10：实现报告和结果

- [x] 通过组件与真实浏览器测试验证三步、最多 3 条证据、缺项、确认弹窗和返回审讯。
- [x] 实现 `/case/001/report` 并调用报告 API。
- [x] 通过评分与真实浏览器测试验证五项分数、玩家/真实结论、完整时间线、命中/遗漏和无剧透文案。
- [x] 实现 `/case/001/result`、重新审讯和下一案预约反馈。

### 任务 11：真实浏览器闭环与响应式

- [x] 启动后端 8011 与前端 3011。
- [x] 用 Python Playwright 和 Ego Lite 完成有效命中主流程。
- [x] 验证无关证据、重复问题、第 3 回合前锁定、第 8 回合强制结案和失败完整真相。
- [x] 截图检查 1440×900、1366×768、390×844、360×800；检查 Console、Network、抽屉、对话框和横向滚动。

### 任务 12：最终质量门槛

- [x] 运行后端 `pytest`。
- [x] 运行前端 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e`。
- [x] 若出现故障，先写可重现失败测试，再修复并重跑全套。
- [x] 更新 `README.md`，列出启动、配置、验证、部署兼容和未实现能力。
- [x] 检查 `.gitignore`、`.env.example`、`.vefaasignore`，确认无密钥和本地数据进入包。
