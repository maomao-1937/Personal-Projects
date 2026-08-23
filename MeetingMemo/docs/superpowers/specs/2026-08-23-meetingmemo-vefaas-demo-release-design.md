# MeetingMemo veFaaS 演示环境发布设计

## 目标

把当前 MeetingMemo 封闭测试版本发布为可公开访问的火山引擎演示环境，完成真实邀请码登录和 `qwen-plus` 摘要生成验收；成功后把源码同步到 `maomao-1937/Personal-Projects` 的 `MeetingMemo/` 目录，并合并当前实现分支。

## 已确认边界

- 使用账号 `2130684037`、华北 2（北京）和现有 Serverless 网关 `shipcheck-gw`。
- 账号剩余 1024 MiB 配额，前端与后端各使用 512 MiB、最多一个实例。
- 当前没有 PostgreSQL 或 NAS/TOS 持久化配置。本次按用户“现在开始部署”的指令发布演示环境：后端数据库与上传目录放在 `/tmp`，实例重建可能丢失会议历史。
- API Key、应用签名密钥和邀请码只写入 veFaaS 环境变量，不写入 Git。

## 架构

部署两个 veFaaS Application：

1. `meetingmemo-api`：Python 3.11 FastAPI，启动时先执行 Alembic，再幂等写入部署邀请码，随后启动 Uvicorn。使用单实例 SQLite 和真实百炼 `qwen-plus`。
2. `meetingmemo-web`：Node 20 Next.js standalone。浏览器只请求前端域名下的 `/api/v1/*`，Next.js rewrite 转发到后端 HTTPS 地址，Cookie 保持同源。

后端先创建以获得 HTTPS 地址；前端在构建前写入 `BACKEND_URL`。前端发布后，再把后端 `FRONTEND_ORIGIN` 更新为前端正式域名并重新发布。

## 邀请码初始化

新增一个部署启动脚本，从 `BOOTSTRAP_INVITE_CODE` 读取邀请码。脚本先运行数据库迁移，再按当前 `SECRET_KEY` 计算哈希：

- 数据库没有该邀请码时创建 50 次额度的邀请码；
- 已存在时不重复创建；
- 环境变量缺失时拒绝启动，避免发布一个无法进入的演示环境；
- 日志不输出邀请码明文。

## 验收

- 后端 `/health/ready` 返回 ready。
- 前端首页可打开，无 5xx。
- 使用部署邀请码成功进入工作台。
- 新建短会议后，真实模型任务变为 `succeeded`，出现“确认摘要”。
- 线上页面不出现已删除的版本状态、邮件、Slack 和未配置提示。
- 完成后再同步 `MeetingMemo/` 到目标 GitHub 仓库，确保 `.env`、`.vefaas/`、本地数据库和缓存不进入提交，最后合并 `impl/meetingmemo-closed-beta` 到本地主分支。

