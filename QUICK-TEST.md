# 快速測試查詢記錄功能

## 問題排查

Backend 編譯成功但啟動有問題。請手動測試：

### 1. 啟動 Backend
```bash
cd /Users/fweng/qaplus/apps/backend
npm run dev
```

等待看到：
```
[Nest] xxx  - xx/xx/xxxx, x:xx:xx PM     LOG [NestApplication] Nest application successfully started
```

### 2. 測試 Session Init API
```bash
# 獲取 chatbot_id
CHATBOT_ID=$(curl -s http://localhost:3001/chatbots | jq -r '.data[0].id')
echo "Chatbot ID: $CHATBOT_ID"

# 初始化 Session
curl -X POST http://localhost:3001/sessions/init \
  -H "Content-Type: application/json" \
  -d "{\"chatbot_id\": \"$CHATBOT_ID\"}" | jq .

# 應該返回：
# {
#   "token": "...",
#   "expires_at": "...",
#   "max_queries": 50
# }
```

### 3. 測試查詢（帶 Session Token）
```bash
# 使用上面獲得的 token
TOKEN="你的_token_這裡"

curl -X POST http://localhost:3001/query/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"query\": \"測試查詢\",
    \"chatbot_id\": \"$CHATBOT_ID\"
  }" | jq .

# 應該返回：
# {
#   "intro": "...",
#   "qa_blocks": [...],
#   "log_id": "uuid-here"  ← 關鍵！
# }
```

### 4. 檢查資料庫
```sql
-- 檢查 sessions
SELECT * FROM sessions ORDER BY "createdAt" DESC LIMIT 5;

-- 檢查 query_logs（應該有記錄了！）
SELECT * FROM query_logs ORDER BY "createdAt" DESC LIMIT 10;

-- 檢查 session 的 queryCount
SELECT 
  id, 
  LEFT(token, 20) as token_prefix,
  "chatbotId", 
  "queryCount", 
  "maxQueries", 
  "createdAt"
FROM sessions 
ORDER BY "createdAt" DESC 
LIMIT 5;
```

---

## 前端測試

### 1. 確保 Frontend 運行
```bash
# 檢查
lsof -ti:3000

# 如果沒運行，啟動
cd /Users/fweng/qaplus/apps/frontend
npm run dev
```

### 2. 打開 Chatbot 頁面
```
http://localhost:3000/chatbot/你的chatbot_id
```

### 3. 打開瀏覽器開發者工具
- F12 或右鍵 → 檢查
- 切換到 Console 標籤

### 4. 發送查詢
輸入任何問題並發送，觀察 Console 輸出：
```
[ChatbotWidget] Session token 獲取成功，token 長度: 64
[ChatbotWidget] 完整 API URL: http://localhost:3001/query/chat
[ChatbotWidget] 收到回應: { intro: "...", qa_blocks: [...], log_id: "..." }
```

### 5. 檢查 localStorage
開發者工具 → Application 標籤 → Local Storage → http://localhost:3000

應該看到：
- `qaplus_session_token`
- `qaplus_session_token_chatbot`
- `qaplus_session_token_expires`

### 6. 再次檢查資料庫
```sql
SELECT * FROM query_logs ORDER BY "createdAt" DESC LIMIT 10;
```

**應該有記錄了！** 🎉

---

## 如果還是沒有記錄

### 檢查 Backend Log
查看 Backend console 輸出，應該看到：
```
[Query Chat] ✅ Session 驗證成功: session_id=xxx
[Chat] ✅ 已記錄搜尋日誌: log_id=xxx, session_id=xxx, results_count=x
[Chat] ✅ 已增加 session 查詢次數: session_id=xxx
```

### 檢查前端 Network
開發者工具 → Network 標籤 → 找到 `/query/chat` 請求

**Request Headers** 應該有：
```
Authorization: Bearer abc123...
```

**Response** 應該有：
```json
{
  "intro": "...",
  "qa_blocks": [...],
  "log_id": "uuid-here"
}
```

---

## 預期結果

✅ sessions 表有新記錄
✅ query_logs 表有新記錄
✅ session.queryCount 增加
✅ 前端 localStorage 有 token
✅ 前端收到 log_id

如果以上都正常，查詢記錄功能就完全正常了！

