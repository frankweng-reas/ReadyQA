/**
 * Embedding 服務模組
 * 
 * 此模組提供文本向量化功能，用於 Elasticsearch 混合搜索。
 * 參考 AnswerGO 的 embedding_service.py
 * 
 * 主要功能：
 * - generateEmbedding(): 生成 Dense Embedding（語義向量）
 * 
 * 設計原則：
 * - 支持 OpenAI 和 Azure OpenAI 模型
 * - 統一的錯誤處理和驗證機制
 * - 模型配置緩存，減少配置讀取
 */

import axios, { AxiosError } from 'axios';
import { ModelConfigService } from './model-config.service';

// ============================================================================
// 模組級緩存
// ============================================================================

// 緩存模型配置，避免每次調用都讀環境變數
const modelConfigService = new ModelConfigService();
let cachedModelConfig: ReturnType<typeof modelConfigService.getCurrentEmbeddingModel> | null = null;

function getModelConfig(forceRefresh: boolean = false) {
  if (forceRefresh || cachedModelConfig === null) {
    cachedModelConfig = modelConfigService.getCurrentEmbeddingModel();
  }
  return cachedModelConfig;
}

export function clearModelConfigCache(): void {
  cachedModelConfig = null;
}

// ============================================================================
// 常數定義
// ============================================================================

// HTTP 請求超時時間（毫秒）
const REQUEST_TIMEOUT = 30000;

// API 端點路徑
const EMBEDDINGS_ENDPOINT = '/embeddings';

// 錯誤訊息
const ERROR_NO_MODEL_CONFIG = '請先設置 OPENAI_API_KEY 環境變數';
const ERROR_NO_API_KEY = '未設置 API Key，無法生成向量';
const ERROR_API_FORMAT = 'API 回應格式錯誤: 找不到 embedding 數據';
const ERROR_API_FAILED = 'Embedding API 失敗 ({status}): {detail}';
const ERROR_CONNECTION = '無法連接到 API 伺服器: {error}';

// ============================================================================
// 輔助函數
// ============================================================================

function validateModelConfig(modelConfig: any): void {
  if (!modelConfig) {
    throw new Error(ERROR_NO_MODEL_CONFIG);
  }

  if (!modelConfig.apiKey) {
    throw new Error(ERROR_NO_API_KEY);
  }
}

function buildApiEndpoint(
  apiUrl: string,
  provider: string = 'openai',
  apiVersion?: string,
  modelName?: string,
): string {
  // 移除尾部斜線
  const baseUrl = apiUrl.replace(/\/$/, '');

  if (provider === 'azure-openai') {
    // Azure OpenAI URL 格式：https://<resource-name>.openai.azure.com/openai/deployments/<deployment-name>/embeddings?api-version=...
    if (!apiVersion) {
      apiVersion = '2024-02-15-preview'; // 預設版本
    }
    if (!modelName) {
      throw new Error('Azure OpenAI 需要提供 modelName（部署名稱）');
    }
    // modelName 在 Azure OpenAI 中是部署名稱（Deployment Name）
    return `${baseUrl}/openai/deployments/${modelName}${EMBEDDINGS_ENDPOINT}?api-version=${apiVersion}`;
  } else {
    // 標準 OpenAI URL 格式：https://api.openai.com/v1/embeddings
    return `${baseUrl}${EMBEDDINGS_ENDPOINT}`;
  }
}

function buildRequestHeaders(apiKey: string, provider: string = 'openai'): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // 根據 provider 選擇不同的認證方式
  if (provider === 'azure-openai') {
    // Azure OpenAI 使用 'api-key' header
    headers['api-key'] = apiKey;
  } else {
    // 標準 OpenAI 使用 'Authorization: Bearer' header
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

function buildRequestPayload(modelName: string, text: string): Record<string, any> {
  return {
    model: modelName,
    input: text,
  };
}

function extractEmbeddingFromResponse(data: any): number[] {
  if (data.data && data.data.length > 0) {
    return data.data[0].embedding;
  } else {
    throw new Error(ERROR_API_FORMAT);
  }
}

function handleApiError(error: any): Error {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      // HTTP 狀態錯誤（4xx, 5xx）
      let errorDetail = '未知錯誤';
      try {
        const errorData: any = axiosError.response.data;
        errorDetail = errorData?.error?.message || String(error);
      } catch {
        errorDetail = String(error);
      }

      return new Error(
        ERROR_API_FAILED.replace('{status}', String(axiosError.response.status)).replace(
          '{detail}',
          errorDetail,
        ),
      );
    } else if (axiosError.request) {
      // 請求錯誤（連線失敗、超時等）
      return new Error(ERROR_CONNECTION.replace('{error}', String(error)));
    }
  }

  // 其他未知錯誤
  return new Error(`未知錯誤: ${String(error)}`);
}

// ============================================================================
// 核心函數：基礎 Embedding
// ============================================================================

/**
 * 生成文本的向量表示（Dense Embedding）
 * 
 * 此函數調用 Embedding API（如 OpenAI text-embedding-3-large）將文本轉換為
 * 高維向量，用於語意相似度計算。
 * 
 * @param text 要向量化的文本
 * @returns 向量數組（number[]），維度取決於使用的模型
 * @throws Error 以下情況會拋出異常：
 *   - 模型配置不存在
 *   - API Key 未設置
 *   - API 回應格式錯誤
 *   - API 調用失敗（網路錯誤、認證失敗等）
 * 
 * @example
 * const embedding = await generateEmbedding("如何重置密碼？");
 * console.log(embedding.length); // 例如: 3072 (OpenAI text-embedding-3-large)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // 1. 獲取並驗證模型配置（使用緩存）
  // 如果驗證失敗，清除緩存並重試一次（配置可能剛被更新）
  let modelConfig = getModelConfig();
  try {
    validateModelConfig(modelConfig);
  } catch {
    // 配置可能剛被更新，清除緩存並重新讀取
    modelConfig = getModelConfig(true);
    validateModelConfig(modelConfig);
  }

  // 2. 構建 API 請求
  const apiUrl = modelConfig!.apiUrl;
  const provider = modelConfig!.provider || 'openai';
  const apiVersion = modelConfig!.apiVersion;
  const modelName = modelConfig!.modelName;
  const endpoint = buildApiEndpoint(apiUrl, provider, apiVersion, modelName);
  const headers = buildRequestHeaders(modelConfig!.apiKey, provider);
  const payload = buildRequestPayload(modelConfig!.modelName, text);

  // 3. 發送 HTTP 請求
  try {
    const response = await axios.post(endpoint, payload, {
      headers,
      timeout: REQUEST_TIMEOUT,
    });

    // 4. 提取並返回 embedding
    return extractEmbeddingFromResponse(response.data);
  } catch (error) {
    // 5. 錯誤處理
    throw handleApiError(error);
  }
}

