# Stripe 設定檢查清單

## ✅ 已完成項目

### 1. 環境變數設定
- ✅ `STRIPE_SECRET_KEY` - 已設定
- ✅ `STRIPE_WEBHOOK_SECRET` - 已設定 (whsec_76ff2593f33c18b7f98bbf6220bc89878654d58f2d92151af5ec8b5c9a6c4303)
- ✅ `STRIPE_PRICE_ID_STARTER` - 已設定 (price_1Sy31ZK9AZTayzSGRTAAnraV)
- ✅ `STRIPE_PRICE_ID_PRO` - 已設定 (price_1Sy3MbK9AZTayzSGFi27yW0O)
- ✅ `STRIPE_PRICE_ID_ENTERPRISE` - 已設定 (price_1Sy3WRK9AZTayzSGV0TlB2VF)
- ✅ `FRONTEND_URL` - 已設定 (http://localhost:3000)

### 2. Stripe CLI
- ✅ Stripe CLI 已安裝
- ✅ Stripe CLI 已登入
- ✅ Webhook Secret 已取得

## 🔄 待完成項目

### 1. 更新資料庫 Plan 資料 ⚠️ **重要**

需要將 Stripe Price ID 更新到資料庫的 `plans` 表：

**方法 1: 使用 Prisma Studio（推薦）**
```bash
cd apps/backend
npx prisma studio
```

在 Prisma Studio 中：
1. 打開 `plans` 表
2. 編輯每個方案，填入對應的 `stripePriceId`：
   - `starter` → `price_1Sy31ZK9AZTayzSGRTAAnraV`
   - `pro` → `price_1Sy3MbK9AZTayzSGFi27yW0O`
   - `enterprise` → `price_1Sy3WRK9AZTayzSGV0TlB2VF`

**方法 2: 使用 SQL**
```bash
cd apps/backend
psql postgresql://qaplus:password@localhost:5432/qaplus -f ../scripts/update-plans-stripe-price-id.sql
```

或直接執行 SQL：
```sql
UPDATE plans SET "stripePriceId" = 'price_1Sy31ZK9AZTayzSGRTAAnraV' WHERE code = 'starter';
UPDATE plans SET "stripePriceId" = 'price_1Sy3MbK9AZTayzSGFi27yW0O' WHERE code = 'pro';
UPDATE plans SET "stripePriceId" = 'price_1Sy3WRK9AZTayzSGV0TlB2VF' WHERE code = 'enterprise';
```

### 2. 啟動服務

**終端 1 - 後端伺服器：**
```bash
cd apps/backend
npm run dev
```

**終端 2 - Stripe Webhook 轉發：**
```bash
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
```

### 3. 測試 API

**測試建立 Checkout Session：**
```bash
# 需要先取得 Supabase 認證 token
curl -X POST http://localhost:8000/api/stripe/create-checkout-session \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planCode": "starter"
  }'
```

**測試 Webhook：**
```bash
# 在終端 2（stripe listen 運行的終端）執行
stripe trigger checkout.session.completed
```

檢查後端日誌應該會看到：
```
[StripeService] Received webhook event: checkout.session.completed
[StripeService] Updated tenant xxx to plan starter after successful checkout
```

## 📋 完整檢查清單

- [x] Stripe CLI 安裝
- [x] Stripe CLI 登入
- [x] 環境變數設定
- [x] Webhook Secret 取得
- [ ] **資料庫 plans 表 stripePriceId 更新** ⚠️
- [ ] 後端伺服器啟動
- [ ] Stripe Webhook 轉發啟動
- [ ] API 測試

## 🎯 下一步

1. **立即執行**：更新資料庫 plans 表的 stripePriceId
2. 啟動後端和 Webhook 轉發
3. 測試 API 功能

## 📚 相關文件

- `docs/STRIPE-SETUP.md` - 完整設定指南
- `docs/STRIPE-CLI-SETUP.md` - Stripe CLI 詳細說明
- `STRIPE-WEBHOOK-快速設定.md` - Webhook 快速設定
