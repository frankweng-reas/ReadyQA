# 更新：自動觸發付款失敗功能

## 🔧 問題
原本的「觸發付款失敗」按鈕只顯示提示訊息，需要手動在 Terminal 執行命令。

## ✅ 解決方案
現在按鈕會**自動調用 Backend API**，由 Backend 執行 `stripe trigger` 命令。

## 📝 修改內容

### Backend 修改

#### 1. 新增 Controller 端點
**檔案**: `apps/backend/src/stripe/stripe.controller.ts`

```typescript
@Post('test/trigger-payment-failed')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: '測試：觸發付款失敗 webhook (僅供開發測試)' })
async triggerPaymentFailed(@CurrentUser() supabaseUser: any)
```

#### 2. 新增 Service 方法
**檔案**: `apps/backend/src/stripe/stripe.service.ts`

```typescript
async triggerTestPaymentFailed(tenantId: string) {
  // 1. 找到 active subscription
  // 2. 使用 child_process 執行 stripe trigger 命令
  // 3. 返回執行結果
}
```

### Frontend 修改

#### 更新 handleTestPaymentFailed 函數
**檔案**: `apps/frontend/src/app/[locale]/debug/page.tsx`

現在會：
1. ✅ 調用 `POST /api/stripe/test/trigger-payment-failed`
2. ✅ Backend 自動執行 `stripe trigger invoice.payment_failed`
3. ✅ 顯示 Stripe CLI 的輸出日誌
4. ✅ 3 秒後自動重新載入資料

## 🎯 使用方式

1. **確保 Stripe CLI 正在運行**
   ```bash
   stripe listen --forward-to http://localhost:8000/api/stripe/webhook
   ```

2. **重新啟動 Backend**（套用新的 API）
   ```bash
   cd apps/backend
   npm run start:dev
   ```

3. **刷新 Debug 頁面**
   - 訪問：`http://localhost:3000/zh-TW/debug`
   - 找到「步驟 3-5 - 付款失敗測試」

4. **點擊按鈕**
   - 點擊「⚠️ 觸發付款失敗 (webhook)」
   - 確認對話框
   - **自動觸發** webhook
   - 查看 Process Log 的輸出
   - 3 秒後自動重新載入

## 📊 預期結果

### Process Log 範例
```
14:30:45: ⚠️ 開始觸發付款失敗測試
14:30:45: 📡 調用 API: http://localhost:8000/api/stripe/test/trigger-payment-failed
14:30:46: 📥 收到回應: 200 OK
14:30:46: ✓ Stripe trigger command executed successfully
14:30:46: 📝 Stripe CLI 輸出:
14:30:46:    Trigger succeeded! Check dashboard for event details.
14:30:46: ✓ 付款失敗 webhook 已觸發
14:30:46: ℹ️ 請稍等 2-3 秒後點擊「重新載入」查看結果
14:30:49: 🔄 自動重新載入資料...
```

### 資料變化
1. **Payments 區塊**：新增 `failed` 狀態記錄（紅色標籤）
2. **Subscriptions 區塊**：狀態變為 `past_due`
3. **Dashboard**：顯示黃色付款失敗警告橫幅

## ⚠️ 注意事項

1. **Stripe CLI 必須運行**
   - Backend 執行 `stripe trigger` 命令
   - Webhook 需要通過 `stripe listen` 轉發

2. **開發環境限定**
   - 此功能僅供測試使用
   - 不應在生產環境使用

3. **Backend 需要重啟**
   - 修改後需要重新啟動 Backend
   - Frontend 會自動 hot reload

## ✅ 驗證清單

- [x] Backend Controller 新增端點
- [x] Backend Service 新增方法
- [x] Frontend 更新處理函數
- [x] Backend 編譯成功
- [x] Frontend 編譯成功

## 🚀 下一步

1. 重啟 Backend
2. 刷新瀏覽器
3. 測試新的自動觸發功能
