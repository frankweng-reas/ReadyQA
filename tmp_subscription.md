# 訂閱流程說明

## 概述

QAPlus 使用 Stripe 作為訂閱制金流服務，支援三種訂閱操作：
1. **新訂閱**：用戶首次訂閱付費方案
2. **升級**：從較低方案升級到較高方案（例如：Pro → Enterprise）
3. **降級**：從較高方案降級到較低方案（例如：Enterprise → Pro）

所有操作都通過 `/api/stripe/create-checkout-session` API 端點處理。

---

## 1. 新訂閱流程

### 觸發條件
- 用戶目前沒有 active/trialing 訂閱
- 用戶選擇付費方案（starter/pro/enterprise）

### 處理流程

1. **前端調用 API**
   ```typescript
   stripeApi.createCheckoutSession('starter', successUrl, cancelUrl)
   ```

2. **後端檢測**
   - 查詢現有訂閱：`subscription.findMany({ status: ['active', 'trialing'] })`
   - 如果沒有找到現有訂閱 → 判定為新訂閱

3. **建立 Stripe Checkout Session**
   - 建立新的 Stripe Checkout Session
   - 設定付款成功/取消的 URL
   - 返回 Stripe Checkout URL

4. **前端跳轉**
   - 跳轉到 Stripe Checkout 付款頁面
   - 用戶完成付款後，Stripe 自動重定向到 `successUrl`

5. **Webhook 處理**
   - Stripe 發送 `checkout.session.completed` webhook
   - Backend 處理 webhook：
     - 建立 Subscription 記錄
     - 建立 Payment 記錄
     - 更新 Tenant 的 planCode

### 特點
- ✅ 需要跳轉到 Stripe Checkout 頁面
- ✅ 用戶需要完成付款流程
- ✅ 付款完成後通過 webhook 更新資料庫

---

## 2. 升級流程（例如：Pro → Enterprise）

### 觸發條件
- 用戶目前有 active/trialing 訂閱
- 目標方案價格 > 當前方案價格
- 例如：Pro ($99.99) → Enterprise ($299.99)

### 處理流程

1. **前端調用 API**
   ```typescript
   stripeApi.createCheckoutSession('enterprise', successUrl, cancelUrl)
   ```

2. **後端檢測**
   ```typescript
   // 查詢現有訂閱
   const existingSubscription = await subscription.findMany({...})
   
   // 取得當前方案和目標方案
   const currentPlan = await plan.findUnique({ code: 'pro' })
   const targetPlan = await plan.findUnique({ code: 'enterprise' })
   
   // 判斷是否為升級
   const isUpgrade = targetPlan.priceTwdMonthly > currentPlan.priceTwdMonthly
   // Enterprise ($299.99) > Pro ($99.99) → true
   ```

3. **直接更新 Stripe 訂閱**
   ```typescript
   await stripe.subscriptions.update(subscriptionId, {
     items: [{ id: currentItem.id, price: newPriceId }],
     proration_behavior: 'always_invoice', // 立即按比例計費
     billing_cycle_anchor: 'unchanged',
     metadata: { planCode: 'enterprise', previousPlanCode: 'pro' }
   })
   ```

4. **立即更新資料庫**
   ```typescript
   // 更新 Subscription
   await subscription.update({
     where: { id: subscriptionId },
     data: { planCode: 'enterprise' }
   })
   
   // 更新 Tenant
   await tenant.update({
     where: { id: tenantId },
     data: { planCode: 'enterprise' }
   })
   ```

5. **返回成功 URL**
   - 直接返回 `successUrl`（本地 URL）
   - **不跳轉到 Stripe Checkout 頁面**

6. **Webhook 處理**
   - Stripe 自動發送 `customer.subscription.updated` webhook（通常在幾秒內）
   - Backend 處理 webhook：
     - 從 Stripe metadata 讀取 `planCode`
     - 如果 metadata 沒有 planCode，從 Price ID 反推方案
     - 使用事務更新 Subscription 和 Tenant 的 planCode
     - **確保資料庫與 Stripe 狀態一致**

### 特點
- ✅ **不跳轉到 Stripe Checkout**（直接升級）
- ✅ **立即生效**：方案立即變更
- ✅ **立即收費**：按比例計算差價並立即收費
- ✅ **立即更新資料庫**：planCode 立即更新

### 收費方式
- 使用 `proration_behavior: 'always_invoice'`
- Stripe 會自動計算：
  - 當前週期剩餘時間的 Pro 費用（退款）
  - 當前週期剩餘時間的 Enterprise 費用（收費）
  - 差價 = Enterprise 費用 - Pro 費用
