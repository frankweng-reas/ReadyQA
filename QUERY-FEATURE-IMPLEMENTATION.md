# QAPlus Chatbot 查詢功能實作完成報告

## 📋 實作概述

已成功實作 QAPlus Chatbot 的查詢功能，參考 AnswerGO 的架構，實現了完整的 FAQ 問答查詢流程。

## ✅ 完成的功能

### 1. 後端實作

#### a. Elasticsearch 混合搜尋（BM25 + kNN）
**檔案**: `apps/backend/src/elasticsearch/elasticsearch.service.ts`
- 實作 `hybridSearch()` 方法
- 支援 BM25 文本搜尋 + kNN 向量搜尋
- 自動過濾 `active` 狀態的 FAQ
- 預設權重：BM25 (0.3) + kNN (0.7)

#### b. Query 模組
**檔案結構**:
```
apps/backend/src/query/
├── query.module.ts         # 模組定義
├── query.controller.ts     # API 端點
├── query.service.ts        # 核心查詢邏輯
├── llm.service.ts          # LLM 調用和回應解析
└── dto/
    └── chat-query.dto.ts   # DTO 定義
```

**功能**:
- `POST /query/chat` - 問答查詢 API
- 完整的查詢流程：
  1. 生成查詢的 embedding
  2. Elasticsearch 混合搜尋
  3. 發送結果給 LLM 進行篩選
  4. 解析 LLM 回應
  5. 記錄搜尋日誌

#### c. LLM 服務
**檔案**: `apps/backend/src/query/llm.service.ts`
- 支援 OpenAI 和 Azure OpenAI
- 實作 System Prompt（與 AnswerGO 一致）
- JSON 回應解析
- 錯誤處理

#### d. ModelConfigService 改造
**檔案**: `apps/backend/src/common/model-config.service.ts`
- 改為 `@Injectable()` 服務
- 支援 DI（Dependency Injection）

### 2. 前端實作

#### a. ChatbotWidget 增強
**檔案**: `apps/frontend/src/components/chatbot/ChatbotWidget.tsx`

**新增狀態**:
```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [isTyping, setIsTyping] = useState(false);
```

**新增功能**:
- `handleSendMessage()` - 發送查詢到後端
- 聊天訊息顯示介面
- QACard 結果展示
- 正在輸入指示器
- 返回知識列表按鈕

**UI 特性**:
- 用戶訊息：藍色背景，右對齊
- 助手訊息：灰色背景，左對齊
- Intro 文字顯示
- QABlock 使用 QACard 元件展示
- 錯誤訊息處理

## 🔧 技術細節

### API 端點

**POST /query/chat**

請求：
```json
{
  "query": "如何重置密碼？",
  "chatbot_id": "chatbot-123"
}
```

回應：
```json
{
  "intro": "以下是可能符合您需求的答案：",
  "qa_blocks": [
    {
      "faq_id": "faq-123",
      "question": "如何重置密碼？",
      "answer": "請點擊「忘記密碼」按鈕...",
      "layout": "text"
    }
  ],
  "log_id": "log-uuid-123"
}
```

### 環境變數需求

必須在 `.env.local` 設置以下變數：

```bash
# OpenAI API 設定
OPENAI_API_KEY=sk-xxx
OPENAI_PROVIDER=openai  # 或 azure-openai
OPENAI_API_URL=https://api.openai.com/v1

# LLM 模型設定
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.7
LLM_MAX_TOKENS=1000

# Embedding 模型設定
EMBEDDING_MODEL=text-embedding-3-large
EMBEDDING_DIMENSIONS=3072

# Elasticsearch 設定
ELASTICSEARCH_HOST=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=admin123456
```

## 📝 測試步驟

### 1. 啟動服務

```bash
# 啟動 Elasticsearch
docker-compose up -d elasticsearch

# 啟動後端
cd apps/backend
npm run start:dev

# 啟動前端
cd apps/frontend
npm run dev
```

### 2. 測試流程

1. **創建 Chatbot**
   - 進入 Dashboard
   - 創建一個新的 Chatbot

2. **添加 FAQ**
   - 進入 Chatbot 知識管理
   - 添加幾個 FAQ（確保狀態為 `active`）
   - FAQ 會自動同步到 Elasticsearch

3. **測試查詢**
   - 進入 Chatbot 測試頁面
   - 在輸入框輸入問題
   - 點擊發送按鈕
   - 應該看到：
     - 用戶訊息顯示（藍色背景，右側）
     - 正在輸入指示器（3 個跳動的點）
     - 助手回應（灰色背景，左側）
     - Intro 文字
     - QACard 列表（展開的 FAQ）

4. **檢查日誌**
   - 後端 console：
     ```
     [Chat] 收到查詢: "如何重置密碼？" (chatbot: xxx)
     [Chat] 生成查詢 embedding...
     [Chat] ✅ Embedding 生成成功，維度: 3072，耗時: XXms
     [Chat] 執行混合搜尋...
     [Chat] ✅ 混合搜尋完成，找到 X 個結果，耗時: XXms
     [Chat] 發送搜尋結果給 LLM...
     [Chat] ✅ LLM 調用成功，耗時: XXms
     [Chat] 解析 LLM 回應...
     [Chat] ✅ 解析完成，返回 X 個 QABlock
     ```

## 🚀 下一步優化建議

1. **Session Token 驗證**
   - 目前 session token 驗證為可選
   - 建議加入完整的 session 驗證邏輯

2. **快取機制**
   - 為常見查詢添加快取
   - 減少 LLM 調用成本

3. **查詢日誌分析**
   - 記錄更多查詢統計資訊
   - 用於後續分析和優化

4. **多語言支援**
   - 目前所有文字都應該使用 `t()`
   - 需要添加翻譯檔

5. **錯誤處理增強**
   - 更友好的錯誤訊息
   - 自動重試機制

6. **效能優化**
   - 添加請求節流
   - 優化 Elasticsearch 查詢

## 📚 參考資料

- **AnswerGO 專案**: `/Users/fweng/answergo`
- **核心參考檔案**:
  - `backend/app/api/ai.py` - 查詢 API
  - `backend/app/services/elastic_service.py` - ES 搜尋
  - `backend/app/services/send_faq_to_llm.py` - LLM 調用
  - `frontend/hooks/useChatMessage.ts` - 前端查詢 Hook

## ✨ 總結

已成功實作完整的 Chatbot 查詢功能，包括：
- ✅ Elasticsearch 混合搜尋
- ✅ LLM 回應處理
- ✅ 前端聊天介面
- ✅ 錯誤處理
- ✅ 日誌記錄

所有程式碼遵循 QAPlus 開發規範，使用 TypeScript 型別定義，無 linter 錯誤。

