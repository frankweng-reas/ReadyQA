import { Test, TestingModule } from '@nestjs/testing';
import { LlmService } from './llm.service';
import { ModelConfigService } from '../common/model-config.service';
import axios, { AxiosError } from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock isAxiosError
const mockIsAxiosError = jest.fn();
jest.spyOn(axios, 'isAxiosError').mockImplementation(mockIsAxiosError);

describe('LlmService', () => {
  let service: LlmService;
  let modelConfigService: jest.Mocked<ModelConfigService>;

  const mockModelConfigService = {
    getCurrentLLMModel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ModelConfigService,
          useValue: mockModelConfigService,
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    modelConfigService = module.get(ModelConfigService);

    jest.clearAllMocks();
    mockIsAxiosError.mockReset();
  });

  // ========== callLlmOpenai 測試 ==========

  describe('callLlmOpenai', () => {
    const mockMessages = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'User question' },
    ];
    const mockApiUrl = 'https://api.openai.com/v1';
    const mockApiKey = 'test-api-key';
    const mockModelName = 'gpt-4';
    const mockTemperature = 0.7;
    const mockMaxTokens = 1000;

    it('✅ 應該成功調用 OpenAI API', async () => {
      const mockResponse = {
        data: {
          model: 'gpt-4',
          choices: [
            {
              message: {
                content: 'Test response',
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.callLlmOpenai(
        mockMessages,
        mockApiUrl,
        mockApiKey,
        mockModelName,
        mockTemperature,
        mockMaxTokens,
      );

      expect(result).toEqual({
        content: 'Test response',
        model: 'gpt-4',
        provider: 'openai',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
        },
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockApiUrl}/chat/completions`,
        {
          model: mockModelName,
          messages: mockMessages,
          temperature: mockTemperature,
          max_tokens: mockMaxTokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          },
          timeout: 60000,
        },
      );
    });

    it('✅ 應該成功調用 Azure OpenAI API', async () => {
      const mockAzureUrl = 'https://test.openai.azure.com';
      const mockApiVersion = '2024-02-15-preview';
      const mockResponse = {
        data: {
          model: 'gpt-4',
          choices: [
            {
              message: {
                content: 'Azure response',
              },
            },
          ],
          usage: {},
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await service.callLlmOpenai(
        mockMessages,
        mockAzureUrl,
        mockApiKey,
        mockModelName,
        mockTemperature,
        mockMaxTokens,
        'azure-openai',
        mockApiVersion,
      );

      expect(result.content).toBe('Azure response');
      expect(result.provider).toBe('azure-openai');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${mockAzureUrl}/openai/deployments/${mockModelName}/chat/completions?api-version=${mockApiVersion}`,
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'api-key': mockApiKey,
          }),
        }),
      );
    });

    it('✅ 應該移除 API URL 結尾的斜線', async () => {
      const urlWithSlash = 'https://api.openai.com/v1/';
      const mockResponse = {
        data: {
          choices: [{ message: { content: 'Test' } }],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.callLlmOpenai(
        mockMessages,
        urlWithSlash,
        mockApiKey,
        mockModelName,
        mockTemperature,
        mockMaxTokens,
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('✅ 應該使用預設 API 版本（Azure OpenAI）', async () => {
      const mockAzureUrl = 'https://test.openai.azure.com';
      const mockResponse = {
        data: {
          choices: [{ message: { content: 'Test' } }],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await service.callLlmOpenai(
        mockMessages,
        mockAzureUrl,
        mockApiKey,
        mockModelName,
        mockTemperature,
        mockMaxTokens,
        'azure-openai',
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('api-version=2024-02-15-preview'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('❌ 應該拒絕缺少 API URL', async () => {
      await expect(
        service.callLlmOpenai(
          mockMessages,
          '',
          mockApiKey,
          mockModelName,
          mockTemperature,
          mockMaxTokens,
        ),
      ).rejects.toThrow('未設置 API URL，無法調用 LLM');
    });

    it('❌ 應該拒絕缺少 API Key', async () => {
      await expect(
        service.callLlmOpenai(
          mockMessages,
          mockApiUrl,
          '',
          mockModelName,
          mockTemperature,
          mockMaxTokens,
        ),
      ).rejects.toThrow('未設置 API Key，無法調用 LLM');
    });

    it('❌ 應該拒絕缺少 Model Name', async () => {
      await expect(
        service.callLlmOpenai(
          mockMessages,
          mockApiUrl,
          mockApiKey,
          '',
          mockTemperature,
          mockMaxTokens,
        ),
      ).rejects.toThrow('未設置 Model Name，無法調用 LLM');
    });

    it('❌ 應該處理 API 回應格式錯誤', async () => {
      const mockResponse = {
        data: {
          choices: [], // 空的 choices
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await expect(
        service.callLlmOpenai(
          mockMessages,
          mockApiUrl,
          mockApiKey,
          mockModelName,
          mockTemperature,
          mockMaxTokens,
        ),
      ).rejects.toThrow('API 回應格式錯誤: 找不到選擇結果');
    });

    it('❌ 應該處理 HTTP 錯誤', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: {
            error: {
              message: 'Invalid API key',
            },
          },
        },
        message: 'Request failed',
      };

      mockIsAxiosError.mockReturnValue(true);
      mockedAxios.post.mockRejectedValue(axiosError);

      await expect(
        service.callLlmOpenai(
          mockMessages,
          mockApiUrl,
          mockApiKey,
          mockModelName,
          mockTemperature,
          mockMaxTokens,
        ),
      ).rejects.toThrow('LLM API 失敗 (401): Invalid API key');
    });

    it('❌ 應該處理網路錯誤', async () => {
      const axiosError = {
        isAxiosError: true,
        request: {},
        message: 'Network error',
      };

      mockIsAxiosError.mockReturnValue(true);
      mockedAxios.post.mockRejectedValue(axiosError);

      await expect(
        service.callLlmOpenai(
          mockMessages,
          mockApiUrl,
          mockApiKey,
          mockModelName,
          mockTemperature,
          mockMaxTokens,
        ),
      ).rejects.toThrow('無法連接到 API 伺服器: Network error');
    });

    it('❌ 應該處理其他錯誤', async () => {
      const error = new Error('Unknown error');
      mockIsAxiosError.mockReturnValue(false);
      mockedAxios.post.mockRejectedValue(error);

      await expect(
        service.callLlmOpenai(
          mockMessages,
          mockApiUrl,
          mockApiKey,
          mockModelName,
          mockTemperature,
          mockMaxTokens,
        ),
      ).rejects.toThrow('LLM 調用失敗: Unknown error');
    });
  });

  // ========== sendFaqToLlm 測試 ==========

  describe('sendFaqToLlm', () => {
    const mockQuery = '如何重置密碼？';
    const mockSearchResults = [
      {
        faq_id: 'faq-1',
        question: '如何重置密碼？',
        answer: '請點擊登入頁面的「忘記密碼」連結',
        synonym: '忘記密碼,重設密碼',
        score: 0.95,
      },
      {
        faq_id: 'faq-2',
        question: '如何修改密碼？',
        answer: '請到設定頁面修改',
        score: 0.85,
      },
    ];

    const mockLlmModel = {
      id: 'test-llm-model',
      type: 'llm' as const,
      apiUrl: 'https://api.openai.com/v1',
      apiKey: 'test-api-key',
      modelName: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      provider: 'openai',
    };

    beforeEach(() => {
      // Mock callLlmOpenai
      jest.spyOn(service, 'callLlmOpenai').mockResolvedValue({
        content: '{"has_results": true, "intro": "以下可能是您需要的...", "results": []}',
        model: 'gpt-4',
        provider: 'openai',
        usage: {},
      });
    });

    it('✅ 應該成功發送 FAQ 到 LLM', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);

      const result = await service.sendFaqToLlm(mockQuery, mockSearchResults);

      expect(result).toBeDefined();
      expect(modelConfigService.getCurrentLLMModel).toHaveBeenCalled();
      expect(service.callLlmOpenai).toHaveBeenCalled();

      // 驗證消息格式
      const callArgs = (service.callLlmOpenai as jest.Mock).mock.calls[0];
      const messages = callArgs[0];
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain(mockQuery);
      expect(messages[1].content).toContain('faq-1');
      expect(messages[1].content).toContain('faq-2');
    });

    it('✅ 應該按分數降序排序搜尋結果', async () => {
      const unsortedResults = [
        { faq_id: 'faq-1', question: 'Q1', answer: 'A1', score: 0.5 },
        { faq_id: 'faq-2', question: 'Q2', answer: 'A2', score: 0.9 },
        { faq_id: 'faq-3', question: 'Q3', answer: 'A3', score: 0.7 },
      ];

      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);

      await service.sendFaqToLlm(mockQuery, unsortedResults);

      const callArgs = (service.callLlmOpenai as jest.Mock).mock.calls[0];
      const messages = callArgs[0];
      const userContent = messages[1].content;
      const contextMatch = userContent.match(/\{[\s\S]*"context":\s*\[([\s\S]*)\][\s\S]*\}/);
      expect(contextMatch).toBeTruthy();
      // 驗證順序（最高分在前）
      expect(userContent.indexOf('faq-2')).toBeLessThan(userContent.indexOf('faq-3'));
      expect(userContent.indexOf('faq-3')).toBeLessThan(userContent.indexOf('faq-1'));
    });

    it('✅ 應該包含 synonym 欄位', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(mockLlmModel);

      await service.sendFaqToLlm(mockQuery, mockSearchResults);

      const callArgs = (service.callLlmOpenai as jest.Mock).mock.calls[0];
      const messages = callArgs[0];
      expect(messages[1].content).toContain('synonym');
      expect(messages[1].content).toContain('忘記密碼,重設密碼');
    });

    it('✅ 應該使用預設值（temperature, maxTokens, provider）', async () => {
      const modelWithoutDefaults = {
        id: 'test-llm-model',
        type: 'llm' as const,
        apiUrl: 'https://api.openai.com/v1',
        apiKey: 'test-api-key',
        modelName: 'gpt-4',
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(modelWithoutDefaults as any);

      await service.sendFaqToLlm(mockQuery, mockSearchResults);

      const callArgs = (service.callLlmOpenai as jest.Mock).mock.calls[0];
      expect(callArgs[3]).toBe('gpt-4'); // modelName
      expect(callArgs[4]).toBe(0.7); // temperature 預設值
      expect(callArgs[5]).toBe(1000); // maxTokens 預設值
      expect(callArgs[6]).toBe('openai'); // provider 預設值
    });

    it('✅ 應該處理 Azure OpenAI', async () => {
      const azureModel = {
        ...mockLlmModel,
        provider: 'azure-openai',
        apiVersion: '2024-02-15-preview',
      };

      modelConfigService.getCurrentLLMModel.mockReturnValue(azureModel as any);

      await service.sendFaqToLlm(mockQuery, mockSearchResults);

      const callArgs = (service.callLlmOpenai as jest.Mock).mock.calls[0];
      expect(callArgs[6]).toBe('azure-openai'); // provider
      expect(callArgs[7]).toBe('2024-02-15-preview'); // apiVersion
    });

    it('❌ 應該拒絕空查詢', async () => {
      await expect(
        service.sendFaqToLlm('', mockSearchResults),
      ).rejects.toThrow('查詢文本不能為空');

      await expect(
        service.sendFaqToLlm('   ', mockSearchResults),
      ).rejects.toThrow('查詢文本不能為空');
    });

    it('❌ 應該拒絕缺少 LLM 配置', async () => {
      modelConfigService.getCurrentLLMModel.mockReturnValue(null);

      await expect(
        service.sendFaqToLlm(mockQuery, mockSearchResults),
      ).rejects.toThrow('請設置環境變數 OPENAI_API_KEY');
    });
  });

  // ========== parseLlmResponse 測試 ==========

  describe('parseLlmResponse', () => {
    const mockLlmResponse = {
      content: '',
      model: 'gpt-4',
      provider: 'openai',
      usage: {},
    };

    const mockPrismaService = {
      faq: {
        findUnique: jest.fn(),
      },
    };

    it('✅ 應該解析標準 JSON 回應', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '以下可能是您需要的...',
        results: [
          { faq_id: 'faq-1', question: '問題1' },
          { faq_id: 'faq-2', question: '問題2' },
        ],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique
        .mockResolvedValueOnce({
          id: 'faq-1',
          question: '問題1',
          answer: '答案1',
          layout: 'text',
          images: null,
        })
        .mockResolvedValueOnce({
          id: 'faq-2',
          question: '問題2',
          answer: '答案2',
          layout: 'text',
          images: null,
        });

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.intro).toBe('以下可能是您需要的...');
      expect(result.qa_blocks).toHaveLength(2);
      expect(result.qa_blocks[0].faq_id).toBe('faq-1');
      expect(result.qa_blocks[0].answer).toBe('答案1');
    });

    it('✅ 應該解析包含 markdown 代碼塊的 JSON', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [{ faq_id: 'faq-1', question: '問題1' }],
      };

      mockLlmResponse.content = `\`\`\`json\n${JSON.stringify(jsonResponse)}\n\`\`\``;
      mockPrismaService.faq.findUnique.mockResolvedValue({
        id: 'faq-1',
        question: '問題1',
        answer: '答案1',
        layout: 'text',
        images: null,
      });

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks).toHaveLength(1);
    });

    it('✅ 應該處理沒有結果的情況', async () => {
      const jsonResponse = {
        has_results: false,
        intro: '抱歉，沒有找到相關的資訊。',
        results: [],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);

      const result = await service.parseLlmResponse(mockLlmResponse);

      expect(result.intro).toBe('抱歉，沒有找到相關的資訊。');
      expect(result.qa_blocks).toHaveLength(0);
    });

    it('✅ 應該使用 faqMap 當 prismaService 不存在時', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [{ faq_id: 'faq-1', question: '問題1' }],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);

      const faqMap = new Map([
        ['faq-1', { faq_id: 'faq-1', question: '問題1', answer: '答案1' }],
      ]);

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        faqMap,
        undefined,
      );

      expect(result.qa_blocks).toHaveLength(1);
      expect(result.qa_blocks[0].answer).toBe('答案1');
      expect(result.qa_blocks[0].layout).toBe('text'); // 預設布局
    });

    it('✅ 應該包含 layout 和 images 欄位', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [{ faq_id: 'faq-1', question: '問題1' }],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique.mockResolvedValue({
        id: 'faq-1',
        question: '問題1',
        answer: '答案1',
        layout: 'image',
        images: '["image1.jpg", "image2.jpg"]',
      });

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks[0].layout).toBe('image');
      expect(result.qa_blocks[0].images).toBe('["image1.jpg", "image2.jpg"]');
    });

    it('✅ 應該處理換行符轉換', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [{ faq_id: 'faq-1', question: '問題1' }],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique.mockResolvedValue({
        id: 'faq-1',
        question: '問題1',
        answer: '第一行\\n第二行\\n第三行',
        layout: 'text',
        images: null,
      });

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks[0].answer).toBe('第一行\n第二行\n第三行');
    });

    it('✅ 應該跳過缺少 faq_id 的結果', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [
          { faq_id: 'faq-1', question: '問題1' },
          { question: '問題2（缺少 faq_id）' },
          { faq_id: 'faq-3', question: '問題3' },
        ],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique
        .mockResolvedValueOnce({
          id: 'faq-1',
          question: '問題1',
          answer: '答案1',
          layout: 'text',
          images: null,
        })
        .mockResolvedValueOnce({
          id: 'faq-3',
          question: '問題3',
          answer: '答案3',
          layout: 'text',
          images: null,
        });

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks).toHaveLength(2);
      expect(result.qa_blocks[0].faq_id).toBe('faq-1');
      expect(result.qa_blocks[1].faq_id).toBe('faq-3');
    });

    it('✅ 應該跳過不存在的 FAQ', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [
          { faq_id: 'faq-1', question: '問題1' },
          { faq_id: 'faq-not-exist', question: '問題2' },
        ],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique
        .mockResolvedValueOnce({
          id: 'faq-1',
          question: '問題1',
          answer: '答案1',
          layout: 'text',
          images: null,
        })
        .mockResolvedValueOnce(null); // 不存在的 FAQ

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks).toHaveLength(1);
      expect(result.qa_blocks[0].faq_id).toBe('faq-1');
    });

    it('✅ 應該跳過 answer 為空的 FAQ', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [{ faq_id: 'faq-1', question: '問題1' }],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique.mockResolvedValue({
        id: 'faq-1',
        question: '問題1',
        answer: '', // 空的 answer
        layout: 'text',
        images: null,
      });

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks).toHaveLength(0);
    });

    it('❌ 應該處理 JSON 解析錯誤', async () => {
      mockLlmResponse.content = 'Invalid JSON {';

      const result = await service.parseLlmResponse(mockLlmResponse);

      expect(result.intro).toBe('抱歉，處理回應時發生錯誤。');
      expect(result.qa_blocks).toHaveLength(0);
    });

    it('✅ 應該處理查詢資料庫失敗的情況', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [{ faq_id: 'faq-1', question: '問題1' }],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks).toHaveLength(0);
    });

    it('✅ 應該使用資料庫中的 question（而非 LLM 返回的）', async () => {
      const jsonResponse = {
        has_results: true,
        intro: '測試',
        results: [
          {
            faq_id: 'faq-1',
            question: 'LLM 返回的問題（可能不完整）',
          },
        ],
      };

      mockLlmResponse.content = JSON.stringify(jsonResponse);
      mockPrismaService.faq.findUnique.mockResolvedValue({
        id: 'faq-1',
        question: '資料庫中的完整問題',
        answer: '答案1',
        layout: 'text',
        images: null,
      });

      const result = await service.parseLlmResponse(
        mockLlmResponse,
        undefined,
        mockPrismaService,
      );

      expect(result.qa_blocks[0].question).toBe('資料庫中的完整問題');
    });
  });
});
