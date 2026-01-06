#!/bin/bash

# 查詢記錄功能測試腳本
# 使用方法: ./scripts/test-query-logging.sh

set -e

API_URL="http://localhost:3001"

# 顏色輸出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}查詢記錄功能測試${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 1. 檢查是否有 Chatbot
echo -e "${YELLOW}步驟 1: 檢查 Chatbot...${NC}"
CHATBOT_RESPONSE=$(curl -s "${API_URL}/chatbots")
CHATBOT_ID=$(echo $CHATBOT_RESPONSE | jq -r '.data[0].id // empty')

if [ -z "$CHATBOT_ID" ]; then
  echo -e "${RED}❌ 找不到 Chatbot，請先創建 Chatbot${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 找到 Chatbot: ${CHATBOT_ID}${NC}"
echo ""

# 2. 獲取 Tenant ID
echo -e "${YELLOW}步驟 2: 獲取 Tenant ID...${NC}"
TENANT_ID=$(echo $CHATBOT_RESPONSE | jq -r '.data[0].tenantId // empty')

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ 找不到 Tenant ID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant ID: ${TENANT_ID}${NC}"
echo ""

# 3. 創建測試 Session
echo -e "${YELLOW}步驟 3: 創建測試 Session...${NC}"
SESSION_TOKEN="test-session-$(date +%s)"
EXPIRES_AT=$(date -u -v+30d +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+30 days" +"%Y-%m-%dT%H:%M:%S.000Z")

SESSION_RESPONSE=$(curl -s -X POST "${API_URL}/sessions" \
  -H "Content-Type: application/json" \
  -d "{
    \"chatbotId\": \"${CHATBOT_ID}\",
    \"tenantId\": \"${TENANT_ID}\",
    \"token\": \"${SESSION_TOKEN}\",
    \"expiresAt\": \"${EXPIRES_AT}\",
    \"maxQueries\": 50
  }")

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.data.id // empty')

if [ -z "$SESSION_ID" ]; then
  echo -e "${RED}❌ 創建 Session 失敗${NC}"
  echo $SESSION_RESPONSE | jq .
  exit 1
fi

echo -e "${GREEN}✅ Session 創建成功${NC}"
echo -e "   Session ID: ${SESSION_ID}"
echo -e "   Token: ${SESSION_TOKEN}"
echo ""

# 4. 測試查詢（帶 Session Token）
echo -e "${YELLOW}步驟 4: 測試查詢（帶 Session Token）...${NC}"
QUERY_RESPONSE=$(curl -s -X POST "${API_URL}/query/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -d "{
    \"query\": \"測試查詢 - $(date +%H:%M:%S)\",
    \"chatbot_id\": \"${CHATBOT_ID}\"
  }")

LOG_ID=$(echo $QUERY_RESPONSE | jq -r '.log_id // empty')

if [ -z "$LOG_ID" ]; then
  echo -e "${RED}❌ 查詢失敗或沒有返回 log_id${NC}"
  echo $QUERY_RESPONSE | jq .
else
  echo -e "${GREEN}✅ 查詢成功，log_id: ${LOG_ID}${NC}"
  
  QA_BLOCKS=$(echo $QUERY_RESPONSE | jq -r '.qa_blocks | length')
  echo -e "   返回 ${QA_BLOCKS} 個 QA Block"
fi
echo ""

# 5. 檢查資料庫記錄
echo -e "${YELLOW}步驟 5: 檢查資料庫記錄...${NC}"
echo -e "${GREEN}請手動執行以下 SQL 檢查：${NC}"
echo ""
echo "-- 檢查 query_logs"
echo "SELECT * FROM query_logs WHERE \"sessionId\" = '${SESSION_ID}' ORDER BY \"createdAt\" DESC LIMIT 5;"
echo ""
echo "-- 檢查 session.queryCount"
echo "SELECT id, token, \"queryCount\", \"maxQueries\" FROM sessions WHERE id = '${SESSION_ID}';"
echo ""

# 6. 測試 FAQ Action（如果有 log_id）
if [ -n "$LOG_ID" ]; then
  FAQ_ID=$(echo $QUERY_RESPONSE | jq -r '.qa_blocks[0].faq_id // empty')
  
  if [ -n "$FAQ_ID" ]; then
    echo -e "${YELLOW}步驟 6: 測試 FAQ Action...${NC}"
    
    # 測試 viewed
    ACTION_RESPONSE=$(curl -s -X POST "${API_URL}/query/log-faq-action" \
      -H "Content-Type: application/json" \
      -d "{
        \"log_id\": \"${LOG_ID}\",
        \"faq_id\": \"${FAQ_ID}\",
        \"action\": \"viewed\"
      }")
    
    if [ "$(echo $ACTION_RESPONSE | jq -r '.success')" = "true" ]; then
      echo -e "${GREEN}✅ 記錄 viewed 成功${NC}"
    else
      echo -e "${RED}❌ 記錄 viewed 失敗${NC}"
      echo $ACTION_RESPONSE | jq .
    fi
    
    # 測試 like
    sleep 1
    ACTION_RESPONSE=$(curl -s -X POST "${API_URL}/query/log-faq-action" \
      -H "Content-Type: application/json" \
      -d "{
        \"log_id\": \"${LOG_ID}\",
        \"faq_id\": \"${FAQ_ID}\",
        \"action\": \"like\"
      }")
    
    if [ "$(echo $ACTION_RESPONSE | jq -r '.success')" = "true" ]; then
      echo -e "${GREEN}✅ 記錄 like 成功${NC}"
    else
      echo -e "${RED}❌ 記錄 like 失敗${NC}"
      echo $ACTION_RESPONSE | jq .
    fi
    
    echo ""
    echo -e "${GREEN}請手動執行以下 SQL 檢查：${NC}"
    echo ""
    echo "-- 檢查 query_log_details"
    echo "SELECT * FROM query_log_details WHERE \"logId\" = '${LOG_ID}';"
    echo ""
    echo "-- 檢查 FAQ hitCount"
    echo "SELECT id, question, \"hitCount\", \"lastHitAt\" FROM faqs WHERE id = '${FAQ_ID}';"
    echo ""
  fi
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}測試完成！${NC}"
echo -e "${GREEN}========================================${NC}"

