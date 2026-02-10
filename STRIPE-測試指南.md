# Stripe 測試指南

## ✅ 測試狀態

### 已完成的測試
- ✅ Webhook 事件觸發成功
- ✅ Stripe CLI 正常運作

## 🧪 測試方法

### 方法 1: 使用測試腳本（推薦）

```bash
./scripts/test-stripe-complete.sh
```

這個腳本會引導你完成所有測試。

### 方法 2: 手動測試

#### 測試 1: Webhook（不需要認證）

**觸發付款完成事件：**
```bash
stripe trigger checkout.session.completed
```

**觸發訂閱更新事件：**
```bash
stripe trigger customer.subscription.updated
```

**觸發訂閱取消事件：**
```bash
stripe trigger customer.subscription.deleted
```

**檢查結果：**
1. 查看 Stripe Webhook 終端，應該顯示：
   ```
   --> checkout.session.completed [evt_xxxxx]
   <-- [200] POST http://localhost:8000/api/stripe/webhook [evt_xxxxx]
   ```

2. 查看後端日誌，應該看到：
   ```
   [StripeService] Received webhook event: checkout.session.completed
   [StripeService] Updated tenant xxx to plan starter after successful checkout
   ```

3. 檢查資料庫：
   ```bash
   ./scripts/test-stripe-complete.sh
   # 選擇選項 5: 查看資料庫狀態
   ```

#### 測試 2: 建立 Checkout Session（需要認證）

**步驟 1: 取得 Supabase Token**

方法 A - 使用瀏覽器（推薦）：
1. 登入前端應用：http://localhost:3000
2. 打開瀏覽器開發者工具 (F12)
3. 切換到 Console 標籤
4. 執行：
   ```javascript
   const { createClient } = await import('/src/lib/supabase/client');
   const supabase = createClient();
   const { data } = await supabase.auth.getSession();
   console.log('Token:', data.session.access_token);
   ```
5. 複製顯示的 token

方法 B - 使用測試腳本：
```bash
./scripts/test-stripe-complete.sh
# 選擇選項 2，腳本會引導你輸入 token
```

**步驟 2: 測試 API**

```bash
curl -X POST http://localhost:8000/api/stripe/create-checkout-session \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planCode": "starter"
  }'
```

**成功回應：**
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

**步驟 3: 測試付款**

1. 訪問返回的 `url`
2. 使用 Stripe 測試卡號：
   - 卡號：`4242 4242 4242 4242`
   - 到期日：任何未來日期（例如：12/25）
   - CVC：任何 3 位數（例如：123）
   - 郵遞區號：任何 5 位數（例如：12345）
3. 完成付款
4. 檢查 Webhook 是否自動更新資料庫

## 📊 檢查測試結果

### 檢查資料庫

```bash
cd apps/backend
npx prisma studio
```

在 Prisma Studio 中檢查：
- `subscriptions` 表 - 應該有新訂閱記錄
- `tenants` 表 - `planCode` 應該已更新
- `payments` 表 - 應該有付款記錄（如果有實作）

### 檢查後端日誌

後端日誌應該顯示：
```
[StripeService] Created checkout session cs_test_... for tenant xxx, plan starter
[StripeService] Received webhook event: checkout.session.completed
[StripeService] Updated tenant xxx to plan starter after successful checkout
```

### 檢查 Stripe Dashboard

1. 登入 https://dashboard.stripe.com
2. 切換到 Test mode
3. 查看：
   - **Events** - 應該看到觸發的事件
   - **Customers** - 應該看到新客戶
   - **Subscriptions** - 應該看到新訂閱

## 🔍 常見問題

### Webhook 沒有收到？

1. 確認 `stripe listen` 正在運行
2. 確認後端正在運行
3. 檢查 Stripe Webhook 終端是否有錯誤訊息
4. 檢查後端日誌是否有錯誤

### API 返回 401 Unauthorized？

1. 確認 Supabase token 正確
2. 確認 token 沒有過期
3. 確認後端能連接到 Supabase

### Checkout Session 建立失敗？

1. 確認 Plan 的 `stripePriceId` 已填入資料庫
2. 確認 `STRIPE_SECRET_KEY` 正確
3. 檢查後端日誌錯誤訊息

## 📝 測試檢查清單

- [ ] Webhook 事件觸發成功
- [ ] 後端收到 Webhook
- [ ] 資料庫更新成功
- [ ] Checkout Session 建立成功
- [ ] 測試付款完成
- [ ] 付款後 Webhook 自動更新資料庫

## 🎯 下一步

測試完成後，可以：
1. 整合前端付款頁面
2. 實作訂閱管理功能
3. 實作付款歷史查詢

---

**測試愉快！** 🎉
