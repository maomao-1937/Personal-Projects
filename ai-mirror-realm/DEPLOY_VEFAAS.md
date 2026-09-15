# AI 个人写真工坊 · 火山引擎部署指南

> 后端：veFaaS 函数服务（Python 3.12）
> 前端：veFaaS 静态托管 / 函数服务（Node.js 20）
> AI：火山方舟 Seedream 4.5（图生图）

---

## 一、前置准备

### 1.1 安装 veFaaS CLI

```bash
npm i -g @volcengine/vefaas-cli@latest
vefaas --version   # 确认 >= 0.2.7
```

### 1.2 登录火山引擎

```bash
vefaas login
```

按提示完成认证（需要火山引擎 AK/SK）。

### 1.3 确认 API 网关

部署应用需要绑定一个 APIG 网关。如果没有，先创建：

```bash
vefaas gateway list --first
```

如果返回为空，需要先在火山引擎控制台创建一个 API 网关。

---

## 二、部署后端

### 2.1 初始化应用

```bash
cd ai-mirror-realm/backend
vefaas init application --runtime native-python3.12 --yes
```

CLI 会自动检测 FastAPI 框架并生成配置。

### 2.2 配置环境变量

```bash
vefaas env set DEBUG=false
vefaas env set DATABASE_URL=sqlite:///./mirror_realm.db
vefaas env set SECRET_KEY=your-production-secret-key
vefaas env set INVITE_TOKEN_PEPPER=your-independent-invite-token-pepper
vefaas env set AUTH_COOKIE_SECURE=true
vefaas env set CORS_ORIGINS=https://your-frontend-domain.volceapp.com
vefaas env set AI_API_KEY=ark-xxxxxxxxxxxxxxxxxx
vefaas env set AI_API_BASE_URL=https://ark.cn-beijing.volces.com
vefaas env set AI_MODEL=doubao-seedream-4.5
vefaas env set AI_IMAGE_SIZE=2K
```

### 2.3 配置构建与启动

```bash
vefaas config set buildCommand "pip install -r requirements.txt"
vefaas config set startCommand "uvicorn app.main:app --host 0.0.0.0 --port 9000"
```

> 注意：veFaaS 监听端口通常是 9000，具体以实际环境为准。

### 2.4 部署

```bash
vefaas deploy --yes
```

部署成功后会返回访问地址，形如：
`https://xxxxxx.apigateway-cn-beijing.volceapi.com/`

### 2.5 验证

```bash
curl https://your-backend-url/api/health
```

应返回 `{"status": "ok", "ai_configured": true}`。

---

## 三、部署前端

### 3.1 初始化应用

```bash
cd ai-mirror-realm/frontend
vefaas init application --runtime native-node20 --yes
```

CLI 会自动检测 Next.js 框架。

### 3.2 配置环境变量

```bash
vefaas env set NEXT_PUBLIC_API_URL=https://your-backend-url
```

### 3.3 配置构建与启动

```bash
vefaas config set buildCommand "npm install && npm run build"
vefaas config set startCommand "npx next start -p 9000"
```

### 3.4 部署

```bash
vefaas deploy --yes
```

---

## 四、域名与 CORS

1. 在火山引擎控制台为前端绑定自定义域名（可选）
2. 更新后端 CORS 环境变量：
   ```bash
   vefaas env set CORS_ORIGINS=https://your-domain.com
   ```
3. 重新部署后端：`vefaas deploy --yes`

---

## 五、成本估算（Seedream 4.5）

| 项目 | 单价 | 1000 张 |
|------|------|---------|
| Seedream 4.5 图生图 | ~0.25 元/张 | 250 元 |
| veFaaS 后端函数 | 按调用量计费 | 约 10-50 元 |
| veFaaS 前端函数 | 按调用量计费 | 约 10-30 元 |
| API 网关 | 按调用量计费 | 约 5-20 元 |
| **合计** | | **约 275-350 元 / 千张** |

> 说明：Seedream 4.5 采用 2K 分辨率，约 0.25 元/张（具体以火山方舟定价为准）。veFaaS 函数服务有免费额度，初期成本很低。

---

## 六、常见问题

### Q: 部署后 404？
A: 检查 APIG 触发器是否正确绑定，路由前缀是否匹配。

### Q: AI 生成超时？
A: Seedream 图生图通常 10-30 秒。如果超时，检查函数超时配置（建议设为 120s）。

### Q: 数据库持久化？
A: veFaaS 是无服务器环境，本地 SQLite 不持久化。生产环境建议使用火山引擎的 MySQL/PostgreSQL 托管服务。

### Q: 如何查看日志？
A: `vefaas logs` 或在火山引擎控制台查看函数日志。
