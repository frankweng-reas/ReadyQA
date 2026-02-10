# 訂閱相關作業文件

## 概述

QAPlus 使用 Stripe 作為訂閱制金流服務，支援方案升級、降級、取消等操作。

## 資料庫模型

### Subscription（訂閱）
- `id`: 訂閱 ID
- `tenantId`: 租戶 ID
- `stripeCustomerId`: Stripe 客戶 ID
- `stripeSubscriptionId`: Stripe 訂閱 ID（唯一）
- `planCode`: 方案代碼（free/starter/pro/enterprise）
- `status`: 訂閱狀態（active/canceled/past_due/trialing 等）
- `currentPeriodStart/End`: 當前計費週期
- `cancelAtPeriodEnd`: 是否在期末取消
- `canceledAt`: 取消時間

### Payment（付款記錄）
- `id`: 付款 ID
- `subscriptionId`: 關聯的訂閱 ID
- `tenantId`: 租戶 ID
- `amount`: 金額
- `currency`: 幣別（預設 TWD）
- `status`: 付款狀態（succeeded/failed/pending/canceled）
- `stripePaymentIntentId`: Stripe 付款意圖 ID
- `stripeInvoiceId`: Stripe 發票 ID
- `paidAt`: 付款時間

## API 端點

### 1. 建立 Checkout Session
```
POST /api/stripe/create-checkout-session
Authorization: Bearer {token}
Content-Type: application/json

{
  "planCode": "starter",
  "successUrl": "https://example.com/plans?success=true",
  "cancelUrl": "https://example.com/plans?canceled=true"
}
```

**功能**：
- 新訂閱：建立 Stripe Checkout Session，導向付款頁面
- 升級/降級：直接更新現有訂閱的價格
- 降級到 Free：設定訂閱在期末取消

**回應**：
```json
{
  "success": true,
  "message": "Checkout session created successfully",
  "data": {
    "sessionId": "cs_test_...",
    "url": "https://checkout.stripe.com/..."
  }
}
```

### 2. 取消訂閱
```
POST /api/stripe/cancel-subscription
Authorization: Bearer {token}
Content-Type: application/json

{
  "cancelAtPeriodEnd": true
}
```

**功能**：
- `cancelAtPeriodEnd: true`：在計費週期結束時取消（預設）
- `cancelAtPeriodEnd: false`：立即取消

### 3. 重新啟用訂閱
```
POST /api/stripe/reactivate-subscription
Authorization: Bearer {token}
```

**功能**：取消「取消訂閱」的設定，恢復正常訂閱

### 4. Webhook 端點
```
POST /api/stripe/webhook
stripe-signature: {signature}
```

**處理的事件**：
- `checkout.session.completed`：付款成功，建立訂閱記錄
- `customer.subscription.updated`：訂閱更新（升級/降級/付款失敗狀態變更），同步資料庫
- `customer.subscription.deleted`：訂閱取消，更新狀態為 canceled
- `invoice.payment_failed`：付款失敗，記錄失敗的 Payment 記錄
- `invoice.payment_succeeded`：付款成功，記錄 Payment 記錄

### 5. 付款失敗相關端點

#### 5.1 取得付款失敗資訊
```
GET /api/stripe/payment-failed-info
Authorization: Bearer {token}
```

**功能**：取得當前用戶的付款失敗資訊

**回應**：
```json
{
  "success": true,
  "data": {
    "hasFailedPayment": true,
    "subscriptionStatus": "past_due",
    "failedInvoices": [
      {
        "invoiceId": "in_xxx",
        "amount": 900,
        "currency": "TWD",
        "failedAt": "2026-02-10T10:00:00Z",
        "reason": "Your card was declined",
        "nextRetryAt": "2026-02-12T10:00:00Z"
      }
    ],
    "canRetry": true
  }
}
```

#### 5.2 取得失敗的發票列表
```
GET /api/stripe/failed-invoices
Authorization: Bearer {token}
```

**功能**：取得該租戶所有失敗的發票記錄

#### 5.3 更新付款方式
```
POST /api/stripe/update-payment-method
Authorization: Bearer {token}
Content-Type: application/json

{
  "paymentMethodId": "pm_xxx"
}
```

**功能**：
- 更新訂閱的預設付款方式
- **不手動觸發重試**：Stripe 會自動使用新的付款方式重試扣款

## 訂閱流程

### 新訂閱流程
1. 用戶選擇方案 → 前端呼叫 `createCheckoutSession`
2. Backend 建立 Stripe Checkout Session
3. 用戶導向 Stripe 付款頁面
4. 付款成功 → Stripe 發送 `checkout.session.completed` Webhook
5. Backend 處理 Webhook：
   - 建立 Subscription 記錄
   - 建立 Payment 記錄
   - 更新 Tenant 的 planCode

### 升級/降級流程
1. 用戶選擇新方案 → 前端呼叫 `createCheckoutSession`
2. Backend 檢查現有訂閱：
   - **升級**：立即更新訂閱價格，使用 `proration_behavior: 'always_invoice'`
   - **降級**：立即更新訂閱價格，使用 `proration_behavior: 'none'`（不退費）
3. Stripe 發送 `customer.subscription.updated` Webhook
4. Backend 處理 Webhook：更新 Subscription 和 Tenant 的 planCode

### 取消訂閱流程
1. 用戶點擊取消 → 前端呼叫 `cancelSubscription`
2. Backend 更新 Stripe 訂閱：設定 `cancel_at_period_end: true`
3. Stripe 發送 `customer.subscription.updated` Webhook（狀態變更）
4. 計費週期結束 → Stripe 發送 `customer.subscription.deleted` Webhook
5. Backend 處理 Webhook：更新 Subscription 狀態為 canceled