- 立即產生 invoice 並從付款方式扣款

### ⚠️ 資料一致性保護機制

**執行順序**：
1. 先更新 Stripe 訂閱（第258行）
2. 如果 Stripe 更新失敗 → 拋出異常，資料庫不會更新 ✅
3. 如果 Stripe 更新成功 → 更新資料庫（第302-314行）

**潛在風險**：
- 如果 Stripe 更新成功但資料庫更新失敗，會導致短暫的資料不一致
  - Stripe 訂閱已更新為新方案
  - 資料庫 planCode 仍是舊方案

**保護機制 - Webhook 自動同步**：
- Stripe 更新訂閱時，會在 `metadata` 中寫入 `planCode: 'enterprise'`
- Stripe 自動發送 `customer.subscription.updated` webhook（通常在幾秒內）
- Webhook 處理邏輯：
  ```typescript
  // 從 Stripe metadata 讀取 planCode
  let planCode = subscription.metadata?.planCode
  
  // 如果 metadata 沒有，從 Price ID 反推
  if (!planCode && subscription.items?.data?.[0]?.price?.id) {
    const priceId = subscription.items.data[0].price.id
    const plan = await plan.findFirst({ where: { stripePriceId: priceId } })
    planCode = plan.code
  }
  
  // 當前 webhook 主要同步訂閱狀態和週期資訊
  // 如果 API 更新失敗，webhook 可以從 Stripe metadata 或 Price ID 讀取 planCode
  // 並更新資料庫（架構上支持，可作為保護機制）
  ```

**結論**：
- ✅ Stripe 更新失敗時，資料庫不會更新（因為會拋出異常）
- ✅ 資料庫更新失敗時，Webhook 可以從 Stripe metadata 或 Price ID 讀取 planCode 來同步
- ⏳ 存在短暫不一致的時間窗口（API 返回後到 webhook 處理前，通常幾秒內）
- ✅ **Webhook 自動同步機制已足夠保護資料一致性**
  - Stripe 是單一真實來源（Single Source of Truth）
  - Webhook 確保資料庫最終與 Stripe 狀態一致

---

## 3. 降級流程（例如：Enterprise → Pro）

### 觸發條件
- 用戶目前有 active/trialing 訂閱
- 目標方案價格 < 當前方案價格
- 例如：Enterprise ($299.99) → Pro ($99.99)

### 處理流程

1. **前端調用 API**
   ```typescript
   stripeApi.createCheckoutSession('pro', successUrl, cancelUrl)
   ```

2. **後端檢測**
   ```typescript
   // 查詢現有訂閱
   const existingSubscription = await subscription.findMany({...})
   
   // 取得當前方案和目標方案
   const currentPlan = await plan.findUnique({ code: 'enterprise' })
   const targetPlan = await plan.findUnique({ code: 'pro' })
   
   // 判斷是否為降級
   const isDowngrade = targetPlan.priceTwdMonthly < currentPlan.priceTwdMonthly
   // Pro ($99.99) < Enterprise ($299.99) → true
   ```

3. **處理 Subscription Schedule（如有）**
   ```typescript
   // 如果訂閱已綁定到 schedule，先釋放
   if (stripeSubscription.schedule) {
     await stripe.subscriptionSchedules.release(scheduleId)
   }
   ```

4. **直接更新 Stripe 訂閱**
   ```typescript
   await stripe.subscriptions.update(subscriptionId, {
     items: [{ id: currentItem.id, price: newPriceId }],
     proration_behavior: 'none', // 不收費也不退款
     metadata: { planCode: 'pro', previousPlanCode: 'enterprise' }
   })
   ```

5. **返回成功 URL**
   - 直接返回 `successUrl`（本地 URL）
   - **不跳轉到 Stripe Checkout 頁面**

6. **資料庫更新時機**
   - ⚠️ **不立即更新資料庫 planCode**
   - 要等到下個計費週期開始時
   - Stripe 發送 `customer.subscription.updated` webhook
   - Backend 處理 webhook 時才更新 planCode

### 特點
- ✅ **不跳轉到 Stripe Checkout**（直接降級）
- ⏳ **下個週期生效**：新價格在下個計費週期才生效
- ❌ **不退款**：當前週期已付費用不退還
- ⏳ **延遲更新資料庫**：planCode 要等下個週期 webhook 才更新

### 收費方式
- 使用 `proration_behavior: 'none'`
- **不收費也不退款**
- 當前週期繼續使用 Enterprise 方案
- 下個計費週期開始時才改為 Pro 方案並按新價格收費

---

## 4. 特殊情況：降級到 Free

