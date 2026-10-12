# AI 审讯室

一款可完整游玩的中文 AI 审讯推理游戏：审问三名嫌疑人、交叉核对证据，并在有限提问内主动提交结案判断。DeepSeek 负责案件生成和人物表达，固定真相、证据命中与评分始终由后端结构化规则决定。

## 产品功能

- 六段闭环：首页、案件库、案件档案、调查工作台、结案报告、结果复盘。
- 内置精修首案秒开；也可以用 DeepSeek 生成未知案件，服务不可用时自动降级到内置案件。
- 精修首案包含 3 名嫌疑人、6 条证据、4 个矛盾节点和 12 次全局提问额度。
- 工作台支持切换嫌疑人、逐人查看口供、快速出示证据，并实时显示各自防线与案件进度。
- 角色模型只接收当前已公开事实，不接收完整真相、隐藏证据或私密软肋；生成案的失败降级措辞由服务端受控模板提供。
- FastAPI + SQLite 持久化会话与结构化评分。
- Next.js 动态案件路由；结果页可重审同案，也可继续生成下一案。

## 本地启动

首次安装：

```bash
python3.11 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd frontend
env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY npm install
```

如需真实 AI 案件，先将样例复制为 `backend/.env`，只在后端填入 Key：

```bash
cp .env.example backend/.env
```

然后把 `LLM_ENABLED` 设为 `true`，填写 `LLM_API_KEY`。默认使用 DeepSeek 官方 `https://api.deepseek.com` 和 `deepseek-flash`（DeepSeek V4.1 Flash）。不要使用 `NEXT_PUBLIC_` 前缀，也不要将 `backend/.env` 提交到 Git。生成一案通常需要 30–90 秒。

终端一，启动后端：

```bash
cd backend
PYTHONPATH=. DATABASE_URL=sqlite:///../data/ai-interrogation.db ../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8011
```

终端二，启动前端开发服务器：

```bash
cd frontend
BACKEND_URL=http://127.0.0.1:8011 npm run dev
```

访问 `http://127.0.0.1:3011`。案件库位于 `/cases`，精修首案位于 `/cases/refined-001-v2`。本地端口使用 3011/8011，避免与常用的 3000/8000 冲突。

## 验证

```bash
cd backend
PYTHONPATH=. ../.venv/bin/python -m pytest
../.venv/bin/python -m compileall -q app

cd ../frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

浏览器端到端验收需要额外安装：

```bash
.venv/bin/pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
```

完成前端构建后可一条命令运行：

```bash
cd frontend
npm run test:e2e
```

该命令会启动并在结束后关闭 8011/3011 测试服务，覆盖完整闭环、规则边界、失败复盘和 1440×900、1366×768、390×844、360×800 四种视口。
在独立 worktree 中可通过 `PYTHON_BIN=/绝对路径/.venv/bin/python npm run test:e2e` 指定已有虚拟环境。

## 文档入口

- [产品定义](PRODUCT.md)
- [视觉与交互系统](DESIGN.md)
- [竞品重构计划](docs/2026-10-12-competitor-rebuild-plan.md)
- [技术适配声明](docs/技术适配声明.md)
- [后端开发文档](docs/阶段1技术开发文档.md)
- [前端开发文档](docs/阶段2前端开发文档.md)
- [Factory 设计语言适配](REFERO-FACTORY-DESIGN.md)

生产部署使用独立前后端应用。前端通过构建期 `BACKEND_URL` 同源代理后端；模型密钥、访问令牌哈希和存储凭据只配置在后端服务端环境变量中。

生产环境不要让多个 worker 各自执行迁移。部署时先运行：

```bash
cd backend
PYTHONPATH=. ../.venv/bin/alembic upgrade head
```

随后以 `app.production:app` 启动 API。生产入口使用单一访问令牌换取安全 Cookie，业务会话按访问主体隔离；SQLite 在启动时从 TOS 恢复，并在运行期间定期生成一致性快照。
