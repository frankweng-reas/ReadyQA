#!/bin/bash

echo "測試 Rate Limiting (3次/分鐘限制)"
echo "====================================="
echo ""

# 測試用的 chatbot ID
CHATBOT_ID="test123"

echo "快速發送 5 次請求..."
echo ""

for i in {1..5}; do
  echo -n "請求 $i: "
  
  response=$(curl -s -w "\n%{http_code}" -X POST "http://localhost:8000/api/sessions/init" \
    -H "Content-Type: application/json" \
    -d "{\"chatbot_id\": \"$CHATBOT_ID\"}" 2>&1)
  
  http_code=$(echo "$response" | tail -n 1)
  
  if [ "$http_code" = "200" ]; then
    echo "✓ 成功 (200)"
  elif [ "$http_code" = "404" ]; then
    echo "✓ Chatbot不存在但請求通過限制 (404)"
  elif [ "$http_code" = "429" ]; then
    echo "⚠ Rate Limited! (429)"
    body=$(echo "$response" | head -n -1)
    echo "   錯誤訊息: $(echo $body | grep -o '"message":"[^"]*"' | cut -d'"' -f4)"
  else
    echo "✗ 其他錯誤 ($http_code)"
  fi
  
  sleep 0.2
done

echo ""
echo "如果看到 429 錯誤，表示 Rate Limiting 正常運作！"
