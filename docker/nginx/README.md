# Nginx 反向代理設定

讓使用者訪問 `readyqa.crossbot.com.tw` 即可，不需打 `:3000`。

**HTTPS**：見 [docs/HTTPS-SETUP.md](../../docs/HTTPS-SETUP.md)

## 部署步驟

### 1. 安裝 Nginx（若尚未安裝）

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nginx -y
```

### 2. 複製設定檔

```bash
# 從專案目錄執行
sudo cp docker/nginx/readyqa.conf /etc/nginx/sites-available/readyqa.conf
sudo ln -sf /etc/nginx/sites-available/readyqa.conf /etc/nginx/sites-enabled/
```

### 3. 測試並重載

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 4. 防火牆

確保 port 80 已開放：

```bash
sudo ufw allow 80/tcp
sudo ufw reload
```

### 5. 更新 env

設定檔已改為使用 `http://readyqa.crossbot.com.tw/api`（無 port），需重新 build 前端：

```bash
cd apps/frontend && npm run build
```

## 架構

```
使用者 → :80 (Nginx) → /     → :3000 (前端)
                    → /api  → :8000 (後端)
```
