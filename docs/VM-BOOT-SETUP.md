# ReadyQA VM 開機自動啟動

VM 重啟後，讓所有 Docker 服務（含 Elasticsearch）依正確順序啟動。

## 問題說明

- `docker compose restart` 或 VM 重啟時，容器可能同時啟動
- Backend 若早於 Elasticsearch 就緒，會出現 `ECONNREFUSED`，ES 連線失敗
- 建立 Chatbot 時就不會建立 ES 索引

## 解決方式：systemd 服務

使用 systemd 在開機後依序啟動，確保 Postgres、ES 先 healthy，再啟動 Backend。

### 安裝

```bash
cd /home/frank_weng/ReadyQA
./scripts/install-readyqa-boot.sh
```

### 指令

| 指令 | 說明 |
|------|------|
| `sudo systemctl enable readyqa-docker` | 啟用開機自動啟動 |
| `sudo systemctl disable readyqa-docker` | 停用開機自動啟動 |
| `sudo systemctl start readyqa-docker` | 立即啟動 |
| `sudo systemctl stop readyqa-docker` | 立即停止 |
| `sudo systemctl status readyqa-docker` | 查看狀態 |

### 啟動順序

1. Postgres（等待 healthy）
2. Elasticsearch（等待 healthy）
3. Backend（ES 已就緒，連線成功）
4. Frontend
5. Nginx

### 手動安裝（若路徑不同）

若專案不在 `/home/frank_weng/ReadyQA`，可手動修改：

```bash
# 複製並編輯
cp docker/readyqa-docker.service /tmp/
# 修改 WorkingDirectory 為你的專案路徑
sudo cp /tmp/readyqa-docker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable readyqa-docker
```
