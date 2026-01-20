import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../query/llm.service';
import { ModelConfigService } from '../common/model-config.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly modelConfigService: ModelConfigService,
  ) {}

  /**
   * 生成多張 FAQ 卡片
   */
  async generateCards(
    chatbotId: string,
    content: string,
    cardCount: number,
  ): Promise<{
    success: boolean;
    cards?: Array<{ question: string; answer: string }>;
    usage?: any;
    cost?: any;
    message?: string;
  }> {
    try {
      // 獲取 LLM 配置
      const llmModel = this.modelConfigService.getCurrentLLMModel();
      if (!llmModel) {
        return {
          success: false,
          message: '請設置環境變數 OPENAI_API_KEY',
        };
      }

      // 構建 System Prompt
      const systemPrompt = `你是一個專業的知識卡片生成助手。根據用戶提供的文章內容，生成指定數量的問答（Q&A）卡片。

**要求：**
1. 從文章中提取關鍵信息，生成 ${cardCount} 張 Q&A 卡片
2. 每張卡片包含一個問題（question）和對應的答案（answer）
3. 問題要簡潔明確，答案要完整準確
4. 答案支援 Markdown 格式
5. 必須返回 JSON 格式

**回應格式：**
\`\`\`json
{
  "cards": [
    {
      "question": "問題 1",
      "answer": "答案 1（支援 Markdown）"
    },
    {
      "question": "問題 2",
      "answer": "答案 2（支援 Markdown）"
    }
  ]
}
\`\`\``;

      // 構建用戶消息
      const userMessage = `請根據以下內容生成 ${cardCount} 張 Q&A 卡片：

${content}`;

      // 調用 LLM
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      const result = await this.llmService.callLlmOpenai(
        messages,
        llmModel.apiUrl,
        llmModel.apiKey,
        llmModel.modelName,
        0.7,
        3000,
        llmModel.provider,
        llmModel.apiVersion,
      );

      // 解析回應
      let jsonContent = result.content.trim();

      // 提取 JSON
      const jsonMatch = jsonContent.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      } else {
        const codeBlockMatch = jsonContent.match(/```\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          jsonContent = codeBlockMatch[1].trim();
        }
      }

      const jsonData = JSON.parse(jsonContent);
      const cards = jsonData.cards || [];

      // 計算費用
      const cost = this.calculateCost(result.usage, llmModel.modelName);

      return {
        success: true,
        cards,
        usage: result.usage,
        cost,
      };
    } catch (error: any) {
      this.logger.error(`[generateCards] 錯誤: ${error.message}`);
      return {
        success: false,
        message: error.message || '生成失敗',
      };
    }
  }

  /**
   * 根據標題從內容生成答案
   */
  async generateCardFromTitle(
    chatbotId: string,
    title: string,
    content: string,
  ): Promise<{
    success: boolean;
    answer?: string;
    usage?: any;
    cost?: any;
    message?: string;
  }> {
    try {
      // 獲取 LLM 配置
      const llmModel = this.modelConfigService.getCurrentLLMModel();
      if (!llmModel) {
        return {
          success: false,
          message: '請設置環境變數 OPENAI_API_KEY',
        };
      }

      // 構建 System Prompt
      const systemPrompt = `你是一個專業的知識卡片生成助手。根據用戶提供的標題和原文內容，生成對應的詳細答案。

**要求：**
1. 根據標題的主題，從原文中提取相關信息
2. 生成完整、準確的答案
3. 答案支援 Markdown 格式
4. 如果原文中沒有相關信息，基於常識提供合理的答案

**回應格式：**
直接返回答案內容（支援 Markdown），不需要 JSON 格式。`;

      // 構建用戶消息
      const userMessage = `標題：${title}

原文內容：
${content}

請根據以上標題和原文內容，生成詳細的答案：`;

      // 調用 LLM
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      const result = await this.llmService.callLlmOpenai(
        messages,
        llmModel.apiUrl,
        llmModel.apiKey,
        llmModel.modelName,
        0.7,
        2000,
        llmModel.provider,
        llmModel.apiVersion,
      );

      // 計算費用
      const cost = this.calculateCost(result.usage, llmModel.modelName);

      return {
        success: true,
        answer: result.content.trim(),
        usage: result.usage,
        cost,
      };
    } catch (error: any) {
      this.logger.error(`[generateCardFromTitle] 錯誤: ${error.message}`);
      return {
        success: false,
        message: error.message || '生成失敗',
      };
    }
  }

  /**
   * 從 URL 抓取網頁內容
   */
  async fetchWebContent(url: string): Promise<{
    success: boolean;
    content?: string;
    message?: string;
  }> {
    try {
      // 驗證 URL
      const urlObj = new URL(url);

      // 發送請求
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      // 使用 cheerio 解析 HTML
      const $ = cheerio.load(response.data);

      // 移除不需要的元素
      $('script, style, nav, footer, header, aside, iframe').remove();

      // 提取文字內容
      let content = '';

      // 優先提取 article 或 main 標籤的內容
      if ($('article').length > 0) {
        content = $('article').text();
      } else if ($('main').length > 0) {
        content = $('main').text();
      } else {
        content = $('body').text();
      }

      // 清理文字
      content = content
        .replace(/\s+/g, ' ') // 多個空白字符替換為單個空格
        .replace(/\n\s*\n/g, '\n\n') // 多個換行替換為雙換行
        .trim();

      // 限制長度（最多 10000 字）
      if (content.length > 10000) {
        content = content.substring(0, 10000);
      }

      return {
        success: true,
        content,
        message: content.length >= 10000 ? '內容已截斷至前 10,000 字' : undefined,
      };
    } catch (error: any) {
      this.logger.error(`[fetchWebContent] 錯誤: ${error.message}`);
      
      let message = '載入網頁失敗';
      if (error.code === 'ENOTFOUND') {
        message = '無法找到該網址';
      } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        message = '請求超時，請稍後再試';
      } else if (error.response) {
        message = `HTTP ${error.response.status}: ${error.response.statusText}`;
      }

      return {
        success: false,
        message,
      };
    }
  }

  /**
   * 計算 API 使用費用
   */
  private calculateCost(
    usage: any,
    modelName: string,
  ): {
    input_cost: number;
    output_cost: number;
    total_cost: number;
    input_price_per_million: number;
    output_price_per_million: number;
  } {
    // 根據模型設置價格（每百萬 token 的美元價格）
    let inputPricePerMillion = 0.15; // 預設 gpt-4o-mini 價格
    let outputPricePerMillion = 0.6;

    if (modelName.includes('gpt-4o-mini')) {
      inputPricePerMillion = 0.15;
      outputPricePerMillion = 0.6;
    } else if (modelName.includes('gpt-4o')) {
      inputPricePerMillion = 2.5;
      outputPricePerMillion = 10.0;
    } else if (modelName.includes('gpt-4-turbo')) {
      inputPricePerMillion = 10.0;
      outputPricePerMillion = 30.0;
    } else if (modelName.includes('gpt-3.5-turbo')) {
      inputPricePerMillion = 0.5;
      outputPricePerMillion = 1.5;
    }

    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;

    const inputCost = (promptTokens / 1000000) * inputPricePerMillion;
    const outputCost = (completionTokens / 1000000) * outputPricePerMillion;
    const totalCost = inputCost + outputCost;

    return {
      input_cost: inputCost,
      output_cost: outputCost,
      total_cost: totalCost,
      input_price_per_million: inputPricePerMillion,
      output_price_per_million: outputPricePerMillion,
    };
  }
}
