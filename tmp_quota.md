# Plan Quota 限制說明

## 限制項目

**Chatbot 數量**
- 來源：`Plan.maxChatbots`
- 意義：租戶可創建的最大 chatbot 數量
- NULL 表示無限制

**FAQ 總數**
- 來源：`Plan.maxFaqsPerBot`（此欄位現代表整個 tenant 的 FAQ 總數）
- 意義：租戶下所有 chatbot 的 FAQ 合計上限
- 只計算 `status = active` 的 FAQ
- NULL 表示無限制

**每月 AI 查詢次數**
- 來源：`Plan.maxQueriesPerMo`
- 意義：租戶每月可使用的 AI 查詢與 FAQ 瀏覽總次數
- 統計範圍：本月 1 日 00:00 至今
- 只計算 `query_logs` 中 `ignored = false` 的記錄
- 若租戶無 chatbot，直接視為 0
- NULL 表示無限制

---

## 檢查時機

- 創建 Chatbot：檢查是否超過 maxChatbots
- 創建 FAQ（單筆）：檢查 tenant 的 active FAQ 總數是否超過 maxFaqsPerBot
- 批量上傳 FAQ：先過濾重複，再檢查「現有數量 + 本次新增數」是否超過 maxFaqsPerBot
- AI 對話查詢：檢查本月查詢次數是否超過 maxQueriesPerMo
- FAQ 瀏覽記錄：同上，共用查詢配額

---

## 計算邏輯

**Chatbot 數量**：統計該租戶下的 chatbot 數量

**FAQ 總數**：統計該租戶下所有 chatbot 的 FAQ，且只計 `status = active`

**每月查詢次數**：統計該租戶下所有 chatbot 的 query_logs，條件為本月建立、且 `ignored = false`

---

## 超限處理

- 超限時回傳 400 Bad Request，錯誤訊息為中文，提示升級方案
- 修改 `plans` 表的配額欄位即可調整，不需重啟服務
