#!/bin/bash
# ReadyQA Production Health Check
# 每次執行會顯示各服務狀態，異常時顯示 ❌

set -euo pipefail

BACKEND="http://127.0.0.1:8000"
FRONTEND="http://127.0.0.1:3000"
ES="http://127.0.0.1:9200"
DB_CONTAINER="qaplus-postgres"
DB_USER="qaplus"
DB_NAME="qaplus"

PASS=0
FAIL=0

ok()   { echo "  ✅ $1"; ((PASS++)) || true; }
fail() { echo "  ❌ $1"; ((FAIL++)) || true; }
title(){ echo ""; echo "▶ $1"; }

echo "========================================="
echo " ReadyQA Health Check  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="

# ── 1. Docker 容器 ────────────────────────────────────────────────────────────
title "Docker 容器"
for name in qaplus-backend qaplus-frontend qaplus-postgres qaplus-elasticsearch qaplus-nginx; do
  status=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "not_found")
  if [[ "$status" == "running" ]]; then
    ok "$name (running)"
  else
    fail "$name ($status)"
  fi
done

# ── 2. Backend ────────────────────────────────────────────────────────────────
title "Backend API"
resp=$(curl -sf --max-time 5 "$BACKEND/api/health" 2>/dev/null || echo "")
if echo "$resp" | grep -q '"status":"healthy"'; then
  uptime=$(echo "$resp" | grep -o '"uptime":[0-9.]*' | cut -d: -f2 | awk '{printf "%.0f", $1}')
  ok "健康，uptime ${uptime}s"
else
  fail "無法連線或狀態異常 ($BACKEND/api/health)"
fi

# ── 3. Frontend ───────────────────────────────────────────────────────────────
title "Frontend"
code=$(curl -so /dev/null --max-time 5 -w "%{http_code}" "$FRONTEND/" 2>/dev/null || echo "000")
if [[ "$code" =~ ^(200|301|302|307|308)$ ]]; then
  ok "回應正常 (HTTP $code)"
else
  fail "異常 (HTTP $code)"
fi

# ── 4. Elasticsearch ──────────────────────────────────────────────────────────
title "Elasticsearch"
es_resp=$(curl -sf --max-time 5 "$ES/_cluster/health" 2>/dev/null || echo "")
if [[ -n "$es_resp" ]]; then
  es_status=$(echo "$es_resp" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  docs=$(curl -sf --max-time 5 "$ES/_cat/count/faq_*?h=count" 2>/dev/null | awk '{s+=$1} END {print s+0}')
  if [[ "$es_status" == "green" || "$es_status" == "yellow" ]]; then
    ok "集群狀態 $es_status，faq 文件數: $docs"
  else
    fail "集群狀態 $es_status"
  fi
else
  fail "無法連線 ($ES)"
fi

# ── 5. PostgreSQL ─────────────────────────────────────────────────────────────
title "PostgreSQL"
pg_resp=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT COUNT(*) FROM users;" \
  2>/dev/null || echo "")
users=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
chatbots=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM chatbots;" 2>/dev/null | tr -d ' ')
faqs=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT COUNT(*) FROM faqs;" 2>/dev/null | tr -d ' ')
if [[ -n "$users" && "$users" =~ ^[0-9]+$ ]]; then
  ok "連線正常 (users:$users, chatbots:$chatbots, faqs:$faqs)"
else
  fail "無法連線"
fi

# ── 6. OpenAI API ─────────────────────────────────────────────────────────────
title "OpenAI API"
OPENAI_KEY=$(grep '^OPENAI_API_KEY=' /home/frank_weng/ReadyQA/.env | cut -d= -f2-)
OPENAI_URL=$(grep '^OPENAI_API_URL=' /home/frank_weng/ReadyQA/.env | cut -d= -f2-)
OPENAI_URL="${OPENAI_URL:-https://api.openai.com/v1}"

openai_resp=$(curl -sf --max-time 10 \
  -H "Authorization: Bearer $OPENAI_KEY" \
  "$OPENAI_URL/models" 2>/dev/null || echo "")
if echo "$openai_resp" | grep -q '"id"'; then
  ok "API Key 有效，可正常呼叫"
else
  http_code=$(curl -so /dev/null --max-time 10 -w "%{http_code}" \
    -H "Authorization: Bearer $OPENAI_KEY" \
    "$OPENAI_URL/models" 2>/dev/null || echo "000")
  if [[ "$http_code" == "429" ]]; then
    fail "額度用完或達到 rate limit (HTTP 429)，請檢查 OpenAI 帳號"
  elif [[ "$http_code" == "401" ]]; then
    fail "API Key 無效 (HTTP 401)"
  else
    fail "API 異常 (HTTP $http_code)"
  fi
fi

# ── 7. 磁碟空間 ───────────────────────────────────────────────────────────────
title "磁碟空間"
usage=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
avail=$(df -h / | awk 'NR==2 {print $4}')
if [[ "$usage" -lt 80 ]]; then
  ok "使用 ${usage}%，剩餘 ${avail}"
elif [[ "$usage" -lt 90 ]]; then
  fail "警告：使用 ${usage}%，剩餘 ${avail}，請考慮清理"
else
  fail "危險：使用 ${usage}%，剩餘 ${avail}，請立即處理！"
fi

# ── 結果 ──────────────────────────────────────────────────────────────────────
echo ""
echo "========================================="
if [[ "$FAIL" -eq 0 ]]; then
  echo " 結果：全部正常 ✅  ($PASS 項通過)"
else
  echo " 結果：$FAIL 項異常 ❌  ($PASS 項通過，$FAIL 項失敗)"
fi
echo "========================================="
echo ""
