#!/bin/bash

echo "測試 /query/chat Rate Limiting (3次/分鐘限制)"
echo "=============================================="
echo ""

CHATBOT_ID="test123"

echo "快速發送 5 次查詢請求..."
echo ""

for i in {1..5}; do
  echo -n "請求 $i: "
  
  response=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:8000/api/query/chat" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"測試問題\", \"chatbot_id\": \"$CHATBOT_ID\"}" 2>&1)
  
  http_code=$(echo "$response" | tail -n 1)
  
  if [ "$http_code" = "200" ]; then
    echo "✓ 成功 (200)"
  elif [ "$http_code" = "404" ] || [ "$http_code" = "400" ]; then
    echo "✓ 業務錯誤但請求通過限制 ($http_code)"
  elif [ "$http_code" = "429" ]; then
    echo "⚠ Rate Limited! (429) ← 正確！"
    body=$(echo "$response" | head -n -1)
    msg=$(echo "$body" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', ''))" 2>/dev/null || echo "")
    if [ -n "$msg" ]; then
      echo "   訊息: $msg"
    fi
  else
    echo "✗ 其他錯誤 ($http_code)"
  fi
  
  sleep 0.1
done

echo ""
echo "====================================="
echo "如果第 4-5 次看到 429 錯誤，表示成功！"
echo "====================================="
