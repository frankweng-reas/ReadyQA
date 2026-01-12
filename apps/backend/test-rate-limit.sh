#!/bin/bash

# Rate Limiting 測試腳本
# 測試 QAPlus 的 Rate Limiting 功能

echo "========================================="
echo "QAPlus Rate Limiting 測試"
echo "========================================="
echo ""

BASE_URL="http://localhost:8000/api"
CHATBOT_ID="test-chatbot-id"

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "測試 1: Session Init API (20次/分鐘限制)"
echo "-----------------------------------"
echo "快速發送 25 次請求..."

success_count=0
rate_limited_count=0

for i in {1..25}; do
  response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/sessions/init" \
    -H "Content-Type: application/json" \
    -d "{\"chatbot_id\": \"$CHATBOT_ID\"}")
  
  http_code=$(echo "$response" | tail -n 1)
  
  if [ "$http_code" = "200" ]; then
    success_count=$((success_count + 1))
    printf "${GREEN}✓${NC} 請求 $i: 成功 (200)\n"
  elif [ "$http_code" = "429" ]; then
    rate_limited_count=$((rate_limited_count + 1))
    printf "${YELLOW}⚠${NC} 請求 $i: Rate Limited (429)\n"
  else
    printf "${RED}✗${NC} 請求 $i: 錯誤 ($http_code)\n"
  fi
done

echo ""
echo "結果："
echo "  成功: $success_count 次"
echo "  Rate Limited: $rate_limited_count 次"

if [ $rate_limited_count -gt 0 ]; then
  echo -e "${GREEN}✓ Rate Limiting 正常運作！${NC}"
else
  echo -e "${RED}✗ Rate Limiting 未生效${NC}"
fi

echo ""
echo "========================================="
echo "測試完成"
echo "========================================="
