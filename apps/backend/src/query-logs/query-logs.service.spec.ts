import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { QueryLogsService } from './query-logs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateQueryLogDto,
  CreateQueryLogDetailDto,
  QueryLogQueryDto,
} from './dto/query-log.dto';

describe('QueryLogsService', () => {
  let service: QueryLogsService;
  let prismaService: any;

  const mockPrismaService = {
    queryLog: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      updateMany: jest.fn(),
    },
    queryLogDetail: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryLogsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QueryLogsService>(QueryLogsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateQueryLogDto = {
      id: 'log-1',
      sessionId: 'session-1',
      chatbotId: 'chatbot-1',
      query: '測試查詢',
      resultsCnt: 5,
      readCnt: 3,
      ignored: false,
    };

    const createdLog = {
      ...createDto,
      session: {
        id: 'session-1',
        token: 'token-123',
      },
      chatbot: {
        id: 'chatbot-1',
        name: 'Test Chatbot',
      },
    };

    it('✅ 應該成功創建 QueryLog', async () => {
      prismaService.queryLog.findUnique.mockResolvedValue(null);
      prismaService.queryLog.create.mockResolvedValue(createdLog);

      const result = await service.create(createDto);

      expect(result).toEqual(createdLog);
      expect(prismaService.queryLog.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.id },
      });
      expect(prismaService.queryLog.create).toHaveBeenCalledWith({
        data: createDto,
        include: {
          session: {
            select: {
              id: true,
              token: true,
            },
          },
          chatbot: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    it('❌ 應該拒絕重複的 ID', async () => {
      prismaService.queryLog.findUnique.mockResolvedValue({ id: 'log-1' } as any);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow('QueryLog with id log-1 already exists');
      expect(prismaService.queryLog.create).not.toHaveBeenCalled();
    });

    it('✅ 應該支援可選欄位', async () => {
      const createDtoMinimal = {
        id: 'log-2',
        sessionId: 'session-1',
        chatbotId: 'chatbot-1',
        query: '測試查詢',
      };
      prismaService.queryLog.findUnique.mockResolvedValue(null);
      prismaService.queryLog.create.mockResolvedValue({
        ...createDtoMinimal,
        session: { id: 'session-1', token: 'token-123' },
        chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
      });

      const result = await service.create(createDtoMinimal);

      expect(result.resultsCnt).toBeUndefined();
      expect(result.readCnt).toBeUndefined();
      expect(result.ignored).toBeUndefined();
    });
  });

  describe('findAll', () => {
    const queryDto: QueryLogQueryDto = {
      chatbotId: 'chatbot-1',
      limit: 20,
      offset: 0,
    };

    const mockLogs = [
      {
        id: 'log-1',
        chatbotId: 'chatbot-1',
        query: '查詢1',
        session: { id: 'session-1', token: 'token-123' },
        _count: { queryLogDetails: 3 },
      },
      {
        id: 'log-2',
        chatbotId: 'chatbot-1',
        query: '查詢2',
        session: { id: 'session-2', token: 'token-456' },
        _count: { queryLogDetails: 5 },
      },
    ];

    it('✅ 應該成功查詢所有 QueryLogs', async () => {
      prismaService.queryLog.findMany.mockResolvedValue(mockLogs);
      prismaService.queryLog.count.mockResolvedValue(2);

      const result = await service.findAll(queryDto);

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(2);
      expect(prismaService.queryLog.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId: 'chatbot-1',
        },
        include: {
          session: {
            select: {
              id: true,
              token: true,
            },
          },
          _count: {
            select: {
              queryLogDetails: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: 0,
        take: 20,
      });
    });

    it('✅ 應該支援 sessionId 過濾', async () => {
      const queryWithSession: QueryLogQueryDto = {
        ...queryDto,
        sessionId: 'session-1',
      };
      prismaService.queryLog.findMany.mockResolvedValue([mockLogs[0]]);
      prismaService.queryLog.count.mockResolvedValue(1);

      const result = await service.findAll(queryWithSession);

      expect(result.logs).toHaveLength(1);
      expect(prismaService.queryLog.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId: 'chatbot-1',
          sessionId: 'session-1',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      });
    });

    it('✅ 應該支援 ignored 過濾', async () => {
      const queryWithIgnored: QueryLogQueryDto = {
        ...queryDto,
        ignored: true,
      };
      prismaService.queryLog.findMany.mockResolvedValue([]);
      prismaService.queryLog.count.mockResolvedValue(0);

      const result = await service.findAll(queryWithIgnored);

      expect(prismaService.queryLog.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId: 'chatbot-1',
          ignored: true,
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      });
    });

    it('✅ 應該支援日期範圍過濾', async () => {
      const queryWithDate: QueryLogQueryDto = {
        ...queryDto,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      prismaService.queryLog.findMany.mockResolvedValue(mockLogs);
      prismaService.queryLog.count.mockResolvedValue(2);

      await service.findAll(queryWithDate);

      expect(prismaService.queryLog.findMany).toHaveBeenCalledWith({
        where: {
          chatbotId: 'chatbot-1',
          createdAt: {
            gte: new Date('2024-01-01'),
            lte: new Date('2024-01-31'),
          },
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      });
    });

    it('✅ 應該支援分頁', async () => {
      const queryWithPagination: QueryLogQueryDto = {
        ...queryDto,
        limit: 10,
        offset: 20,
      };
      prismaService.queryLog.findMany.mockResolvedValue([]);
      prismaService.queryLog.count.mockResolvedValue(100);

      await service.findAll(queryWithPagination);

      expect(prismaService.queryLog.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 20,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    const logId = 'log-1';
    const mockLog = {
      id: logId,
      chatbotId: 'chatbot-1',
      query: '測試查詢',
      session: {
        id: 'session-1',
        token: 'token-123',
        tenantId: 'tenant-1',
      },
      chatbot: {
        id: 'chatbot-1',
        name: 'Test Chatbot',
      },
      queryLogDetails: [],
    };

    it('✅ 應該成功查詢單一 QueryLog', async () => {
      prismaService.queryLog.findUnique.mockResolvedValue(mockLog);

      const result = await service.findOne(logId);

      expect(result).toEqual(mockLog);
      expect(prismaService.queryLog.findUnique).toHaveBeenCalledWith({
        where: { id: logId },
        include: {
          session: {
            select: {
              id: true,
              token: true,
              tenantId: true,
            },
          },
          chatbot: {
            select: {
              id: true,
              name: true,
            },
          },
          queryLogDetails: {
            include: {
              faq: {
                select: {
                  id: true,
                  question: true,
                  answer: true,
                },
              },
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
    });

    it('❌ 應該在 QueryLog 不存在時拋出 NotFoundException', async () => {
      prismaService.queryLog.findUnique.mockResolvedValue(null);

      await expect(service.findOne(logId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(logId)).rejects.toThrow(`QueryLog with id ${logId} not found`);
    });

    it('✅ 應該包含 queryLogDetails', async () => {
      const logWithDetails = {
        ...mockLog,
        queryLogDetails: [
          {
            id: 'detail-1',
            logId: 'log-1',
            faqId: 'faq-1',
            faq: {
              id: 'faq-1',
              question: '問題1',
              answer: '答案1',
            },
          },
        ],
      };
      prismaService.queryLog.findUnique.mockResolvedValue(logWithDetails);

      const result = await service.findOne(logId);

      expect(result.queryLogDetails).toHaveLength(1);
      expect(result.queryLogDetails[0].faq).toBeDefined();
    });
  });

  describe('createDetail', () => {
    const createDto: CreateQueryLogDetailDto = {
      logId: 'log-1',
      faqId: 'faq-1',
      userAction: 'viewed',
    };

    const createdDetail = {
      ...createDto,
      faq: {
        id: 'faq-1',
        question: '問題1',
        answer: '答案1',
      },
    };

    it('✅ 應該成功創建 QueryLogDetail', async () => {
      prismaService.queryLogDetail.findUnique.mockResolvedValue(null);
      prismaService.queryLogDetail.create.mockResolvedValue(createdDetail);

      const result = await service.createDetail(createDto);

      expect(result).toEqual(createdDetail);
      expect(prismaService.queryLogDetail.findUnique).toHaveBeenCalledWith({
        where: {
          logId_faqId: {
            logId: createDto.logId,
            faqId: createDto.faqId,
          },
        },
      });
      expect(prismaService.queryLogDetail.create).toHaveBeenCalledWith({
        data: createDto,
        include: {
          faq: {
            select: {
              id: true,
              question: true,
              answer: true,
            },
          },
        },
      });
    });

    it('❌ 應該拒絕重複的 logId 和 faqId 組合', async () => {
      prismaService.queryLogDetail.findUnique.mockResolvedValue({
        logId: 'log-1',
        faqId: 'faq-1',
      } as any);

      await expect(service.createDetail(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.createDetail(createDto)).rejects.toThrow('QueryLogDetail for log log-1 and faq faq-1 already exists');
      expect(prismaService.queryLogDetail.create).not.toHaveBeenCalled();
    });
  });

  describe('getDetailsByLog', () => {
    const logId = 'log-1';
    const mockDetails = [
      {
        id: 'detail-1',
        logId: 'log-1',
        faqId: 'faq-1',
        userAction: 'viewed',
        faq: {
          id: 'faq-1',
          question: '問題1',
          answer: '答案1',
          topicId: 'topic-1',
        },
      },
      {
        id: 'detail-2',
        logId: 'log-1',
        faqId: 'faq-2',
        userAction: 'liked',
        faq: {
          id: 'faq-2',
          question: '問題2',
          answer: '答案2',
          topicId: 'topic-2',
        },
      },
    ];

    it('✅ 應該成功查詢所有 Details', async () => {
      prismaService.queryLogDetail.findMany.mockResolvedValue(mockDetails);

      const result = await service.getDetailsByLog(logId);

      expect(result).toEqual(mockDetails);
      expect(prismaService.queryLogDetail.findMany).toHaveBeenCalledWith({
        where: { logId },
        include: {
          faq: {
            select: {
              id: true,
              question: true,
              answer: true,
              topicId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });

    it('✅ 應該返回空陣列當沒有 Details', async () => {
      prismaService.queryLogDetail.findMany.mockResolvedValue([]);

      const result = await service.getDetailsByLog(logId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('remove', () => {
    const logId = 'log-1';
    const existingLog = {
      id: logId,
      chatbotId: 'chatbot-1',
      query: '測試查詢',
      session: { id: 'session-1', token: 'token-123', tenantId: 'tenant-1' },
      chatbot: { id: 'chatbot-1', name: 'Test Chatbot' },
      queryLogDetails: [],
    };

    beforeEach(() => {
      prismaService.queryLog.findUnique.mockResolvedValue(existingLog);
    });

    it('✅ 應該成功刪除 QueryLog', async () => {
      prismaService.queryLogDetail.deleteMany.mockResolvedValue({ count: 0 });
      prismaService.queryLog.delete.mockResolvedValue(existingLog);

      const result = await service.remove(logId);

      expect(result).toEqual(existingLog);
      expect(prismaService.queryLog.findUnique).toHaveBeenCalled();
      expect(prismaService.queryLogDetail.deleteMany).toHaveBeenCalledWith({
        where: { logId },
      });
      expect(prismaService.queryLog.delete).toHaveBeenCalledWith({
        where: { id: logId },
      });
    });

    it('✅ 應該先刪除所有 Details 再刪除 Log', async () => {
      prismaService.queryLogDetail.deleteMany.mockResolvedValue({ count: 5 });
      prismaService.queryLog.delete.mockResolvedValue(existingLog);

      await service.remove(logId);

      const deleteManyCall = prismaService.queryLogDetail.deleteMany.mock.invocationCallOrder[0];
      const deleteCall = prismaService.queryLog.delete.mock.invocationCallOrder[0];
      expect(deleteManyCall).toBeLessThan(deleteCall);
    });

    it('❌ 應該在 QueryLog 不存在時拋出 NotFoundException', async () => {
      prismaService.queryLog.findUnique.mockResolvedValue(null);

      await expect(service.remove(logId)).rejects.toThrow(NotFoundException);
      expect(prismaService.queryLogDetail.deleteMany).not.toHaveBeenCalled();
      expect(prismaService.queryLog.delete).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    const chatbotId = 'chatbot-1';

    it('✅ 應該成功獲取統計資訊', async () => {
      prismaService.queryLog.count.mockResolvedValueOnce(100);
      prismaService.queryLog.aggregate.mockResolvedValue({
        _avg: {
          resultsCnt: 5.5,
          readCnt: 3.2,
        },
      });
      prismaService.queryLog.count.mockResolvedValueOnce(10);

      const result = await service.getStats(chatbotId);

      expect(result).toEqual({
        totalQueries: 100,
        avgResultsCnt: 5.5,
        avgReadCnt: 3.2,
        ignoredCount: 10,
      });
      expect(prismaService.queryLog.count).toHaveBeenCalledTimes(2);
      expect(prismaService.queryLog.aggregate).toHaveBeenCalled();
    });

    it('✅ 應該支援日期範圍', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      prismaService.queryLog.count.mockResolvedValueOnce(50);
      prismaService.queryLog.aggregate.mockResolvedValue({
        _avg: {
          resultsCnt: 4.0,
          readCnt: 2.0,
        },
      });
      prismaService.queryLog.count.mockResolvedValueOnce(5);

      await service.getStats(chatbotId, startDate, endDate);

      expect(prismaService.queryLog.count).toHaveBeenCalledWith({
        where: {
          chatbotId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
    });

    it('✅ 應該處理 null 平均值', async () => {
      prismaService.queryLog.count.mockResolvedValueOnce(0);
      prismaService.queryLog.aggregate.mockResolvedValue({
        _avg: {
          resultsCnt: null,
          readCnt: null,
        },
      });
      prismaService.queryLog.count.mockResolvedValueOnce(0);

      const result = await service.getStats(chatbotId);

      expect(result.avgResultsCnt).toBe(0);
      expect(result.avgReadCnt).toBe(0);
    });
  });

  describe('ignoreQuery', () => {
    const chatbotId = 'chatbot-1';
    const query = '測試查詢';

    it('✅ 應該成功標記查詢為忽略', async () => {
      prismaService.queryLog.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.ignoreQuery(chatbotId, query, true);

      expect(result).toEqual({ count: 5 });
      expect(prismaService.queryLog.updateMany).toHaveBeenCalledWith({
        where: {
          chatbotId,
          query,
        },
        data: {
          ignored: true,
        },
      });
    });

    it('✅ 應該成功取消忽略查詢', async () => {
      prismaService.queryLog.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.ignoreQuery(chatbotId, query, false);

      expect(result).toEqual({ count: 3 });
      expect(prismaService.queryLog.updateMany).toHaveBeenCalledWith({
        where: {
          chatbotId,
          query,
        },
        data: {
          ignored: false,
        },
      });
    });

    it('✅ 應該返回更新的記錄數', async () => {
      prismaService.queryLog.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.ignoreQuery(chatbotId, query, true);

      expect(result.count).toBe(0);
    });
  });
});
