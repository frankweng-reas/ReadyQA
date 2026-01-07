# Chatbot 建立功能規格文件

## 📋 概述

Chatbot 建立功能允許用戶建立新的聊天機器人，自動設置預設主題和配置，並建立對應的 Elasticsearch 索引。

### 核心架構

```
Frontend (Dashboard)
    ↓ 用戶輸入名稱/描述
    ↓ POST /api/chatbots
Backend (ChatbotsService)
    ↓ 驗證資料
    ↓ 建立 Chatbot 記錄
    ↓ 自動設置預設主題
    ↓ 建立 ES 索引（可選）
PostgreSQL + Elasticsearch
```

---

## 🔐 建立流程

### 1. 前端建立流程

**檔案**: `apps/frontend/src/app/[locale]/dashboard/page.tsx`

**流程**:
1. 用戶在 Dashboard 點擊「新增 Chatbot」按鈕
2. 輸入 Chatbot 名稱（必填）和描述（選填）
3. 前端生成唯一 ID：`timestamp_randomString`
4. 呼叫 `chatbotApi.create()` → Backend API
5. 建立成功後重新載入列表

**關鍵程式碼**:
```typescript
const handleCreateChatbot = async () => {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 11)
  const id = `${timestamp}_${randomStr}`

  await chatbotApi.create({
    id,
    name,
    description: description || undefined,
    userId: postgresUserId,
    status: 'published', // 狀態欄位保留用，目前沒有控制功能
  })
}
```

### 2. 後端建立流程

**檔案**: `apps/backend/src/chatbots/chatbots.service.ts`

**流程**:
1. 接收 `CreateChatbotDto`
2. 如果沒有提供 ID，自動生成
3. 檢查 ID 是否已存在
4. 如果沒有提供 `tenantId`，從 `userId` 取得
5. 設置預設值：
   - `status`: 'published'（保留用，目前沒有控制功能）
   - `isActive`: 'active'
   - `theme`: 使用 `getDefaultTheme()`
   - `domainWhitelist`: 使用 `getDefaultDomainWhitelist()`
6. 建立 Chatbot 記錄
7. 建立 Elasticsearch 索引（如果 ES 可用，失敗不影響建立）

**關鍵程式碼**:
```typescript
async create(createDto: CreateChatbotDto) {
  const chatbotId = createDto.id || generateChatbotId()
  
  // 檢查 ID 是否存在
  const existing = await this.prisma.chatbot.findUnique({
    where: { id: chatbotId }
  })
  
  // 建立 Chatbot
  const chatbot = await this.prisma.chatbot.create({
    data: {
      id: chatbotId,
      userId: createDto.userId,
      tenantId: tenantId,
      name: createDto.name,
      theme: createDto.theme || getDefaultTheme(),
      // ...
    }
  })
  
  // 建立 ES 索引（可選）
  if (this.elasticsearchService.isAvailable()) {
    await this.elasticsearchService.createFaqIndex(chatbotId)
  }
}
```

---

## 📝 預設配置

### 預設主題

**檔案**: `apps/backend/src/chatbots/default-theme.ts`

**主要設定**:
- 背景色：白色
- Header：漸層背景（紅色系）
- 標題：「AI 知識助手」
- 副標題：「不生成、不猜測、快速找到正確答案」
- 輸入框：底部位置
- 語音功能：預設關閉

### 預設網域白名單

**設定**:
- `enabled`: false（預設關閉）
- `domains`: []（空陣列）

---

## 🛡️ 驗證機制

### 前端驗證

- Chatbot 名稱：必填
- 用戶必須已登入（`postgresUserId` 必須存在）

### 後端驗證

- ID 唯一性檢查
- DTO 驗證（使用 class-validator）
- 用戶存在性檢查（透過 `userId` 取得 `tenantId`）

---

## 🔌 API 端點

