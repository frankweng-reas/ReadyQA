# Stripe 金流設定指南

## 📋 概述

本文件說明如何設定 Stripe 訂閱制金流系統。

## 🔧 設定步驟

### 1. 取得 Stripe API Keys

1. 登入 [Stripe Dashboard](https://dashboard.stripe.com)
2. 確保右上角切換到 **Test mode**（測試模式）
3. 前往 **Developers > API keys**
4. 複製 **Secret key**（格式：`sk_test_...`）
5. 將 Secret key 填入 `.env.local` 的 `STRIPE_SECRET_KEY`

### 2. 建立 Stripe Products 和 Prices

為每個付費方案建立 Product 和 Price：

#### Starter 方案
1. 前往 **Products > Add product**
2. 設定：
   - Name: `Starter Plan`（或 `入門方案`）
   - Description: 可選
   - Pricing model: **Recurring**
   - Price: `900` TWD（或對應的 USD）
   - Billing period: **Monthly**
3. 建立後，複製 **Price ID**（格式：`price_xxxxx`）
4. 將 Price ID 填入 `.env.local` 的 `STRIPE_PRICE_ID_STARTER`

#### Pro 方案
1. 重複上述步驟
2. Price: `2990` TWD
3. 將 Price ID 填入 `.env.local` 的 `STRIPE_PRICE_ID_PRO`

#### Enterprise 方案
1. 重複上述步驟
2. Price: `8990` TWD
3. 將 Price ID 填入 `.env.local` 的 `STRIPE_PRICE_ID_ENTERPRISE`

### 3. 設定 Webhook Endpoint

#### 方法 1: 使用 Stripe CLI（本地開發推薦）

1. 安裝 Stripe CLI：
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # 或下載：https://stripe.com/docs/stripe-cli
   ```

2. 登入 Stripe CLI：
   ```bash
   stripe login
   ```

3. 轉發 Webhook 到本地：
   ```bash
   stripe listen --forward-to http://localhost:8000/api/stripe/webhook
   ```

4. 複製顯示的 **Webhook signing secret**（格式：`whsec_...`）
5. 將 signing secret 填入 `.env.local` 的 `STRIPE_WEBHOOK_SECRET`

#### 方法 2: 在 Stripe Dashboard 設定（生產環境）

1. 前往 **Developers > Webhooks**
2. 點擊 **Add endpoint**
3. 設定：
   - Endpoint URL: `https://your-domain.com/api/stripe/webhook`
   - Description: `QAPlus Subscription Webhook`
4. 選擇要監聽的事件：
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. 點擊 **Add endpoint**
6. 複製 **Signing secret**（點擊 endpoint 後顯示）
7. 將 signing secret 填入 `.env.local` 的 `STRIPE_WEBHOOK_SECRET`

### 4. 更新資料庫 Plan 資料

將 Stripe Price ID 更新到資料庫：

```bash
cd apps/backend

# 使用 Prisma Studio（圖形介面）
npx prisma studio

# 或使用 SQL
psql postgresql://qaplus:password@localhost:5432/qaplus
```

在 Prisma Studio 或 SQL 中：
1. 找到 `plans` 表
2. 更新每個方案的 `stripePriceId` 欄位：
   - `starter`: 填入 `STRIPE_PRICE_ID_STARTER` 的值
   - `pro`: 填入 `STRIPE_PRICE_ID_PRO` 的值
   - `enterprise`: 填入 `STRIPE_PRICE_ID_ENTERPRISE` 的值

或使用 SQL：
```sql
UPDATE plans SET "stripePriceId" = 'price_your_starter_price_id' WHERE code = 'starter';
UPDATE plans SET "stripePriceId" = 'price_your_pro_price_id' WHERE code = 'pro';
UPDATE plans SET "stripePriceId" = 'price_your_enterprise_price_id' WHERE code = 'enterprise';
```

### 5. 設定 Frontend URL

在 `.env.local` 中設定：
```env
FRONTEND_URL=http://localhost:3000
```

生產環境請改為實際的網域：
```env
FRONTEND_URL=https://your-domain.com
```

## ✅ 驗證設定

### 測試 Checkout Session 建立

1. 啟動後端：
   ```bash
   cd apps/backend
   npm run dev
   ```

2. 使用 API 測試（需要認證 token）：
   ```bash
   curl -X POST http://localhost:8000/api/stripe/create-checkout-session \
     -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "planCode": "starter",
       "successUrl": "http://localhost:3000/dashboard?success=true",
       "cancelUrl": "http://localhost:3000/dashboard?canceled=true"
     }'
   ```

3. 應該返回：
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

4. 訪問返回的 `url` 進行測試付款

### 測試 Webhook

1. 使用 Stripe CLI 觸發測試事件：
   ```bash
   stripe trigger checkout.session.completed
   ```

2. 檢查後端日誌，應該看到：
   ```
   [StripeService] Received webhook event: checkout.session.completed
   [StripeService] Updated tenant xxx to plan starter after successful checkout
   ```

3. 檢查資料庫：
   - `subscriptions` 表應該有新記錄
   - `tenants` 表的 `planCode` 應該已更新

## 📝 環境變數檢查清單

確認以下環境變數都已設定：

- [ ] `STRIPE_SECRET_KEY` - Stripe Secret Key（Test mode）
- [ ] `STRIPE_WEBHOOK_SECRET` - Webhook Signing Secret
- [ ] `STRIPE_PRICE_ID_STARTER` - Starter 方案 Price ID
- [ ] `STRIPE_PRICE_ID_PRO` - Pro 方案 Price ID
- [ ] `STRIPE_PRICE_ID_ENTERPRISE` - Enterprise 方案 Price ID
- [ ] `FRONTEND_URL` - 前端 URL（用於付款後導向）

## 🔍 常見問題

### Webhook 驗證失敗

- 確認 `STRIPE_WEBHOOK_SECRET` 正確
- 確認後端有啟用 `rawBody: true`（已在 `main.ts` 設定）
- 確認 Webhook URL 正確且可訪問

### Checkout Session 建立失敗

- 確認 `STRIPE_SECRET_KEY` 正確
- 確認 Plan 的 `stripePriceId` 已填入資料庫
- 檢查後端日誌錯誤訊息

### 訂閱狀態未更新

- 確認 Webhook 事件已正確設定
- 檢查 Webhook 端點是否可訪問
- 檢查後端日誌是否有錯誤

## 🚀 生產環境部署

1. 切換到 **Live mode**（Stripe Dashboard 右上角）
2. 取得 **Live** 的 Secret Key 和 Webhook Secret
3. 更新環境變數為 Live 模式的值
4. 確保 Webhook endpoint URL 指向生產環境
5. 重新建立 Products 和 Prices（Live mode）

## 📚 相關文件

- [Stripe API 文件](https://stripe.com/docs/api)
- [Stripe Webhooks 指南](https://stripe.com/docs/webhooks)
- [Stripe Testing](https://stripe.com/docs/testing)
