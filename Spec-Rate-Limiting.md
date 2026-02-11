# QAPlus Rate Limiting & Quota 規格

## 📋 概述

QAPlus 使用雙層保護機制來保障系統穩定性和商業公平性：

1. **Rate Limiting**（速率限制）：防止瞬間攻擊和系統過載
2. **Quota**（配額限制）：控制每月總使用量，確保方案公平性

**技術架構：**
- Rate Limiting 框架：NestJS + `@nestjs/throttler`
- Quota 服務：`QuotaService` + Prisma ORM
- 識別方式：IP 地址（Rate Limiting）、租戶 ID（Quota）
- 時間窗口：60 秒滾動窗口（Rate Limiting）、每月累計（Quota）

---

## 🎯 限制設定

### Rate Limiting（速率限制）

- **`POST /api/query/chat`**：10 次/分鐘（AI 對話查詢，成本高）
- **`POST /api/query/log-faq-action`**：使用全局預設 60 次/分鐘（FAQ 操作記錄，輕量，無自訂限制）
- **`POST /api/query/log-faq-browse`**：30 次/分鐘（FAQ 瀏覽記錄）
- **`POST /api/sessions/init`**：20 次/分鐘（Session 初始化）

### Quota（配額限制）

- **Chatbot 數量**：`Plan.maxChatbots`，租戶可創建的最大 chatbot 數量，`NULL` = 無限制
- **FAQ 數量**：`Plan.maxFaqsPerBot`，tenant 的 FAQ 總數限制（只計算 active 狀態），`NULL` = 無限制
- **每月 AI 查詢次數**：`Plan.maxQueriesPerMo`，每月總查詢次數，`NULL` = 無限制

**適用端點：**
- `POST /api/chatbots` - 創建 Chatbot（檢查 `maxChatbots`）
- `POST /api/faqs` - 創建 FAQ（檢查 `maxFaqsPerBot`）
- `POST /api/faqs/bulk-upload` - 批量上傳 FAQ（檢查 `maxFaqsPerBot`）
- `POST /api/query/chat` - AI 對話查詢（檢查 `maxQueriesPerMo`）
- `POST /api/query/log-faq-browse` - FAQ 瀏覽（檢查 `maxQueriesPerMo`）

**執行順序：**
1. 先檢查 Rate Limiting（快速判斷）
2. 再檢查 Quota（資料庫查詢）
3. 通過檢查後，執行操作並記錄日誌

---

## 🔍 設計原則

### 1. 分層防護
```
第一層：Rate Limiting (技術保護)
  ↓ 防止瞬間攻擊（IP 級別）
第二層：Quota (商業限制)
  ↓ 控制每月總量（租戶級別）
資源：AI、資料庫、運算
```

### 2. 技術 vs 商業
- **Rate Limiting：** 技術保護，硬編碼在代碼中（快速判斷）
- **Quota：** 商業限制，從資料庫讀取（靈活調整）

### 3. 用戶友善
- 正常用戶不受影響
- 只在明顯濫用或超過方案限制時觸發
- 友好的中文錯誤訊息

---

## ⚙️ 實作細節

### Rate Limiting 配置

**`apps/backend/src/app.module.ts`**
```typescript
ThrottlerModule.forRoot({
  throttlers: [
    {
      name: 'default',
      ttl: 60000, // 60 秒（毫秒）
      limit: 60,  // 全局預設
    },
  ],
}),

providers: [
  {
    provide: APP_GUARD,
    useClass: ThrottlerGuard, // 全局啟用
  },
],
```

**`apps/backend/src/query/query.controller.ts`**
```typescript
@Post('chat')
@Throttle({ default: { limit: 10, ttl: 60000 } })
async chat(...) {
  // 步驟 1: 驗證 Session Token
  // 步驟 2: 檢查 Quota
  await this.quotaService.ensureQueryQuota(dto.chatbot_id);
  // 步驟 3: 執行查詢
}

@Post('log-faq-browse')
@Throttle({ default: { limit: 30, ttl: 60000 } })
async logFaqBrowse(...) {
  // 步驟 1: 驗證 Session Token（可選）
  // 步驟 2: 檢查 Quota
  await this.quotaService.ensureQueryQuota(dto.chatbot_id);
  // 步驟 3: 記錄 FAQ 瀏覽
}
```

