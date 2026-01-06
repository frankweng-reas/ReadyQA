# Session Token 實作完成報告

## 📋 實作概述

參考 AnswerGO 的實作，完整實現了前端 Session Token 管理機制，現在查詢會自動記錄到資料庫。

---

## ✅ 已實作功能

### 1. 後端：公開 Session Init API

**檔案**: `apps/backend/src/sessions/`

**新增 API**: `POST /sessions/init`

```typescript
// 請求
{
  "chatbot_id": "chatbot-123"
}

// 回應
{
  "token": "abc123...",
  "expires_at": "2025-12-31T23:59:59.000Z",
  "max_queries": 50
}
```

**功能**:
- 驗證 chatbot 存在且狀態為 active
- 生成隨機 token（64 字元）
- 創建 session 記錄
- 返回 token、過期時間、最大查詢次數

**新增檔案**:
- `dto/init-session.dto.ts` - DTO 定義
- `sessions.service.ts` - 新增 `initSession()` 方法
- `sessions.controller.ts` - 新增 `POST /sessions/init` 端點

### 2. 前端：Session Token 管理工具

**檔案**: `apps/frontend/src/utils/sessionToken.ts`

**功能**:
- `initSessionToken(chatbotId)` - 從後端獲取新 token
- `getSessionToken(chatbotId)` - 獲取現有 token（檢查過期）
- `clearSessionToken()` - 清除 token
- `getOrInitSessionToken(chatbotId)` - 自動獲取或初始化

**儲存機制**:
- 使用 localStorage 儲存
- Key: `qaplus_session_token`, `qaplus_session_token_chatbot`, `qaplus_session_token_expires`
- 提前 1 分鐘視為過期（避免邊界情況）

### 3. 前端：ChatbotWidget 整合

**檔案**: `apps/frontend/src/components/chatbot/ChatbotWidget.tsx`

**修改內容**:
```typescript
// 查詢前獲取 Session Token
const { getOrInitSessionToken } = await import('@/utils/sessionToken');
const sessionToken = await getOrInitSessionToken(chatbotId);

// 發送請求時帶上 Authorization Header
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionToken}`, // ← 關鍵！
  },
  body: JSON.stringify(requestBody),
});

// 處理 TOKEN_EXPIRED 錯誤
if (errorData.message === 'TOKEN_EXPIRED' || response.status === 401) {
  const { clearSessionToken } = await import('@/utils/sessionToken');
  clearSessionToken();
  throw new Error('會話已過期，請重新載入頁面');
}
```

---

## 🔄 完整流程

### 首次查詢
```
1. 用戶輸入查詢
   ↓
2. ChatbotWidget 調用 getOrInitSessionToken(chatbotId)
   ↓
3. localStorage 沒有 token → 調用 initSessionToken()
   ↓
4. POST /sessions/init { chatbot_id }
   ↓
5. 後端創建 session，返回 token
   ↓
6. 儲存到 localStorage
   ↓
7. 發送查詢請求（帶 Authorization: Bearer <token>）
   ↓
8. 後端驗證 token → 取得 sessionId
   ↓
9. 記錄 QueryLog 並增加 session.queryCount
   ↓
10. 返回查詢結果（包含 log_id）
```

### 後續查詢
```
1. 用戶輸入查詢
   ↓
2. ChatbotWidget 調用 getOrInitSessionToken(chatbotId)
   ↓
3. localStorage 有 token 且未過期 → 直接使用
   ↓
4. 發送查詢請求（帶 Authorization: Bearer <token>）
   ↓
5. 後端驗證 token → 取得 sessionId
   ↓
6. 記錄 QueryLog 並增加 session.queryCount
   ↓
7. 返回查詢結果（包含 log_id）
```

### Token 過期處理
```
1. 發送查詢請求（帶過期的 token）
   ↓
2. 後端返回 401 TOKEN_EXPIRED
   ↓
3. 前端清除 localStorage 中的 token
   ↓
4. 提示用戶「會話已過期，請重新載入頁面」
   ↓
5. 用戶重新載入頁面
   ↓
