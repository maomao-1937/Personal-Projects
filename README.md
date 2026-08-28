# AI 歌曲转 MV

当前后端版本：`3.0.0a1`

这是“AI 歌曲转 MV”第 1 阶段的后端工程。当前交付重点是可持久、可恢复、可测试的真实能力链路；仓库中的旧 React 页面仅作为历史底座保留，不代表已开始正式前端阶段。

## 当前真实能力

- 邀请码登录、用户数据隔离和项目持久化；
- 30—60 秒 MP3/WAV 上传，单文件不超过 100 MB；
- librosa 分析 BPM、Beat、Downbeat、Onset、Energy 和 Waveform；
- BeatPlan 与 OpenAI Compatible Storyboard Provider；
- 最多 12 个独立 Cut，视频生成并发 2，支持 Partial、Retry 和 Regenerate；
- SQLite Job/Event、租约恢复和可续传 SSE；
- 不可变 TimelineVersion，旧 Preview/Export 自动 stale；
- FFmpeg H.264/AAC Preview；
- 16:9 与 9:16 两个独立 MP4 Export，9:16 为确定性中心裁切/缩放；
- `/acceptance` 原生最小验收页；
- 旧 `/api/process`、`/api/status/{job_id}` 和 `/api/download/{job_id}` 暂时保留。

## 环境要求

- Python 3.11；
- FFmpeg 与 ffprobe；
- `uv`；
- 本地 `.env`，该文件必须保持在 Git 忽略范围内。

## 启动

```bash
uv sync --extra test
uv run uvicorn backend.main:app --reload
```

打开：

- 健康检查：`http://127.0.0.1:8000/api/v1/health`
- API 文档：`http://127.0.0.1:8000/docs`
- 后端最小验收：`http://127.0.0.1:8000/acceptance`

环境变量模板见 `.env.example`。API Key 只允许写入本地 `.env`，不得进入前端、README、日志或 Git。

邀请码以 SHA-256 哈希配置到 `APP_INVITE_CODE_HASHES`，多个哈希使用英文逗号分隔。生成哈希时不要把明文邀请码写入命令历史或仓库文件。

## 测试

```bash
.venv/bin/python -m pytest -m 'not real_model' -q
.venv/bin/python -m compileall -q backend
git diff --check
```

真实模型测试默认 Skip，具体门禁见 `tests/smoke/README.md`。当前 Storyboard 真模型冒烟已通过；Seedance 创建请求被上游以 HTTP 400 拒绝且没有返回任务 ID，需先在火山方舟控制台核验模型开通、余额/资源包和内容策略后再执行一次。

## P0 边界

P0 不包含专业多轨剪辑器、完整 Characters/Environments、多候选图片、复杂 Lipsync Timeline、社区、会员积分、在线支付和多人协作。正式前端与部署必须通过后续人工闸门后才能开始。

## 安全与本地数据

以下内容不进入 Git：

- `.env` 和任何本地 Key 备份；
- `.venv/`；
- `data/` SQLite 数据库；
- `artifacts/`、上传文件、生成视频和真实模型冒烟产物。

## License

MIT
