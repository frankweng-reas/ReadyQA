import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from '../common/quota.service';
import { GetOrCreateUserDto } from './dto/get-or-create-user.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;

  // Mock PrismaService
  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockQuotaService = {
    getMonthlyQueryCount: jest.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);

    // 清除所有 mock
    jest.clearAllMocks();
  });

  describe('getOrCreateUser', () => {
    const supabaseUserId = 'supabase-uuid-123';
    const email = 'test@example.com';
    const name = 'Test User';

    it('應該通過 supabaseUserId 找到現有用戶', async () => {
      const existingUser = {
        id: 1,
        email,
        username: name,
        supabaseUserId,
        tenantId: '1',
      };

      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(existingUser); // 第一次查詢 supabaseUserId

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      const result = await service.getOrCreateUser(dto);

      expect(result).toEqual({
        success: true,
        message: '用戶已存在',
        userId: 1,
        created: false,
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { supabaseUserId },
        select: {
          id: true,
          email: true,
          username: true,
          supabaseUserId: true,
          tenantId: true,
        },
      });
    });

    it('應該通過 email 找到現有用戶（supabaseUserId 為 null，更新）', async () => {
      const existingUser = {
        id: 1,
        email,
        username: name,
        supabaseUserId: null,
        tenantId: '1',
      };

      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(null) // 第一次查詢 supabaseUserId 找不到
        .mockResolvedValueOnce(existingUser); // 第二次查詢 email 找到

      prismaService.user.update = jest.fn().mockResolvedValue({
        id: 1,
      });

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      const result = await service.getOrCreateUser(dto);

      expect(result).toEqual({
        success: true,
        message: '已更新用戶的 Supabase ID',
        userId: 1,
        created: false,
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { supabaseUserId },
        select: { id: true },
      });
    });

    it('應該通過 email 找到現有用戶（supabaseUserId 已匹配）', async () => {
      const existingUser = {
        id: 1,
        email,
        username: name,
        supabaseUserId, // 已匹配
        tenantId: '1',
        _count: {
          chatbots: 0,
        },
      };

      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(null) // 第一次查詢 supabaseUserId 找不到
        .mockResolvedValueOnce(existingUser); // 第二次查詢 email 找到

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      const result = await service.getOrCreateUser(dto);

      expect(result).toEqual({
        success: true,
        message: '用戶已存在',
        userId: 1,
        created: false,
      });
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('應該智能合併（email 存在但 supabaseUserId 不同）', async () => {
      const existingUser = {
        id: 1,
        email,
        username: name,
        supabaseUserId: 'different-uuid', // 不同的 UUID
        tenantId: '1',
        _count: {
          chatbots: 3, // 有 3 個 chatbot
        },
      };

      prismaService.user.findUnique = jest
        .fn()
        .mockResolvedValueOnce(null) // 第一次查詢 supabaseUserId 找不到
        .mockResolvedValueOnce(existingUser); // 第二次查詢 email 找到

      prismaService.user.update = jest.fn().mockResolvedValue({
        id: 1,
      });

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      const result = await service.getOrCreateUser(dto);

      expect(result).toEqual({
        success: true,
        message: '已更新用戶的 Supabase ID（已保留 3 個 chatbot）',
        userId: 1,
        created: false,
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { supabaseUserId },
      });
    });

    it('應該創建新用戶和 Tenant', async () => {
      const newUserId = 1;
      const tenantId = String(newUserId);
      const freePlan = {
        code: 'free',
        name: 'Free Plan',
      };

      // Mock 事務
      prismaService.user.findUnique = jest.fn().mockResolvedValue(null); // 找不到用戶
      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        // 模擬事務內的執行
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue({ id: newUserId }),
            update: jest.fn().mockResolvedValue({ id: newUserId }),
          },
          tenant: {
            findUnique: jest.fn().mockResolvedValue(null), // Tenant 不存在
            create: jest.fn().mockResolvedValue({ id: tenantId }),
          },
          plan: {
            findUnique: jest.fn().mockResolvedValue(freePlan),
          },
        };
        return callback(mockTx);
      });

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      const result = await service.getOrCreateUser(dto);

      expect(result).toEqual({
        success: true,
        message: '用戶建立成功',
        userId: newUserId,
        created: true,
      });
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('應該在沒有 email 時使用預設 email', async () => {
      const newUserId = 1;
      const tenantId = String(newUserId);
      const freePlan = {
        code: 'free',
        name: 'Free Plan',
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue({ id: newUserId }),
            update: jest.fn().mockResolvedValue({ id: newUserId }),
          },
          tenant: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: tenantId }),
          },
          plan: {
            findUnique: jest.fn().mockResolvedValue(freePlan),
          },
        };
        return callback(mockTx);
      });

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        // 沒有提供 email
      };

      const result = await service.getOrCreateUser(dto);

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      // 驗證使用了預設 email 格式
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('應該在沒有 name 時使用預設 username', async () => {
      const newUserId = 1;
      const tenantId = String(newUserId);
      const freePlan = {
        code: 'free',
        name: 'Free Plan',
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue({ id: newUserId }),
            update: jest.fn().mockResolvedValue({ id: newUserId }),
          },
          tenant: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: tenantId }),
          },
          plan: {
            findUnique: jest.fn().mockResolvedValue(freePlan),
          },
        };
        return callback(mockTx);
      });

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        // 沒有提供 name
      };

      const result = await service.getOrCreateUser(dto);

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
    });

    it('應該在 free plan 不存在時跳過 tenant 創建', async () => {
      const newUserId = 1;
      const tenantId = String(newUserId);

      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue({ id: newUserId }),
            update: jest.fn().mockResolvedValue({ id: newUserId }),
          },
          tenant: {
            findUnique: jest.fn(),
            create: jest.fn(),
          },
          plan: {
            findUnique: jest.fn().mockResolvedValue(null), // free plan 不存在
          },
        };
        return callback(mockTx);
      });

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      const result = await service.getOrCreateUser(dto);

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      // Tenant 創建應該被跳過，但不影響用戶創建
    });

    it('應該在 tenant 已存在時跳過創建', async () => {
      const newUserId = 1;
      const tenantId = String(newUserId);
      const freePlan = {
        code: 'free',
        name: 'Free Plan',
      };

      prismaService.user.findUnique = jest.fn().mockResolvedValue(null);
      prismaService.$transaction = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            create: jest.fn().mockResolvedValue({ id: newUserId }),
            update: jest.fn().mockResolvedValue({ id: newUserId }),
          },
          tenant: {
            findUnique: jest.fn().mockResolvedValue({ id: tenantId }), // Tenant 已存在
            create: jest.fn(),
          },
          plan: {
            findUnique: jest.fn().mockResolvedValue(freePlan),
          },
        };
        return callback(mockTx);
      });

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      const result = await service.getOrCreateUser(dto);

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
    });

    it('應該在錯誤時拋出 BadRequestException', async () => {
      const error = new Error('Database error');
      prismaService.user.findUnique = jest.fn().mockRejectedValue(error);

      const dto: GetOrCreateUserDto = {
        supabaseUserId,
        email,
        name,
      };

      await expect(service.getOrCreateUser(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getOrCreateUser(dto)).rejects.toThrow(
        '獲取或建立用戶失敗',
      );
    });
  });
});
