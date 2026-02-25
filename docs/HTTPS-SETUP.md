# ReadyQA HTTPS 設定

## 簡要說明

1. **Certbot**：用 Let's Encrypt 取得免費 SSL 憑證
2. **Nginx**：用 HTTPS 設定檔取代原本 HTTP
3. **Env**：將 `http://` 改為 `https://` 後重新 build

---

## 步驟 1：安裝 Certbot 並取得憑證

```bash
# 安裝
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 確保目前為 HTTP 設定（port 80 正常）
# 取得憑證（需 port 80 可從外網訪問）
sudo certbot certonly --nginx -d readyqa.crossbot.com.tw
```

依提示輸入 email，完成後憑證在 `/etc/letsencrypt/live/readyqa.crossbot.com.tw/`。Certbot 會建立 `options-ssl-nginx.conf` 和 `ssl-dhparams.pem`。

---

## 步驟 2：啟用 HTTPS Nginx 設定

```bash
# 從專案目錄執行
sudo cp docker/nginx/readyqa-https.conf /etc/nginx/sites-available/readyqa.conf
sudo mkdir -p /var/www/html

# 測試並重載
sudo nginx -t && sudo systemctl reload nginx
```

---

## 步驟 3：開放防火牆 443

```bash
sudo ufw allow 443/tcp
sudo ufw reload
```

---

## 步驟 4：更新環境變數

將 `apps/backend/.env` 和 `apps/frontend/.env.local` 中的 `http://` 改為 `https://`：

```bash
# backend/.env
FRONTEND_URL=https://readyqa.crossbot.com.tw
NEXT_PUBLIC_API_URL=https://readyqa.crossbot.com.tw/api
NEXT_PUBLIC_APP_URL=https://readyqa.crossbot.com.tw

# frontend/.env.local
NEXT_PUBLIC_API_URL=https://readyqa.crossbot.com.tw/api
NEXT_PUBLIC_APP_URL=https://readyqa.crossbot.com.tw
```

---

## 步驟 5：重新 build 前端

```bash
cd apps/frontend && npm run build
```

重啟後端與前端服務。

---

## 憑證自動續期

Certbot 會建立 cron 或 systemd timer，憑證會自動續期。可手動測試：

```bash
sudo certbot renew --dry-run
```

---

## 其他注意事項

- **Supabase**：若使用自訂 callback URL，需在 Supabase Dashboard 中新增 `https://readyqa.crossbot.com.tw/...`
- **Stripe**：Webhook URL 需改為 `https://readyqa.crossbot.com.tw/api/stripe/webhook`
