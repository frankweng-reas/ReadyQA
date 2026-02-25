# 監控與告警 - 分步實作計畫

## 目標

1. Health check 含 DB、ES 連線檢查
2. UptimeRobot 監控服務可用性

每一步完成後先測試，確認無誤再做下一步。

---

## 第一步：Health Check 含 DB 連線

**目標**：`/api/health` 驗證 PostgreSQL 是否連線正常。

**修改檔案**：
- [apps/backend/src/app.service.ts](apps/backend/src/app.service.ts)

**作法**：
1. 在 AppService 建構式注入 PrismaService（PrismaModule 已 @Global，無需改 app.module）
2. 將 `getHealth()` 改為 `async getHealth()`，內部呼叫 `this.prisma.$queryRaw\`SELECT 1\``
3. 若 DB 連線失敗，throw 錯誤（Nest 會回 500），回傳格式維持原樣
4. 成功時在回傳物件多加 `database: 'ok'`

**Timeout 建議**：Prisma 預設有連線逾時，可暫時不額外加；若之後有需求再加。

**測試**：
1. 啟動 backend（`npm run dev` in apps/backend）及 postgres（docker-compose）
2. `curl http://localhost:8000/api/health` 應回 200，含 `database: 'ok'`
3. 停止 postgres，再 curl，應回 500 或 503

**狀態**：已完成

---

---

## 第二步：Health Check 含 ES 連線

**目標**：`/api/health` 也驗證 Elasticsearch 是否連線正常。

**前置**：ElasticsearchService 的 client 可能為 null（當 ELASTICSEARCH_HOST 未設定時）。需處理此狀況。

**修改檔案**：
- [apps/backend/src/elasticsearch/elasticsearch.service.ts](apps/backend/src/elasticsearch/elasticsearch.service.ts)：新增 `async isHealthy(): Promise<boolean>`
- [apps/backend/src/app.service.ts](apps/backend/src/app.service.ts)：注入 ElasticsearchService，呼叫 `isHealthy()`

**作法**：
1. 在 ElasticsearchService 新增方法：
   ```typescript
   async isHealthy(): Promise<boolean> {
     if (!this.client) return false; // 未配置 ES 視為跳過檢查
     try {
       await this.client.cluster.health({ timeout: '3s' });
       return true;
     } catch {
       return false;
     }
   }
   ```
2. AppModule 已 import ElasticsearchModule，AppService 可直接注入 ElasticsearchService
3. 在 AppService.getHealth() 中：
   - 若 ES 有配置（ELASTICSEARCH_HOST 存在）且 `!await this.elasticsearch.isHealthy()`，throw 錯誤
   - 成功時在回傳物件多加 `elasticsearch: 'ok'`（有配置時）或 `elasticsearch: 'skipped'`（未配置時）

**測試**：
1. 有 ES 時：curl health 應回 200，含 `elasticsearch: 'ok'`
2. 停止 ES 時：curl health 應回 503
3. 未配置 ELASTICSEARCH_HOST 時：應回 200，含 `elasticsearch: 'skipped'`

**狀態**：已完成

---

---

## 第三步：Health 回傳格式與 503 處理

**目標**：DB 或 ES 異常時回傳 HTTP 503，方便 UptimeRobot 判定為 down。

**修改檔案**：
- [apps/backend/src/app.controller.ts](apps/backend/src/app.controller.ts)：若需由 controller  throw
- [apps/backend/src/app.service.ts](apps/backend/src/app.service.ts)：throw ServiceUnavailableException（Nest 會回 503）

**作法**：
1. 當 DB 或 ES 檢查失敗時，`throw new ServiceUnavailableException({ status: 'unhealthy', ... })`
2. 成功時維持 `status: 'healthy'` 並回 200

**測試**：
1. 正常：`curl -w '%{http_code}' http://localhost:8000/api/health` 應為 200
2. 停止 DB 或 ES：應為 503

**狀態**：已在第一步、第二步一併實作（ServiceUnavailableException）

---

---

## 第四步：UptimeRobot 設定（免程式碼）

**目標**：讓 UptimeRobot 每 5 分鐘檢查 `/api/health`，服務掛了會發信告警。

**步驟**：
1. 至 [uptimerobot.com](https://uptimerobot.com) 註冊
2. 新增 Monitor：
   - Monitor Type: HTTP(s)
   - Friendly Name: 例如 `QAPlus API`
   - URL: `https://你的正式環境網域/api/health`（或 staging 網域）
   - Monitoring Interval: 5 分鐘
3. 新增 Alert Contact（Email）
4. 儲存後，UptimeRobot 會開始監控

**測試**：
1. 在 UptimeRobot  dashboard 確認 monitor 顯示為 Up（綠色）
2. 暫時關閉 backend 或斷開 DB/ES，等一輪檢查週期，確認收到 Alert

**完成**：到此兩大項（Health check、UptimeRobot）皆完成。

**詳細步驟**：見 [UptimeRobot-設定指南.md](UptimeRobot-設定指南.md)
