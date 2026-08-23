# AI 对话质检器前端

Next.js 单页质检工作台，覆盖邀请码访问、销售／客服对话输入、分析状态、证据化报告、复制和匿名反馈。浏览器只请求同源 `/backend-api/*`，由 Next.js Route Handler 在服务端转发到后端。

## 本地开发

要求 Node.js 24 与 npm 11。在仓库根目录执行：

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

默认页面地址是 `http://127.0.0.1:3010`，默认后端地址是 `http://127.0.0.1:8010`。如后端地址不同，修改 `.env.local` 中的 `BACKEND_API_BASE_URL` 并重新启动前端；该值在服务端请求时读取，不会编译进浏览器包。

## 生产构建

```bash
cd frontend
npm run build
npm run start
```

构建采用 Next.js `standalone` 输出。`build` 会把静态资源补入 standalone 目录，`start` 默认监听 `0.0.0.0:3010`，也接受运行环境提供的 `HOSTNAME` 与 `PORT`。

## 质量门禁

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Playwright E2E 使用受控 API fixture，验证邀请码 → 分析 → 报告 → 证据 → 反馈闭环。额外的浏览器核验脚本要求 Python Playwright：

```bash
python3 ../path/to/with_server.py \
  --server "npm run start" --port 3010 \
  python3 scripts/visual_verify.py
```

`scripts/integration_verify.py` 用于连接真实后端的无模型 Key 冒烟：它应看到安全的 503 提示，并确认失败后额度仍为 50。

## 隐私与访问边界

- 没有注册、账号和密码体系，只接受团队发放的邀请码。
- 签名访问 Cookie 由后端通过同源代理设置；前端不读取或保存访问令牌。
- 原始对话与完整报告只存在于页面内存，刷新后不恢复。
- 页面不向第三方字体、分析脚本或图像服务发送内容。
- `BACKEND_API_BASE_URL` 是服务端配置，不使用 `NEXT_PUBLIC_` 暴露。
