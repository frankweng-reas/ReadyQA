# 查詢與 Feedback 記錄功能實作完成

## 📋 實作概述

完整實現了 end user 查詢與 feedback 記錄機制。

---

## ✅ 已實作功能

### 1. Session Token 驗證與管理

**檔案**: `apps/backend/src/sessions/sessions.service.ts`

新增方法：
- `verifyToken(token, chatbotId)` - 驗證 token 並返回 session 資訊
  - 檢查 token 是否存在
  - 檢查是否過期
  - 檢查 chatbot_id 是否匹配
  - 檢查查詢次數是否超過限制
  
- `incrementQueryCount(sessionId)` - 增加 session 的查詢次數

### 2. 查詢記錄 (QueryLog)

**檔案**: 
- `apps/backend/src/query/query.controller.ts`
- `apps/backend/src/query/query.service.ts`

**流程**:
```
用戶查詢 → 驗證 Session Token → 執行查詢 → 記錄 QueryLog → 增加 queryCount → 返回結果
```

**記錄內容**:
- `id` (自動生成的 UUID)
- `sessionId` (從 token 驗證取得)
- `chatbotId`
- `query` (用戶查詢文字)
- `resultsCnt` (返回的 FAQ 數量)
- `readCnt` (初始為 0，由 viewed 更新)
- `createdAt`

**重要**：只有提供有效 Session Token 時才會記錄！

### 3. Feedback 記錄 (QueryLogDetail)

**API**: `POST /query/log-faq-action`

**支援操作**:
- `viewed` - 展開 FAQ
- `not-viewed` - 未展開
- `like` - 有幫助
- `dislike` - 沒幫助

**記錄內容**:
- `logId` + `faqId` (複合主鍵)
- `userAction`
- `createdAt`

**當 action = 'viewed' 時**:
1. 更新 `QueryLog.readCnt`（統計該 log_id 的 viewed 數量）
2. 更新 `FAQ.hitCount` 和 `lastHitAt`

### 4. 直接瀏覽記錄 (log-faq-browse)

**API**: `POST /query/log-faq-browse`

**用途**: 用戶直接點擊 FAQ（非搜尋結果）時記錄

**流程**:
```
點擊 FAQ → 驗證 Session Token → 創建 QueryLog → 創建 QueryLogDetail → 更新 hitCount → 增加 queryCount
```

**記錄內容**:
- 創建 `QueryLog`（query = FAQ 的 question，resultsCnt = 1，readCnt = 1）
- 創建 `QueryLogDetail`（action = 'viewed'）
- 更新 `FAQ.hitCount` 和 `lastHitAt`
- 增加 `Session.queryCount`

---

## 📊 資料庫 Schema

### QueryLog (query_logs)
```prisma
model QueryLog {
  id              String    @id @default(dbgenerated("gen_random_uuid()"))
  sessionId       String    @db.Uuid
  chatbotId       String
  query           String
  resultsCnt      Int       @default(0)
  readCnt         Int       @default(0)
  ignored         Boolean   @default(false)
  createdAt       DateTime  @default(now())
  
  session         Session   @relation(...)
  chatbot         Chatbot   @relation(...)
  queryLogDetails QueryLogDetail[]
}
```

### QueryLogDetail (query_log_details)
```prisma
model QueryLogDetail {
  logId         String
  faqId         String
  userAction    String    // viewed, not-viewed, like, dislike
  createdAt     DateTime  @default(now())
  
  log           QueryLog  @relation(...)
  faq           Faq       @relation(...)
  
  @@id([logId, faqId])
}
```

### Session (sessions)
```prisma
model Session {
  id            String    @id @default(dbgenerated("gen_random_uuid()"))
  token         String    @unique
  chatbotId     String
  tenantId      String
  queryCount    Int       @default(0)  // ← 每次查詢時增加
  maxQueries    Int       @default(50)
  expiresAt     DateTime
  createdAt     DateTime  @default(now())
  
  queryLogs     QueryLog[]
}
```

---

## 🔄 完整流程圖

### 查詢流程
```
前端發送查詢
  ↓
[Header] Authorization: Bearer <session_token>
  ↓
QueryController.chat()
  ↓
驗證 Session Token → 取得 sessionId
  ↓
QueryService.chatWithContext(dto, sessionId)
  ↓
執行混合搜尋 + LLM 處理
  ↓
記錄 QueryLog（如果有 sessionId）
  ↓
增加 Session.queryCount
  ↓
返回結果（包含 log_id）
```

