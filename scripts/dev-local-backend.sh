#!/usr/bin/env bash
# dev:local 後端 - port 8001，連線本地 DB（避開 VM 的 8000）
cd "$(dirname "$0")/../apps/backend" && PORT=8001 npm run dev
