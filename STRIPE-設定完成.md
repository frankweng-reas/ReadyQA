# ✅ Stripe 金流整合 - 設定完成

## 🎉 已完成項目

### 1. 環境變數設定 ✅
- ✅ `STRIPE_SECRET_KEY` - 已設定
- ✅ `STRIPE_WEBHOOK_SECRET` - 已設定
- ✅ `STRIPE_PRICE_ID_STARTER` - 已設定
- ✅ `STRIPE_PRICE_ID_PRO` - 已設定
- ✅ `STRIPE_PRICE_ID_ENTERPRISE` - 已設定
- ✅ `FRONTEND_URL` - 已設定

### 2. Stripe CLI ✅
- ✅ Stripe CLI 已安裝
- ✅ Stripe CLI 已登入
- ✅ Webhook Secret 已取得

### 3. 資料庫更新 ✅
- ✅ `starter` 方案：`price_1Sy31ZK9AZTayzSGRTAAnraV`
- ✅ `pro` 方案：`price_1Sy3MbK9AZTayzSGFi27yW0O`
- ✅ `enterprise` 方案：`price_1Sy3WRK9AZTayzSGV0TlB2VF`
- ✅ `free` 方案：不需要 Stripe Price ID（正常）

### 4. 程式碼實作 ✅
- ✅ Stripe Service 已建立
- ✅ Stripe Controller 已建立
- ✅ Webhook 處理邏輯已實作
- ✅ 資料庫 Migration 已執行

## 🚀 如何使用

### 啟動服務

**終端 1 - 後端伺服器：**
```bash
cd apps/backend
npm run dev
```

**終端 2 - Stripe Webhook 轉發：**
```bash
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
```

### API 端點

#### 1. 建立 Checkout Session
```bash
POST /api/stripe/create-checkout-session
Authorization: Bearer YOUR_SUPABASE_TOKEN
Content-Type: application/json

{
  "planCode": "starter",
  "successUrl": "http://localhost:3000/dashboard?success=true",
  "cancelUrl": "http://localhost:3000/dashboard?canceled=true"
}
```

**回應：**
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

#### 2. Webhook 端點
```
POST /api/stripe/webhook
stripe-signature: whsec_...
```

自動處理以下事件：
- `checkout.session.completed` - 付款成功
- `customer.subscription.updated` - 訂閱更新
- `customer.subscription.deleted` - 訂閱取消

### 測試

**測試 Webhook：**
```bash
stripe trigger checkout.session.completed
```

**測試 API（需要認證 token）：**
```bash
curl -X POST http://localhost:8000/api/stripe/create-checkout-session \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planCode": "starter"}'
```

**使用測試腳本：**
```bash
./scripts/test-stripe-api.sh
```

## 📋 資料流程

```
用戶選擇方案
    ↓
前端呼叫 POST /api/stripe/create-checkout-session
    ↓
後端建立 Stripe Checkout Session
    ↓
返回 Checkout URL
    ↓
用戶在 Stripe Checkout 頁面付款
    ↓
Stripe 發送 Webhook 事件
    ↓
後端處理 Webhook
    ↓
更新資料庫：
  - 建立/更新 Subscription 記錄
  - 更新 Tenant planCode
```

## 🔍 檢查清單

- [x] 環境變數設定
- [x] Stripe CLI 安裝與登入
- [x] 資料庫 plans 表更新
- [x] 後端程式碼實作
- [x] Migration 執行
- [ ] 後端伺服器啟動（需要手動啟動）
- [ ] Stripe Webhook 轉發啟動（需要手動啟動）
- [ ] API 測試（可選）

## 📚 相關文件

- `docs/STRIPE-SETUP.md` - 完整設定指南
- `docs/STRIPE-CLI-SETUP.md` - Stripe CLI 詳細說明
- `STRIPE-WEBHOOK-快速設定.md` - Webhook 快速設定
- `STRIPE-設定檢查清單.md` - 檢查清單

## 🎯 下一步

1. **啟動服務**：按照上面的步驟啟動後端和 Webhook 轉發
2. **測試功能**：使用測試腳本或手動測試 API
3. **整合前端**：在前端實作付款頁面（可選）

## 💡 提示

- Stripe Webhook 轉發需要一直運行，不要關閉該終端
- 使用 Stripe 測試卡號進行測試：`4242 4242 4242 4242`
- 所有測試都在 Stripe Test mode 進行，不會產生實際費用

---

**設定完成！** 🎉
