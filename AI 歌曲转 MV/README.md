# AI 歌曲转 MV

把一首歌自动转成 MV：音频节拍分析 → 分镜脚本生成 → AI 视频片段生成 → 时间轴剪辑导出。

## 目录结构

```
AI 歌曲转 MV/
├── docs/                        # 产品与技术文档
│   ├── AI歌曲转MV_PRD_V1.1.md   # 最新 PRD
│   ├── PRD_CHANGELOG_V1.0_to_V1.1.md
│   ├── PRD_LOGIC_REVIEW.md
│   ├── API_KEY_CHECKLIST.md
│   ├── 第1阶段技术开发文档.md
│   ├── 后端核验报告.md
│   ├── 技术适配声明.md
│   ├── competitor/              # 竞品调研（含 4i 证据截图）
│   └── superpowers/
├── auto-beat-video-engine/      # 可运行工程（backend + frontend）
│   ├── backend/                 # FastAPI 服务：上传/分析/分镜/视频生成/剪辑
│   ├── frontend/                # Next.js 分镜工作台
│   ├── tests/
│   └── README.md
├── AI歌曲转MV_PRD_V1.0.md
├── AI Agent 产品上线部署手册.md
├── AI产品Vibe Coding通用技术栈手册.md
└── AI产品Vibe Coding通用前端技术栈手册.md
```

## 快速开始

```bash
cd auto-beat-video-engine
cp .env.example .env   # 填入 STORYBOARD_* / VIDEO_* 等密钥
uv sync
uv run uvicorn backend.app.main:app --reload
```

前端：

```bash
cd auto-beat-video-engine/frontend
npm install
npm run dev
```

## 分支说明

工程代码由 `auto-beat-video-engine` 独立仓库以 `git subtree` 方式并入，
`phase1-backend`（后端）与 `phase2-frontend`（前端）两个分支的工作已全部合并进 `main`。
