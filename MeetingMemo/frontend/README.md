# MeetingMemo 前端

MeetingMemo 是邀请码访问的会议摘要工作台。前端提供会议转写导入、AI 处理状态、摘要与来源对照、决策和行动项扫描、结构化编辑、审批及导出。

## 本地启动

先按 [`../backend/README.md`](../backend/README.md) 启动 FastAPI（默认端口 `8100`），再在本目录执行：

```sh
npm ci
cp .env.example .env.local
npm run dev
```

浏览器打开 `http://localhost:3000`，输入后端 CLI 创建的邀请码即可进入。默认 `BACKEND_URL=http://127.0.0.1:8100`；所有 API 请求都通过 Next.js 同源转发，密钥只保存在后端环境变量中。

本地后端默认使用 mock LLM，因此查看完整交互不需要配置 API Key。音频和视频转录服务尚未配置，当前支持粘贴转写文本以及上传 TXT、VTT、SRT。

## 质量验证

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

视觉核验脚本需要 Python Playwright，并在生产构建启动后检查 390、768、1280、1440px 断点、横向溢出与浏览器控制台错误：

```sh
python3 scripts/visual_qa.py /tmp/meetingmemo-ui-qa
```

启动真实 FastAPI 和前端后，可用一个专门的测试邀请码执行完整浏览器主链路：

```sh
MEETINGMEMO_BASE_URL=http://localhost:3000 \
MEETINGMEMO_INVITE_CODE=<测试邀请码> \
python3 scripts/real_acceptance.py
```

## 运行时边界

- 不提供注册或账号密码登录，访问状态由后端 HttpOnly Cookie 管理。
- 摘要保存使用完整结构化内容和 `expected_version`，版本冲突会保留编辑内容并显示错误。
- Slack、邮件等集成只按后端真实配置状态启用，不模拟发送成功。
- `NEXT_PUBLIC_*` 不保存任何模型或服务密钥。
