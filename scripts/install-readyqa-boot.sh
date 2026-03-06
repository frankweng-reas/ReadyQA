#!/bin/bash
# ReadyQA - 安裝 VM 開機自動啟動 Docker 服務
# 用途：VM 重啟後，依正確順序啟動所有容器（含 ES 連線）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_NAME="readyqa-docker.service"

echo "=========================================="
echo "ReadyQA 開機自動啟動安裝"
echo "=========================================="
echo "專案目錄: $PROJECT_DIR"
echo ""

# 1. 檢查 Docker
if ! command -v docker &> /dev/null; then
  echo "❌ 找不到 docker，請先安裝 Docker"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "❌ 找不到 docker compose，請確認已安裝"
  exit 1
fi

# 2. 建立 systemd service（替換 WorkingDirectory）
SERVICE_FILE="/tmp/$SERVICE_NAME"
cat "$PROJECT_DIR/docker/readyqa-docker.service" | \
  sed "s|WorkingDirectory=.*|WorkingDirectory=$PROJECT_DIR|" > "$SERVICE_FILE"

# 3. 複製到 systemd
echo "安裝 systemd 服務（需要 sudo）..."
sudo cp "$SERVICE_FILE" "/etc/systemd/system/$SERVICE_NAME"
sudo systemctl daemon-reload

# 4. 啟用開機啟動
sudo systemctl enable "$SERVICE_NAME"

echo ""
echo "✅ 安裝完成"
echo ""
echo "指令："
echo "  啟用開機啟動: sudo systemctl enable readyqa-docker"
echo "  停用開機啟動: sudo systemctl disable readyqa-docker"
echo "  立即啟動:     sudo systemctl start readyqa-docker"
echo "  立即停止:     sudo systemctl stop readyqa-docker"
echo "  查看狀態:     sudo systemctl status readyqa-docker"
echo ""
echo "VM 重啟後，服務會依序啟動（Postgres → ES → Backend → Frontend → Nginx）"
echo ""