| 端點 | 方法 | 說明 | 認證 | 請求體 |
|------|------|------|------|--------|
| `/api/chatbots` | POST | 建立新 Chatbot | ❌ 公開 | `CreateChatbotDto` |
| `/api/chatbots` | GET | 取得 Chatbot 列表 | ❌ 公開 | Query params |
| `/api/chatbots/:id` | GET | 取得單一 Chatbot | ❌ 公開 | - |
| `/api/chatbots/:id` | PATCH | 更新 Chatbot | ❌ 公開 | `UpdateChatbotDto` |
| `/api/chatbots/:id` | DELETE | 刪除 Chatbot | ❌ 公開 | - |
| `/api/chatbots/:id/stats` | GET | 取得統計資料 | ❌ 公開 | - |
| `/api/chatbots/:id/public-config` | GET | 取得公開配置 | ❌ 公開 | - |
| `/api/chatbots/:id/upload-logo` | POST | 上傳 Logo | ❌ 公開 | FormData |

### CreateChatbotDto

```typescript
{
  id: string                    // Chatbot ID（可選，會自動生成）
  userId: number               // 用戶 ID（必填）
  tenantId?: string            // 租戶 ID（可選，會自動取得）
  name: string                // Chatbot 名稱（必填）
  description?: string         // 描述（選填）
  status?: string             // 狀態（保留用，目前沒有控制功能，預設 'published'）
  isActive?: string           // 啟用狀態（預設 'active'）
  theme?: any                 // 主題配置（預設使用 getDefaultTheme()）
  domainWhitelist?: any       // 網域白名單（預設使用 getDefaultDomainWhitelist()）
}
```

---

## 📁 檔案結構

### Frontend

```
apps/frontend/src/
├── app/
│   └── [locale]/
│       └── dashboard/
│           └── page.tsx                    # Dashboard 頁面（建立 UI）
└── lib/
    └── api/
        └── chatbot.ts                      # Chatbot API 客戶端
```

### Backend

```
apps/backend/src/chatbots/
├── chatbots.module.ts                      # Chatbot 模組
├── chatbots.controller.ts                 # Chatbot API 端點
├── chatbots.service.ts                     # Chatbot 業務邏輯
├── default-theme.ts                        # 預設主題配置
└── dto/
    └── chatbot.dto.ts                      # DTO 定義
```

---

## ⚙️ 環境變數

### Backend

```env
# Elasticsearch（可選）
ELASTICSEARCH_NODE=http://localhost:9200
EMBEDDING_DIMENSIONS=3072

# 資料庫
DATABASE_URL=postgresql://user:pass@host:5432/db
```

**注意**: Elasticsearch 為可選，建立失敗不影響 Chatbot 建立。

---

## 🔄 ID 生成機制

### 格式

```
{timestamp}_{randomString}
```

**範例**: `1767688111182_dddqsliym`

### 生成邏輯

**檔案**: `apps/backend/src/chatbots/default-theme.ts`

```typescript
export const generateChatbotId = (): string => {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 11)
  return `${timestamp}_${randomString}`
}
```

**特點**:
- 時間戳確保唯一性
- 隨機字串增加安全性
- 前端和後端都可生成（後端會驗證唯一性）

---

## 🗄️ 資料庫結構

### Chatbot 表

```sql
model Chatbot {
  id              String    @id
  userId          Int       @default(1)
  tenantId        String?
  name            String
  description     String?
  status          String    @default("published") // 保留用，目前沒有控制功能
  isActive        String    @default("active")
  theme           Json?
  domainWhitelist Json?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  user            User      @relation(...)
  tenant          Tenant?   @relation(...)
  faqs            Faq[]
  topics          Topic[]
  sessions        Session[]
  queryLogs       QueryLog[]

  @@index([userId])
  @@index([tenantId])
  @@index([isActive])
}
```

### 關聯說明

