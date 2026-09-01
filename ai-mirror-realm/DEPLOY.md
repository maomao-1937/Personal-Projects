# AI 镜界 · 部署指南

> 全栈部署：前端 Vercel + 后端 Render

## 一、后端部署（Render）

1. 登录 [Render](https://dashboard.render.com) → New Web Service → 连接 GitHub 仓库
2. 配置：
   - Root Directory: `ai-mirror-realm/backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --workers 2`
3. 环境变量：

| Key | Value |
|-----|-------|
| `DEBUG` | `false` |
| `DATABASE_URL` | `sqlite:///./mirror_realm.db` |
| `SECRET_KEY` | 点击 Generate 生成 |
| `CORS_ORIGINS` | Vercel 前端域名 |
| `AI_API_KEY` | 混元 API Key |
| `AI_API_BASE_URL` | `https://tokenhub.tencentmaas.com` |
| `AI_MODEL` | `hy-image-v3` |

## 二、前端部署（Vercel）

1. 登录 [Vercel](https://vercel.com/dashboard) → Import 项目
2. Root Directory: `ai-mirror-realm/frontend`
3. 环境变量：

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | Render 后端地址 |

## 三、本地开发

```bash
# 后端
cd ai-mirror-realm/backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd ai-mirror-realm/frontend
npm install
npm run dev
```
