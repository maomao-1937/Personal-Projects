# AI 审讯室

一款可完整游玩的 AI 审讯推理游戏：模型生成每局不同的案件并扮演嫌疑人，固定真相、证据命中和评分始终由后端结构化规则决定。

## 产品功能

- 五个页面：落地页、案件简报、审讯工作台、三步结案报告、结果复盘。
- 每次开局生成新案件；服务不可用时仍可进入内置案件。
- 首页用一句话描述想玩的案件，也可选择示例再编辑。系统先分析场景、事件、嫌疑人身份、氛围与偏好，再按固定玩法生成卷宗；必要的题材调整会显示在案件简报中。
- 嫌疑人模型只负责临场表达；每案固定 5 条证据、3 个谎言节点和 8 回合上限。
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

然后把 `LLM_ENABLED` 设为 `true`，填写 `LLM_API_KEY`。不要使用 `NEXT_PUBLIC_` 前缀，也不要将 `backend/.env` 提交到 Git。生成一案通常需要 30–90 秒。

样例使用 DeepSeek 官方接口 `https://api.deepseek.com`，案件生成、审校与嫌疑人对话均使用 `deepseek-flash`。后端按 DeepSeek 接口规范显式关闭思考模式，把输出额度用于案件 JSON 和对话正文。仍可通过上述模型环境变量切换其他兼容服务。

自由提示词限 1–500 字。产品定位由后端固定约束：面向无需刑侦知识的轻推理玩家，使用证据卡、提问、笔记和结案报告，在手机或电脑上单人短局游玩。三卡不是要求玩家填写的额外表单。分析调用最多等待 30 秒，随后生成调用最多等待 90 秒；前端请求有 150 秒超时。失败保留输入，可以修改重试，也可以明确选择内置案件。

生成接口接受 `{"prompt":"雨夜博物馆的设计稿失踪，重点查门禁与监控"}`。原始输入只交给意图分析器；生成器接收经过字段和内容校验的方向。方向以 `generationIntent` 保存并返回，不含隐藏真相。旧客户端不传 `prompt` 时仍能使用受控主题生成。

前端有访问令牌入口，本地体验也需配置 `ACCESS_TOKEN_HASH`（令牌的 SHA-256 十六进制摘要）和 `AUTH_SIGNING_SECRET`（随机签名密钥）。这两项只放在 `backend/.env`；页面输入原始访问令牌，模型 API Key 不用于页面登录。

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

访问 `http://127.0.0.1:3011`。本地端口使用 3011/8011，避免与常用的 3000/8000 冲突。

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

2026-10-06 提示词生成流程验收：后端 107 项测试通过（`pytest -q --ignore=tests/test_database_backup.py`；现有 Windows SQLite 文件锁导致的备份测试单独排除），前端 50 项 Vitest 测试、typecheck、lint 和 Next 生产构建通过。Windows 可使用 `node node_modules/next/dist/bin/next build` 检查构建；本地 Node 的 Vitest 设置 `NODE_OPTIONS=--no-experimental-webstorage`，避免原生 localStorage 与 jsdom 冲突。

DeepSeek 实际验证了两种不同案件方向、方向保存恢复和审讯回合；Playwright 验证 1440×900、390×844、360×640 下的输入、示例填入、空白/500 字边界、失败保留原文、重试、简报和真实提问。本次未运行上述完整结案端到端套件。浏览器日志仅有已有 favicon 缺失及验收刻意模拟的 502，未发现相关运行时错误。

## 文档入口

- [产品与交互规格](DESIGN_SPEC.md)
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