### Feedback 流程
```
前端點擊「有幫助」或展開 FAQ
  ↓
POST /query/log-faq-action
  ↓
QueryService.logFaqAction()
  ↓
插入/更新 QueryLogDetail
  ↓
如果是 viewed：
  - 更新 QueryLog.readCnt
  - 更新 FAQ.hitCount
```

### 直接瀏覽流程
```
前端點擊知識列表中的 FAQ
  ↓
POST /query/log-faq-browse
  ↓
驗證 Session Token（可選）
  ↓
QueryService.logFaqBrowse()
  ↓
創建 QueryLog（query = FAQ.question）
  ↓
創建 QueryLogDetail（action = 'viewed'）
  ↓
更新 FAQ.hitCount
  ↓
增加 Session.queryCount
```

---

## 🎯 功能對比

| 功能 | QAPlus | 狀態 |
|------|--------|------|
| 查詢記錄 | `query_logs` | ✅ 已實作 |
| Feedback 記錄 | `query_log_details` | ✅ 已實作 |
| Session 驗證 | `SessionsService.verifyToken()` | ✅ 已實作 |
| 查詢次數統計 | `session.queryCount` | ✅ 已實作 |
| 直接瀏覽記錄 | `/process-faq/log-faq-browse` | `/query/log-faq-browse` | ✅ 已實作 |
| FAQ 點擊統計 | `faqs.hit_count` | `faqs.hitCount` | ✅ 已實作 |

---

## 🧪 測試方法

### 方法 1: 使用測試腳本
```bash
./scripts/test-query-logging.sh
```

### 方法 2: 手動測試
參考 `TEST-QUERY-LOGGING.md` 中的詳細步驟。

### 方法 3: 資料庫驗證
```sql
-- 檢查查詢記錄
SELECT * FROM query_logs ORDER BY "createdAt" DESC LIMIT 10;

-- 檢查 feedback 記錄
SELECT * FROM query_log_details ORDER BY "createdAt" DESC LIMIT 10;

-- 檢查 session 查詢次數
SELECT id, token, "queryCount", "maxQueries" FROM sessions;

-- 檢查 FAQ 點擊統計
SELECT id, question, "hitCount", "lastHitAt" 
FROM faqs 
ORDER BY "hitCount" DESC LIMIT 10;
```

---

## ⚠️ 重要注意事項

### 1. Session Token 必須提供
沒有 Session Token 時：
- ✅ 查詢仍然可以執行
- ❌ 不會記錄 QueryLog
- ❌ 不會增加 queryCount
- ⚠️ Backend log 會顯示警告

### 2. 前端需要傳遞 Session Token
```typescript
// ChatbotWidget.tsx
const response = await fetch(`${API_URL}/query/chat`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`, // ← 必須提供
  },
  body: JSON.stringify({ query, chatbot_id })
});
```

### 3. log_id 的使用
- 查詢成功後，前端會收到 `log_id`
- 保存在 ChatMessage 中
- 傳遞給 QACard 用於記錄 feedback

### 4. 查詢次數限制
- 每個 Session 有 `maxQueries` 限制
- 超過限制時返回 `QUERY_LIMIT_EXCEEDED` 錯誤
- 需要創建新 Session 或延長現有 Session

---

## 📝 後續工作

### 前端整合
1. ✅ ChatbotWidget - 已保存 log_id
2. ✅ QACard - 已實作 logAction
3. ⚠️ 知識列表頁 - 需要調用 log-faq-browse API

### 後端優化
1. ⚠️ 考慮增加 rate limiting
2. ⚠️ 考慮增加查詢日誌的過期清理機制
3. ⚠️ 考慮增加統計分析 API

---

## 🎉 總結

✅ **完整實作了查詢與 Feedback 記錄機制**

包含：
1. Session Token 驗證與管理
2. 查詢記錄（QueryLog）
3. Feedback 記錄（QueryLogDetail）
4. 直接瀏覽記錄（log-faq-browse）
5. 查詢次數統計
6. FAQ 點擊統計

**關鍵差異**：
- QAPlus 使用 Prisma + PostgreSQL
- 使用 Prisma ORM + PostgreSQL
- 功能完全一致，但實作更優雅

**測試方式**：
- 使用 `./scripts/test-query-logging.sh` 快速測試
- 參考 `TEST-QUERY-LOGGING.md` 詳細測試步驟

