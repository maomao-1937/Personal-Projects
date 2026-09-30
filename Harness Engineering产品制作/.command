#!/bin/bash
# ============================================================
#  learn-claude-code 一键启动（Mac 双击本文件即可运行）
# ============================================================
cd "$(dirname "$0")" || exit 1

# 检查 Python
if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ 未检测到 python3"
    echo "   请先安装 Python 3.9 以上版本：https://www.python.org/downloads/"
    echo ""
    read -r -p "按回车关闭窗口..."
    exit 1
fi

# 启动课程（会自动装依赖、引导填 key）
python3 run.py

# 课程退出后防止窗口闪退
echo ""
read -r -p "按回车关闭窗口..."
