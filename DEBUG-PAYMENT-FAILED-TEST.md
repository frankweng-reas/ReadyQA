# Debug 頁面 - 付款失敗測試功能說明

## 📍 位置
`http://localhost:3000/zh-TW/debug`

## 🎯 新增測試區塊：步驟 3-5 - 付款失敗測試

### 測試項目
1. ✅ 觸發 invoice.payment_failed webhook 事件
2. ✅ 檢查失敗的 Payment 記錄是否建立
3. ✅ 檢查訂閱狀態是否更新為 past_due
4. ✅ 檢查 Dashboard 是否顯示付款失敗警告

### 測試按鈕

#### 1. ⚠️ 觸發付款失敗 (webhook)
- **功能**: 提示用戶手動執行 `stripe trigger invoice.payment_failed`
- **API**: 無（需手動執行 Stripe CLI 命令）
- **前置條件**: 需要有 active 或 trialing 訂閱
- **後端調用**: 無（由 Stripe CLI 直接觸發 webhook）

#### 2. 📋 查看付款失敗資訊
- **功能**: 調用已實作的 `getPaymentFailedInfo` API
- **API**: `GET /api/stripe/payment-failed-info`
- **回應資訊**:
  - `hasFailedPayment`: 是否有失敗付款
  - `subscriptionStatus`: 訂閱狀態
  - `failedInvoices`: 失敗發票列表（含原因、金額、下次重試時間）
  - `canRetry`: 是否可重試
- **顯示方式**: Process Log + Alert

#### 3. 📄 查看失敗發票列表
- **功能**: 調用已實作的 `getFailedInvoices` API
- **API**: `GET /api/stripe/failed-invoices`
- **回應資訊**:
  - 所有失敗發票的詳細列表
  - 每筆發票包含：invoiceId、金額、狀態、原因、失敗時間、下次重試時間、發票 URL
- **顯示方式**: Process Log + Alert

## 🎨 UI 改進

### Payment 狀態顏色
更新了 Payment 表格的狀態顯示，根據不同狀態顯示不同顏色：
- ✅ `succeeded`: 綠色 (bg-green-100 text-green-800)
- ❌ `failed`: 紅色 (bg-red-100 text-red-800)
- ⏳ `pending`: 黃色 (bg-yellow-100 text-yellow-800)
- ⚪ 其他: 灰色 (bg-gray-100 text-gray-800)

## 📋 測試步驟

### 完整測試流程

1. **前置準備**
   ```bash
   # Terminal 1: 啟動 Stripe webhook 監聽
   stripe listen --forward-to http://localhost:8000/api/stripe/webhook
   
   # Terminal 2: 確保 Backend 正在運行
   cd apps/backend
   npm run start:dev
   
   # Terminal 3: 確保 Frontend 正在運行  
   cd apps/frontend
   npm run dev
   ```

2. **建立測試訂閱**
   - 前往 `http://localhost:3000/zh-TW/debug`
   - 執行「步驟 3-1」建立 Starter 訂閱
   - 確認訂閱狀態為 `active`

3. **觸發付款失敗**
   - 點擊「⚠️ 觸發付款失敗 (webhook)」按鈕
   - 根據提示，在 Terminal 執行：
     ```bash
     stripe trigger invoice.payment_failed
     ```
   - 觀察 Stripe CLI 的 webhook 日誌

4. **查看付款失敗資訊**
   - 點擊「📋 查看付款失敗資訊」按鈕
   - 檢查 Process Log 中的資訊：
     - `hasFailedPayment` 應為 `true`
     - `subscriptionStatus` 應為 `past_due`
     - 查看失敗原因
     - 查看下次重試時間

5. **查看失敗發票列表**
   - 點擊「📄 查看失敗發票列表」按鈕
   - 檢查 Process Log 中顯示的所有失敗發票
   - 確認每筆發票的詳細資訊

6. **檢查資料庫記錄**
   - 在 Debug 頁面的「Payments」區塊
   - 應該看到新的 payment 記錄，狀態為 `failed`（紅色標籤）
   - 在「Subscriptions」區塊
   - 應該看到訂閱狀態變更為 `past_due`

7. **檢查 Dashboard 警告**
   - 前往 `http://localhost:3000/zh-TW/dashboard`
   - 應該看到黃色的付款失敗警告橫幅（PaymentFailedBanner）
   - 點擊「更新付款方式」按鈕測試
   - 點擊「查看詳情」查看失敗原因

## 🔧 技術實作細節

### 新增函數
1. **handleTestPaymentFailed()**
   - 提示用戶手動執行 stripe trigger 命令
   - 顯示測試說明

2. **handleGetPaymentFailedInfo()**
   - 調用 `/api/stripe/payment-failed-info` 端點
   - 顯示完整的付款失敗資訊
   - 格式化輸出到 Process Log

3. **handleGetFailedInvoices()**
   - 調用 `/api/stripe/failed-invoices` 端點
   - 顯示所有失敗發票的詳細列表
   - 格式化輸出到 Process Log

### 修改內容
- ✅ 新增步驟 3-5 測試區塊
- ✅ 新增 3 個測試按鈕
- ✅ 新增 3 個處理函數
- ✅ 更新 DebugData 介面（添加 `cancelAtPeriodEnd`）
- ✅ 改進 Payment 狀態的顏色顯示
- ✅ 添加詳細的測試說明和步驟

## ✅ 驗證結果

### 編譯狀態
- ✅ TypeScript 編譯成功
- ✅ 程式碼行數：1336 行
- ✅ 語法檢查通過

### 整合測試點
1. ✅ 調用已實作的 `stripeApi.getPaymentFailedInfo()`
2. ✅ 調用已實作的 `stripeApi.getFailedInvoices()`
3. ✅ 與現有的 Debug 頁面功能完美整合
4. ✅ UI 風格與其他測試步驟一致

## 📝 注意事項

1. **Stripe CLI 必須運行**
   - 測試前確保 `stripe listen` 正在運行
   - webhook 端點：`http://localhost:8000/api/stripe/webhook`

2. **需要 Active 訂閱**
   - 付款失敗測試需要先有 active 或 trialing 訂閱
   - 如果沒有訂閱，按鈕會被禁用

3. **測試環境**
   - 使用 Stripe 測試模式
   - 不會影響真實付款

4. **錯誤處理**
   - 所有函數都有完整的錯誤處理
   - 錯誤訊息會顯示在 Process Log 和 Alert 中

## 🎉 總結

成功在 Debug 頁面新增了完整的付款失敗測試功能：
- ✅ 3 個測試按鈕
- ✅ 3 個處理函數  
- ✅ 完整的 UI 指引
- ✅ 調用已實作的 API
- ✅ 改進的視覺回饋（顏色標籤）
- ✅ 詳細的測試步驟說明

用戶可以直接在 Debug 頁面測試整個付款失敗流程，從觸發 webhook 到查看結果，無需手動操作資料庫或 API。
