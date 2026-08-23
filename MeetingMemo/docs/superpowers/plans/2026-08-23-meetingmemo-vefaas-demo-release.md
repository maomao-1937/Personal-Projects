# MeetingMemo veFaaS 演示环境发布实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 发布可通过邀请码访问、能真实生成摘要的 MeetingMemo 火山引擎演示环境，随后同步到个人 GitHub 仓库并合并实现分支。

**架构：** 使用两个 veFaaS Application 承载 FastAPI 和 Next.js；前端通过 rewrite 同源代理后端。后端固定单实例，以 `/tmp` SQLite 提供演示存储，并通过环境变量幂等初始化邀请码。

**技术栈：** veFaaS CLI 0.3.1、FastAPI、SQLAlchemy、Alembic、Next.js 16、Vitest、pytest、GitHub CLI。

---

### 任务 1：演示环境启动能力

**文件：**
- 创建：`backend/app/access/bootstrap.py`
- 创建：`backend/scripts/start_demo.py`
- 创建：`backend/tests/test_access_bootstrap.py`
- 创建：`backend/.python-version`
- 创建：`backend/.vefaasignore`

- [ ] **步骤 1：编写失败的启动邀请测试**

测试调用 `ensure_bootstrap_invite(settings, session_factory, code)` 两次，断言数据库只有一条邀请码，并断言缺少邀请码时抛出 `ValueError`。

- [ ] **步骤 2：验证测试正确失败**

运行：`cd backend && APP_ENV=test LLM_PROVIDER=mock LLM_API_KEY= uv run pytest tests/test_access_bootstrap.py -q`

预期：FAIL，原因是 `app.access.bootstrap` 尚不存在。

- [ ] **步骤 3：实现最小启动逻辑**

`ensure_bootstrap_invite` 使用 `hash_invite_code` 查询现有记录，不存在时调用 `AccessService.create_invite(code=...)`；`scripts/start_demo.py` 依次执行 Alembic、初始化邀请码，再 `os.execvp` 启动 Uvicorn，且不记录邀请码。

- [ ] **步骤 4：验证后端测试与静态检查**

运行：

```bash
cd backend
APP_ENV=test LLM_PROVIDER=mock LLM_API_KEY= uv run pytest -q
uv run ruff check .
uv run ruff format --check .
```

预期：全部通过。

- [ ] **步骤 5：提交**

```bash
git add backend/app/access/bootstrap.py backend/scripts/start_demo.py backend/tests/test_access_bootstrap.py backend/.python-version backend/.vefaasignore
git commit -m "feat(部署): 添加 veFaaS 演示启动流程"
```

### 任务 2：Next.js standalone 发布配置

**文件：**
- 修改：`frontend/next.config.ts`
- 创建：`frontend/.vefaasignore`
- 测试：`frontend/tests/page.test.tsx`

- [ ] **步骤 1：添加 standalone 构建断言**

运行现有前端测试、类型检查和生产构建，随后断言 `.next/standalone/server.js` 存在。

- [ ] **步骤 2：启用 standalone 输出**

在 `nextConfig` 中加入 `output: "standalone"`；`.vefaasignore` 排除 `.env*`、`node_modules`、`.next`、测试与本地报告。

- [ ] **步骤 3：验证前端**

运行：

```bash
cd frontend
npm test -- --run
npm run lint
npm run typecheck
npm run build
test -f .next/standalone/server.js
```

预期：全部通过。

- [ ] **步骤 4：提交**

```bash
git add frontend/next.config.ts frontend/.vefaasignore
git commit -m "build(前端): 配置 veFaaS standalone 构建"
```

### 任务 3：创建并发布后端应用

**文件：**
- 本地忽略配置：`backend/.vefaas/config.json`

- [ ] **步骤 1：创建应用并绑定网关**

在 `backend/` 执行 `vefaas link --newApp meetingmemo-api --gatewayName shipcheck-gw --command "uv run python -m scripts.start_demo" --port 8000 --memory 512 --cpu 250 --yes`。

- [ ] **步骤 2：配置环境变量**

设置 `APP_ENV=development`、`DATABASE_URL=sqlite:////tmp/meetingmemo.db`、`UPLOAD_DIR=/tmp/uploads`、`ALLOW_ORIGINLESS_STATE_CHANGES=false`、百炼模型配置、随机 `SECRET_KEY` 和部署邀请码。Secret 值不进入输出或 Git。

- [ ] **步骤 3：限制实例并发布**

将后端 `minInstance=0`、`maxInstance=1`，执行 `vefaas deploy --yes`，随后用 `vefaas domains` 获取 HTTPS 地址。

- [ ] **步骤 4：验证后端**

轮询 `/health/ready`，预期 HTTP 200 且 JSON `status=ready`。

### 任务 4：创建并发布前端应用

**文件：**
- 本地忽略配置：`frontend/.vefaas/config.json`

- [ ] **步骤 1：创建前端应用**

在 `frontend/` 创建 `meetingmemo-web`，网关使用 `shipcheck-gw`，构建命令 `npm run build`，输出目录 `.next/standalone`，启动命令 `node server.js`，端口 3000，资源 512 MiB/250m CPU。

- [ ] **步骤 2：配置后端地址并发布**

把 `BACKEND_URL` 设置为后端 HTTPS 地址，限制 `minInstance=0`、`maxInstance=1` 后发布并取得前端地址。

- [ ] **步骤 3：回填后端来源**

把后端 `FRONTEND_ORIGIN` 设置为前端正式地址，重新发布后端并确认健康。

- [ ] **步骤 4：真实浏览器验收**

使用 Playwright 打开前端地址、兑换邀请码、新建短会议并等待“确认摘要”；断言已删除的审核与发送控件不存在。

### 任务 5：同步 GitHub 并合并分支

**文件：**
- 目标目录：`Personal-Projects/MeetingMemo/`

- [ ] **步骤 1：克隆并检查目标仓库**

克隆 `maomao-1937/Personal-Projects`，确认 `MeetingMemo/` 不存在且默认分支为 `main`。

- [ ] **步骤 2：同步安全文件集**

使用 `rsync` 同步已跟踪文件，排除 `.git`、`.env`、`.vefaas`、虚拟环境、`node_modules`、`.next` 和运行数据库；运行密钥扫描与 `git diff --check`。

- [ ] **步骤 3：提交并推送 GitHub**

在目标仓库创建提交 `feat: add MeetingMemo` 并推送 `main`，随后用 GitHub API 验证 `MeetingMemo/README.md` 可读取。

- [ ] **步骤 4：合并本地实现分支**

在主仓库 `main` 合并 `impl/meetingmemo-closed-beta`，在合并结果上重新运行后端 111 项测试、前端 37 项测试及构建；成功后清理 worktree 和功能分支。

- [ ] **步骤 5：交付**

只输出产品名、邀请码和已通过真实浏览器验收的前端 HTTPS 地址。

