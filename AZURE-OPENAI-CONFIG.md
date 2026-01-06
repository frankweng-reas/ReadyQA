# Azure OpenAI 配置說明

## ✅ 已完成的設定

你的 `.env.local` 中已有：

```env
OPENAI_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://ptsc-openai-dev-api.openai.azure.com
OPENAI_API_KEY=Esrj0tYuTIV9KxbI2Er25O83m4rJDf2nh8ZJoQ2xr67bue4Y7OHqJQQJ99BLACHYHv6XJ3w3AAABACOGcOpn
AZURE_OPENAI_API_VERSION=2025-01-01-preview
WHISPER_DEPLOYMENT_NAME=whisper
```

## 📝 需要補充的設定

請在 `.env.local` 中添加 **Embedding 模型的部署名稱**：

```env
# Embedding 模型部署名稱（在 Azure Portal 中查看）
EMBEDDING_MODEL=text-embedding-3-large

# (可選) LLM 模型部署名稱（如果有使用 LLM 功能）
# LLM_MODEL=gpt-4o-mini
# LLM_TEMPERATURE=0.7
# LLM_MAX_TOKENS=1000
```

## 🔍 如何找到部署名稱？

1. 登入 [Azure Portal](https://portal.azure.com/)
2. 找到你的 Azure OpenAI 資源：`ptsc-openai-dev-api`
3. 進入「模型部署」(Model deployments)
4. 查看以下部署：
   - ✅ Whisper 部署名稱：`whisper` (已設定)
   - ❓ Embedding 部署名稱：`text-embedding-3-large` 或其他名稱

## 📋 完整的環境變數清單

```env
# ============================================================================
# Azure OpenAI 配置
# ============================================================================

# Provider 類型（必需）
OPENAI_PROVIDER=azure-openai

# Azure OpenAI Endpoint（必需）
AZURE_OPENAI_ENDPOINT=https://ptsc-openai-dev-api.openai.azure.com

# API Key（必需）
OPENAI_API_KEY=Esrj0tYuTIV9KxbI2Er25O83m4rJDf2nh8ZJoQ2xr67bue4Y7OHqJQQJ99BLACHYHv6XJ3w3AAABACOGcOpn

# API Version（必需）
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# ============================================================================
# 模型部署名稱
# ============================================================================

# Whisper 語音轉文字（必需，用於語音輸入）
WHISPER_DEPLOYMENT_NAME=whisper

# Embedding 向量模型（必需，用於語意搜索）
EMBEDDING_MODEL=text-embedding-3-large

# LLM 語言模型（可選，用於 AI 問答）
# LLM_MODEL=gpt-4o-mini
# LLM_TEMPERATURE=0.7
# LLM_MAX_TOKENS=1000
```

## 🎯 服務對應關係

| 功能 | 使用的服務 | 部署名稱環境變數 |
|------|-----------|-----------------|
| 🎤 語音輸入 | Whisper | `WHISPER_DEPLOYMENT_NAME` |
| 🔍 語意搜索 | Embedding | `EMBEDDING_MODEL` |
| 💬 AI 問答 | LLM | `LLM_MODEL` |

## ✅ 驗證設定

重啟 Backend 後，查看 log 應該會顯示：

```
[WhisperService] 使用 Azure OpenAI - Endpoint: https://ptsc-openai-dev-api.openai.azure.com
[WhisperService] Deployment: whisper, API Version: 2025-01-01-preview
```

## 🚀 重啟服務

設定完成後，重啟 Backend：

```bash
cd apps/backend
npm run dev
```

---

**代碼已經完全支援 Azure OpenAI！** 只需要補充 embedding 模型的部署名稱即可。🎉