### 觸發條件
- 用戶目前有 active/trialing 訂閱
- 目標方案為 `free`

### 處理流程

1. **前端調用 API**
   ```typescript
   stripeApi.createCheckoutSession('free', successUrl, cancelUrl)
   ```

2. **後端檢測**
   - 檢測到 `planCode === 'free'`
   - 這是取消訂閱的特殊情況

3. **設定訂閱在期末取消**
   ```typescript
   await stripe.subscriptions.update(subscriptionId, {
     cancel_at_period_end: true
   })
   ```

4. **返回成功 URL**
   - 直接返回 `successUrl`
   - **不跳轉到 Stripe Checkout 頁面**

5. **資料庫更新時機**
   - 當前週期結束時，Stripe 發送 `customer.subscription.deleted` webhook
   - Backend 處理 webhook：
     - 更新 Subscription 狀態為 `canceled`
     - 更新 Tenant 的 planCode 為 `free`

### 特點
- ✅ **不跳轉到 Stripe Checkout**
- ⏳ **期末生效**：訂閱在當前計費週期結束時取消
- ❌ **不退款**：當前週期已付費用不退還
- ⏳ **延遲更新資料庫**：planCode 要等週期結束 webhook 才更新為 `free`

---

## 5. 流程對比表

| 項目 | 新訂閱 | 升級 | 降級 | 降級到 Free |
|------|--------|------|------|-------------|
| **檢測方式** | 無現有訂閱 | `新價格 > 當前價格` | `新價格 < 當前價格` | `planCode === 'free'` |
| **跳轉 Stripe** | ✅ 是 | ❌ 否 | ❌ 否 | ❌ 否 |
| **立即生效** | ✅ 是 | ✅ 是 | ❌ 否 | ❌ 否 |
| **生效時機** | 付款完成後 | 立即 | 下個計費週期 | 當前週期結束 |
| **收費方式** | 全額收費 | `always_invoice`（按比例） | `none`（不退款） | `none`（不退款） |
| **資料庫更新** | Webhook 後 | 立即更新 | 下個週期 Webhook | 週期結束 Webhook |
| **退款** | N/A | 按比例退款 | ❌ 不退款 | ❌ 不退款 |

---

## 6. API 回應格式

