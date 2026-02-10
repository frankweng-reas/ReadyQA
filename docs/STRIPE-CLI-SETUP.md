# Stripe CLI 本地開發 Webhook 設定指南

## 📋 概述

使用 Stripe CLI 可以在本地開發環境接收 Stripe Webhook 事件，無需部署到生產環境。

## 🔧 安裝步驟

### macOS

```bash
# 使用 Homebrew（推薦）
brew install stripe/stripe-cli/stripe

# 或下載二進位檔案
# 前往：https://github.com/stripe/stripe-cli/releases
# 下載對應 macOS 的版本並解壓縮
```

### Linux

```bash
# 下載並安裝
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

### Windows

1. 前往：https://github.com/stripe/stripe-cli/releases
2. 下載 `stripe_X.X.X_windows_x86_64.zip`
3. 解壓縮並將 `stripe.exe` 加入 PATH

## 🚀 使用步驟

### 1. 登入 Stripe CLI

```bash
stripe login
```

這會：
- 開啟瀏覽器
- 要求你授權 Stripe CLI 存取你的 Stripe 帳號
- 完成後會顯示 "Done! The Stripe CLI is configured"

### 2. 啟動後端伺服器

確保後端正在運行：

```bash
cd apps/backend
npm run dev
```

後端應該運行在 `http://localhost:8000`

### 3. 啟動 Stripe Webhook 轉發

開啟**新的終端視窗**，執行：

```bash
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
```

### 4. 複製 Webhook Signing Secret

執行 `stripe listen` 後，會顯示類似以下的輸出：

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

**重要**：複製這個 `whsec_...` 的值！

### 5. 更新環境變數

將複製的 Webhook Signing Secret 填入 `.env.local`：

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

### 6. 重啟後端伺服器

更新環境變數後，需要重啟後端：

```bash
# 停止後端（Ctrl+C）
# 然後重新啟動
cd apps/backend
npm run dev
```

## ✅ 驗證設定

### 測試 Webhook

在 `stripe listen` 運行的終端中，開啟**另一個終端**，執行：

```bash
# 觸發測試事件
stripe trigger checkout.session.completed
```

你應該會看到：

1. **在 `stripe listen` 終端**：
   ```
   --> checkout.session.completed [evt_xxxxx]
   <-- [200] POST http://localhost:8000/api/stripe/webhook [evt_xxxxx]
   ```

2. **在後端日誌**：
   ```
   [StripeService] Received webhook event: checkout.session.completed
   [StripeService] Updated tenant xxx to plan starter after successful checkout
   ```

### 測試其他事件

```bash
# 訂閱更新
stripe trigger customer.subscription.updated

# 訂閱取消
stripe trigger customer.subscription.deleted
```

## 🔍 常見問題

### 問題 1: `stripe: command not found`

**解決方法**：
- 確認 Stripe CLI 已正確安裝
- 確認已加入 PATH
- macOS: `brew install stripe/stripe-cli/stripe`
- 重新開啟終端

### 問題 2: Webhook 驗證失敗

**可能原因**：
- `STRIPE_WEBHOOK_SECRET` 不正確
- 後端未啟用 `rawBody: true`（已設定）
- Webhook URL 錯誤

**解決方法**：
- 確認複製的是完整的 `whsec_...` 值
- 確認後端運行在正確的 port（8000）
- 檢查後端日誌錯誤訊息

### 問題 3: 後端無法接收 Webhook

**檢查清單**：
- ✅ 後端是否運行在 `http://localhost:8000`
- ✅ `stripe listen` 是否正在運行
- ✅ `--forward-to` URL 是否正確
- ✅ 後端是否有 `rawBody: true`（已在 `main.ts` 設定）

### 問題 4: 每次重啟都需要新的 Secret？

**答案**：不需要！

- 同一個 Stripe CLI session 的 `whsec_...` 可以重複使用
- 只有當你：
  - 重新執行 `stripe login`
  - 或使用不同的 Stripe 帳號
  - 才會需要更新 Secret

## 💡 使用技巧

### 同時監聽多個事件

`stripe listen` 會自動轉發所有 Stripe 事件到你的後端。你可以在後端程式碼中選擇要處理的事件。

### 查看 Webhook 事件詳情

```bash
# 查看所有事件
stripe events list

# 查看特定事件
stripe events retrieve evt_xxxxx
```

### 過濾特定事件

```bash
# 只轉發特定事件
stripe listen --events checkout.session.completed,customer.subscription.updated --forward-to http://localhost:8000/api/stripe/webhook
```

### 在背景運行

```bash
# macOS/Linux
stripe listen --forward-to http://localhost:8000/api/stripe/webhook > stripe-webhook.log 2>&1 &

# 停止
pkill -f "stripe listen"
```

## 📝 完整工作流程範例

```bash
# 終端 1: 啟動後端
cd apps/backend
npm run dev

# 終端 2: 啟動 Stripe Webhook 轉發
stripe listen --forward-to http://localhost:8000/api/stripe/webhook
# 複製顯示的 whsec_... 到 .env.local

# 終端 3: 更新環境變數後重啟後端（終端 1）
# Ctrl+C 停止，然後重新執行 npm run dev

# 終端 2: 測試 Webhook
stripe trigger checkout.session.completed
```

## 🎯 下一步

設定完成後，可以：

1. 測試建立 Checkout Session
2. 使用 Stripe 測試卡號進行付款
3. 驗證 Webhook 是否正確更新資料庫

測試卡號：
- 卡號：`4242 4242 4242 4242`
- 到期日：任何未來日期
- CVC：任何 3 位數
- 郵遞區號：任何 5 位數
