import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { QueryService } from './query.service';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { LlmService } from './llm.service';
import { ChatQueryDto } from './dto/chat-query.dto';
import { LogFaqActionDto } from './dto/log-faq-action.dto';
import { LogFaqBrowseDto } from './dto/log-faq-browse.dto';

// Mock generateEmbedding
jest.mock('../common/embedding.service', () => ({
  generateEmbedding: jest.fn(),
}));

import { generateEmbedding } from '../common/embedding.service';

describe('QueryService', () => {
  let service: QueryService;
  let prismaService: jest.Mocked<PrismaService>;
  let elasticsearchService: jest.Mocked<ElasticsearchService>;
  let llmService: jest.Mocked<LlmService>;

  // Mock PrismaService
  const mockPrismaService = {
    chatbot: {
      findUnique: jest.fn(),
    },
    queryLog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    queryLogDetail: {
      upsert: jest.fn(),
      count: jest.fn(),
    },
    session: {
      update: jest.fn(),
    },
    faq: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  // Mock ElasticsearchService
  const mockElasticsearchService = {
    hybridSearch: jest.fn(),
  };

  // Mock LlmService
  const mockLlmService = {
    sendFaqToLlm: jest.fn(),
    parseLlmResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
        {
          provide: LlmService,
          useValue: mockLlmService,
        },
      ],
    }).compile();

    service = module.get<QueryService>(QueryService);
    prismaService = module.get(PrismaService);
    elasticsearchService = module.get(ElasticsearchService);
    llmService = module.get(LlmService);

    // 清除所有 mock
    jest.clearAllMocks();
  });

  describe('chatWithContext', () => {
    const chatbotId = 'test-chatbot-1';
    const sessionId = 'session-uuid-123';
    const queryDto: ChatQueryDto = {
      query: '如何重置密碼？',
      chatbot_id: chatbotId,
      mode: 'production',
    };

    it('應該拒絕不存在的 Chatbot', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.chatWithContext(queryDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.chatWithContext(queryDto)).rejects.toThrow(
        `Chatbot not found: ${chatbotId}`,
      );
    });

    it('應該拒絕未啟用的 Chatbot（production mode）', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        name: 'Test Chatbot',
        isActive: 'inactive',
      });

      await expect(service.chatWithContext(queryDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.chatWithContext(queryDto)).rejects.toThrow(
        'Chatbot 已暫停使用',
      );
    });

    it('應該允許 Preview mode 使用停用的 Chatbot', async () => {
      const previewDto: ChatQueryDto = {
        ...queryDto,
        mode: 'preview',
      };

      const mockEmbedding = new Array(3072).fill(0.1);
      const mockEsResults: any[] = [];
      const mockLlmResponse = {
        content: JSON.stringify({
          has_results: false,
          intro: '沒有找到相關資訊',
          results: [],
        }),
        model: 'gpt-4',
        provider: 'openai',
        usage: {},
      };
      const mockParsedResult = {
        intro: '沒有找到相關資訊',
        qa_blocks: [],
      };

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        name: 'Test Chatbot',
        isActive: 'inactive', // 停用中
      });

      (generateEmbedding as jest.Mock).mockResolvedValue(mockEmbedding);
      elasticsearchService.hybridSearch = jest.fn().mockResolvedValue(mockEsResults);
      llmService.sendFaqToLlm = jest.fn().mockResolvedValue(mockLlmResponse);
      llmService.parseLlmResponse = jest.fn().mockResolvedValue(mockParsedResult);

      const result = await service.chatWithContext(previewDto);

      expect(result).toBeDefined();
      expect(result.qa_blocks).toEqual([]);
      // Preview mode 應該允許停用的 Chatbot
    });

    it('應該在 Embedding 生成失敗時使用 fallback 向量', async () => {
      const mockEsResults: any[] = [];
      const mockLlmResponse = {
        content: JSON.stringify({
          has_results: false,
          intro: '沒有找到相關資訊',
          results: [],
        }),
        model: 'gpt-4',
        provider: 'openai',
        usage: {},
      };
      const mockParsedResult = {
        intro: '沒有找到相關資訊',
        qa_blocks: [],
      };

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        name: 'Test Chatbot',
        isActive: 'active',
      });

      // Embedding 生成失敗
      (generateEmbedding as jest.Mock).mockRejectedValue(
        new Error('API 錯誤'),
      );

      elasticsearchService.hybridSearch = jest.fn().mockResolvedValue(mockEsResults);
      llmService.sendFaqToLlm = jest.fn().mockResolvedValue(mockLlmResponse);
      llmService.parseLlmResponse = jest.fn().mockResolvedValue(mockParsedResult);

      const result = await service.chatWithContext(queryDto);

      expect(result).toBeDefined();
      // 應該使用 fallback 向量（全部 0.001）
      expect(elasticsearchService.hybridSearch).toHaveBeenCalled();
    });

    it('應該在 Elasticsearch 搜尋失敗時繼續執行', async () => {
      const mockEmbedding = new Array(3072).fill(0.1);
      const mockLlmResponse = {
        content: JSON.stringify({
          has_results: false,
          intro: '沒有找到相關資訊',
          results: [],
        }),
        model: 'gpt-4',
        provider: 'openai',
        usage: {},
      };
      const mockParsedResult = {
        intro: '沒有找到相關資訊',
        qa_blocks: [],
      };

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        name: 'Test Chatbot',
        isActive: 'active',
      });

      (generateEmbedding as jest.Mock).mockResolvedValue(mockEmbedding);
      // Elasticsearch 搜尋失敗
      elasticsearchService.hybridSearch = jest
        .fn()
        .mockRejectedValue(new Error('ES 連接失敗'));
      llmService.sendFaqToLlm = jest.fn().mockResolvedValue(mockLlmResponse);
      llmService.parseLlmResponse = jest.fn().mockResolvedValue(mockParsedResult);

      const result = await service.chatWithContext(queryDto);

      expect(result).toBeDefined();
      // 搜尋失敗不應該影響結果返回
      expect(llmService.sendFaqToLlm).toHaveBeenCalled();
    });

    it('應該在 LLM 調用失敗時拋出錯誤', async () => {
      const mockEmbedding = new Array(3072).fill(0.1);
      const mockEsResults: any[] = [];

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        name: 'Test Chatbot',
        isActive: 'active',
      });

      (generateEmbedding as jest.Mock).mockResolvedValue(mockEmbedding);
      elasticsearchService.hybridSearch = jest.fn().mockResolvedValue(mockEsResults);
      // LLM 調用失敗
      llmService.sendFaqToLlm = jest
        .fn()
        .mockRejectedValue(new Error('LLM API 錯誤'));

      await expect(service.chatWithContext(queryDto)).rejects.toThrow(
        'LLM 服務暫時無法使用',
      );
    });

    it('應該成功處理查詢並記錄日誌（有 sessionId）', async () => {
      const mockEmbedding = new Array(3072).fill(0.1);
      const mockEsResults: any[] = [
        {
          faq_id: 'faq-1',
          question: '如何重置密碼？',
          answer: '請點擊忘記密碼',
        },
      ];
      const mockLlmResponse = {
        content: JSON.stringify({
          has_results: true,
          intro: '以下是相關答案',
          results: [{ faq_id: 'faq-1', question: '如何重置密碼？' }],
        }),
        model: 'gpt-4',
        provider: 'openai',
        usage: {},
      };
      const mockParsedResult = {
        intro: '以下是相關答案',
        qa_blocks: [
          {
            faq_id: 'faq-1',
            question: '如何重置密碼？',
            answer: '請點擊忘記密碼',
          },
        ],
      };
      const mockLogId = 'log-uuid-123';

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        name: 'Test Chatbot',
        isActive: 'active',
      });

      (generateEmbedding as jest.Mock).mockResolvedValue(mockEmbedding);
      elasticsearchService.hybridSearch = jest.fn().mockResolvedValue(mockEsResults);
      llmService.sendFaqToLlm = jest.fn().mockResolvedValue(mockLlmResponse);
      llmService.parseLlmResponse = jest.fn().mockResolvedValue(mockParsedResult);
      prismaService.queryLog.create = jest.fn().mockResolvedValue({
        id: mockLogId,
      });
      prismaService.session.update = jest.fn().mockResolvedValue({});

      const result = await service.chatWithContext(queryDto, sessionId);

      expect(result).toBeDefined();
      expect(result.log_id).toBe(mockLogId);
      expect(result.qa_blocks).toHaveLength(1);
      expect(prismaService.queryLog.create).toHaveBeenCalled();
      expect(prismaService.session.update).toHaveBeenCalled();
    });

    it('應該在沒有 sessionId 時不記錄日誌', async () => {
      const mockEmbedding = new Array(3072).fill(0.1);
      const mockEsResults: any[] = [];
      const mockLlmResponse = {
        content: JSON.stringify({
          has_results: false,
          intro: '沒有找到相關資訊',
          results: [],
        }),
        model: 'gpt-4',
        provider: 'openai',
        usage: {},
      };
      const mockParsedResult = {
        intro: '沒有找到相關資訊',
        qa_blocks: [],
      };

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        name: 'Test Chatbot',
        isActive: 'active',
      });

      (generateEmbedding as jest.Mock).mockResolvedValue(mockEmbedding);
      elasticsearchService.hybridSearch = jest.fn().mockResolvedValue(mockEsResults);
      llmService.sendFaqToLlm = jest.fn().mockResolvedValue(mockLlmResponse);
      llmService.parseLlmResponse = jest.fn().mockResolvedValue(mockParsedResult);

      const result = await service.chatWithContext(queryDto);

      expect(result).toBeDefined();
      expect(result.log_id).toBeUndefined();
      expect(prismaService.queryLog.create).not.toHaveBeenCalled();
      expect(prismaService.session.update).not.toHaveBeenCalled();
    });
  });

  describe('logFaqAction', () => {
    const logId = 'log-uuid-123';
    const faqId = 'faq-uuid-123';
    const dto: LogFaqActionDto = {
      log_id: logId,
      faq_id: faqId,
      action: 'viewed',
    };

    it('應該拒絕不存在的 log_id', async () => {
      prismaService.queryLog.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.logFaqAction(dto)).rejects.toThrow(NotFoundException);
      await expect(service.logFaqAction(dto)).rejects.toThrow(
        `找不到 log_id: ${logId}`,
      );
    });

    it('應該拒絕不存在的 faq_id', async () => {
      prismaService.queryLog.findUnique = jest.fn().mockResolvedValue({
        id: logId,
      });
      prismaService.faq.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.logFaqAction(dto)).rejects.toThrow(NotFoundException);
      await expect(service.logFaqAction(dto)).rejects.toThrow(
        `找不到 faq_id: ${faqId}`,
      );
    });

    it('應該成功記錄 viewed 動作並更新統計', async () => {
      prismaService.queryLog.findUnique = jest.fn().mockResolvedValue({
        id: logId,
      });
      prismaService.faq.findUnique = jest.fn().mockResolvedValue({
        id: faqId,
      });
      prismaService.queryLogDetail.upsert = jest.fn().mockResolvedValue({});
      prismaService.queryLogDetail.count = jest.fn().mockResolvedValue(3);
      prismaService.queryLog.update = jest.fn().mockResolvedValue({});
      prismaService.faq.update = jest.fn().mockResolvedValue({});

      await service.logFaqAction(dto);

      expect(prismaService.queryLogDetail.upsert).toHaveBeenCalledWith({
        where: {
          logId_faqId: {
            logId,
            faqId,
          },
        },
        update: {
          userAction: 'viewed',
        },
        create: {
          logId,
          faqId,
          userAction: 'viewed',
        },
      });
      // viewed 動作應該更新 readCnt 和 hitCount
      expect(prismaService.queryLog.update).toHaveBeenCalled();
      expect(prismaService.faq.update).toHaveBeenCalled();
    });

    it('應該成功記錄 like 動作但不更新統計', async () => {
      const likeDto: LogFaqActionDto = {
        ...dto,
        action: 'like',
      };

      prismaService.queryLog.findUnique = jest.fn().mockResolvedValue({
        id: logId,
      });
      prismaService.faq.findUnique = jest.fn().mockResolvedValue({
        id: faqId,
      });
      prismaService.queryLogDetail.upsert = jest.fn().mockResolvedValue({});

      await service.logFaqAction(likeDto);

      expect(prismaService.queryLogDetail.upsert).toHaveBeenCalled();
      // like 動作不應該更新 readCnt 和 hitCount
      expect(prismaService.queryLog.update).not.toHaveBeenCalled();
      expect(prismaService.faq.update).not.toHaveBeenCalled();
    });

    it('應該在記錄失敗時拋出 BadRequestException', async () => {
      prismaService.queryLog.findUnique = jest.fn().mockResolvedValue({
        id: logId,
      });
      prismaService.faq.findUnique = jest.fn().mockResolvedValue({
        id: faqId,
      });
      prismaService.queryLogDetail.upsert = jest
        .fn()
        .mockRejectedValue(new Error('資料庫錯誤'));

      await expect(service.logFaqAction(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.logFaqAction(dto)).rejects.toThrow('記錄操作失敗');
    });
  });

  describe('logFaqBrowse', () => {
    const chatbotId = 'test-chatbot-1';
    const faqId = 'faq-uuid-123';
    const sessionId = 'session-uuid-123';
    const dto: LogFaqBrowseDto = {
      chatbot_id: chatbotId,
      faq_id: faqId,
    };

    it('應該拒絕不存在的 FAQ', async () => {
      prismaService.faq.findFirst = jest.fn().mockResolvedValue(null);

      await expect(service.logFaqBrowse(dto)).rejects.toThrow(NotFoundException);
      await expect(service.logFaqBrowse(dto)).rejects.toThrow(
        `找不到 FAQ: ${faqId}`,
      );
    });

    it('應該成功記錄直接瀏覽（有 sessionId）', async () => {
      const mockLogId = 'log-uuid-123';
      const mockFaq = {
        id: faqId,
        question: '如何重置密碼？',
      };

      prismaService.faq.findFirst = jest.fn().mockResolvedValue(mockFaq);
      prismaService.queryLog.create = jest.fn().mockResolvedValue({
        id: mockLogId,
      });
      prismaService.queryLogDetail.create = jest.fn().mockResolvedValue({});
      prismaService.faq.update = jest.fn().mockResolvedValue({});
      prismaService.session.update = jest.fn().mockResolvedValue({});

      const result = await service.logFaqBrowse(dto, sessionId);

      expect(result).toBe(mockLogId);
      expect(prismaService.queryLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          query: mockFaq.question,
          resultsCnt: 1,
          readCnt: 1,
        }),
      });
      expect(prismaService.queryLogDetail.create).toHaveBeenCalledWith({
        data: {
          logId: mockLogId,
          faqId,
          userAction: 'viewed',
        },
      });
      expect(prismaService.faq.update).toHaveBeenCalled();
      expect(prismaService.session.update).toHaveBeenCalled();
    });

    it('應該在沒有 sessionId 時不記錄日誌', async () => {
      const mockFaq = {
        id: faqId,
        question: '如何重置密碼？',
      };

      prismaService.faq.findFirst = jest.fn().mockResolvedValue(mockFaq);

      const result = await service.logFaqBrowse(dto);

      expect(result).toBeNull();
      expect(prismaService.queryLog.create).not.toHaveBeenCalled();
    });

    it('應該在記錄失敗時不拋出錯誤（不影響功能）', async () => {
      const mockFaq = {
        id: faqId,
        question: '如何重置密碼？',
      };

      prismaService.faq.findFirst = jest.fn().mockResolvedValue(mockFaq);
      prismaService.queryLog.create = jest
        .fn()
        .mockRejectedValue(new Error('資料庫錯誤'));

      // 記錄失敗不應該拋出錯誤
      const result = await service.logFaqBrowse(dto, sessionId);

      expect(result).toBeNull();
    });
  });
});