### 新訂閱
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_...",
    "url": "https://checkout.stripe.com/..."  // Stripe Checkout URL
  }
}
```

### 升級/降級
```json
{
  "success": true,
  "data": {
    "sessionId": "sub_...",  // Stripe Subscription ID
    "url": "https://example.com/test?success=true"  // 本地成功 URL
  }
}
```

### 前端判斷方式
```typescript
if (result.url.includes(window.location.origin)) {
  // 這是升級/降級，直接導向成功頁面
  window.location.href = result.url
} else {
  // 這是新訂閱，導向 Stripe Checkout
  window.location.href = result.url
}
```

---

## 7. 測試頁面行為

在測試頁面 (`/zh-TW/test`) 中：

1. **按下訂閱按鈕**（例如：Starter、Pro、Enterprise）
2. **前端調用** `handleCreateSubscription(planCode)`
3. **後端自動判斷**：
   - 無訂閱 → 新訂閱 → 跳轉 Stripe Checkout
   - 有訂閱 + 價格更高 → 升級 → 直接升級，不跳轉
   - 有訂閱 + 價格更低 → 降級 → 直接降級，不跳轉
4. **處理日誌顯示**在下方結果區域
5. **數據自動更新**：Tenant、Subscriptions、Payments 三個區塊

---

## 8. 注意事項

### 升級
- ✅ 立即生效，用戶可立即使用新方案功能
- ✅ 立即收費，按比例計算差價
- ✅ 資料庫立即更新，前端可立即看到新方案

### 降級
- ⚠️ 下個週期才生效，當前週期仍使用舊方案
- ⚠️ 不退款，已付費用不退還
- ⚠️ 資料庫延遲更新，要等下個週期 webhook

### 降級到 Free
- ⚠️ 當前週期結束時才取消
- ⚠️ 不退款，已付費用不退還
- ⚠️ 資料庫延遲更新，要等週期結束 webhook

---

## 9. Webhook 事件

### 新訂閱
- `checkout.session.completed` - Checkout 完成
- `customer.subscription.created` - 訂閱建立
- `invoice.payment_succeeded` - 付款成功

### 升級
- `customer.subscription.updated` - 訂閱更新（自動同步 planCode 到資料庫）
- `invoice.payment_succeeded` - 差價付款成功

### 降級
- `customer.subscription.updated` - 訂閱更新（當前週期）
- `customer.subscription.updated` - 訂閱更新（下個週期開始時）

### 降級到 Free
- `customer.subscription.updated` - 訂閱更新（設定 cancel_at_period_end）
- `customer.subscription.deleted` - 訂閱刪除（週期結束時）

---

## 10. 程式碼位置

### 前端
- API 調用：`apps/frontend/src/lib/api/stripe.ts` → `createCheckoutSession()`
- 測試頁面：`apps/frontend/src/app/[locale]/test/page.tsx` → `handleCreateSubscription()`

### 後端
- 主要邏輯：`apps/backend/src/stripe/stripe.service.ts` → `createCheckoutSession()`
- Controller：`apps/backend/src/stripe/stripe.controller.ts` → `createCheckoutSession()`

### 文檔
- 完整文檔：`docs/SUBSCRIPTION.md`
- 升級文檔：`docs/STRIPE-UPGRADE-PLAN.md`

---

## 11. 付款失敗處理流程

### 觸發條件
- Stripe 嘗試從用戶的付款方式扣款時失敗
- 常見原因：
  - 沒有付款方式（付款方式被刪除）
  - 卡片被拒絕（餘額不足、卡片過期、銀行拒絕等）
  - 付款方式無效

### 處理流程

#### 1. Stripe 發送 Webhook
當付款失敗時，Stripe 會自動發送兩個 webhook：
- `invoice.payment_failed` - 付款失敗事件
- `customer.subscription.updated` - 訂閱狀態更新為 `past_due`

#### 2. 處理 `invoice.payment_failed` Webhook
```typescript
async handleInvoicePaymentFailed(event: Stripe.InvoicePaymentFailedEvent) {
  // 1. 從 invoice 取得 subscriptionId 和 paymentIntentId
  const subscriptionId = invoice.subscription
  const paymentIntentId = invoice.payment_intent
  
  // 2. 查找資料庫中的訂閱記錄
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId }
  })
  
  // 3. 從 payment_intent.last_payment_error 取得失敗原因
  const failureReason = paymentIntent.last_payment_error?.message || '付款失敗'
  
  // 4. 創建 Payment 記錄（status: 'failed'）
  await prisma.payment.create({
    data: {
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: paymentIntentId,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: 'failed',
      failureReason: failureReason,
      failedAt: new Date(),
      // ...
    }
  })
}
```

**重要**：
- ✅ 只創建 Payment 記錄（status: 'failed'）
- ❌ **不更新訂閱狀態**（由 `customer.subscription.updated` 處理）

#### 3. 處理 `customer.subscription.updated` Webhook
```typescript
async handleSubscriptionUpdated(event: Stripe.CustomerSubscriptionUpdatedEvent) {
  const subscription = event.data.object
  
  // Stripe 自動將訂閱狀態更新為 'past_due'
  if (subscription.status === 'past_due') {
    // 更新資料庫中的訂閱狀態
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'past_due' }
    })
  }
}
```

**結果**：
- ✅ Subscription 狀態更新為 `past_due`
- ✅ Payment 記錄創建（status: 'failed'）
- ✅ Dashboard 顯示付款失敗警告橫幅

### 前端顯示

#### PaymentFailedBanner 組件
- **位置**：`apps/frontend/src/components/dashboard/PaymentFailedBanner.tsx`
- **顯示條件**：訂閱狀態為 `past_due` 且有失敗的 Payment 記錄
- **功能**：
  - 顯示失敗金額、失敗時間、失敗原因
  - 顯示下次重試時間（如果有）
  - 「更新付款方式」按鈕 → 導向 Stripe Billing Portal
  - 「查看詳情」按鈕 → 顯示詳細失敗資訊

### 恢復流程（付款成功）

#### 1. 用戶更新付款方式
- 點擊 Dashboard 的「更新付款方式」按鈕
- 導向 Stripe Billing Portal
- 在 Stripe 中添加/更新付款方式

#### 2. Stripe 自動重試
- Stripe 會自動使用新的付款方式重試扣款
- 如果成功，發送 `invoice.payment_succeeded` webhook

#### 3. 處理 `invoice.payment_succeeded` Webhook
```typescript
async handleInvoicePaymentSucceeded(event: Stripe.InvoicePaymentSucceededEvent) {
  const invoice = event.data.object
  const paymentIntentId = invoice.payment_intent
  
  // 1. 檢查是否存在失敗的 Payment 記錄（相同 paymentIntentId）
  const existingPayment = await prisma.payment.findFirst({
    where: {
      stripePaymentIntentId: paymentIntentId,
      status: 'failed'
    }
  })
  
  if (existingPayment) {
    // 2. 更新失敗記錄為成功
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: 'succeeded',
        paidAt: new Date(),
        failureReason: null
      }
    })
  } else {
    // 3. 如果沒有失敗記錄，創建新的成功記錄
    await prisma.payment.create({
      data: {
        status: 'succeeded',
        paidAt: new Date(),
        // ...
      }
    })
  }
  
  // 4. 如果是 subscription_cycle，更新 planCode
  if (invoice.billing_reason === 'subscription_cycle') {
    // 更新 Subscription 和 Tenant 的 planCode
  }
}
```

**結果**：
- ✅ Payment 記錄更新為 `succeeded`（或創建新的成功記錄）
- ✅ Subscription 狀態由 `customer.subscription.updated` 更新為 `active`
- ✅ Dashboard 付款失敗警告橫幅消失

### 測試流程

在測試頁面 (`/zh-TW/test`) 的「付款失敗測試」tab：

1. **步驟 ① - 清除測試資料**
   - 點擊右上角「清除測試資料」重置環境

2. **步驟 ② - 創建 Test Clock 訂閱**
   - 點擊「⏰ Starter $10」創建 Test Clock 訂閱

3. **步驟 ③ - 模擬付款失敗**
   - 點擊「💳 刪除付款方式」移除所有付款方式
   - 這會刪除 Stripe Customer 的所有付款方式，確保付款失敗

4. **步驟 ④ - 快轉 Test Clock（觸發付款失敗）**
   - 點擊「⏩ 快轉 +1 個月」觸發付款嘗試
   - Stripe 會自動產生 invoice 並嘗試收款
   - 因為沒有付款方式會失敗，並發送 `invoice.payment_failed` webhook

5. **查看結果**
   - 查看 Process Log 和下方資料，確認付款失敗
   - 前往 Dashboard 查看付款失敗警告橫幅

6. **恢復正常**
   - 前往 Dashboard，透過「更新付款方式」按鈕
   - 在 Stripe Billing Portal 中添加正確的付款方式
   - Stripe 自動重試扣款，成功後恢復正常

### 特點
- ✅ **自動處理**：Stripe 自動發送 webhook，系統自動更新狀態
- ✅ **狀態同步**：訂閱狀態由 `customer.subscription.updated` 統一管理
- ✅ **記錄完整**：Payment 記錄完整記錄失敗和成功狀態
- ✅ **用戶友好**：Dashboard 顯示清晰的警告和恢復指引
- ✅ **自動重試**：Stripe 會自動重試失敗的付款（根據設定）

### 相關 API 端點

#### 取得付款失敗資訊
```
GET /api/stripe/payment-failed-info
Authorization: Bearer {token}
```

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
        "amount": 1000,
        "currency": "usd",
        "failedAt": "2026-02-10T10:00:00Z",
        "reason": "沒有付款方式",
        "nextRetryAt": "2026-02-12T10:00:00Z"
      }
    ],
    "canRetry": true
  }
}
```

