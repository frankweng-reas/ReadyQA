#!/bin/bash

echo "========================================="
echo "Quota 檢查測試"
echo "========================================="
echo ""

CHATBOT_ID="1767688111182_dddqsliym"
API_URL="http://localhost:8000/api/query/chat"

echo "發送 5 次 AI 查詢請求（每次間隔 2 秒）..."
echo ""

for i in {1..5}; do
  echo "========== 請求 $i =========="
  RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"test quota $i\", \"chatbot_id\": \"$CHATBOT_ID\"}")
  
  # 檢查是否有配額錯誤
  if echo "$RESPONSE" | grep -q "每月查詢次數限制"; then
    echo "✅ Quota 阻擋成功！"
    echo "錯誤訊息: $(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'N/A'))")"
    break
  elif echo "$RESPONSE" | grep -q "qa_blocks"; then
    echo "✓ 請求成功"
  else
    echo "⚠ 其他回應: $RESPONSE"
  fi
  
  sleep 2
done

echo ""
echo "========================================="
echo "測試完成"
echo "========================================="
echo ""
echo "請檢查："
echo "1. 後端終端是否有 '[QuotaService]' 日誌"
echo "2. chatbot 是否有 tenant_id"
echo "3. free plan 的 max_queries_per_mo 是否為 3"
echo ""
