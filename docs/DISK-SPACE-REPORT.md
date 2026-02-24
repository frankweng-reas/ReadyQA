# 磁碟空間檢查報告

檢查時間：約 2026-02-24

---

## 一、目前狀態

| 項目 | 數值 |
|------|------|
| **根目錄總容量** | 8.6 GB |
| **已使用** | 8.1 GB（約 94%） |
| **剩餘可用** | 約 537 MB |
| **狀態** | ⚠️ 偏滿，建議維持至少 1GB 以上可用 |

Elasticsearch 會因磁碟不足將 index 設為唯讀（之前已幫你解除），若再低於約 5% 可能又觸發。

---

## 二、空間佔用排行

| 目錄 | 約略大小 | 說明 |
|------|----------|------|
| `/var/lib/docker` | 4.1 GB | Docker 映像與資料（ES 約 2.5GB、Postgres 約 0.3GB） |
| `/snap` + `/var/lib/snapd` | 約 3.3 GB | Snap 套件（如 core22、google-cloud-cli、snapd） |
| `/usr` | 2.4 GB | 系統程式，勿刪 |
| `/home/frank_weng` | 1.9 GB | 你的家目錄 |
| └ ReadyQA（含 node_modules） | 約 1.1 GB | 專案與依賴 |
| └ .npm | 345 MB | npm 快取，可定期清理 |
| └ .cursor-server | 339 MB | Cursor 伺服器快取 |

---

## 三、已幫你做過的清理

- ✅ 清理 apt 快取
- ✅ Docker 未使用資源（prune，未刪除使用中的 image）
- ✅ 系統 log 縮減（journal 保留約 50MB）
- ✅ Snap 已停用舊版移除（例如 google-cloud-cli 舊 revision）

目前可用空間從約 **376 MB** 提升到約 **537 MB**。

---

## 四、你可選的後續做法

### A. 不再動磁碟（維持現狀）

- 目前約 537 MB 可用，短期可運作。
- 建議偶爾跑一次：`df -h /` 確認根目錄不要長期低於 400 MB。

### B. 在 GCP 上加大磁碟（最根本）

1. 到 **Google Cloud Console** → **Compute Engine** → **磁碟**。
2. 選這台 VM 的開機磁碟 → **編輯** → 把大小改大（例如 20 GB 或 30 GB）→ 儲存。
3. 回到 VM，擴充分割區（依 OS 不同，例如用 `sudo growpart /dev/sda 1` 與 `sudo resize2fs /dev/root`，或用 GCP 文件對應指令）。
4. 做完再跑一次 `df -h /` 確認容量變大。

這樣 ES、Docker、專案都有足夠空間，不必常清。

### C. 再從本機清一點空間（不加大磁碟時）

可在本機手動執行（不會自動幫你跑）：

```bash
# 清理 npm 快取（可釋放約數十～數百 MB）
npm cache clean --force

# 若不需要舊的 Snap 版本，可再清一次
snap list --all | awk '/disabled/{print $1, $3}'
# 再依列表用: sudo snap remove <name> --revision=<rev>
```

**不建議**在未備份前刪除專案 `node_modules` 或整個專案；若刪除，之後要再跑 `npm install` 或重新 clone。

---

## 五、建議

- **短期**：維持現狀即可，留意 `df -h /` 不要長期低於約 400 MB。
- **長期**：在 GCP 把這台 VM 的磁碟加大到 20 GB 以上，再擴充分割區，最省事也最穩定。

若你願意，我可以再根據你貼的 `df -h` 輸出，幫你判斷要不要再清或怎麼擴充。
