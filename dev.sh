#!/usr/bin/env bash
# Start the Flask API and the Vite dev server together.
#
#   ./dev.sh            → API on :5000, UI on :5173 (proxying /api to the API)
#
# Stop both with Ctrl-C.
set -euo pipefail

cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"
if [ -x ".venv/bin/python" ]; then
  PYTHON=".venv/bin/python"
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies…"
  (cd frontend && npm install)
fi

echo "🚀 Starting Flask API on http://localhost:5000"
$PYTHON run.py &
API_PID=$!

cleanup() {
  echo ""
  echo "👋 Shutting down…"
  kill $API_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "🎨 Starting Vite dev server on http://localhost:5173"
(cd frontend && npm run dev -- --host 0.0.0.0)
