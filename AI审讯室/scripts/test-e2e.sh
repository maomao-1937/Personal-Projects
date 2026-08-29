#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_PID=""
FRONTEND_PID=""
E2E_DATABASE_DIR="$(mktemp -d)"
E2E_DATABASE_URL="sqlite:///$E2E_DATABASE_DIR/e2e-web.db"
E2E_ACCESS_TOKEN="ONE-TOKEN"
E2E_ACCESS_TOKEN_HASH="7bcc86e1de14cb298a0f806ecb183e8e74630fc3d7855c60e14fb9a0acd54040"
PYTHON_BIN="${PYTHON_BIN:-$PROJECT_ROOT/.venv/bin/python}"

mkdir -p "$PROJECT_ROOT/data"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Python virtual environment not found: $PYTHON_BIN" >&2
  exit 1
fi

cleanup() {
  if [[ -n "$FRONTEND_PID" ]]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [[ -n "$BACKEND_PID" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  rm -rf "$E2E_DATABASE_DIR"
}
trap cleanup EXIT INT TERM

(
  cd "$PROJECT_ROOT/backend"
  PYTHONPATH=. DATABASE_URL="$E2E_DATABASE_URL" \
    "$PYTHON_BIN" -m alembic upgrade head
  PYTHONPATH=. DATABASE_URL="$E2E_DATABASE_URL" \
    "$PYTHON_BIN" "$PROJECT_ROOT/tests/dynamic_case_fixture.py"
)

(
  cd "$PROJECT_ROOT/backend"
  PYTHONPATH=. DATABASE_URL="$E2E_DATABASE_URL" LLM_ENABLED=false \
    ACCESS_TOKEN_HASH="$E2E_ACCESS_TOKEN_HASH" \
    AUTH_SIGNING_SECRET="e2e-signing-secret" AUTH_COOKIE_SECURE=false \
    "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8011
) &
BACKEND_PID=$!

(
  cd "$PROJECT_ROOT/frontend"
  npm start
) &
FRONTEND_PID=$!

for _ in {1..120}; do
  if curl --silent --fail http://127.0.0.1:8011/api/v1/health >/dev/null \
    && curl --silent --fail http://127.0.0.1:3011 >/dev/null; then
    E2E_ACCESS_TOKEN="$E2E_ACCESS_TOKEN" \
      "$PYTHON_BIN" "$PROJECT_ROOT/tests/web_smoke.py"
    exit 0
  fi
  sleep 0.25
done

echo "E2E servers did not become ready within 30 seconds." >&2
exit 1
