import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SessionsService', () => {
  let service: SessionsService;
  let prismaService: jest.Mocked<PrismaService>;

  // Mock PrismaService
  const mockPrismaService = {
    session: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    chatbot: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prismaService = module.get(PrismaService);

    // 清除所有 mock
    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    const token = 'test-token-123';
    const chatbotId = 'test-chatbot-1';
    const sessionId = 'session-uuid-123';
    const tenantId = 'test-tenant-1';

    it('應該成功驗證有效的 Token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      prismaService.session.findUnique = jest.fn().mockResolvedValue({
        id: sessionId,
        token,
        chatbotId,
        tenantId,
        queryCount: 10,
        maxQueries: 50,
        expiresAt: futureDate,
        chatbot: {
          id: chatbotId,
          name: 'Test Chatbot',
        },
      });

      const result = await service.verifyToken(token, chatbotId);

      expect(result).toEqual({
        session_id: sessionId,
        chatbot_id: chatbotId,
        tenant_id: tenantId,
        query_count: 10,
        max_queries: 50,
      });
      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { token },
        include: {
          chatbot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('應該拒絕不存在的 Token', async () => {
      prismaService.session.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.verifyToken(token, chatbotId)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyToken(token, chatbotId)).rejects.toThrow(
        'SESSION_NOT_FOUND',
      );
    });

    it('應該拒絕已過期的 Token', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // 昨天過期

      prismaService.session.findUnique = jest.fn().mockResolvedValue({
        id: sessionId,
        token,
        chatbotId,
        tenantId,
        queryCount: 10,
        maxQueries: 50,
        expiresAt: pastDate,
        chatbot: {
          id: chatbotId,
          name: 'Test Chatbot',
        },
      });

      await expect(service.verifyToken(token, chatbotId)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyToken(token, chatbotId)).rejects.toThrow(
        'TOKEN_EXPIRED',
      );
    });

    it('應該拒絕 Chatbot ID 不匹配的 Token', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const differentChatbotId = 'different-chatbot';

      prismaService.session.findUnique = jest.fn().mockResolvedValue({
        id: sessionId,
        token,
        chatbotId: differentChatbotId, // 不同的 chatbotId
        tenantId,
        queryCount: 10,
        maxQueries: 50,
        expiresAt: futureDate,
        chatbot: {
          id: differentChatbotId,
          name: 'Different Chatbot',
        },
      });

      await expect(service.verifyToken(token, chatbotId)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyToken(token, chatbotId)).rejects.toThrow(
        'CHATBOT_MISMATCH',
      );
    });
  });

  describe('incrementQueryCount', () => {
    const sessionId = 'session-uuid-123';

    it('應該成功增加查詢次數', async () => {
      prismaService.session.update = jest.fn().mockResolvedValue({
        id: sessionId,
        queryCount: 11,
      });

      await service.incrementQueryCount(sessionId);

      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: {
          queryCount: {
            increment: 1,
          },
        },
      });
    });

    it('應該處理 Session 不存在的情況', async () => {
      const error = new Error('Record not found');
      prismaService.session.update = jest.fn().mockRejectedValue(error);

      await expect(
        service.incrementQueryCount(sessionId),
      ).rejects.toThrow(error);
    });
  });

  describe('create', () => {
    const createDto = {
      id: 'session-123',
      chatbotId: 'chatbot-1',
      tenantId: 'tenant-1',
      token: 'token-123',
      expiresAt: '2025-12-31T23:59:59.000Z',
      maxQueries: 50,
    };

    it('應該成功創建 Session', async () => {
      const expectedSession = {
        ...createDto,
        expiresAt: new Date(createDto.expiresAt),
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      prismaService.session.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.session.create = jest
        .fn()
        .mockResolvedValue(expectedSession);

      const result = await service.create(createDto);

      expect(result).toEqual(expectedSession);
      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.id },
      });
      expect(prismaService.session.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          expiresAt: new Date(createDto.expiresAt),
        },
        include: {
          chatbot: {
            select: {
              id: true,
              name: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('應該拒絕重複的 ID', async () => {
      prismaService.session.findUnique = jest.fn().mockResolvedValue({
        id: createDto.id,
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        `Session with id ${createDto.id} already exists`,
      );
      expect(prismaService.session.create).not.toHaveBeenCalled();
    });
  });

  describe('findByToken', () => {
    const token = 'test-token-123';
    const sessionId = 'session-uuid-123';

    it('應該成功找到有效的 Session', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const expectedSession = {
        id: sessionId,
        token,
        chatbotId: 'chatbot-1',
        tenantId: 'tenant-1',
        expiresAt: futureDate,
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      prismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(expectedSession);

      const result = await service.findByToken(token);

      expect(result).toEqual(expectedSession);
      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { token },
        include: {
          chatbot: true,
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('應該拒絕不存在的 Token', async () => {
      prismaService.session.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.findByToken(token)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByToken(token)).rejects.toThrow(
        'Session not found',
      );
    });

    it('應該拒絕已過期的 Session', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      prismaService.session.findUnique = jest.fn().mockResolvedValue({
        id: sessionId,
        token,
        expiresAt: pastDate,
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      });

      await expect(service.findByToken(token)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByToken(token)).rejects.toThrow(
        'Session expired',
      );
    });
  });

  describe('findOne', () => {
    const sessionId = 'session-uuid-123';

    it('應該成功找到 Session', async () => {
      const expectedSession = {
        id: sessionId,
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
        queryLogs: [],
        _count: { queryLogs: 0 },
      };

      prismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(expectedSession);

      const result = await service.findOne(sessionId);

      expect(result).toEqual(expectedSession);
      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: sessionId },
        include: {
          chatbot: {
            select: {
              id: true,
              name: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          queryLogs: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          },
          _count: {
            select: {
              queryLogs: true,
            },
          },
        },
      });
    });

    it('應該拒絕不存在的 Session', async () => {
      prismaService.session.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.findOne(sessionId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(sessionId)).rejects.toThrow(
        `Session with id ${sessionId} not found`,
      );
    });
  });

  describe('initSession', () => {
    const chatbotId = 'test-chatbot-1';
    const tenantId = 'test-tenant-1';
    const ipAddress = '192.168.1.1';

    it('應該成功初始化 Session', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        status: 'published',
        isActive: 'active',
      });

      // Mock generateSessionToken 會生成隨機 token
      const mockToken = 'generated-token-123';
      jest.spyOn(service, 'generateSessionToken').mockReturnValue(mockToken);

      prismaService.session.create = jest.fn().mockResolvedValue({
        token: mockToken,
        expiresAt: futureDate,
        maxQueries: 50,
      });

      const result = await service.initSession(chatbotId, ipAddress);

      expect(result).toHaveProperty('token', mockToken);
      expect(result).toHaveProperty('expires_at');
      expect(result).toHaveProperty('max_queries', 50);
      expect(prismaService.chatbot.findUnique).toHaveBeenCalledWith({
        where: { id: chatbotId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          isActive: true,
        },
      });
      expect(prismaService.session.create).toHaveBeenCalled();
    });

    it('應該拒絕不存在的 Chatbot', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.initSession(chatbotId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.initSession(chatbotId)).rejects.toThrow(
        'Chatbot 不存在',
      );
      expect(prismaService.session.create).not.toHaveBeenCalled();
    });

    it('應該拒絕未啟用的 Chatbot', async () => {
      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        status: 'published',
        isActive: 'inactive', // 未啟用
      });

      await expect(service.initSession(chatbotId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.initSession(chatbotId)).rejects.toThrow(
        'Chatbot 已暫停使用',
      );
      expect(prismaService.session.create).not.toHaveBeenCalled();
    });

    it('應該在沒有提供 ipAddress 時也能成功初始化', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      prismaService.chatbot.findUnique = jest.fn().mockResolvedValue({
        id: chatbotId,
        tenantId,
        status: 'published',
        isActive: 'active',
      });

      const mockToken = 'generated-token-123';
      jest.spyOn(service, 'generateSessionToken').mockReturnValue(mockToken);

      prismaService.session.create = jest.fn().mockResolvedValue({
        token: mockToken,
        expiresAt: futureDate,
        maxQueries: 50,
      });

      const result = await service.initSession(chatbotId);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expires_at');
      expect(result).toHaveProperty('max_queries', 50);
    });
  });

  describe('generateSessionToken', () => {
    it('應該生成唯一的 Token', () => {
      const token1 = service.generateSessionToken();
      const token2 = service.generateSessionToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(0);
      expect(token2.length).toBeGreaterThan(0);
    });

    it('應該生成 64 字元的 hex Token（32 bytes = 64 hex chars）', () => {
      const token = service.generateSessionToken();
      expect(token.length).toBe(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('update', () => {
    const sessionId = 'session-uuid-123';
    const updateDto = {
      ipAddress: '192.168.1.2',
      queryCount: 5,
    };

    it('應該成功更新 Session', async () => {
      const existingSession = {
        id: sessionId,
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      prismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(existingSession);
      prismaService.session.update = jest.fn().mockResolvedValue({
        id: sessionId,
        ...updateDto,
      });

      const result = await service.update(sessionId, updateDto);

      expect(result).toEqual({
        id: sessionId,
        ...updateDto,
      });
      expect(prismaService.session.findUnique).toHaveBeenCalledWith({
        where: { id: sessionId },
        include: expect.any(Object),
      });
      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: updateDto,
      });
    });

    it('應該在 Session 不存在時拋出異常', async () => {
      prismaService.session.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.update(sessionId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.session.update).not.toHaveBeenCalled();
    });
  });

  describe('extendExpiry', () => {
    const sessionId = 'session-uuid-123';
    const days = 60;

    it('應該成功延長過期時間', async () => {
      const existingSession = {
        id: sessionId,
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      prismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(existingSession);
      prismaService.session.update = jest.fn().mockResolvedValue({
        id: sessionId,
        expiresAt: futureDate,
      });

      const result = await service.extendExpiry(sessionId, days);

      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(prismaService.session.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: {
          expiresAt: expect.any(Date),
        },
      });
    });

    it('應該使用預設 30 天', async () => {
      const existingSession = {
        id: sessionId,
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      prismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(existingSession);
      prismaService.session.update = jest.fn().mockResolvedValue({
        id: sessionId,
        expiresAt: new Date(),
      });

      await service.extendExpiry(sessionId);

      expect(prismaService.session.update).toHaveBeenCalled();
      const updateCall = (prismaService.session.update as jest.Mock).mock.calls[0];
      const expiresAt = updateCall[0].data.expiresAt;
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 30);

      // 允許 1 秒誤差
      expect(Math.abs(expiresAt.getTime() - expectedDate.getTime())).toBeLessThan(
        1000,
      );
    });
  });

  describe('remove', () => {
    const sessionId = 'session-uuid-123';

    it('應該成功刪除 Session', async () => {
      const existingSession = {
        id: sessionId,
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
        tenant: { id: 'tenant-1', name: 'Test Tenant' },
      };

      prismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(existingSession);
      prismaService.session.delete = jest.fn().mockResolvedValue({
        id: sessionId,
      });

      const result = await service.remove(sessionId);

      expect(result).toEqual({ id: sessionId });
      expect(prismaService.session.delete).toHaveBeenCalledWith({
        where: { id: sessionId },
      });
    });

    it('應該在 Session 不存在時拋出異常', async () => {
      prismaService.session.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.remove(sessionId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.session.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const query = {
      chatbotId: 'chatbot-1',
      tenantId: 'tenant-1',
      active: true,
      limit: 10,
      offset: 0,
    };

    it('應該成功取得 Session 列表', async () => {
      const sessions = [
        {
          id: 'session-1',
          tenant: { id: 'tenant-1', name: 'Test Tenant' },
          _count: { queryLogs: 5 },
        },
        {
          id: 'session-2',
          tenant: { id: 'tenant-1', name: 'Test Tenant' },
          _count: { queryLogs: 3 },
        },
      ];

      prismaService.session.findMany = jest.fn().mockResolvedValue(sessions);
      prismaService.session.count = jest.fn().mockResolvedValue(2);

      const result = await service.findAll(query);

      expect(result).toEqual({
        sessions,
        total: 2,
      });
      expect(prismaService.session.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          chatbotId: query.chatbotId,
          tenantId: query.tenantId,
          expiresAt: { gt: expect.any(Date) },
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      });
    });

    it('應該正確過濾 active=false 的 Session', async () => {
      const inactiveQuery = {
        ...query,
        active: false,
      };

      prismaService.session.findMany = jest.fn().mockResolvedValue([]);
      prismaService.session.count = jest.fn().mockResolvedValue(0);

      await service.findAll(inactiveQuery);

      expect(prismaService.session.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          expiresAt: { lte: expect.any(Date) },
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: inactiveQuery.offset,
        take: inactiveQuery.limit,
      });
    });

    it('應該在沒有提供 tenantId 時不過濾 tenantId', async () => {
      const queryWithoutTenant = {
        chatbotId: 'chatbot-1',
        limit: 10,
        offset: 0,
      };

      prismaService.session.findMany = jest.fn().mockResolvedValue([]);
      prismaService.session.count = jest.fn().mockResolvedValue(0);

      await service.findAll(queryWithoutTenant as any);

      expect(prismaService.session.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          chatbotId: queryWithoutTenant.chatbotId,
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: queryWithoutTenant.offset,
        take: queryWithoutTenant.limit,
      });
    });
  });
});