- **User**: 1 對多（一個用戶可有多個 Chatbot）
- **Tenant**: 多對 1（多個 Chatbot 屬於一個租戶）
- **FAQ**: 1 對多（一個 Chatbot 有多個 FAQ）
- **Topic**: 1 對多（一個 Chatbot 有多個分類）
- **Session**: 1 對多（一個 Chatbot 有多個 Session）
- **QueryLog**: 1 對多（一個 Chatbot 有多個查詢記錄）

---

## 🔧 維護重點

### 1. ID 唯一性檢查

**檔案**: `apps/backend/src/chatbots/chatbots.service.ts`

**邏輯**:
- 建立前檢查 ID 是否已存在
- 如果存在，拋出 `BadRequestException`
- 前端和後端都可生成 ID，但後端會驗證

### 2. Tenant ID 自動取得

**邏輯**:
- 如果沒有提供 `tenantId`，從 `userId` 查詢用戶的 `tenantId`
- 確保 Chatbot 與正確的租戶關聯

### 3. 預設值設置

**邏輯**:
- `status`: 預設 'published'（保留用，目前沒有控制功能）
- `isActive`: 預設 'active'
- `theme`: 使用 `getDefaultTheme()` 取得完整預設主題
- `domainWhitelist`: 使用 `getDefaultDomainWhitelist()`（預設關閉）

### 4. Elasticsearch 索引建立

**邏輯**:
- 檢查 ES 是否可用
- 建立對應的 FAQ 索引
- **重要**: ES 索引建立失敗不影響 Chatbot 建立
- 使用 try-catch 包裹，只記錄警告

### 5. 錯誤處理

**前端**:
- 名稱必填驗證
- 用戶登入檢查
- API 錯誤顯示

**後端**:
- ID 重複檢查
- DTO 驗證
- 資料庫錯誤處理

---

## 🐛 常見問題

### Q: 建立 Chatbot 時 ES 索引建立失敗怎麼辦？

**A**: ES 索引建立失敗不影響 Chatbot 建立。Chatbot 會正常建立，但需要手動建立 ES 索引或稍後重試。

### Q: 如何修改預設主題？

**A**: 修改 `apps/backend/src/chatbots/default-theme.ts` 中的 `getDefaultTheme()` 函數。

### Q: Chatbot ID 可以自訂嗎？

**A**: 可以。前端或後端都可以提供自訂 ID，但必須確保唯一性。如果不提供，會自動生成。

### Q: 建立後如何啟用網域白名單？

**A**: 建立後透過 PATCH API 更新 `domainWhitelist.enabled = true` 並設定允許的網域。

### Q: 建立 Chatbot 需要認證嗎？

**A**: 目前 API 是公開的，但需要提供有效的 `userId`。建議未來加入認證保護。

---

## 📚 相關文件

- [認證系統規格](./Spec-Auth.md) - 用戶認證機制
- [Chatbot 列表功能](./CHATBOT-LIST-COMPLETE.md) - Dashboard 列表顯示
- [Elasticsearch 服務](../apps/backend/src/elasticsearch/elasticsearch.service.ts) - ES 索引管理

---

**最後更新**: 2026-01-06  
**維護者**: QAPlus Team

---

## 📌 重要說明

### status 欄位

- **預設值**: `'published'`
- **用途**: 保留用，目前沒有控制功能
- **說明**: 此欄位在建立 Chatbot 時會自動設置為 `'published'`，但系統目前不會根據此欄位進行任何功能控制。實際控制 Chatbot 是否可用的是 `isActive` 欄位。

---

## 🔄 Chatbot 啟用/停用功能

### 概述

`isActive` 欄位用於控制 Chatbot 是否可以使用。當 Chatbot 被停用時，在 embedded mode 下將無法使用。

### 欄位說明

- **欄位名稱**: `isActive`
- **類型**: `String`
- **可能值**: `'active'` | `'inactive'`
- **預設值**: `'active'`
- **資料庫索引**: 有建立索引（`@@index([isActive])`）

