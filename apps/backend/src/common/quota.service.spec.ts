import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { QuotaService, QuotaCheckResult } from './quota.service';
import { PrismaService } from '../prisma/prisma.service';

describe('QuotaService', () => {
  let service: QuotaService;
  let prismaService: jest.Mocked<PrismaService>;

  // Mock PrismaService
  const mockPrismaService = {
    chatbot: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    faq: {
      count: jest.fn(),
    },
    queryLog: {
      count: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QuotaService>(QuotaService);
    prismaService = module.get(PrismaService);

    // 清除所有 mock
    jest.clearAllMocks();
  });

  describe('getMonthlyQueryCount', () => {
    it('應該正確統計本月查詢次數', async () => {
      const tenantId = 'test-tenant-1';
      const expectedCount = 50;

      prismaService.queryLog.count = jest.fn().mockResolvedValue(expectedCount);

      const result = await service.getMonthlyQueryCount(tenantId);

      expect(result).toBe(expectedCount);
      expect(prismaService.queryLog.count).toHaveBeenCalledWith({
        where: {
          chatbot: {
            tenantId,
          },
          createdAt: {
            gte: expect.any(Date),
          },
          ignored: false,
        },
      });
    });

    it('應該忽略 ignored=true 的記錄', async () => {
      const tenantId = 'test-tenant-1';
      prismaService.queryLog.count = jest.fn().mockResolvedValue(0);

      await service.getMonthlyQueryCount(tenantId);

      expect(prismaService.queryLog.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          ignored: false,
        }),
      });
    });

    it('應該處理錯誤並重新拋出', async () => {
      const tenantId = 'test-tenant-1';
      const error = new Error('Database error');

      prismaService.queryLog.count = jest.fn().mockRejectedValue(error);

      await expect(service.getMonthlyQueryCount(tenantId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('checkCanQuery', () => {
    const chatbotId = 'test-chatbot-1';
    const tenantId = 'test-tenant-1';

    it('應該允許無限制方案（maxQueriesPerMo = null）', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxQueriesPerMo: null,
          },
        },
      });

      const result = await service.checkCanQuery(chatbotId);

      expect(result).toEqual({
        allowed: true,
        current_count: 0,
        max_count: null,
      });
      expect(prismaService.queryLog.count).not.toHaveBeenCalled();
    });

    it('應該允許未超過配額的查詢', async () => {
      const maxQueries = 100;
      const currentCount = 50;

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxQueriesPerMo: maxQueries,
          },
        },
      });
      prismaService.queryLog.count = jest
        .fn()
        .mockResolvedValue(currentCount);

      const result = await service.checkCanQuery(chatbotId);

      expect(result).toEqual({
        allowed: true,
        current_count: currentCount,
        max_count: maxQueries,
      });
    });

    it('應該拒絕超過配額的查詢', async () => {
      const maxQueries = 100;
      const currentCount = 100; // 達到上限

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxQueriesPerMo: maxQueries,
          },
        },
      });
      prismaService.queryLog.count = jest
        .fn()
        .mockResolvedValue(currentCount);

      const result = await service.checkCanQuery(chatbotId);

      expect(result).toEqual({
        allowed: false,
        reason: '已達到每月查詢次數限制，請升級方案',
        current_count: currentCount,
        max_count: maxQueries,
      });
    });

    it('應該拒絕超過配額的查詢（currentCount > maxQueries）', async () => {
      const maxQueries = 100;
      const currentCount = 101; // 超過上限

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxQueriesPerMo: maxQueries,
          },
        },
      });
      prismaService.queryLog.count = jest
        .fn()
        .mockResolvedValue(currentCount);

      const result = await service.checkCanQuery(chatbotId);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('已達到每月查詢次數限制，請升級方案');
    });

    it('應該拒絕不存在的 Chatbot', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.checkCanQuery(chatbotId);

      expect(result).toEqual({
        allowed: false,
        reason: 'Chatbot 不存在',
        current_count: 0,
        max_count: 0,
      });
    });

    it('應該拒絕沒有 Tenant 的 Chatbot', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId: null,
        tenant: null,
      });

      const result = await service.checkCanQuery(chatbotId);

      expect(result).toEqual({
        allowed: false,
        reason: '租戶不存在或已停用',
        current_count: 0,
        max_count: 0,
      });
    });

    it('應該拒絕沒有 tenantId 的 Chatbot', async () => {
      const maxQueries = 100;

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId: null,
        tenant: {
          plan: {
            maxQueriesPerMo: maxQueries,
          },
        },
      });

      const result = await service.checkCanQuery(chatbotId);

      expect(result).toEqual({
        allowed: false,
        reason: '租戶 ID 不存在',
        current_count: 0,
        max_count: maxQueries,
      });
    });

    it('應該處理錯誤並重新拋出', async () => {
      const error = new Error('Database error');
      prismaService.chatbot.findUnique = jest.fn().mockRejectedValue(error);

      await expect(service.checkCanQuery(chatbotId)).rejects.toThrow(error);
    });
  });

  describe('ensureQueryQuota', () => {
    const chatbotId = 'test-chatbot-1';
    const tenantId = 'test-tenant-1';

    it('應該在配額充足時不拋出異常', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxQueriesPerMo: 100,
          },
        },
      });
      prismaService.queryLog.count = jest.fn().mockResolvedValue(50);

      await expect(
        service.ensureQueryQuota(chatbotId),
      ).resolves.not.toThrow();
    });

    it('應該在配額超限時拋出 BadRequestException', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxQueriesPerMo: 100,
          },
        },
      });
      prismaService.queryLog.count = jest.fn().mockResolvedValue(100);

      await expect(service.ensureQueryQuota(chatbotId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.ensureQueryQuota(chatbotId)).rejects.toThrow(
        '已達到每月查詢次數限制，請升級方案',
      );
    });

    it('應該在 Chatbot 不存在時拋出 BadRequestException', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.ensureQueryQuota(chatbotId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkCanCreateChatbot', () => {
    const userId = 1;
    const tenantId = 'test-tenant-1';

    it('應該允許無限制方案（maxChatbots = null）', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        tenantId,
        tenant: {
          plan: {
            maxChatbots: null,
          },
        },
      });

      const result = await service.checkCanCreateChatbot(userId);

      expect(result).toEqual({
        allowed: true,
        current_count: 0,
        max_count: null,
      });
      expect(prismaService.chatbot.count).not.toHaveBeenCalled();
    });

    it('應該允許未超過配額的創建', async () => {
      const maxChatbots = 5;
      const currentCount = 3;

      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        tenantId,
        tenant: {
          plan: {
            maxChatbots,
          },
        },
      });
      prismaService.chatbot.count = jest.fn().mockResolvedValue(currentCount);

      const result = await service.checkCanCreateChatbot(userId);

      expect(result).toEqual({
        allowed: true,
        current_count: currentCount,
        max_count: maxChatbots,
      });
    });

    it('應該拒絕超過配額的創建', async () => {
      const maxChatbots = 5;
      const currentCount = 5; // 達到上限

      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        tenantId,
        tenant: {
          plan: {
            maxChatbots,
          },
        },
      });
      prismaService.chatbot.count = jest.fn().mockResolvedValue(currentCount);

      const result = await service.checkCanCreateChatbot(userId);

      expect(result).toEqual({
        allowed: false,
        reason: `已達到方案限制（${maxChatbots} 個 chatbot），請升級方案`,
        current_count: currentCount,
        max_count: maxChatbots,
      });
    });

    it('應該拒絕不存在的用戶', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.checkCanCreateChatbot(userId);

      expect(result).toEqual({
        allowed: false,
        reason: '用戶不存在',
        current_count: 0,
        max_count: 0,
      });
    });

    it('應該拒絕沒有 Tenant 的用戶', async () => {
      prismaService.user.findUnique = jest.fn().mockResolvedValue({
        id: userId,
        tenantId: null,
        tenant: null,
      });

      const result = await service.checkCanCreateChatbot(userId);

      expect(result).toEqual({
        allowed: false,
        reason: '租戶不存在或已停用',
        current_count: 0,
        max_count: 0,
      });
    });

    it('應該處理錯誤並重新拋出', async () => {
      const error = new Error('Database error');
      prismaService.user.findUnique = jest.fn().mockRejectedValue(error);

      await expect(
        service.checkCanCreateChatbot(userId),
      ).rejects.toThrow(error);
    });
  });

  describe('checkCanCreateFaq', () => {
    const chatbotId = 'test-chatbot-1';
    const tenantId = 'test-tenant-1';

    it('應該允許無限制方案（maxFaqsPerBot = null）', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxFaqsPerBot: null,
          },
        },
      });

      const result = await service.checkCanCreateFaq(chatbotId);

      expect(result).toEqual({
        allowed: true,
        current_count: 0,
        max_count: null,
      });
      expect(prismaService.faq.count).not.toHaveBeenCalled();
    });

    it('應該允許未超過配額的創建', async () => {
      const maxFaqs = 100;
      const currentCount = 50;

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxFaqsPerBot: maxFaqs,
          },
        },
      });
      prismaService.faq.count = jest.fn().mockResolvedValue(currentCount);

      const result = await service.checkCanCreateFaq(chatbotId);

      expect(result).toEqual({
        allowed: true,
        current_count: currentCount,
        max_count: maxFaqs,
      });
      expect(prismaService.faq.count).toHaveBeenCalledWith({
        where: {
          chatbotId,
          status: 'active',
        },
      });
    });

    it('應該拒絕超過配額的創建', async () => {
      const maxFaqs = 100;
      const currentCount = 100; // 達到上限

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxFaqsPerBot: maxFaqs,
          },
        },
      });
      prismaService.faq.count = jest.fn().mockResolvedValue(currentCount);

      const result = await service.checkCanCreateFaq(chatbotId);

      expect(result).toEqual({
        allowed: false,
        reason: `此 chatbot 已達到 FAQ 數量限制（${maxFaqs} 個），請升級方案`,
        current_count: currentCount,
        max_count: maxFaqs,
      });
    });

    it('應該只計算 active 狀態的 FAQ', async () => {
      const maxFaqs = 100;
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        tenant: {
          plan: {
            maxFaqsPerBot: maxFaqs,
          },
        },
      });
      prismaService.faq.count = jest.fn().mockResolvedValue(50);

      await service.checkCanCreateFaq(chatbotId);

      expect(prismaService.faq.count).toHaveBeenCalledWith({
        where: {
          chatbotId,
          status: 'active',
        },
      });
    });

    it('應該拒絕不存在的 Chatbot', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue(null);

      const result = await service.checkCanCreateFaq(chatbotId);

      expect(result).toEqual({
        allowed: false,
        reason: 'Chatbot 不存在',
        current_count: 0,
        max_count: 0,
      });
    });

    it('應該拒絕沒有 Tenant 的 Chatbot', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId: null,
        tenant: null,
      });

      const result = await service.checkCanCreateFaq(chatbotId);

      expect(result).toEqual({
        allowed: false,
        reason: '租戶不存在或已停用',
        current_count: 0,
        max_count: 0,
      });
    });

    it('應該處理錯誤並重新拋出', async () => {
      const error = new Error('Database error');
      prismaService.chatbot.findUnique = jest.fn().mockRejectedValue(error);

      await expect(service.checkCanCreateFaq(chatbotId)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getQuotaUsage', () => {
    const tenantId = 'test-tenant-1';

    it('應該正確返回配額使用情況', async () => {
      const planCode = 'pro';
      const planName = 'Pro Plan';
      const maxQueries = 1000;
      const currentCount = 500;

      prismaService.tenant.findUnique = jest.fn().mockResolvedValue({
        id: tenantId,
        planCode,
        plan: {
          name: planName,
          maxQueriesPerMo: maxQueries,
        },
      });
      prismaService.queryLog.count = jest.fn().mockResolvedValue(currentCount);

      const result = await service.getQuotaUsage(tenantId);

      expect(result).toEqual({
        plan: {
          code: planCode,
          name: planName,
        },
        usage: {
          queries_monthly: {
            current: currentCount,
            max: maxQueries,
          },
        },
      });
    });

    it('應該處理無限制方案（maxQueriesPerMo = null）', async () => {
      const planCode = 'business';
      const planName = 'Business Plan';

      prismaService.tenant.findUnique = jest.fn().mockResolvedValue({
        id: tenantId,
        planCode,
        plan: {
          name: planName,
          maxQueriesPerMo: null,
        },
      });
      prismaService.queryLog.count = jest.fn().mockResolvedValue(0);

      const result = await service.getQuotaUsage(tenantId);

      expect(result.usage.queries_monthly.max).toBeNull();
    });

    it('應該在租戶不存在時拋出 BadRequestException', async () => {
      prismaService.tenant.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.getQuotaUsage(tenantId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getQuotaUsage(tenantId)).rejects.toThrow(
        '租戶方案不存在或已停用',
      );
    });

    it('應該處理錯誤並重新拋出', async () => {
      const error = new Error('Database error');
      prismaService.tenant.findUnique = jest.fn().mockRejectedValue(error);

      await expect(service.getQuotaUsage(tenantId)).rejects.toThrow(error);
    });
  });
});
