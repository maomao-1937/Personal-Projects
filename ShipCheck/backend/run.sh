#!/bin/bash
# veFaaS Native Python 启动脚本
# 适配: _FAAS_RUNTIME_PORT 端口 / /tmp 数据目录 / Playwright chromium + 系统库补齐
set -ex
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ===== 数据目录:veFaaS 只有 /tmp 可写 =====
export DB_URL="sqlite:////tmp/shipcheck.db"
export DATA_DIR="/tmp/shipcheck-data"
export SCREENSHOT_DIR="/tmp/shipcheck-data/screenshots"
mkdir -p "$SCREENSHOT_DIR"

# ===== 系统库补齐(免 root):apt download + dpkg -x 到 /tmp/lib-root =====
# veFaaS debian11 缺 chromium 所需的图形/字体库;用清华镜像下载解压,LD_LIBRARY_PATH 注入
export LIB_ROOT="/tmp/lib-root"
export LD_LIBRARY_PATH="$LIB_ROOT/usr/lib/x86_64-linux-gnu:$LIB_ROOT/lib/x86_64-linux-gnu:$LIB_ROOT/usr/lib"
if [ ! -f "$LIB_ROOT/.libs-ready" ]; then
  APTOPT="-o Dir::State::lists=/tmp/apt/lists -o Dir::Cache=/tmp/apt/cache -o Dir::State::status=/var/lib/dpkg/status -o Dir::Etc::sourcelist=/tmp/apt/sources.list -o Dir::Etc::sourceparts=-"
  mkdir -p /tmp/apt/lists/partial /tmp/apt/cache/archives/partial /tmp/debs "$LIB_ROOT"
  echo 'deb https://mirrors.tuna.tsinghua.edu.cn/debian/ bullseye main' > /tmp/apt/sources.list
  apt-get $APTOPT update 2>/dev/null || true
  cd /tmp/debs
  # chromium 及其传递依赖(两轮迭代收敛出的完整清单)
  apt-get $APTOPT download \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    libavahi-client3 libavahi-common3 libfribidi0 libharfbuzz0b libpixman-1-0 \
    libthai0 libwayland-server0 libxcb-render0 libxcb-shm0 libxrender1 \
    libdatrie1 libgraphite2-3 libbsd0 libmd0 2>/dev/null || true
  for f in *.deb; do dpkg -x "$f" "$LIB_ROOT" 2>/dev/null || true; done
  touch "$LIB_ROOT/.libs-ready"
  cd "$SCRIPT_DIR"
fi

# ===== Playwright chromium 装到 /tmp(代码目录只读) =====
export PLAYWRIGHT_BROWSERS_PATH="/tmp/pw-browsers"
if ! ls "$PLAYWRIGHT_BROWSERS_PATH"/chromium-*/chrome-linux/chrome >/dev/null 2>&1; then
  python3 -m playwright install chromium || echo "WARN: chromium install failed, acceptance mode may not work"
fi

HOST="0.0.0.0"
PORT="${_FAAS_RUNTIME_PORT:-8000}"

exec python3 -m uvicorn app.main:app --host "$HOST" --port "$PORT" --timeout-graceful-shutdown 30
