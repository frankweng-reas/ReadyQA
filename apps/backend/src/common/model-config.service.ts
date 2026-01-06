import { Injectable } from '@nestjs/common';

/**
 * 模型配置管理
 * 從環境變數讀取模型配置
 * 
 * 參考 AnswerGO 的 model_config.py
 * 
 * 支援的函數：
 *   - getCurrentEmbeddingModel()  # 獲取 Embedding 模型配置
 *   - getCurrentLLMModel()        # 獲取 LLM 模型配置
 * 
 * 支援的 Provider：
 *   - 'openai': 標準 OpenAI API
 *   - 'azure-openai': Azure OpenAI API
 */

interface ModelConfig {
  id: string;
  modelName: string;
  type: 'embedding' | 'llm';
  temperature?: number | null;
  maxTokens?: number | null;
  provider: string;
  apiKey: string;
  apiUrl: string;
  apiVersion?: string;
}

@Injectable()
export class ModelConfigService {
  /**
   * 獲取當前選擇的 embedding 模型配置（全部從環境變數讀取）
   * 
   * 支援的環境變數：
   * - OPENAI_API_KEY: API 密鑰（必需）
   * - OPENAI_PROVIDER: Provider 類型，'openai' 或 'azure-openai'（預設：'openai'）
   * - OPENAI_API_URL: API URL（預設：'https://api.openai.com/v1'）
   * - EMBEDDING_MODEL: 模型名稱（預設：'text-embedding-3-large'）
   * - AZURE_OPENAI_API_VERSION: Azure API 版本（僅 Azure OpenAI 需要，預設：'2024-02-15-preview'）
   */
  getCurrentEmbeddingModel(): ModelConfig | null {
    // 從環境變數讀取配置
    const apiKey = process.env.OPENAI_API_KEY;
    const provider = (process.env.OPENAI_PROVIDER || 'openai').toLowerCase();
    const modelName = process.env.EMBEDDING_MODEL || 'text-embedding-3-large';

    // 根據 provider 設置預設 API URL
    let apiUrl: string;
    let apiVersion: string | undefined;

    if (provider === 'azure-openai') {
      const defaultApiUrl = process.env.AZURE_OPENAI_ENDPOINT || '';
      if (!defaultApiUrl) {
        console.warn('警告: Azure OpenAI 需要設置 AZURE_OPENAI_ENDPOINT 環境變數');
        return null;
      }
      apiUrl = defaultApiUrl.replace(/\/$/, '');
      apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
    } else {
      apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
      apiVersion = undefined;
    }

    if (!apiKey) {
      console.warn('警告: 環境變數 OPENAI_API_KEY 未設置');
      return null;
    }

    const config: ModelConfig = {
      id: 'env_embedding',
      modelName,
      type: 'embedding',
      temperature: null,
      maxTokens: null,
      provider,
      apiKey,
      apiUrl,
    };

    // Azure OpenAI 需要額外的 API 版本參數
    if (apiVersion) {
      config.apiVersion = apiVersion;
    }

    return config;
  }

  /**
   * 獲取當前選擇的 LLM 模型配置（全部從環境變數讀取）
   * 
   * 支援的環境變數：
   * - OPENAI_API_KEY: API 密鑰（必需）
   * - OPENAI_PROVIDER: Provider 類型，'openai' 或 'azure-openai'（預設：'openai'）
   * - OPENAI_API_URL: API URL（預設：'https://api.openai.com/v1'）
   * - LLM_MODEL: 模型名稱（預設：'gpt-4o-mini'）
   * - LLM_TEMPERATURE: 溫度參數（預設：0.7）
   * - LLM_MAX_TOKENS: 最大 token 數（預設：1000）
   * - AZURE_OPENAI_API_VERSION: Azure API 版本（僅 Azure OpenAI 需要，預設：'2024-02-15-preview'）
   */
  getCurrentLLMModel(): ModelConfig | null {
    // 從環境變數讀取配置
    const apiKey = process.env.OPENAI_API_KEY;
    const provider = (process.env.OPENAI_PROVIDER || 'openai').toLowerCase();
    const modelName = process.env.LLM_MODEL || 'gpt-4o-mini';

    // 從環境變數讀取 temperature 和 max_tokens（可選）
    // 處理可能包含註釋的值（例如："3000 #output tokens限制"）
    let temperatureStr = process.env.LLM_TEMPERATURE || '0.7';
    if (temperatureStr.includes('#')) {
      temperatureStr = temperatureStr.split('#')[0];
    }
    const temperature = parseFloat(temperatureStr.trim());

    let maxTokensStr = process.env.LLM_MAX_TOKENS || '1000';
    if (maxTokensStr.includes('#')) {
      maxTokensStr = maxTokensStr.split('#')[0];
    }
    const maxTokens = parseInt(maxTokensStr.trim(), 10);

    // 根據 provider 設置預設 API URL
    let apiUrl: string;
    let apiVersion: string | undefined;

    if (provider === 'azure-openai') {
      const defaultApiUrl = process.env.AZURE_OPENAI_ENDPOINT || '';
      if (!defaultApiUrl) {
        console.warn('警告: Azure OpenAI 需要設置 AZURE_OPENAI_ENDPOINT 環境變數');
        return null;
      }
      apiUrl = defaultApiUrl.replace(/\/$/, '');
      apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
    } else {
      apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1';
      apiVersion = undefined;
    }

    if (!apiKey) {
      console.warn('警告: 環境變數 OPENAI_API_KEY 未設置');
      return null;
    }

    const config: ModelConfig = {
      id: 'env_llm',
      modelName,
      type: 'llm',
      temperature,
      maxTokens,
      provider,
      apiKey,
      apiUrl,
    };

    // Azure OpenAI 需要額外的 API 版本參數
    if (apiVersion) {
      config.apiVersion = apiVersion;
    }

    return config;
  }
}
