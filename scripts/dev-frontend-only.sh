#!/usr/bin/env bash
# 前端開發模式（不 build Docker，改動即時生效）
# 後端、DB、ES 仍用 Docker
#
# 使用方式：
# 1. docker compose up -d postgres elasticsearch backend  # 先啟動後端
# 2. docker compose stop frontend                          # 停掉 Docker 前端
# 3. ./scripts/dev-frontend-only.sh                        # 本機跑前端 dev

set -e
cd "$(dirname "$0")/.."

echo "🔧 前端開發模式：port 3000（需先停止 Docker frontend）"
echo ""

# 載入 .env（若存在）
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# 開發用：API 指向 Docker backend
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
export NEXT_TELEMETRY_DISABLED=1

# 若透過 readyqa.crossbot.com.tw 存取，需改為：
# export NEXT_PUBLIC_API_URL=https://readyqa.crossbot.com.tw/api
# export NEXT_PUBLIC_APP_URL=https://readyqa.crossbot.com.tw

echo "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
echo ""

npm run dev -w @qaplus/frontend