### Quota 服務

**`apps/backend/src/common/quota.service.ts`**
```typescript
@Injectable()
export class QuotaService {
  /**
   * 檢查是否可以創建 Chatbot
   */
  async checkCanCreateChatbot(userId: number): Promise<QuotaCheckResult> {
    // 1. 獲取用戶的 tenant 和 plan 資訊
    // 2. 檢查 maxChatbots（NULL = 無限制）
    // 3. 統計當前 chatbot 數量
    // 4. 判斷是否超過限制
  }

  /**
   * 檢查是否可以創建 FAQ
   */
  async checkCanCreateFaq(chatbotId: string): Promise<QuotaCheckResult> {
    // 1. 獲取 chatbot 的 tenant 和 plan 資訊
    // 2. 檢查 maxFaqsPerBot（NULL = 無限制，此欄位代表整個 tenant 的 FAQ 總數限制）
    // 3. 統計 tenant 的 FAQ 總數（只計算 active 狀態）
    // 4. 判斷是否超過限制
  }

  /**
   * 檢查是否可以執行查詢
   */
  async checkCanQuery(chatbotId: string): Promise<QuotaCheckResult> {
    // 1. 獲取 tenant 和 plan 資訊
    // 2. 檢查 maxQueriesPerMo（NULL = 無限制）
    // 3. 統計本月查詢次數（ignored = false）
    // 4. 判斷是否超過限制
  }

  /**
   * 獲取租戶本月的查詢次數（從 query_logs 統計）
   */
  async getMonthlyQueryCount(tenantId: string): Promise<number> {
    // 若 tenant 無 chatbot，直接回傳 0
    // 統計本月 1 日至今的查詢次數（ignored = false）
  }
}
```

### 資料庫 Schema

**相關表：**
- `Plan`：方案配置（`maxChatbots`、`maxFaqsPerBot`、`maxQueriesPerMo`）
- `Tenant`：租戶資訊（關聯到 `Plan`）
- `Chatbot`：聊天機器人（關聯到 `Tenant`）
- `QueryLog`：查詢日誌（記錄每次查詢，欄位 `ignored = false` 才計入配額）

---

## 📊 對照 AnswerGO

**Rate Limiting：**
- AI 對話：AnswerGO 10 次/分鐘，QAPlus 10 次/分鐘（一致）
- FAQ 操作：AnswerGO 30 次/分鐘，QAPlus 使用全局預設 60 次/分鐘（更寬鬆）
- FAQ 瀏覽：AnswerGO 30 次/分鐘，QAPlus 30 次/分鐘（一致）
- Session Init：AnswerGO 20 次/分鐘，QAPlus 20 次/分鐘（一致）

**Quota：**
- 每月查詢配額：兩者皆從 Plan 讀取（一致）
- Session 查詢限制：兩者皆已移除（一致）
- 錯誤訊息：兩者皆為中文友好（一致）

---

## 🚫 錯誤回應

### Rate Limiting 超限

**HTTP 狀態碼：** `429 Too Many Requests`

**回應內容：**
```json
{
  "statusCode": 429,
  "message": "請求過於頻繁，請稍後再試。為了保護服務穩定性，我們限制了每個 IP 的請求頻率。",
  "error": "Too Many Requests"
}
```

### Quota 超限

**HTTP 狀態碼：** `400 Bad Request`

**回應內容：**
```json
{
  "statusCode": 400,
  "message": "已達到每月查詢次數限制，請升級方案",
  "error": "Bad Request"
}
```

**前端顯示：** 
- 中文：`抱歉，已達到每月查詢次數限制，請升級方案。請稍後再試。`
- 英文：`Sorry, monthly query limit reached, please upgrade your plan. Please try again later.`

---

## 🧪 測試

### Rate Limiting 測試

```bash
# 測試 /query/chat（10 次/分鐘）
cd apps/backend
./test-query-throttle.sh

# 測試 /sessions/init（20 次/分鐘）
./test-throttle.sh
```

### Quota 測試

```bash
# 測試每月查詢配額
cd apps/backend
./test-quota.sh
```

