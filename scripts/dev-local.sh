#!/usr/bin/env bash
# dev:local - 前端 port 3001，連線本地後端 port 8001（避開 VM 的 3000/8000）
# 需另開終端執行 npm run dev:local:backend 啟動後端
echo "🔧 dev:local: 前端 3001 → 後端 8001（請確認已執行 npm run dev:local:backend）"
export NEXT_TELEMETRY_DISABLED=1
export NEXT_PUBLIC_API_URL=http://localhost:8001/api
export NEXT_PUBLIC_APP_URL=http://localhost:3001
cd "$(dirname "$0")/../apps/frontend" && node ../../node_modules/next/dist/bin/next dev -p 3001 -H 0.0.0.0
