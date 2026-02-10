# Stripe 金流整合 - 快速開始

## ✅ 已完成的工作

1. ✅ 安裝 Stripe npm 套件
2. ✅ 擴展資料庫模型（Subscription, Payment）
3. ✅ 建立 Stripe Service 和 Controller
4. ✅ 實作 Webhook 處理邏輯
5. ✅ 執行資料庫 Migration
6. ✅ 生成 Prisma Client
7. ✅ 更新環境變數檔案

## 🚀 立即開始

### 1. 設定 Stripe 環境變數

編輯 `.env.local`，填入以下 Stripe 相關變數：

```env
# Stripe 配置
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
STRIPE_PRICE_ID_STARTER=price_your_starter_id
STRIPE_PRICE_ID_PRO=price_your_pro_id
STRIPE_PRICE_ID_ENTERPRISE=price_your_enterprise_id
FRONTEND_URL=http://localhost:3000
```

### 2. 在 Stripe Dashboard 設定

#### 取得 API Keys
1. 登入 https://dashboard.stripe.com
2. 切換到 **Test mode**
3. Developers > API keys > 複製 **Secret key**

#### 建立 Products 和 Prices
為每個方案建立：
- **Starter**: 900 TWD/month → 複製 Price ID
- **Pro**: 2990 TWD/month → 複製 Price ID  
- **Enterprise**: 8990 TWD/month → 複製 Price ID

#### 設定 Webhook（本地開發）
```bash
# 安裝 Stripe CLI
brew install stripe/stripe-cli/stripe

# 登入
stripe login

# 轉發 Webhook
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
# 複製顯示的 whsec_... 到環境變數
```

### 3. 更新資料庫 Plan 資料

```bash
cd apps/backend
npx prisma studio
```

在 Prisma Studio 中更新 `plans` 表的 `stripePriceId` 欄位，或使用 SQL：

```sql
UPDATE plans SET "stripePriceId" = 'price_xxxxx' WHERE code = 'starter';
UPDATE plans SET "stripePriceId" = 'price_xxxxx' WHERE code = 'pro';
UPDATE plans SET "stripePriceId" = 'price_xxxxx' WHERE code = 'enterprise';
```

### 4. 測試 API

啟動後端：
```bash
cd apps/backend
npm run dev
```

測試建立 Checkout Session：
```bash
curl -X POST http://localhost:8000/api/stripe/create-checkout-session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode": "starter"}'
```

## 📚 詳細文件

完整設定指南請參考：[docs/STRIPE-SETUP.md](docs/STRIPE-SETUP.md)

## 🔗 API 端點

- `POST /api/stripe/create-checkout-session` - 建立付款 Session（需要認證）
- `POST /api/stripe/webhook` - Stripe Webhook 端點（自動處理）

## 📝 注意事項

1. **測試模式**: 確保使用 Stripe Test mode 的 API keys
2. **Webhook**: 本地開發使用 Stripe CLI，生產環境需要在 Dashboard 設定
3. **Price ID**: 每個方案都需要在 Stripe 建立 Product 和 Price
4. **資料庫**: 記得更新 `plans` 表的 `stripePriceId` 欄位
