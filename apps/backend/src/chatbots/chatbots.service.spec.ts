import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatbotsService } from './chatbots.service';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';

describe('ChatbotsService', () => {
  let service: ChatbotsService;
  let prismaService: any;
  let elasticsearchService: any;

  const mockPrismaService = {
    chatbot: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    faq: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    topic: {
      count: jest.fn(),
    },
    session: {
      count: jest.fn(),
    },
    queryLog: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
    queryLogDetail: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const mockElasticsearchService = {
    isAvailable: jest.fn(),
    createFaqIndex: jest.fn(),
    deleteFaqIndex: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
      ],
    }).compile();

    service = module.get<ChatbotsService>(ChatbotsService);
    prismaService = module.get(PrismaService);
    elasticsearchService = module.get(ElasticsearchService);

    jest.clearAllMocks();
  });

  // ========== create 測試 ==========

  describe('create', () => {
    const createDto = {
      id: 'chatbot-1',
      userId: 1,
      tenantId: 'tenant-1',
      name: 'Test Chatbot',
      description: 'Test Description',
      status: 'published',
      isActive: 'active',
    };

    const createdChatbot = {
      ...createDto,
      theme: {},
      domainWhitelist: {},
    };

    it('✅ 應該成功創建 Chatbot', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(null);
      prismaService.chatbot.create.mockResolvedValue(createdChatbot);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.createFaqIndex.mockResolvedValue(true);

      const result = await service.create(createDto);

      expect(result).toEqual(createdChatbot);
      expect(prismaService.chatbot.findUnique).toHaveBeenCalled();
      expect(prismaService.chatbot.create).toHaveBeenCalled();
      expect(elasticsearchService.createFaqIndex).toHaveBeenCalled();
    });

    it('✅ 應該自動生成 Chatbot ID（如果未提供）', async () => {
      const dtoWithoutId = {
        userId: 1,
        tenantId: 'tenant-1',
        name: 'Test Chatbot',
        description: 'Test Description',
        status: 'published',
        isActive: 'active',
      } as any; // id 是可選的，服務會自動生成

      prismaService.chatbot.findUnique.mockResolvedValue(null);
      prismaService.chatbot.create.mockResolvedValue(createdChatbot);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.createFaqIndex.mockResolvedValue(true);

      const result = await service.create(dtoWithoutId);

      expect(result).toBeDefined();
      // 驗證 create 被調用時有 id
      const createCall = prismaService.chatbot.create.mock.calls[0][0];
      expect(createCall.data.id).toBeDefined();
    });

    it('❌ 應該拒絕重複的 Chatbot ID', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue({
        id: 'chatbot-1',
        name: 'Existing Chatbot',
      });

      await expect(service.create({ ...createDto, id: 'chatbot-1' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.chatbot.create).not.toHaveBeenCalled();
    });

    it('✅ 應該從 user 取得 tenantId（如果未提供）', async () => {
      const dtoWithoutTenantId = {
        id: 'chatbot-1',
        userId: 1,
        name: 'Test Chatbot',
        description: 'Test Description',
        status: 'published',
        isActive: 'active',
      } as any; // tenantId 是可選的

      prismaService.chatbot.findUnique.mockResolvedValue(null);
      prismaService.user.findUnique.mockResolvedValue({
        id: 1,
        tenantId: 'tenant-from-user',
      });
      prismaService.chatbot.create.mockResolvedValue({
        ...createdChatbot,
        tenantId: 'tenant-from-user',
      });
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.createFaqIndex.mockResolvedValue(true);

      const result = await service.create(dtoWithoutTenantId);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: dtoWithoutTenantId.userId },
        select: { tenantId: true },
      });
      expect(result.tenantId).toBe('tenant-from-user');
    });

    it('✅ 應該使用預設 theme 和 domainWhitelist', async () => {
      const dtoWithoutTheme = {
        id: 'chatbot-1',
        userId: 1,
        tenantId: 'tenant-1',
        name: 'Test Chatbot',
        description: 'Test Description',
        status: 'published',
        isActive: 'active',
      } as any; // theme 和 domainWhitelist 是可選的

      prismaService.chatbot.findUnique.mockResolvedValue(null);
      prismaService.chatbot.create.mockResolvedValue(createdChatbot);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.createFaqIndex.mockResolvedValue(true);

      await service.create(dtoWithoutTheme);

      const createCall = prismaService.chatbot.create.mock.calls[0][0];
      expect(createCall.data.theme).toBeDefined();
      expect(createCall.data.domainWhitelist).toBeDefined();
    });

    it('✅ 應該在 ES 不可用時跳過索引創建', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(null);
      prismaService.chatbot.create.mockResolvedValue(createdChatbot);
      elasticsearchService.isAvailable.mockReturnValue(false);

      const result = await service.create(createDto);

      expect(result).toEqual(createdChatbot);
      expect(elasticsearchService.createFaqIndex).not.toHaveBeenCalled();
    });

    it('✅ 應該處理 ES 索引創建失敗（不影響 Chatbot 創建）', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(null);
      prismaService.chatbot.create.mockResolvedValue(createdChatbot);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.createFaqIndex.mockResolvedValue(false);

      const result = await service.create(createDto);

      // Chatbot 應該成功創建，即使 ES 失敗
      expect(result).toEqual(createdChatbot);
    });

    it('✅ 應該處理 ES 索引創建異常（不影響 Chatbot 創建）', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(null);
      prismaService.chatbot.create.mockResolvedValue(createdChatbot);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.createFaqIndex.mockRejectedValue(
        new Error('ES connection failed'),
      );

      const result = await service.create(createDto);

      // Chatbot 應該成功創建，即使 ES 異常
      expect(result).toEqual(createdChatbot);
    });
  });

  // ========== findAll 測試 ==========

  describe('findAll', () => {
    const queryDto = {};

    it('✅ 應該成功取得 Chatbot 列表', async () => {
      const mockChatbots = [
        {
          id: 'chatbot-1',
          name: 'Chatbot 1',
          user: { id: 1, username: 'user1', email: 'user1@example.com' },
          tenant: { id: 'tenant-1', name: 'Tenant 1' },
          _count: { faqs: 10, topics: 5 },
        },
      ];

      prismaService.chatbot.findMany.mockResolvedValue(mockChatbots);

      const result = await service.findAll(queryDto);

      expect(result).toEqual(mockChatbots);
      expect(prismaService.chatbot.findMany).toHaveBeenCalled();
    });

    it('✅ 應該支援 userId 過濾', async () => {
      prismaService.chatbot.findMany.mockResolvedValue([]);

      await service.findAll({ userId: 1 });

      const whereClause = prismaService.chatbot.findMany.mock.calls[0][0].where;
      expect(whereClause.userId).toBe(1);
    });

    it('✅ 應該支援 tenantId 過濾', async () => {
      prismaService.chatbot.findMany.mockResolvedValue([]);

      await service.findAll({ tenantId: 'tenant-1' });

      const whereClause = prismaService.chatbot.findMany.mock.calls[0][0].where;
      expect(whereClause.tenantId).toBe('tenant-1');
    });

    it('✅ 應該支援 status 過濾', async () => {
      prismaService.chatbot.findMany.mockResolvedValue([]);

      await service.findAll({ status: 'published' });

      const whereClause = prismaService.chatbot.findMany.mock.calls[0][0].where;
      expect(whereClause.status).toBe('published');
    });

    it('✅ 應該支援 isActive 過濾', async () => {
      prismaService.chatbot.findMany.mockResolvedValue([]);

      await service.findAll({ isActive: 'active' });

      const whereClause = prismaService.chatbot.findMany.mock.calls[0][0].where;
      expect(whereClause.isActive).toBe('active');
    });
  });

  // ========== findOne 測試 ==========

  describe('findOne', () => {
    const chatbotId = 'chatbot-1';
    const mockChatbot = {
      id: chatbotId,
      name: 'Test Chatbot',
      user: { id: 1, username: 'user1', email: 'user1@example.com' },
      tenant: { id: 'tenant-1', name: 'Tenant 1', planCode: 'free' },
      _count: { faqs: 10, topics: 5, sessions: 3 },
    };

    it('✅ 應該成功取得單一 Chatbot', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(mockChatbot);

      const result = await service.findOne(chatbotId);

      expect(result).toEqual(mockChatbot);
      expect(prismaService.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: chatbotId },
        include: expect.any(Object),
      });
    });

    it('❌ 應該拒絕不存在的 Chatbot', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(null);

      await expect(service.findOne(chatbotId)).rejects.toThrow(NotFoundException);
    });
  });

  // ========== update 測試 ==========

  describe('update', () => {
    const chatbotId = 'chatbot-1';
    const updateDto = {
      name: 'Updated Name',
      isActive: 'inactive',
    };

    const existingChatbot = {
      id: chatbotId,
      name: 'Original Name',
      isActive: 'active',
    };

    const updatedChatbot = {
      ...existingChatbot,
      ...updateDto,
    };

    it('✅ 應該成功更新 Chatbot', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(existingChatbot);
      prismaService.chatbot.update.mockResolvedValue(updatedChatbot);

      const result = await service.update(chatbotId, updateDto);

      expect(result).toEqual(updatedChatbot);
      expect(prismaService.chatbot.update).toHaveBeenCalledWith({
        where: { id: chatbotId },
        data: updateDto,
      });
    });

    it('❌ 應該拒絕更新不存在的 Chatbot', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(null);

      await expect(service.update(chatbotId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.chatbot.update).not.toHaveBeenCalled();
    });
  });

  // ========== remove 測試 ==========

  describe('remove', () => {
    const chatbotId = 'chatbot-1';
    const existingChatbot = {
      id: chatbotId,
      name: 'Test Chatbot',
    };

    it('✅ 應該成功刪除 Chatbot', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(existingChatbot);
      prismaService.chatbot.delete.mockResolvedValue(existingChatbot);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.deleteFaqIndex.mockResolvedValue(true);

      const result = await service.remove(chatbotId);

      expect(result).toEqual(existingChatbot);
      expect(prismaService.chatbot.delete).toHaveBeenCalledWith({
        where: { id: chatbotId },
      });
      expect(elasticsearchService.deleteFaqIndex).toHaveBeenCalledWith(chatbotId);
    });

    it('✅ 應該在 ES 不可用時跳過索引刪除', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(existingChatbot);
      prismaService.chatbot.delete.mockResolvedValue(existingChatbot);
      elasticsearchService.isAvailable.mockReturnValue(false);

      const result = await service.remove(chatbotId);

      expect(result).toEqual(existingChatbot);
      expect(elasticsearchService.deleteFaqIndex).not.toHaveBeenCalled();
    });

    it('✅ 應該處理 ES 索引刪除失敗（不影響 Chatbot 刪除）', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(existingChatbot);
      prismaService.chatbot.delete.mockResolvedValue(existingChatbot);
      elasticsearchService.isAvailable.mockReturnValue(true);
      elasticsearchService.deleteFaqIndex.mockRejectedValue(
        new Error('ES delete failed'),
      );

      const result = await service.remove(chatbotId);

      // Chatbot 應該成功刪除，即使 ES 失敗
      expect(result).toEqual(existingChatbot);
    });
  });

  // ========== getStats 測試 ==========

  describe('getStats', () => {
    const chatbotId = 'chatbot-1';
    const mockChatbot = {
      id: chatbotId,
      name: 'Test Chatbot',
    };

    it('✅ 應該成功取得統計資料', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(mockChatbot);
      prismaService.faq.count.mockResolvedValue(10);
      prismaService.topic.count.mockResolvedValue(5);
      prismaService.session.count.mockResolvedValue(3);
      prismaService.queryLog.count.mockResolvedValue(100);

      const result = await service.getStats(chatbotId);

      expect(result).toEqual({
        chatbot: mockChatbot,
        stats: {
          faqCount: 10,
          topicCount: 5,
          sessionCount: 3,
          queryLogCount: 100,
        },
      });
    });
  });

  // ========== updateLogo 測試 ==========

  describe('updateLogo', () => {
    const chatbotId = 'chatbot-1';
    const logoPath = '/uploads/chatbot-logos/logo.png';
    const mockChatbot = {
      id: chatbotId,
      name: 'Test Chatbot',
      theme: {},
    };

    it('✅ 應該成功更新 Logo', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(mockChatbot);
      prismaService.chatbot.update.mockResolvedValue({
        ...mockChatbot,
        theme: { headerLogo: logoPath },
      });

      const result = await service.updateLogo(chatbotId, logoPath);

      expect(result).toBe(logoPath);
      expect(prismaService.chatbot.update).toHaveBeenCalledWith({
        where: { id: chatbotId },
        data: {
          theme: expect.objectContaining({
            headerLogo: logoPath,
          }),
        },
      });
    });

    it('✅ 應該保留現有的 theme 設定', async () => {
      const chatbotWithTheme = {
        ...mockChatbot,
        theme: {
          primaryColor: '#000000',
          headerLogo: '/old/logo.png',
        },
      };

      prismaService.chatbot.findUnique.mockResolvedValue(chatbotWithTheme);
      prismaService.chatbot.update.mockResolvedValue(chatbotWithTheme);

      await service.updateLogo(chatbotId, logoPath);

      const updateCall = prismaService.chatbot.update.mock.calls[0][0];
      expect(updateCall.data.theme.primaryColor).toBe('#000000');
      expect(updateCall.data.theme.headerLogo).toBe(logoPath);
    });
  });

  // ========== updateHomeImage 測試 ==========

  describe('updateHomeImage', () => {
    const chatbotId = 'chatbot-1';
    const imagePath = '/uploads/chatbot-logos/home-image.jpg';
    const mockChatbot = {
      id: chatbotId,
      name: 'Test Chatbot',
      theme: {},
    };

    it('✅ 應該成功更新首頁圖片', async () => {
      prismaService.chatbot.findUnique.mockResolvedValue(mockChatbot);
      prismaService.chatbot.update.mockResolvedValue({
        ...mockChatbot,
        theme: {
          homePageConfig: {
            backgroundImage: imagePath,
          },
        },
      });

      const result = await service.updateHomeImage(chatbotId, imagePath);

      expect(result).toBe(imagePath);
      expect(prismaService.chatbot.update).toHaveBeenCalledWith({
        where: { id: chatbotId },
        data: {
          theme: expect.objectContaining({
            homePageConfig: expect.objectContaining({
              backgroundImage: imagePath,
            }),
          }),
        },
      });
    });

    it('✅ 應該保留現有的 homePageConfig 設定', async () => {
      const chatbotWithConfig = {
        ...mockChatbot,
        theme: {
          homePageConfig: {
            title: 'Welcome',
            backgroundImage: '/old/image.jpg',
          },
        },
      };

      prismaService.chatbot.findUnique.mockResolvedValue(chatbotWithConfig);
      prismaService.chatbot.update.mockResolvedValue(chatbotWithConfig);

      await service.updateHomeImage(chatbotId, imagePath);

      const updateCall = prismaService.chatbot.update.mock.calls[0][0];
      expect(updateCall.data.theme.homePageConfig.title).toBe('Welcome');
      expect(updateCall.data.theme.homePageConfig.backgroundImage).toBe(imagePath);
    });
  });
});
