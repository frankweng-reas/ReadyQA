#!/bin/bash
# ReadyQA 每日備份 - 可透過 cron 自動執行
# 備份 PostgreSQL + Elasticsearch，保留最近 30 天

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p backups backups/elasticsearch_snapshots

# PostgreSQL 備份（使用唯一檔名避免同日多次執行互相覆寫，且避免權限衝突）
BACKUP_SQL="backups/backup_$(date +%Y%m%d_%H%M%S).sql"
docker exec qaplus-postgres pg_dump -c -U qaplus qaplus > "$BACKUP_SQL"

# Elasticsearch Snapshot 備份
ES_HOST="${ELASTICSEARCH_HOST:-http://localhost:9200}"
REPO_NAME="readyqa_backup"
SNAPSHOT_NAME="snapshot_$(date +%Y%m%d_%H%M%S)"
if curl -sf "${ES_HOST}/_cluster/health" > /dev/null 2>&1; then
  # 註冊 repository（若已存在會忽略）
  curl -s -X PUT "${ES_HOST}/_snapshot/${REPO_NAME}" \
    -H 'Content-Type: application/json' \
    -d '{"type":"fs","settings":{"location":"/usr/share/elasticsearch/backup"}}' > /dev/null 2>&1 || true
  # 建立 snapshot（只備份 faq_* 索引）
  if curl -s -X PUT "${ES_HOST}/_snapshot/${REPO_NAME}/${SNAPSHOT_NAME}?wait_for_completion=true" \
    -H 'Content-Type: application/json' \
    -d '{"indices":"faq_*","include_global_state":false}' | grep -q '"accepted":true\|"state":"SUCCESS"'; then
    echo "[$(date)] Elasticsearch snapshot ${SNAPSHOT_NAME} 完成"
  else
    echo "[$(date)] Elasticsearch snapshot 失敗或無索引可備份" >&2
  fi
else
  echo "[$(date)] Elasticsearch 未運行，跳過 ES 備份" >&2
fi

# 刪除 30 天前的 PostgreSQL 備份
find backups -name "backup_*.sql" -mtime +30 -delete

# 刪除 30 天前的 Elasticsearch snapshot（需透過 API，不可直接刪目錄）
if curl -sf "${ES_HOST}/_cluster/health" > /dev/null 2>&1; then
  CUTOFF=$(date -d '30 days ago' +%Y%m%d 2>/dev/null || date -v-30d +%Y%m%d 2>/dev/null)
  SNAPSHOT_JSON=$(curl -sf "${ES_HOST}/_snapshot/${REPO_NAME}/_all?ignore_unavailable=true" 2>/dev/null)
  for snap in $(echo "$SNAPSHOT_JSON" | grep -o '"snapshot":"[^"]*"' | sed 's/"snapshot":"//;s/"$//'); do
    snap_date=$(echo "$snap" | sed 's/snapshot_\([0-9]\{8\}\).*/\1/')
    if [[ -n "$snap_date" && "$snap_date" < "$CUTOFF" ]]; then
      curl -sf -X DELETE "${ES_HOST}/_snapshot/${REPO_NAME}/${snap}" > /dev/null 2>&1 && echo "[$(date)] 已刪除舊 snapshot: ${snap}" || true
    fi
  done
fi
