import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { QuotaService } from '../common/quota.service';
import { generateEmbedding } from '../common/embedding.service';

// Mock generateEmbedding
jest.mock('../common/embedding.service');
const mockedGenerateEmbedding = generateEmbedding as jest.MockedFunction<
  typeof generateEmbedding
>;

describe('FaqsService', () => {
  let service: FaqsService;
  let prismaService: any;
  let elasticsearchService: any;
  let quotaService: any;

  const mockPrismaService = {
    faq: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockElasticsearchClient = {
    indices: {
      exists: jest.fn(),
    },
  };

  const mockElasticsearchService = {
    isAvailable: jest.fn(),
    saveFaq: jest.fn(),
    deleteFaq: jest.fn(),
  };

  const mockQuotaService = {
    checkCanCreateFaq: jest.fn().mockResolvedValue({ allowed: true, current_count: 0, max_count: null }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
      ],
    }).compile();

    service = module.get<FaqsService>(FaqsService);
    prismaService = module.get(PrismaService);
    elasticsearchService = module.get(ElasticsearchService);
    quotaService = module.get(QuotaService);

    jest.clearAllMocks();
  });

  // ========== create 測試 ==========

  describe('create', () => {
    const createDto = {
      id: 'faq-1',
      chatbotId: 'chatbot-1',
      question: '如何重置密碼？',
      answer: '請點擊登入頁面的「忘記密碼」連結',
      synonym: '忘記密碼,重設密碼',
      status: 'active',
    };

    const createdFaq = {
      ...createDto,
      topic: null,
      chatbot: {
        id: 'chatbot-1',
        name: 'Test Chatbot',
      },
    };

    it('✅ 應該成功創建 FAQ', async () => {
      prismaService.faq.findUnique.mockResolvedValue(null);
      prismaService.faq.create.mockResolvedValue(createdFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));
      elasticsearchService.saveFaq.mockResolvedValue(true);

      const result = await service.create(createDto);

      expect(result).toEqual(createdFaq);
      expect(prismaService.faq.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.id },
      });
      expect(prismaService.faq.create).toHaveBeenCalledWith({
        data: createDto,
        include: {
          topic: true,
          chatbot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      expect(elasticsearchService.saveFaq).toHaveBeenCalled();
    });

    it('❌ 應該拒絕重複的 FAQ ID', async () => {
      prismaService.faq.findUnique.mockResolvedValue({
        id: 'faq-1',
        question: 'Existing FAQ',
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.faq.create).not.toHaveBeenCalled();
    });

    it('✅ 應該在 ES 不可用時跳過同步', async () => {
      prismaService.faq.findUnique.mockResolvedValue(null);
      prismaService.faq.create.mockResolvedValue(createdFaq);
      elasticsearchService.isAvailable.mockReturnValue(false);

      const result = await service.create(createDto);

      expect(result).toEqual(createdFaq);
      expect(elasticsearchService.saveFaq).not.toHaveBeenCalled();
    });

    it('❌ 應該在 ES 保存失敗時回滾 PostgreSQL', async () => {
      prismaService.faq.findUnique.mockResolvedValue(null);
      prismaService.faq.create.mockResolvedValue(createdFaq);
      prismaService.faq.delete.mockResolvedValue(createdFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));
      elasticsearchService.saveFaq.mockResolvedValue(false);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.faq.delete).toHaveBeenCalledWith({
        where: { id: createDto.id },
      });
    });

    it('❌ 應該在 ES 保存異常時回滾 PostgreSQL', async () => {
      prismaService.faq.findUnique.mockResolvedValue(null);
      prismaService.faq.create.mockResolvedValue(createdFaq);
      prismaService.faq.delete.mockResolvedValue(createdFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));
      elasticsearchService.saveFaq.mockRejectedValue(
        new Error('ES connection failed'),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.faq.delete).toHaveBeenCalled();
    });

    it('✅ 應該處理 Embedding 生成失敗（使用 fallback）', async () => {
      prismaService.faq.findUnique.mockResolvedValue(null);
      prismaService.faq.create.mockResolvedValue(createdFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      mockedGenerateEmbedding.mockRejectedValue(new Error('API error'));
      elasticsearchService.saveFaq.mockResolvedValue(true);

      const result = await service.create(createDto);

      expect(result).toEqual(createdFaq);
      // 驗證使用了 fallback 向量（全部 0.001）
      const saveCall = elasticsearchService.saveFaq.mock.calls[0];
      expect(saveCall[6]).toEqual(new Array(3072).fill(0.001));
    });
  });

  // ========== findAll 測試 ==========

  describe('findAll', () => {
    const queryDto = {
      chatbotId: 'chatbot-1',
      limit: 20,
      offset: 0,
    };

    it('✅ 應該成功取得 FAQ 列表', async () => {
      const mockFaqs = [
        {
          id: 'faq-1',
          question: '問題1',
          answer: '答案1',
          topic: null,
        },
      ];
      prismaService.faq.findMany.mockResolvedValue(mockFaqs);
      prismaService.faq.count.mockResolvedValue(1);

      const result = await service.findAll(queryDto);

      expect(result).toEqual({ faqs: mockFaqs, total: 1 });
      expect(prismaService.faq.findMany).toHaveBeenCalled();
      expect(prismaService.faq.count).toHaveBeenCalled();
    });

    it('✅ 應該支援 topicId 過濾', async () => {
      const queryWithTopic = { ...queryDto, topicId: 'topic-1' };
      prismaService.faq.findMany.mockResolvedValue([]);
      prismaService.faq.count.mockResolvedValue(0);

      await service.findAll(queryWithTopic);

      const whereClause = prismaService.faq.findMany.mock.calls[0][0].where;
      expect(whereClause.topicId).toBe('topic-1');
    });

    it('✅ 應該支援 status 過濾', async () => {
      const queryWithStatus = { ...queryDto, status: 'active' };
      prismaService.faq.findMany.mockResolvedValue([]);
      prismaService.faq.count.mockResolvedValue(0);

      await service.findAll(queryWithStatus);

      const whereClause = prismaService.faq.findMany.mock.calls[0][0].where;
      expect(whereClause.status).toBe('active');
    });

    it('✅ 應該支援搜尋', async () => {
      const queryWithSearch = { ...queryDto, search: '密碼' };
      prismaService.faq.findMany.mockResolvedValue([]);
      prismaService.faq.count.mockResolvedValue(0);

      await service.findAll(queryWithSearch);

      const whereClause = prismaService.faq.findMany.mock.calls[0][0].where;
      expect(whereClause.OR).toBeDefined();
      expect(whereClause.OR.length).toBe(3);
    });

    it('✅ 應該支援分頁', async () => {
      prismaService.faq.findMany.mockResolvedValue([]);
      prismaService.faq.count.mockResolvedValue(0);

      await service.findAll({ ...queryDto, limit: 10, offset: 20 });

      const findManyCall = prismaService.faq.findMany.mock.calls[0][0];
      expect(findManyCall.skip).toBe(20);
      expect(findManyCall.take).toBe(10);
    });
  });

  // ========== findOne 測試 ==========

  describe('findOne', () => {
    const faqId = 'faq-1';
    const mockFaq = {
      id: faqId,
      question: '問題1',
      answer: '答案1',
      topic: null,
      chatbot: {
        id: 'chatbot-1',
        name: 'Test Chatbot',
      },
    };

    it('✅ 應該成功取得單一 FAQ', async () => {
      prismaService.faq.findUnique.mockResolvedValue(mockFaq);

      const result = await service.findOne(faqId);

      expect(result).toEqual(mockFaq);
      expect(prismaService.faq.findUnique).toHaveBeenCalledWith({
        where: { id: faqId },
        include: {
          topic: true,
          chatbot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('❌ 應該拒絕不存在的 FAQ', async () => {
      prismaService.faq.findUnique.mockResolvedValue(null);

      await expect(service.findOne(faqId)).rejects.toThrow(NotFoundException);
    });
  });

  // ========== update 測試 ==========

  describe('update', () => {
    const faqId = 'faq-1';
    const updateDto = {
      question: '更新的問題',
      answer: '更新的答案',
    };

    const existingFaq = {
      id: faqId,
      chatbotId: 'chatbot-1',
      question: '原始問題',
      answer: '原始答案',
      synonym: '',
      status: 'active',
      topic: null,
      chatbot: {
        id: 'chatbot-1',
        name: 'Test Chatbot',
      },
    };

    const updatedFaq = {
      ...existingFaq,
      ...updateDto,
    };

    it('✅ 應該成功更新 FAQ', async () => {
      prismaService.faq.findUnique.mockResolvedValue(existingFaq);
      prismaService.faq.update.mockResolvedValue(updatedFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));
      elasticsearchService.saveFaq.mockResolvedValue(true);

      const result = await service.update(faqId, updateDto);

      expect(result).toEqual(updatedFaq);
      expect(prismaService.faq.update).toHaveBeenCalled();
      expect(elasticsearchService.saveFaq).toHaveBeenCalled();
    });

    it('✅ 應該在 ES 不可用時跳過同步', async () => {
      prismaService.faq.findUnique.mockResolvedValue(existingFaq);
      prismaService.faq.update.mockResolvedValue(updatedFaq);
      elasticsearchService.isAvailable.mockReturnValue(false);

      const result = await service.update(faqId, updateDto);

      expect(result).toEqual(updatedFaq);
      expect(elasticsearchService.saveFaq).not.toHaveBeenCalled();
    });

    it('✅ 應該在 ES 更新失敗時不影響 PostgreSQL', async () => {
      prismaService.faq.findUnique.mockResolvedValue(existingFaq);
      prismaService.faq.update.mockResolvedValue(updatedFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));
      elasticsearchService.saveFaq.mockRejectedValue(
        new Error('ES update failed'),
      );

      const result = await service.update(faqId, updateDto);

      // PostgreSQL 更新應該成功
      expect(result).toEqual(updatedFaq);
    });
  });

  // ========== remove 測試 ==========

  describe('remove', () => {
    const faqId = 'faq-1';
    const existingFaq = {
      id: faqId,
      chatbotId: 'chatbot-1',
      question: '問題1',
      answer: '答案1',
      topic: null,
      chatbot: {
        id: 'chatbot-1',
        name: 'Test Chatbot',
      },
    };

    it('✅ 應該成功刪除 FAQ', async () => {
      prismaService.faq.findUnique.mockResolvedValue(existingFaq);
      prismaService.faq.delete.mockResolvedValue(existingFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.deleteFaq.mockResolvedValue(true);

      const result = await service.remove(faqId);

      expect(result).toEqual(existingFaq);
      expect(prismaService.faq.delete).toHaveBeenCalledWith({
        where: { id: faqId },
      });
      expect(elasticsearchService.deleteFaq).toHaveBeenCalledWith(
        existingFaq.chatbotId,
        faqId,
      );
    });

    it('✅ 應該在 ES 不可用時跳過同步', async () => {
      prismaService.faq.findUnique.mockResolvedValue(existingFaq);
      prismaService.faq.delete.mockResolvedValue(existingFaq);
      elasticsearchService.isAvailable.mockReturnValue(false);

      const result = await service.remove(faqId);

      expect(result).toEqual(existingFaq);
      expect(elasticsearchService.deleteFaq).not.toHaveBeenCalled();
    });

    it('✅ 應該在 ES 刪除失敗時不影響 PostgreSQL', async () => {
      prismaService.faq.findUnique.mockResolvedValue(existingFaq);
      prismaService.faq.delete.mockResolvedValue(existingFaq);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.deleteFaq.mockRejectedValue(
        new Error('ES delete failed'),
      );

      const result = await service.remove(faqId);

      // PostgreSQL 刪除應該成功
      expect(result).toEqual(existingFaq);
    });
  });

  // ========== incrementHitCount 測試 ==========

  describe('incrementHitCount', () => {
    const faqId = 'faq-1';
    const updatedFaq = {
      id: faqId,
      hitCount: 10,
      lastHitAt: new Date(),
    };

    it('✅ 應該成功增加點擊次數', async () => {
      prismaService.faq.update.mockResolvedValue(updatedFaq);

      const result = await service.incrementHitCount(faqId);

      expect(result).toEqual(updatedFaq);
      expect(prismaService.faq.update).toHaveBeenCalledWith({
        where: { id: faqId },
        data: {
          hitCount: { increment: 1 },
          lastHitAt: expect.any(Date),
        },
      });
    });
  });

  // ========== bulkUpload 測試 ==========

  describe('bulkUpload', () => {
    const bulkDto = {
      chatbotId: 'chatbot-1',
      faqs: [
        {
          question: '問題1',
          answer: '答案1',
          synonym: '同義詞1',
          status: 'active',
        },
        {
          question: '問題2',
          answer: '答案2',
          synonym: '',
          status: 'active',
        },
      ],
    };

    beforeEach(() => {
      elasticsearchService.isAvailable.mockReturnValue(true);
      // Mock client 通過反射設置（因為是 private）
      (elasticsearchService as any).client = mockElasticsearchClient;
      mockElasticsearchClient.indices.exists.mockResolvedValue(true);
      // 預設配額檢查通過（quota 相關測試會覆寫）
      quotaService.checkCanCreateFaq.mockResolvedValue({
        allowed: true,
        current_count: 0,
        max_count: null,
      });
    });

    it('❌ 應該拒絕空的 FAQ 列表', async () => {
      await expect(
        service.bulkUpload({ chatbotId: 'chatbot-1', faqs: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('❌ 應該拒絕配額已滿的批量上傳', async () => {
      prismaService.faq.findMany.mockResolvedValue([]);
      quotaService.checkCanCreateFaq.mockResolvedValue({
        allowed: false,
        reason: '已達到 FAQ 總數限制（50 個），請升級方案',
        current_count: 50,
        max_count: 50,
      });

      await expect(service.bulkUpload(bulkDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.bulkUpload(bulkDto)).rejects.toThrow(
        '已達到 FAQ 總數限制（50 個），請升級方案',
      );
    });

    it('❌ 應該拒絕本次新增會超過配額的批量上傳', async () => {
      prismaService.faq.findMany.mockResolvedValue([]);
      quotaService.checkCanCreateFaq.mockResolvedValue({
        allowed: true,
        current_count: 49,
        max_count: 50,
      });

      await expect(service.bulkUpload(bulkDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.bulkUpload(bulkDto)).rejects.toThrow(
        /本次將新增 2 個 FAQ，將超過方案限制/,
      );
    });

    it('✅ 應該成功批量上傳 FAQ', async () => {
      prismaService.faq.findMany.mockResolvedValue([]);
      mockedGenerateEmbedding
        .mockResolvedValueOnce(new Array(3072).fill(0.1))
        .mockResolvedValueOnce(new Array(3072).fill(0.2));
      prismaService.faq.create
        .mockResolvedValueOnce({ id: 'faq-1' } as any)
        .mockResolvedValueOnce({ id: 'faq-2' } as any);
      elasticsearchService.saveFaq
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const result = await service.bulkUpload(bulkDto);

      expect(result.success).toBe(true);
      expect(result.success_count).toBe(2);
      expect(result.failed_count).toBe(0);
      expect(prismaService.faq.create).toHaveBeenCalledTimes(2);
      expect(elasticsearchService.saveFaq).toHaveBeenCalledTimes(2);
    });

    it('✅ 應該跳過重複的問題', async () => {
      prismaService.faq.findMany.mockResolvedValue([
        { question: '問題1' },
      ] as any);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));
      prismaService.faq.create.mockResolvedValue({ id: 'faq-2' } as any);
      elasticsearchService.saveFaq.mockResolvedValue(true);

      const result = await service.bulkUpload(bulkDto);

      expect(result.success_count).toBe(1);
      expect(result.skipped_count).toBe(1);
      expect(prismaService.faq.create).toHaveBeenCalledTimes(1);
    });

    it('✅ 應該處理所有 FAQ 都重複的情況', async () => {
      prismaService.faq.findMany.mockResolvedValue([
        { question: '問題1' },
        { question: '問題2' },
      ] as any);

      const result = await service.bulkUpload(bulkDto);

      expect(result.success_count).toBe(0);
      expect(result.skipped_count).toBe(2);
      expect(prismaService.faq.create).not.toHaveBeenCalled();
    });

    it('❌ 應該拒絕空的問題或答案', async () => {
      const dtoWithEmpty = {
        chatbotId: 'chatbot-1',
        faqs: [
          {
            question: '',
            answer: '答案1',
            status: 'active',
          },
        ],
      };

      prismaService.faq.findMany.mockResolvedValue([]);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));

      const result = await service.bulkUpload(dtoWithEmpty);

      expect(result.failed_count).toBeGreaterThan(0);
      expect(prismaService.faq.create).not.toHaveBeenCalled();
    });

    it('✅ 應該處理 Embedding 生成失敗', async () => {
      prismaService.faq.findMany.mockResolvedValue([]);
      mockedGenerateEmbedding.mockRejectedValue(new Error('API error'));

      const result = await service.bulkUpload(bulkDto);

      expect(result.failed_count).toBeGreaterThan(0);
      expect(prismaService.faq.create).not.toHaveBeenCalled();
    });

    it('❌ 應該拒絕 ES 未連接的情況', async () => {
      elasticsearchService.isAvailable.mockReturnValue(false);
      prismaService.faq.findMany.mockResolvedValue([]);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));

      await expect(service.bulkUpload(bulkDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('❌ 應該拒絕索引不存在的情況', async () => {
      mockElasticsearchClient.indices.exists.mockResolvedValue(false);
      prismaService.faq.findMany.mockResolvedValue([]);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));

      await expect(service.bulkUpload(bulkDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('✅ 應該在 ES 保存失敗時回滾 PostgreSQL', async () => {
      prismaService.faq.findMany.mockResolvedValue([]);
      mockedGenerateEmbedding.mockResolvedValue(new Array(3072).fill(0.1));
      prismaService.faq.create.mockResolvedValue({ id: 'faq-1' } as any);
      prismaService.faq.delete.mockResolvedValue({ id: 'faq-1' } as any);
      elasticsearchService.saveFaq.mockResolvedValue(false);

      const result = await service.bulkUpload(bulkDto);

      expect(result.failed_count).toBeGreaterThan(0);
      expect(prismaService.faq.delete).toHaveBeenCalled();
    });

    it('✅ 應該處理部分成功的情況', async () => {
      prismaService.faq.findMany.mockResolvedValue([]);
      mockedGenerateEmbedding
        .mockResolvedValueOnce(new Array(3072).fill(0.1))
        .mockResolvedValueOnce(new Array(3072).fill(0.2));
      prismaService.faq.create
        .mockResolvedValueOnce({ id: 'faq-1' } as any)
        .mockResolvedValueOnce({ id: 'faq-2' } as any);
      elasticsearchService.saveFaq
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      prismaService.faq.delete.mockResolvedValue({ id: 'faq-2' } as any);

      const result = await service.bulkUpload(bulkDto);

      expect(result.success_count).toBe(1);
      expect(result.failed_count).toBe(1);
      expect(prismaService.faq.delete).toHaveBeenCalled();
    });
  });
});
