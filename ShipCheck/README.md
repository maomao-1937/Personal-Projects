# ShipCheck — AI 产品验收工具

给 Vibe Coder / AI 工程师 / AI PM 的产品验收工具。两种模式:

1. **验收模式**: 给 PRD + 产品网址 → 自动操作真实网站 → 判定是否按 PRD 完成 → 给证据 + 修复任务
2. **审查模式**: 给 PRD → 查 PRD 逻辑问题 → 给修改建议

> 当前为 **第 1 阶段:后端 MVP**。前端在后续阶段。配套文档见 `docs/`。

## 技术栈

- Python 3.11 + FastAPI + Pydantic + pytest
- SQLAlchemy + Alembic + SQLite(MVP)
- Playwright(浏览器自动化)
- 腾讯混元大模型(OpenAI 兼容接口)

## 快速开始

```sh
cd shipcheck/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env          # 验收前填入 HUNYUAN_API_KEY
# 初始化 DB
alembic upgrade head          # 或 python -c "from app.db import init_db; init_db()"
# 启动
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Swagger: http://localhost:8000/docs
- 最小验收页: http://localhost:8000/static/index.html

## 开发期(无 Key)

`.env` 里 `MOCK_MODE=true`,所有混元调用与浏览器操作走 mock,可离线跑通全链路。

## 测试

```sh
cd shipcheck/backend
pytest -v
```

## 目录

```
shipcheck/
├── backend/        # FastAPI 服务
├── data/           # SQLite + 截图
├── docs/           # 适配声明 + 阶段文档
└── README.md
```

## 路线

- [x] 第 1 阶段: 后端 MVP(验收 + 审查,API + 最小验收页)
- [ ] 第 2 阶段: 正式前端(Next.js)
- [ ] 第 3 阶段: 上线(火山引擎 veFaaS / Docker + ECS)