### 付款失敗處理流程
1. 付款失敗 → Stripe 發送 `invoice.payment_failed` Webhook
2. Backend 處理 Webhook：
   - 記錄失敗的 Payment 記錄（status: 'failed'）
   - 從 `payment_intent.last_payment_error` 取得錯誤原因
   - **不更新訂閱狀態**（由 `customer.subscription.updated` 處理）
3. Stripe 自動觸發 `customer.subscription.updated` Webhook
4. Backend 處理 Webhook：更新 Subscription 狀態為 `past_due`
5. 前端顯示付款失敗警告橫幅（PaymentFailedBanner）
6. **寬限期**：在 `past_due` 狀態下，用戶仍可正常使用服務
7. Stripe 自動重試付款（根據設定的重試時間表）
8. 用戶可選擇更新付款方式：
   - 前端呼叫 `updatePaymentMethod` API
   - Backend 更新訂閱的 `default_payment_method`
   - Stripe 自動使用新付款方式重試
9. 付款成功 → 訂閱狀態恢復為 `active`

## Frontend 實作

### 方案頁面
- 路徑：`/[locale]/plans`
- 顯示所有方案列表
- 根據當前方案顯示「升級」或「降級」按鈕
- 處理付款成功/取消的 URL 參數

### API 函數（`apps/frontend/src/lib/api/stripe.ts`）
- `getPlans()`：取得所有方案
- `createCheckoutSession()`：建立付款 Session
- `cancelSubscription()`：取消訂閱
- `reactivateSubscription()`：重新啟用訂閱
- `getPaymentFailedInfo()`：取得付款失敗資訊
- `getFailedInvoices()`：取得失敗發票列表
- `updatePaymentMethod(paymentMethodId)`：更新付款方式

### 付款失敗警告組件
- **組件**：`PaymentFailedBanner`（`apps/frontend/src/components/dashboard/PaymentFailedBanner.tsx`）
- **位置**：整合在 Dashboard 頁面頂部
- **顯示條件**：訂閱狀態為 `past_due` 或有失敗的付款記錄
- **功能**：
  - 顯示付款失敗訊息和寬限期說明
  - 顯示下次重試時間
  - 提供「更新付款方式」按鈕
  - 提供「查看詳情」功能

## 環境變數

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
FRONTEND_URL=http://localhost:3000
```

### 重要說明：Stripe Price ID 環境變數

**`STRIPE_PRICE_ID_STARTER`、`STRIPE_PRICE_ID_PRO`、`STRIPE_PRICE_ID_ENTERPRISE` 的使用時機：**

- **僅在 Seed 資料時使用**：執行 `npx prisma db seed` 時，這些環境變數會被用來初始化資料庫中 `plans` 表的 `stripePriceId` 欄位
- **實際運行時不使用**：`StripeService` 直接從資料庫的 `plans` 表讀取 `stripePriceId`，不會從環境變數讀取

**建議**：
- 如果資料庫的 `plans` 表已正確填入 `stripePriceId`，這些環境變數可以保留（方便未來重新 seed）或移除
- 確認資料庫是否有正確值：使用 `npx prisma studio` 查看 `plans` 表的 `stripePriceId` 欄位

## 本地開發

### 啟動 Webhook 轉發
```bash
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
```

### 測試 Webhook 事件
```bash
# 測試付款成功
stripe trigger checkout.session.completed

# 測試訂閱更新
stripe trigger customer.subscription.updated

# 測試訂閱取消
stripe trigger customer.subscription.deleted

# 測試付款失敗
stripe trigger invoice.payment_failed
```

### 測試付款失敗
使用 Stripe 測試卡號模擬付款失敗：

```
4000000000000002  # 卡片被拒絕（一般錯誤）
4000000000009995  # 餘額不足
4000000000009987  # 遺失卡片
4000000000009979  # 被盜卡片
```

測試流程：
1. 使用測試卡建立訂閱
2. 等待或觸發續約
3. 驗證 `invoice.payment_failed` webhook
4. 驗證 `customer.subscription.updated` webhook（status: past_due）
5. 檢查 Dashboard 是否顯示付款失敗警告
6. 測試更新付款方式功能

## 注意事項

1. **Webhook 簽名驗證**：所有 Webhook 請求都必須通過 Stripe 簽名驗證
2. **訂閱狀態同步**：訂閱狀態以 Stripe 為準，透過 Webhook 同步到資料庫
3. **降級不退費**：降級時使用 `proration_behavior: 'none'`，不會退還差額
4. **升級立即生效**：升級時使用 `proration_behavior: 'always_invoice'`，立即生效並收費
5. **Free 方案**：Free 方案不需要 Stripe Price ID，降級到 Free 等同取消訂閱
6. **Stripe Price ID 來源**：系統運行時從資料庫 `plans` 表讀取 `stripePriceId`，環境變數 `STRIPE_PRICE_ID_*` 僅在 seed 資料時使用
7. **付款失敗處理**：
   - **訂閱狀態控制**：訂閱狀態只由 `customer.subscription.updated` webhook 控制，`invoice.payment_failed` 只記錄 Payment 失敗記錄
   - **錯誤原因來源**：錯誤原因從 `payment_intent.last_payment_error` 取得
   - **不手動重試**：不要手動 retry 扣款，只更新付款方式，讓 Stripe 自動重試
   - **寬限期**：在 `past_due` 狀態下，系統不限制功能使用
   - **自動重試**：Stripe 會根據設定的時間表自動重試付款