### 功能說明

#### 1. 建立時預設值

建立新 Chatbot 時，`isActive` 預設為 `'active'`，表示 Chatbot 建立後立即可用。

```typescript
// 後端自動設置
isActive: createDto.isActive || 'active'
```

#### 2. 前端切換功能

**檔案**: `apps/frontend/src/app/[locale]/dashboard/page.tsx`

在 Dashboard 頁面的 Chatbot 列表中，每個 Chatbot 卡片都有啟用/停用開關：

```typescript
const handleToggleActive = async (
  e: React.MouseEvent,
  id: string,
  currentStatus: string | undefined
) => {
  e.stopPropagation()
  
  const status = currentStatus || 'inactive'
  const newStatus = status === 'active' ? 'inactive' : 'active'
  
  await chatbotApi.update(id, { isActive: newStatus })
  await loadChatbots() // 重新載入列表
}
```

**操作流程**:
1. 用戶點擊 Chatbot 卡片上的開關
2. 前端驗證當前狀態（必須是 `'active'` 或 `'inactive'`）
3. 切換狀態（`'active'` ↔ `'inactive'`）
4. 呼叫 `PATCH /api/chatbots/:id` API 更新
5. 更新成功後重新載入列表

#### 3. Embedded Mode 檢查

**檔案**: `apps/frontend/src/components/chatbot/ChatbotWidget.tsx`

在 embedded mode 下，ChatbotWidget 會檢查 Chatbot 的 `isActive` 狀態：

```typescript
// 使用公開 API 檢查狀態
const response = await chatbotApi.getPublicStatus(chatbotId)
const isActiveValue = response.data?.isActive

if (isActiveValue !== 'active') {
  // Chatbot 已停用，不顯示或顯示停用訊息
  setIsActive(false)
}
```

**行為**:
- 如果 `isActive === 'active'`：Chatbot 正常顯示和使用
- 如果 `isActive === 'inactive'`：Chatbot 不顯示或顯示停用訊息
- 非 embedded mode：不檢查 `isActive`，直接視為啟用

#### 4. API 端點

**更新 isActive**:
```
PATCH /api/chatbots/:id
Body: { "isActive": "active" | "inactive" }
```

**查詢公開狀態**（用於 embedded mode）:
```
GET /api/chatbots/:id/public-status
Response: {
  success: true,
  data: {
    id: string,
    name: string,
    isActive: "active" | "inactive"
  }
}
```

**查詢列表時篩選**:
```
GET /api/chatbots?isActive=active
GET /api/chatbots?isActive=inactive
```

### 使用場景

1. **暫時停用**: 當需要暫時停止某個 Chatbot 的服務時，可以將其設為 `'inactive'`
2. **維護模式**: 在進行維護或更新時，可以停用 Chatbot
3. **測試環境**: 在測試完成前，可以保持停用狀態

### 注意事項

- ⚠️ **狀態驗證**: 系統會嚴格驗證 `isActive` 值，必須是 `'active'` 或 `'inactive'`
- ⚠️ **即時生效**: 狀態更新後，embedded mode 會立即反映新的狀態
- ⚠️ **非 embedded mode**: 在 Dashboard 等非 embedded 環境中，不檢查 `isActive` 狀態
- ⚠️ **與 status 的區別**: `status` 欄位目前沒有控制功能，實際控制使用的是 `isActive`

### 相關檔案

- **前端切換邏輯**: `apps/frontend/src/app/[locale]/dashboard/page.tsx`
- **Embedded 檢查**: `apps/frontend/src/components/chatbot/ChatbotWidget.tsx`
- **API 客戶端**: `apps/frontend/src/lib/api/chatbot.ts`
- **後端服務**: `apps/backend/src/chatbots/chatbots.service.ts`
- **公開狀態 API**: `apps/backend/src/chatbots/chatbots.controller.ts` (getPublicStatus)