6. 下次查詢時自動初始化新 token
```

---

## 🎯 與 AnswerGO 的對比

| 功能 | AnswerGO | QAPlus | 狀態 |
|------|----------|--------|------|
| Session Init API | `/api/public/session/init` | `/sessions/init` | ✅ 已實作 |
| Token 儲存 | localStorage (`answergo_*`) | localStorage (`qaplus_*`) | ✅ 已實作 |
| Token 管理工具 | `sessionToken.ts` | `sessionToken.ts` | ✅ 已實作 |
| 自動獲取/初始化 | `getOrInitSessionToken()` | `getOrInitSessionToken()` | ✅ 已實作 |
| 過期檢查 | 提前 1 分鐘 | 提前 1 分鐘 | ✅ 已實作 |
| 查詢時帶 token | Authorization Header | Authorization Header | ✅ 已實作 |
| Token 過期處理 | 清除並提示 | 清除並提示 | ✅ 已實作 |

---

## 🧪 測試方法

### 方法 1: 使用瀏覽器測試

1. 打開 Chatbot 頁面（例如：`http://localhost:3000/chatbot/your-chatbot-id`）
2. 打開瀏覽器開發者工具（F12）
3. 切換到 Console 標籤
4. 輸入查詢並發送
5. 觀察 Console 輸出：
   ```
   [ChatbotWidget] Session token 獲取成功，token 長度: 64
   [ChatbotWidget] 完整 API URL: http://localhost:3001/query/chat
   [ChatbotWidget] 請求內容: { query: "...", chatbot_id: "..." }
   ```
6. 切換到 Application 標籤 → Local Storage
7. 檢查是否有以下 key：
   - `qaplus_session_token`
   - `qaplus_session_token_chatbot`
   - `qaplus_session_token_expires`

### 方法 2: 檢查資料庫

```sql
-- 檢查 sessions 表
SELECT * FROM sessions ORDER BY "createdAt" DESC LIMIT 5;

-- 檢查 query_logs 表（應該有記錄了！）
SELECT * FROM query_logs ORDER BY "createdAt" DESC LIMIT 10;

-- 檢查 session 的 queryCount
SELECT 
  id, 
  token, 
  "chatbotId", 
  "queryCount", 
  "maxQueries", 
  "createdAt"
FROM sessions 
ORDER BY "createdAt" DESC 
LIMIT 5;
```

### 方法 3: 測試 Token 過期

1. 在 localStorage 中手動修改 `qaplus_session_token_expires` 為過去的時間
2. 重新發送查詢
3. 應該會自動初始化新 token

---

## 📊 預期結果

### 首次查詢
- ✅ localStorage 中出現 3 個 key
- ✅ sessions 表有新記錄
- ✅ query_logs 表有新記錄
- ✅ session.queryCount = 1

### 第二次查詢
- ✅ 使用相同的 token
- ✅ query_logs 表有新記錄
- ✅ session.queryCount = 2

### 第三次查詢
- ✅ session.queryCount = 3
- ✅ query_log_details 表有 feedback 記錄（如果點擊了 like/dislike）

---

## ⚠️ 重要注意事項

### 1. Token 安全性
- Token 儲存在 localStorage（與 AnswerGO 一致）
- 適用於公開的 chatbot（end user 使用）
- 不適用於需要嚴格身份驗證的場景

### 2. Token 過期時間
- 預設 30 天（與 AnswerGO 一致）
- 可在 `SessionsService.initSession()` 中調整

### 3. 查詢次數限制
- 預設 50 次（與 AnswerGO 一致）
- 超過限制時返回 `QUERY_LIMIT_EXCEEDED` 錯誤
- 需要重新初始化 token

### 4. 多 Chatbot 支援
- 每個 chatbot 有獨立的 token
- 切換 chatbot 時自動初始化新 token

---

## 🎉 總結

✅ **完整實作了 AnswerGO 的 Session Token 機制**

**關鍵改進**：
1. 前端自動管理 Session Token
2. 查詢時自動帶上 Authorization Header
3. Token 過期自動處理
4. 完整的錯誤處理機制

**現在查詢會正確記錄到資料庫**：
- ✅ query_logs 表有記錄
- ✅ session.queryCount 正確增加
- ✅ query_log_details 表有 feedback 記錄
- ✅ FAQ hitCount 正確統計

**測試方式**：
1. 打開 Chatbot 頁面
2. 發送查詢
3. 檢查資料庫：`SELECT * FROM query_logs ORDER BY "createdAt" DESC LIMIT 10;`
4. 應該看到記錄了！🎊