#### 建立 Billing Portal Session
```
POST /api/stripe/create-billing-portal-session
Authorization: Bearer {token}
```

**功能**：建立 Stripe Billing Portal session，返回 URL 供用戶更新付款方式

**回應**：
```json
{
  "success": true,
  "data": {
    "url": "https://billing.stripe.com/session/xxx"
  }
}
```

### Webhook 事件

#### 付款失敗
- `invoice.payment_failed` - 付款失敗，創建 Payment 記錄（status: 'failed'）
- `customer.subscription.updated` - 訂閱狀態更新為 `past_due`

#### 付款成功（恢復）
- `invoice.payment_succeeded` - 付款成功，更新或創建 Payment 記錄（status: 'succeeded'）
- `customer.subscription.updated` - 訂閱狀態更新為 `active`

### 程式碼位置

#### 後端
- Webhook 處理：`apps/backend/src/stripe/stripe.service.ts`
  - `handleInvoicePaymentFailed()` - 處理付款失敗
  - `handleInvoicePaymentSucceeded()` - 處理付款成功（恢復）
  - `handleSubscriptionUpdated()` - 處理訂閱狀態更新
- Controller：`apps/backend/src/stripe/stripe.controller.ts`
  - `getPaymentFailedInfo()` - 取得付款失敗資訊
  - `createBillingPortalSession()` - 建立 Billing Portal session

#### 前端
- Banner 組件：`apps/frontend/src/components/dashboard/PaymentFailedBanner.tsx`
- Dashboard：`apps/frontend/src/app/[locale]/dashboard/page.tsx`
- 測試頁面：`apps/frontend/src/app/[locale]/test/page.tsx`（付款失敗測試 tab）
