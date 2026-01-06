# 查詢記錄功能測試指南

## 修復內容

### 1. Session Token 驗證
- ✅ `SessionsService.verifyToken()` - 驗證 token 並返回 session_id
- ✅ `SessionsService.incrementQueryCount()` - 增加查詢次數
- ✅ `QueryController.chat()` - 驗證 token 並取得 sessionId

### 2. 查詢記錄
- ✅ `QueryService.chatWithContext()` - 記錄 QueryLog 並增加 session.queryCount
- ✅ 只有提供有效 session token 時才會記錄

### 3. Feedback 記錄
- ✅ `QueryService.logFaqAction()` - 記錄 viewed/like/dislike
- ✅ 更新 QueryLog.readCnt 和 FAQ.hitCount

### 4. 直接瀏覽記錄
- ✅ `POST /query/log-faq-browse` - 記錄直接點擊 FAQ
- ✅ `QueryService.logFaqBrowse()` - 創建 QueryLog + QueryLogDetail

---

## 測試步驟

### 前置準備
1. 確保 Backend 正在運行
2. 確保有測試用的 Chatbot 和 FAQ
3. 需要有效的 Session Token

### 測試 1: 查詢記錄（有 Session Token）

```bash
# 1. 創建 Session（如果還沒有）
curl -X POST http://localhost:3001/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "chatbotId": "YOUR_CHATBOT_ID",
    "tenantId": "YOUR_TENANT_ID",
    "token": "test-session-token-123",
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "maxQueries": 50
  }'

# 2. 發送查詢（帶 Session Token）
curl -X POST http://localhost:3001/query/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-session-token-123" \
  -d '{
    "query": "測試查詢",
    "chatbot_id": "YOUR_CHATBOT_ID"
  }'

# 預期結果：
# - 返回 log_id
# - query_logs 表有新記錄
# - session.queryCount 增加 1
```

### 測試 2: 查詢記錄（無 Session Token）

```bash
# 發送查詢（不帶 Session Token）
curl -X POST http://localhost:3001/query/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "測試查詢",
    "chatbot_id": "YOUR_CHATBOT_ID"
  }'

# 預期結果：
# - 返回結果但 log_id 為 null
# - query_logs 表沒有新記錄
# - 後端 log 顯示 "沒有 session_id，跳過記錄搜尋日誌"
```

### 測試 3: Feedback 記錄

```bash
# 記錄 viewed 操作
curl -X POST http://localhost:3001/query/log-faq-action \
  -H "Content-Type: application/json" \
  -d '{
    "log_id": "YOUR_LOG_ID",
    "faq_id": "YOUR_FAQ_ID",
    "action": "viewed"
  }'

# 記錄 like 操作
curl -X POST http://localhost:3001/query/log-faq-action \
  -H "Content-Type: application/json" \
  -d '{
    "log_id": "YOUR_LOG_ID",
    "faq_id": "YOUR_FAQ_ID",
    "action": "like"
  }'

# 預期結果：
# - query_log_details 表有新記錄
# - query_logs.readCnt 更新（如果是 viewed）
# - faqs.hitCount 增加（如果是 viewed）
```

### 測試 4: 直接瀏覽記錄

```bash
# 記錄直接點擊 FAQ（帶 Session Token）
curl -X POST http://localhost:3001/query/log-faq-browse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-session-token-123" \
  -d '{
    "chatbot_id": "YOUR_CHATBOT_ID",
    "faq_id": "YOUR_FAQ_ID"
  }'

# 預期結果：
# - 返回 log_id
# - query_logs 表有新記錄（query = FAQ 的 question）
# - query_log_details 表有新記錄（action = 'viewed'）
# - faqs.hitCount 增加
# - session.queryCount 增加 1
```

---

## 資料庫驗證

### 檢查 query_logs
```sql
SELECT * FROM query_logs ORDER BY "createdAt" DESC LIMIT 10;
```

### 檢查 query_log_details
```sql
SELECT * FROM query_log_details ORDER BY "createdAt" DESC LIMIT 10;
```

### 檢查 session.queryCount
```sql
SELECT id, token, "queryCount", "maxQueries" FROM sessions;
```

### 檢查 FAQ hitCount
```sql
SELECT id, question, "hitCount", "lastHitAt" FROM faqs ORDER BY "hitCount" DESC LIMIT 10;
```

---

## 常見問題

### 1. query_logs 沒有記錄
- 檢查是否提供了有效的 Session Token
- 檢查 Backend log 是否顯示 "沒有 session_id"

### 2. Session Token 驗證失敗
- 檢查 token 是否正確
- 檢查 session 是否過期
- 檢查 chatbot_id 是否匹配

### 3. queryCount 沒有增加
- 檢查 query.service.ts 是否正確更新
- 檢查是否有錯誤 log

---

## 前端整合

### ChatbotWidget
前端已經在 `handleSendMessage` 中保存 `log_id`：

```typescript
const data = await response.json();
setMessages(prev => [
  ...prev,
  {
    type: 'assistant',
    content: '',
    qa_blocks: data.qa_blocks || [],
    intro: data.intro,
    log_id: data.log_id, // ✅ 已保存
  },
]);
```

### QACard
前端已經實作 `logAction` 函數：

```typescript
const logAction = async (action: 'viewed' | 'like' | 'dislike') => {
  if (!log_id || !faq_id) return;
  
  await fetch(`${API_URL}/query/log-faq-action`, {
    method: 'POST',
    body: JSON.stringify({ log_id, faq_id, action })
  });
};
```

### 知識列表頁（待實作）
需要在點擊 FAQ 時調用 `log-faq-browse` API。

---

## 總結

✅ 已修復：
1. Session Token 驗證並取得 sessionId
2. 查詢時記錄 QueryLog 並增加 session.queryCount
3. Feedback 記錄（viewed/like/dislike）
4. 直接瀏覽記錄（log-faq-browse API）

⚠️ 注意：
- 沒有 Session Token 時不會記錄（符合設計）
- 前端需要在發送查詢時帶上 Session Token
- 知識列表頁需要實作 log-faq-browse 調用

