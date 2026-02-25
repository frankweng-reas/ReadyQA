# UptimeRobot 設定指南

## 目的

UptimeRobot 每 5 分鐘檢查你的 API 是否存活，服務掛了會寄信告警。

---

## 步驟

### 1. 註冊

開啟 https://uptimerobot.com ，點右上角 Sign Up 免費註冊。

### 2. 新增 Monitor

登入後，點 **+ Add New Monitor**：

- **Monitor Type**：選 HTTP(s)
- **Friendly Name**：例如 `QAPlus API`（自訂名稱）
- **URL**：填入你的 health 網址，例如：
  - 正式環境：`https://api.你的網域.com/api/health`
  - 或 staging：`https://staging-api.你的網域.com/api/health`
  - 本機測試可用：`http://localhost:8000/api/health`（僅限本機，外網無法存取）
- **Monitoring Interval**：選 5 分鐘
- **Alert Contacts**：勾選你的 Email（若尚未新增，見下方步驟 3）

點 **Create Monitor** 儲存。

### 3. 新增告警聯絡人（若尚未新增）

點左上角 **My Settings** → **Alert Contacts** → **Add Alert Contact**：

- **Alert Contact Type**：Email
- **Friendly Name**：例如 `我的 Email`
- **Email Address**：填入要收告警的信箱
- 勾選要接收的 Alert 類型（建議全選）

儲存後，回到 Add Monitor 頁面，在 Alert Contacts 中勾選此聯絡人。

### 4. 確認運作

- Dashboard 上該 Monitor 應顯示 **Up**（綠色）
- 可暫時關閉 backend 或停止 DB/ES，等約 5 分鐘，應會收到 Down 告警郵件

---

## 備註

- 免費版最多 50 個 monitors、5 分鐘檢查間隔
- URL 必須從外網可存取（localhost 僅限本機測試）
- 若使用 ngrok 等內網穿透，可用 ngrok 提供的 URL 測試
