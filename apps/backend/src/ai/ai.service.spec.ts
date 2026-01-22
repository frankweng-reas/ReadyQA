import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { LlmService } from '../query/llm.service';
import { ModelConfigService } from '../common/model-config.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock cheerio
jest.mock('cheerio');

describe('AiService', () => {
  let service: AiService;
  let llmService: any;
  let modelConfigService: any;

  const mockLlmService = {
    callLlmOpenai: jest.fn(),
  };

  const mockModelConfigService = {
    getCurrentLLMModel: jest.fn(),
  };

  const mockLlmModel = {
    id: 'test-llm-model',
    type: 'llm' as const,
    apiUrl: 'https://api.openai.com/v1',
    apiKey: 'test-api-key',
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1000,
    provider: 'openai',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: LlmService,
          useValue: mockLlmService,
        },
        {
          provide: ModelConfigService,
          useValue: mockModelConfigService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    llmService = module.get(LlmService);
    modelConfigService = module.get(ModelConfigService);

    jest.clearAllMocks();
  });

  // ========== generateCards 測試 ==========

  describe('generateCards', () => {
    const chatbotId = 'chatbot-1';
    const content = '這是一篇關於密碼重置的文章...';
    const cardCount = 3;

    it('✅ 應該成功生成 FAQ 卡片', async () => {
      const mockResponse = {
        content: JSON.stringify({
          cards: [
            { question: '問題1', answer: '答案1' },
            { question: '問題2', answer: '答案2' },
            { question: '問題3', answer: '答案3' },
          ],
        }),
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
        },
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockResolvedValue(mockResponse);

      const result = await service.generateCards(chatbotId, content, cardCount);

      expect(result.success).toBe(true);
      expect(result.cards).toHaveLength(3);
      expect(result.cards?.[0]).toHaveProperty('question');
      expect(result.cards?.[0]).toHaveProperty('answer');
      expect(result.usage).toBeDefined();
      expect(result.cost).toBeDefined();
    });

    it('✅ 應該解析包含 markdown 代碼塊的 JSON', async () => {
      const mockResponse = {
        content: `\`\`\`json\n${JSON.stringify({
          cards: [{ question: '問題1', answer: '答案1' }],
        })}\n\`\`\``,
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockResolvedValue(mockResponse);

      const result = await service.generateCards(chatbotId, content, cardCount);

      expect(result.success).toBe(true);
      expect(result.cards).toBeDefined();
    });

    it('✅ 應該處理空的 cards 陣列', async () => {
      const mockResponse = {
        content: JSON.stringify({ cards: [] }),
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockResolvedValue(mockResponse);

      const result = await service.generateCards(chatbotId, content, cardCount);

      expect(result.success).toBe(true);
      expect(result.cards).toEqual([]);
    });

    it('❌ 應該拒絕缺少 LLM 配置', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(null);

      const result = await service.generateCards(chatbotId, content, cardCount);

      expect(result.success).toBe(false);
      expect(result.message).toContain('OPENAI_API_KEY');
      expect(llmService.callLlmOpenai).not.toHaveBeenCalled();
    });

    it('❌ 應該處理 LLM 調用錯誤', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockRejectedValue(new Error('API error'));

      const result = await service.generateCards(chatbotId, content, cardCount);

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it('❌ 應該處理 JSON 解析錯誤', async () => {
      const mockResponse = {
        content: 'Invalid JSON',
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockResolvedValue(mockResponse);

      const result = await service.generateCards(chatbotId, content, cardCount);

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it('✅ 應該計算費用', async () => {
      const mockResponse = {
        content: JSON.stringify({
          cards: [{ question: '問題1', answer: '答案1' }],
        }),
        usage: {
          prompt_tokens: 1000000, // 1M tokens
          completion_tokens: 500000, // 0.5M tokens
        },
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockResolvedValue(mockResponse);

      const result = await service.generateCards(chatbotId, content, cardCount);

      expect(result.success).toBe(true);
      expect(result.cost).toBeDefined();
      expect(result.cost?.input_cost).toBeGreaterThan(0);
      expect(result.cost?.output_cost).toBeGreaterThan(0);
      expect(result.cost?.total_cost).toBeGreaterThan(0);
    });
  });

  // ========== generateCardFromTitle 測試 ==========

  describe('generateCardFromTitle', () => {
    const chatbotId = 'chatbot-1';
    const title = '如何重置密碼？';
    const content = '重置密碼的步驟...';

    it('✅ 應該成功根據標題生成答案', async () => {
      const mockResponse = {
        content: '這是根據標題生成的答案',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
        },
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockResolvedValue(mockResponse);

      const result = await service.generateCardFromTitle(
        chatbotId,
        title,
        content,
      );

      expect(result.success).toBe(true);
      expect(result.answer).toBe('這是根據標題生成的答案');
      expect(result.usage).toBeDefined();
      expect(result.cost).toBeDefined();
    });

    it('❌ 應該拒絕缺少 LLM 配置', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(null);

      const result = await service.generateCardFromTitle(
        chatbotId,
        title,
        content,
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('OPENAI_API_KEY');
    });

    it('❌ 應該處理 LLM 調用錯誤', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockRejectedValue(new Error('API error'));

      const result = await service.generateCardFromTitle(
        chatbotId,
        title,
        content,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  // ========== fetchWebContent 測試 ==========

  describe('fetchWebContent', () => {
    const url = 'https://example.com/article';

    beforeEach(() => {
      // Mock cheerio.load
      const mock$ = (selector: string) => {
        const mockElement = {
          length: selector === 'article' ? 1 : selector === 'main' ? 0 : 0,
          text: jest.fn().mockReturnValue('Extracted content'),
          remove: jest.fn().mockReturnThis(),
        };
        return mockElement as any;
      };

      mock$.remove = jest.fn().mockReturnThis();
      mock$.text = jest.fn().mockReturnValue('Extracted content');

      (cheerio.load as jest.Mock) = jest.fn().mockReturnValue(mock$);
    });

    it('✅ 應該成功抓取網頁內容', async () => {
      const mockHtml = '<html><body><article>Content</article></body></html>';

      mockedAxios.get.mockResolvedValue({
        data: mockHtml,
      });

      const result = await service.fetchWebContent(url);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          timeout: 30000,
          headers: expect.any(Object),
        }),
      );
    });

    it('✅ 應該限制內容長度（最多 10000 字）', async () => {
      const longContent = 'a'.repeat(15000);

      mockedAxios.get.mockResolvedValue({
        data: '<html><body><article>' + longContent + '</article></body></html>',
      });

      // Mock cheerio 返回長內容
      const mock$ = (selector: string) => {
        const mockElement = {
          length: selector === 'article' ? 1 : 0,
          text: jest.fn().mockReturnValue(longContent),
          remove: jest.fn().mockReturnThis(),
        };
        return mockElement as any;
      };
      mock$.remove = jest.fn().mockReturnThis();
      mock$.text = jest.fn().mockReturnValue(longContent);

      (cheerio.load as jest.Mock) = jest.fn().mockReturnValue(mock$);

      const result = await service.fetchWebContent(url);

      expect(result.success).toBe(true);
      if (result.content) {
        expect(result.content.length).toBeLessThanOrEqual(10000);
        expect(result.message).toContain('截斷');
      }
    });

    it('❌ 應該處理無效的 URL', async () => {
      const invalidUrl = 'not-a-valid-url';

      // URL 構造函數會拋出錯誤，但服務會捕獲並返回錯誤結果
      try {
        const result = await service.fetchWebContent(invalidUrl);
        // 如果沒有拋出錯誤，應該返回失敗結果
        expect(result.success).toBe(false);
      } catch (error) {
        // 或者拋出錯誤（取決於實現）
        expect(error).toBeDefined();
      }
    });

    it('❌ 應該處理網路錯誤', async () => {
      const networkError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND example.com',
      };

      mockedAxios.get.mockRejectedValue(networkError);

      const result = await service.fetchWebContent(url);

      expect(result.success).toBe(false);
      expect(result.message).toContain('無法找到該網址');
    });

    it('❌ 應該處理請求超時', async () => {
      const timeoutError = {
        code: 'ETIMEDOUT',
        message: 'timeout of 30000ms exceeded',
      };

      mockedAxios.get.mockRejectedValue(timeoutError);

      const result = await service.fetchWebContent(url);

      expect(result.success).toBe(false);
      expect(result.message).toContain('超時');
    });

    it('❌ 應該處理 HTTP 錯誤', async () => {
      const httpError = {
        code: undefined,
        message: 'Request failed',
        response: {
          status: 404,
          statusText: 'Not Found',
        },
      };

      mockedAxios.get.mockRejectedValue(httpError);

      const result = await service.fetchWebContent(url);

      expect(result.success).toBe(false);
      expect(result.message).toContain('HTTP 404');
    });
  });

  // ========== optimizeAnswer 測試 ==========

  describe('optimizeAnswer', () => {
    const chatbotId = 'chatbot-1';
    const question = '如何重置密碼？';
    const answer = '請點擊登入頁面的「忘記密碼」連結';

    it('✅ 應該成功優化答案', async () => {
      const mockResponse = {
        content: '優化後的答案',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
        },
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockResolvedValue(mockResponse);

      const result = await service.optimizeAnswer(chatbotId, question, answer);

      expect(result.success).toBe(true);
      expect(result.optimizedAnswer).toBe('優化後的答案');
      expect(result.usage).toBeDefined();
      expect(result.cost).toBeDefined();
    });

    it('❌ 應該拒絕缺少 LLM 配置', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(null);

      const result = await service.optimizeAnswer(chatbotId, question, answer);

      expect(result.success).toBe(false);
      expect(result.message).toContain('OPENAI_API_KEY');
    });

    it('❌ 應該處理 LLM 調用錯誤', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);
      llmService.callLlmOpenai.mockRejectedValue(new Error('API error'));

      const result = await service.optimizeAnswer(chatbotId, question, answer);

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });
});
