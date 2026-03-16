#!/bin/bash
# ReadyQA - 安裝每日自動備份（systemd timer）
# 每天凌晨 2:00 執行 daily_backup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================="
echo "ReadyQA 每日備份安裝"
echo "=========================================="
echo "專案目錄: $PROJECT_DIR"
echo ""

# 1. 檢查 daily_backup.sh 存在
if [ ! -f "$PROJECT_DIR/daily_backup.sh" ]; then
  echo "❌ 找不到 daily_backup.sh"
  exit 1
fi

chmod +x "$PROJECT_DIR/daily_backup.sh"

# 2. 建立 backups 目錄並設定 Elasticsearch snapshot 權限（ES 容器用 UID 1000）
mkdir -p "$PROJECT_DIR/backups/elasticsearch_snapshots"
if [ -d "$PROJECT_DIR/backups/elasticsearch_snapshots" ]; then
  sudo chown -R 1000:1000 "$PROJECT_DIR/backups/elasticsearch_snapshots" 2>/dev/null || true
fi

# 3. 建立 systemd service（替換路徑與使用者）
SERVICE_FILE="/tmp/readyqa-backup.service"
CURRENT_USER="${SUDO_USER:-$USER}"
CURRENT_GROUP=$(id -gn "$CURRENT_USER" 2>/dev/null || echo "$CURRENT_USER")
sed -e "s|/home/frank_weng/ReadyQA|$PROJECT_DIR|g" \
    -e "s|User=frank_weng|User=$CURRENT_USER|g" \
    -e "s|Group=frank_weng|Group=$CURRENT_GROUP|g" \
    "$PROJECT_DIR/docker/readyqa-backup.service" > "$SERVICE_FILE"

# 4. 複製到 systemd
echo "安裝 systemd 服務與 timer（需要 sudo）..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/readyqa-backup.service
sudo cp "$PROJECT_DIR/docker/readyqa-backup.timer" /etc/systemd/system/
sudo systemctl daemon-reload

# 5. 啟用並啟動 timer
sudo systemctl enable readyqa-backup.timer
sudo systemctl start readyqa-backup.timer

echo ""
echo "✅ 安裝完成"
echo ""
echo "每天凌晨 2:00 會自動執行備份"
echo ""
echo "指令："
echo "  啟用每日備份: sudo systemctl enable readyqa-backup.timer"
echo "  停用每日備份: sudo systemctl disable readyqa-backup.timer"
echo "  立即執行一次: sudo systemctl start readyqa-backup.service"
echo "  查看下次執行: sudo systemctl list-timers readyqa-backup.timer"
echo "  查看狀態:     sudo systemctl status readyqa-backup.timer"
echo ""