**測試步驟：**
1. 發送 5 次查詢請求（間隔 6 秒，避免 Rate Limiting）
2. 檢查是否正確記錄到 `query_logs` 表（`ignored = false`）
3. 模擬超過配額：修改 `Plan.maxQueriesPerMo` 為較小值（如 5）
4. 再次查詢，應該看到配額錯誤訊息

---

## ❓ 常見問題

### Q1: 為什麼需要兩層保護？
**A:** 
- **Rate Limiting：** 技術保護，防止瞬間攻擊（如：DDoS）
- **Quota：** 商業保護，確保方案公平性（如：免費方案 1000 次/月）

### Q2: Quota 如何計算？
**A:** 
- 統計本月 1 日 00:00:00 至今的所有查詢次數
- 只計算 `query_logs` 中 `ignored = false` 的記錄
- 每次 AI 查詢成功後，自動記錄日誌

### Q3: 如何調整方案配額？
**A:** 
- 修改資料庫 `plans` 表的配額欄位：
  - `maxChatbots` - Chatbot 數量限制
  - `maxFaqsPerBot` - tenant 的 FAQ 總數限制
  - `maxQueriesPerMo` - 每月查詢次數限制
- `NULL` = 無限制
- 不需要重啟服務，即時生效

### Q6: FAQ 數量如何計算？
**A:** 
- 統計整個 tenant 下所有 chatbot 的 FAQ 總數
- 只計算 `status = 'active'` 的 FAQ
- 已刪除或停用的 FAQ 不計入配額

### Q4: 為什麼 log-faq-action 不限制？
**A:** 輕量操作（只寫資料庫），不會造成系統負擔。數據品質應由業務邏輯保證（如：同一 session 只能 like 一次）。

### Q5: Session 還有查詢次數限制嗎？
**A:** 
- ❌ 已移除（原本是 50 次/30 分鐘）
- ✅ 改用 Rate Limiting + Quota
- 更靈活、更公平、更易於管理

---

## 🔄 後續規劃

### 已完成
- ✅ Rate Limiting 實作
- ✅ Quota 機制實作（查詢、Chatbot、FAQ）
- ✅ 移除 Session 查詢次數限制
- ✅ 自定義中文錯誤訊息
- ✅ 整合到 `/chatbots`, `/faqs`, `/query/chat`, `/query/log-faq-browse` 端點
- ✅ Chatbot 數量限制（`maxChatbots`）
- ✅ FAQ 數量限制（`maxFaqsPerBot`，tenant 總量）
- ✅ 批量上傳 FAQ 配額檢查

### 待實作
- ⏳ 後台監控 Dashboard
  - 顯示 Rate Limiting 觸發統計
  - 顯示每月配額使用情況
  - 異常 IP 偵測
- ⏳ 配額預警通知
  - 達到 80% 時發送通知
  - 達到 100% 時提示升級

---

## 📝 變更歷史

**2026-01-12**
- 實作 Rate Limiting 功能
- 實作 Quota 機制（每月查詢配額）
- 參考 AnswerGO 設定限制值
- 移除 Session 查詢次數限制（50 次/30 分鐘）
- 移除 log-faq-action 的 rate limiting
- **為 log-faq-browse 添加 Quota 檢查**（與 AnswerGO 一致）
- **添加 Chatbot 數量配額控制**（`maxChatbots`）
- **添加 FAQ 數量配額控制**（`maxFaqsPerBot`）
- 添加自定義中文錯誤訊息
- 創建 `QuotaService` 服務
- 整合到 `/chatbots`, `/faqs`, `/query/chat` 和 `/query/log-faq-browse` 端點
- 創建 `ErrorDialog` 組件顯示錯誤訊息
- 更新翻譯檔（`zh-TW.json`, `en.json`）

---

## 📚 參考資料

- [NestJS Throttler 官方文檔](https://docs.nestjs.com/security/rate-limiting)
- AnswerGO 實作：
  - Rate Limiting: `/Users/fweng/answergo/backend/app/utils/rate_limit.py`
  - Quota Service: `/Users/fweng/answergo/backend/app/services/quota_service.py`
- QAPlus 相關文檔：
  - Session Token: `SESSION-TOKEN-IMPLEMENTATION.md`
  - Database Schema: `apps/backend/prisma/schema.prisma`

