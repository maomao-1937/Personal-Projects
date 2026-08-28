# 真实模型冒烟

默认测试不会发起任何网络请求，也不会产生模型费用。

- 文本模型：`RUN_REAL_MODEL_SMOKE=1 .venv/bin/python -m pytest tests/smoke/test_storyboard_real.py -q`
- Wan：仅在用户单独授权一次付费调用后，设置 `RUN_REAL_WAN_SMOKE=1` 运行。默认 `wanx2.1-t2v-turbo`、480P、固定 5 秒。
- Seedance 兼容项：仅在已报告模型、4 秒、480p、一次生成任务后，设置 `RUN_REAL_VIDEO_SMOKE=1` 运行。

测试只从被 Git 忽略的 `.env` 读取配置。脱敏结果写入被忽略的 `.smoke/`，不记录 API Key。

创建请求被拒绝时，测试只输出本项目错误码、HTTP 状态和格式受限的上游错误码；不会输出上游响应正文、Prompt 或 API Key。每次真实调用仍需单独确认。
