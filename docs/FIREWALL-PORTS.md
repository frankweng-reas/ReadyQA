# QAPlus 防火牆／埠號一覽

部署在 **readyqa.crossbot.com.tw**（或任何對外伺服器）時，需要開放的埠號與建議設定。

---

## 一、一定要開（對外提供服務）

### 方式 A：使用 Nginx 反向代理（建議，使用者不需打 port）

| 埠號 | 協定 | 用途 | 誰會連進來 |
|------|------|------|------------|
| **80** | TCP | Nginx → 前端 3000 + 後端 /api → 8000 | 使用者瀏覽器 |
| **3000** | TCP | 前端 Next.js（僅 Nginx 連，可不對外開） | localhost |
| **8000** | TCP | 後端 NestJS API（僅 Nginx 連，可不對外開） | localhost |

→ 使用者訪問 `http://readyqa.crossbot.com.tw` 即可，不需 `:3000`。設定檔：`docker/nginx/readyqa.conf`

### 方式 B：直接對外開 3000、8000

| 埠號 | 協定 | 用途 | 誰會連進來 |
|------|------|------|------------|
| **3000** | TCP | 前端 Next.js（網站） | 使用者瀏覽器 |
| **8000** | TCP | 後端 NestJS API | 前端、或直接打 API 的客戶 |

→ 使用者需訪問 `http://readyqa.crossbot.com.tw:3000`，env 需設 `NEXT_PUBLIC_API_URL=...:8000/api`

**建議**：來源設為 `0.0.0.0/0`（全網）或你指定的 IP 段。

---

## 二、要用 Postico 從「自己電腦」連「遠端 PostgreSQL」時才開

| 埠號 | 協定 | 用途 | 誰會連進來 |
|------|------|------|------------|
| **5432** | TCP | PostgreSQL | 你的電腦（Postico） |

- **PostgreSQL 在遠端主機**（例如 readyqa.crossbot.com.tw 對應的 IP）  
  → 要在該主機／GCP 防火牆開 **5432**，Postico 才能從外面連進去。
- **PostgreSQL 在你本機**（localhost）  
  → 不用開 5432，Postico 連 `localhost:5432` 即可。

**安全建議**：5432 來源不要開 `0.0.0.0/0`，只開放你的辦公室／家裡 IP 或 VPN 網段。

---

## 三、可選（僅在需要從外連到該服務時才開）

| 埠號 | 協定 | 用途 | 說明 |
|------|------|------|------|
| **9200** | TCP | Elasticsearch | 專案有設 `ELASTICSEARCH_HOST`。若 ES 跑在同一台且只給本機用，**不必**開 9200。 |

---

## 四、不用開的（出站或外部服務）

- **Supabase**：前端／後端主動連出去，不需開入站埠。
- **Stripe**：同上，Webhook 是 Stripe 打進來你的 **8000**（走同一個 API），所以只要 8000 有開即可。
- **Azure OpenAI / Azure Storage**：出站連線，不需開入站埠。

---

## 五、GCP 設定步驟（一次做齊）

1. 開啟 **Google Cloud Console** → **VPC 網路** → **防火牆**。
2. 新增規則或編輯現有規則，建議：

| 規則名稱範例 | 方向 | 目標 | 來源 IP | 協定／埠 |
|-------------|------|------|---------|----------|
| allow-qaplus-web | 入站 | 所有執行個體（或指定 tag） | 0.0.0.0/0 | tcp:3000 |
| allow-qaplus-api | 入站 | 同上 | 0.0.0.0/0 | tcp:8000 |
| allow-postgres-admin | 入站 | 同上 | 你的 IP 或 IP 範圍 | tcp:5432 |

3. 若 VM 有「**作業系統防火牆**」（如 ufw），也要放行：

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
# 僅在需要從外連 Postico 時：
sudo ufw allow 5432/tcp
sudo ufw reload
sudo ufw status
```

---

## 六、快速對照

- 只給別人用網站：開 **3000**、**8000**。
- 還要從自己電腦用 Postico 連遠端 DB：再開 **5432**（並限來源 IP）。
- Elasticsearch 只本機用：**9200 不開**。
