# 真实模型冒烟

默认测试不会发起任何网络请求，也不会产生模型费用。

- 文本模型：`RUN_REAL_MODEL_SMOKE=1 .venv/bin/python -m pytest tests/smoke/test_storyboard_real.py -q`
- Seedance：仅在已报告模型、4 秒、480p、一次生成任务后，设置 `RUN_REAL_VIDEO_SMOKE=1` 运行。

测试只从被 Git 忽略的 `.env` 读取配置。脱敏结果写入被忽略的 `.smoke/`，不记录 API Key。
