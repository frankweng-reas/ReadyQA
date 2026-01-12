#!/bin/bash

echo "測試 Quota 功能"
echo "====================================="
echo "注意：此測試假設租戶方案的每月查詢限制為 100 次"
echo ""

# Chatbot ID（請替換為你的實際 ID）
CHATBOT_ID="1767688111182_dddqsliym"

# API 端點
API_URL="http://localhost:8000/api/query/chat"

# 快速發送 5 次查詢請求
echo "====================================="
echo "步驟 1: 正常查詢測試（5 次）"
echo "====================================="

for i in {1..5}; do
  RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"測試問題 $i\", \"chatbot_id\": \"$CHATBOT_ID\"}")
  
  # 提取錯誤訊息
  ERROR=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"$//')
  
  if echo "$RESPONSE" | grep -q '"qa_blocks"'; then
    echo "請求 $i: ✓ 成功"
  elif echo "$ERROR" | grep -q "每月查詢次數限制"; then
    echo "請求 $i: ⚠ Quota 超限！錯誤訊息：$ERROR"
  elif echo "$ERROR" | grep -q "請求過於頻繁"; then
    echo "請求 $i: ⚠ Rate Limiting！錯誤訊息：$ERROR"
  else
    echo "請求 $i: ⚠ 其他錯誤：$ERROR"
  fi
  
  # 稍微延遲，避免 Rate Limiting 干擾測試
  sleep 6
done

echo ""
echo "====================================="
echo "步驟 2: 檢查本月查詢次數"
echo "====================================="
echo "請登入系統查看 Dashboard，確認查詢次數是否正確累計"
echo ""

echo "====================================="
echo "測試完成！"
echo "====================================="
echo ""
echo "預期結果："
echo "1. 前 5 次查詢應該成功（如果 Quota 未超限）"
echo "2. 如果超過每月限制，應該看到 '已達到每月查詢次數限制' 錯誤"
echo "3. 每次查詢都應該被記錄在 query_logs 表中（ignored = false）"
echo ""
