# 幻我 · AI 造像馆

C 端「个性化 IP / 头像 / 写真」AIGC 生成产品。上传照片 → 选择风格 → 一键生成，支持下载与收藏。

前端纯原生 HTML/CSS/JS，后端为零依赖 Node 服务（静态文件 + 生图 API 代理），API Key 仅存服务端，不暴露到前端。

## 快速开始

```bash
cd huanwo

# 1. 配置 API Key（复制模板并填入）
cp .env.example .env
# 编辑 .env，填入 AI_API_KEY 等配置

# 2. 启动服务（Node >= 18，零依赖）
npm start
# 或 node server/server.js

# 3. 浏览器打开
# http://localhost:8099
```

> 未配置 API Key 时自动进入**预览模式**，生成结果为本地示例占位图，便于前端开发核验。配置 Key 后自动切换为真实生成。

## 环境变量配置（.env）

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务端口 | `8099` |
| `AI_PROVIDER` | API 供应商（openai 兼容格式） | `openai` |
| `AI_API_KEY` | **必填** API 密钥 | 空 |
| `AI_BASE_URL` | API 基础地址（国内中转可改） | `https://api.openai.com/v1` |
| `AI_IMAGE_MODEL` | 生图模型名 | `dall-e-3` |
| `AI_IMAGE_SIZE` | 生成图片尺寸 | `1024x1024` |
| `AI_BATCH_SIZE` | 单次 API 调用生成张数 | `1` |

## 目录结构

```
huanwo/
├── index.html              # 页面骨架（4 视图 + 弹窗 + 提示）
├── package.json            # 启动脚本
├── .env.example            # 环境变量模板
├── .gitignore
├── css/
│   └── styles.css          # 设计系统：令牌 / 组件 / 响应式 / 可访问性
├── js/
│   ├── data.js             # 风格目录（含装饰图案）、套餐方案
│   ├── utils.js            # 存储 / 提示 / 下载
│   ├── api.js              # 大模型接入层（自动检测真实/预览模式）
│   └── app.js              # 主控制器：路由 / 创作流程 / 作品库 / 我的
└── server/
    ├── config.js           # 服务端配置（读取 .env）
    └── server.js           # 零依赖 HTTP 服务（静态文件 + API 代理）
```

## API 接口

### `GET /api/status`
返回服务状态，前端启动时调用以决定运行模式。

```json
{ "ok": true, "hasApiKey": true, "provider": "openai", "model": "dall-e-3" }
```

### `POST /api/generate`
生图代理，转发到 OpenAI 兼容格式的 `/images/generations`。

**请求体：**
```json
{
  "style": "二次元动漫",
  "styleId": "anime",
  "prompt": "用户附加描述（可选）",
  "images": ["data:image/jpeg;base64,..."],
  "count": 4
}
```

**响应：**
```json
{
  "success": true,
  "images": ["data:image/png;base64,...", "..."],
  "style": "二次元动漫",
  "prompt": "实际发送给模型的完整 prompt"
}
```

## 功能清单

- **首页**：获客落地页 —— Hero、8 种风格展示、使用场景、三步流程、转化 CTA
- **创作**（核心）：上传 1–3 张照片（点击/拖拽）→ 选 8 种风格 → 生成 4 张 → 放大预览 / 下载 / 收藏
- **作品**：收藏的作品画廊（localStorage 持久化），可再次下载 / 删除
- **我的**：积分余额、套餐方案（免费 / 畅玩 / 专业）、购买演示、关于与隐私说明

## 技术说明

- 前端：纯原生 HTML / CSS / JS，无框架、无构建，移动优先（桌面居中 520px）
- 后端：Node 内置 `http` 模块，零第三方依赖
- 生图：OpenAI 兼容格式（`/v1/images/generations`），支持国内中转 API（改 `AI_BASE_URL`）
- 安全：API Key 仅存服务端 `.env`，前端不接触密钥；`.env` 已加入 `.gitignore`
- 可访问性：语义化标签、键盘可达、焦点可见、触控目标 ≥ 44px、适配 `prefers-reduced-motion`
- 数据：积分与作品存于浏览器 `localStorage`
