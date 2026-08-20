# 灵感星图

把用户保存的文字或网页素材，推进成一个来源可解释、可以在周末验证的项目假设。

当前版本实现了 Agent Blueprint Step 5 的完整可运行 MVP：

- 文字与网页素材入库
- AI 素材结构化
- 用户数据隔离
- 中英文轻量检索
- 固定孵化工作流
- 项目假设来源校验
- 「无可靠方向」质量门
- 用户反馈记录
- SQLite / PostgreSQL 持久化
- 星空紫罗兰风格的响应式 Web 界面
- 单用户 Bearer Token 鉴权

## 快速开始

要求：安装 [uv](https://docs.astral.sh/uv/)；Python 由 uv 自动管理。

```bash
cd 灵感星图
cp .env.example .env
uv sync --python 3.12
uv run uvicorn app.main:app --reload
```

打开产品界面：<http://127.0.0.1:8000>

首次进入时输入 `.env` 中的 `APP_API_TOKEN`。令牌只保存在当前浏览器会话。

API 文档：<http://127.0.0.1:8000/docs>

健康检查：

```bash
curl http://127.0.0.1:8000/health
```

## 模型模式

默认不需要 API Key，系统使用 `HeuristicModelGateway`，便于完整运行流程和测试。它只提供确定性演示结果，不代表真实 AI 质量。

生产环境使用服务端配置的内置 AI。浏览器不会要求用户输入模型 API Key，也不会向用户展示底层模型供应商或型号。

打开任意素材后，可以查看和修改原始内容。“保存并分析”会保存修改并生成整理版，“重新分析”会保持原文不变并重新生成整理版。素材卡片、检索和后续方案生成都会使用最新整理结果；原始内容始终保留。

也可以在服务端使用 Anthropic 模型，在 `.env` 中配置：

```dotenv
ANTHROPIC_API_KEY=sk-ant-xxx
MODEL_ID=claude-sonnet-4-6
```

启动时会自动选择服务端配置的模型网关。模型只能引用本次检索到的素材；程序会拒绝不存在的素材 ID。

## API 示例

所有业务接口都要求 `Authorization: Bearer <APP_API_TOKEN>`。当前版本是单用户私人 MVP，服务端身份固定为 `owner`，不会信任客户端传入的用户 ID。

### 保存素材

```bash
curl -X POST http://127.0.0.1:8000/materials \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <APP_API_TOKEN>' \
  -d '{"source_type":"text","content":"收藏的文章越来越多，但我从来不回看。"}'

curl -X POST http://127.0.0.1:8000/materials \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <APP_API_TOKEN>' \
  -d '{"source_type":"text","content":"左右滑动可以很轻松地完成筛选。"}'
```

### 生成周末项目

```bash
curl -X POST http://127.0.0.1:8000/incubations \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <APP_API_TOKEN>' \
  -d '{"seed_material_id":"<MATERIAL_ID>","constraints":{"available_days":2,"budget":"low"}}'
```

所选素材会作为方案的核心起点；系统会自动从整个素材星库补充可组合的其他素材。

### 提交反馈

```bash
curl -X POST http://127.0.0.1:8000/hypotheses/<HYPOTHESIS_ID>/feedback \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <APP_API_TOKEN>' \
  -d '{"category":"worth_doing","note":"准备周末验证"}'
```

反馈类型：`worth_doing`、`too_generic`、`weak_connection`、`too_large`、`not_interested`。

## 数据库

本地默认使用 SQLite：

```dotenv
DATABASE_URL=sqlite:///./incubator.db
```

生产环境可切换 PostgreSQL：

```dotenv
DATABASE_URL=postgresql+psycopg://incubator:password@postgres:5432/incubator
```

当前版本会自动创建表。正式部署前应补充 Alembic 迁移，并把轻量关键词检索替换为 PostgreSQL + pgvector 混合检索。

## 测试

```bash
uv run pytest -q
uv run python -m compileall -q app
```

测试覆盖领域约束、租户隔离、URL 私网拦截、素材入库、检索、拒绝生成、伪造引用和 HTTP API 闭环。

## Docker

```bash
docker build -t inspiration-constellation .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=sqlite:////tmp/incubator.db \
  -e APP_API_TOKEN=replace-with-a-long-random-token \
  inspiration-constellation
```

## 火山引擎 veFaaS

项目可直接使用 native Python 3.12 Application 工作流部署，生产启动命令为：

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

线上至少配置：

```dotenv
DATABASE_URL=sqlite:////tmp/incubator.db
APP_API_TOKEN=<long-random-token>
```

SQLite 在 Serverless 实例回收后不保证保留，仅适合在线演示。正式使用请配置 PostgreSQL `DATABASE_URL`。

## 当前边界

- 网页正文目前仅做受限抓取和文本读取，尚未加入专业正文抽取。
- 入库流程当前同步执行，Redis Worker 属于下一阶段。
- 当前检索是轻量关键词与中文字词检索，尚未接入 Embedding 和 pgvector。
- 当前是单用户 Token 鉴权，尚无多用户账号体系、对象存储、偏好学习和数据导出。
- 原始素材会发送给已配置的模型供应商，生产上线前必须完成供应商隐私策略评审。

完整设计与实施记录见 [`docs/superpowers`](docs/superpowers)。
