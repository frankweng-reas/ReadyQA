# Stripe Webhook 快速設定

## ✅ 已完成
- ✅ Stripe CLI 已安裝 (v1.35.0)

## 🚀 接下來請執行以下步驟

### 步驟 1: 登入 Stripe CLI

在終端執行：
```bash
stripe login
```

這會：
- 開啟瀏覽器
- 要求你授權 Stripe CLI
- 完成後顯示 "Done!"

### 步驟 2: 啟動後端（如果還沒啟動）

開啟**終端 1**：
```bash
cd apps/backend
npm run dev
```

確保後端運行在 `http://localhost:8000`

### 步驟 3: 啟動 Stripe Webhook 轉發

開啟**終端 2**（新的終端視窗），執行：
```bash
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
```

你會看到類似這樣的輸出：
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

### 步驟 4: 複製 Webhook Secret

複製 `whsec_...` 的值（整串），然後更新 `.env.local`：

```env
STRIPE_WEBHOOK_SECRET=whsec_你的值
```

### 步驟 5: 重啟後端

在**終端 1**（後端運行的終端）：
1. 按 `Ctrl+C` 停止後端
2. 重新執行 `npm run dev`

## ✅ 完成！

現在 Webhook 已經設定完成。你可以：

1. **測試 Webhook**（在終端 2 運行的同時，開啟終端 3）：
   ```bash
   stripe trigger checkout.session.completed
   ```

2. **查看後端日誌**（終端 1），應該會看到：
   ```
   [StripeService] Received webhook event: checkout.session.completed
   ```

## 📝 注意事項

- **終端 2**（`stripe listen`）需要一直運行，不要關閉
- 同一個 Stripe CLI session 的 `whsec_...` 可以重複使用
- 如果後端無法接收 Webhook，檢查：
  - 後端是否運行在 `http://localhost:8000`
  - `stripe listen` 是否正在運行
  - `.env.local` 中的 `STRIPE_WEBHOOK_SECRET` 是否正確

## 🛠️ 快速命令參考

```bash
# 登入（只需執行一次）
stripe login

# 啟動 Webhook 轉發（每次開發時執行）
stripe listen --forward-to http://localhost:8000/api/stripe/webhook

# 測試 Webhook
stripe trigger checkout.session.completed
```
