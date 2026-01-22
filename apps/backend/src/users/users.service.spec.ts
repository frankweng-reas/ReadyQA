import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: any;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateUserDto = {
      username: 'testuser',
      email: 'test@example.com',
      supabaseUserId: 'supabase-123',
      tenantId: 'tenant-1',
      isActive: true,
    };

    const createdUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      supabaseUserId: 'supabase-123',
      tenantId: 'tenant-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('✅ 應該成功創建 User', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.create(createDto);

      expect(result).toEqual(createdUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createDto.email },
      });
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: createDto,
        select: {
          id: true,
          username: true,
          email: true,
          supabaseUserId: true,
          isActive: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('❌ 應該拒絕重複的 email', async () => {
      prismaService.user.findUnique.mockResolvedValue({ id: 1, email: 'test@example.com' } as any);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow('Email test@example.com already exists');
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('✅ 應該支援可選欄位', async () => {
      const createDtoMinimal = {
        username: 'testuser',
        email: 'test2@example.com',
      };
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue({
        id: 2,
        ...createDtoMinimal,
        supabaseUserId: null,
        tenantId: null,
        isActive: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDtoMinimal);

      expect(result.email).toBe('test2@example.com');
      expect(prismaService.user.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const mockUsers = [
      {
        id: 1,
        username: 'user1',
        email: 'user1@example.com',
        isActive: true,
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { chatbots: 3 },
      },
      {
        id: 2,
        username: 'user2',
        email: 'user2@example.com',
        isActive: false,
        tenantId: 'tenant-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { chatbots: 5 },
      },
    ];

    it('✅ 應該成功查詢所有 Users', async () => {
      const queryDto: UserQueryDto = {};
      prismaService.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll(queryDto);

      expect(result).toEqual(mockUsers);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {},
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              chatbots: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('✅ 應該支援 tenantId 過濾', async () => {
      const queryDto: UserQueryDto = {
        tenantId: 'tenant-1',
      };
      prismaService.user.findMany.mockResolvedValue([mockUsers[0]]);

      const result = await service.findAll(queryDto);

      expect(result).toHaveLength(1);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('✅ 應該支援 isActive 過濾', async () => {
      const queryDto: UserQueryDto = {
        isActive: true,
      };
      prismaService.user.findMany.mockResolvedValue([mockUsers[0]]);

      const result = await service.findAll(queryDto);

      expect(result).toHaveLength(1);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('✅ 應該支援 search 過濾（username 和 email）', async () => {
      const queryDto: UserQueryDto = {
        search: 'user1',
      };
      prismaService.user.findMany.mockResolvedValue([mockUsers[0]]);

      const result = await service.findAll(queryDto);

      expect(result).toHaveLength(1);
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { contains: 'user1', mode: 'insensitive' } },
            { email: { contains: 'user1', mode: 'insensitive' } },
          ],
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('✅ 應該支援組合過濾', async () => {
      const queryDto: UserQueryDto = {
        tenantId: 'tenant-1',
        isActive: true,
        search: 'user',
      };
      prismaService.user.findMany.mockResolvedValue([mockUsers[0]]);

      await service.findAll(queryDto);

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          isActive: true,
          OR: [
            { username: { contains: 'user', mode: 'insensitive' } },
            { email: { contains: 'user', mode: 'insensitive' } },
          ],
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('✅ 應該返回空陣列當沒有 Users', async () => {
      const queryDto: UserQueryDto = {};
      prismaService.user.findMany.mockResolvedValue([]);

      const result = await service.findAll(queryDto);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    const userId = 1;
    const mockUser = {
      id: userId,
      username: 'testuser',
      email: 'test@example.com',
      isActive: true,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      chatbots: [],
      tenant: {
        id: 'tenant-1',
        name: 'Test Tenant',
        planCode: 'basic',
      },
      _count: {
        chatbots: 3,
      },
    };

    it('✅ 應該成功查詢單一 User', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne(userId);

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
          chatbots: {
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              planCode: true,
            },
          },
          _count: {
            select: {
              chatbots: true,
            },
          },
        },
      });
    });

    it('❌ 應該在 User 不存在時拋出 NotFoundException', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(userId)).rejects.toThrow(`User with id ${userId} not found`);
    });

    it('✅ 應該包含 chatbots 和 tenant 資訊', async () => {
      const userWithRelations = {
        ...mockUser,
        chatbots: [
          { id: 'chatbot-1', name: 'Chatbot 1', status: 'published' },
        ],
      };
      prismaService.user.findUnique.mockResolvedValue(userWithRelations);

      const result = await service.findOne(userId);

      expect(result.chatbots).toHaveLength(1);
      expect(result.tenant).toBeDefined();
      expect(result._count.chatbots).toBe(3);
    });
  });

  describe('findByEmail', () => {
    const email = 'test@example.com';
    const mockUser = {
      id: 1,
      username: 'testuser',
      email,
      supabaseUserId: 'supabase-123',
      isActive: true,
      tenantId: 'tenant-1',
      createdAt: new Date(),
    };

    it('✅ 應該成功根據 email 查詢 User', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail(email);

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email },
        select: {
          id: true,
          username: true,
          email: true,
          supabaseUserId: true,
          isActive: true,
          tenantId: true,
          createdAt: true,
        },
      });
    });

    it('❌ 應該在 User 不存在時拋出 NotFoundException', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByEmail(email)).rejects.toThrow(NotFoundException);
      await expect(service.findByEmail(email)).rejects.toThrow(`User with email ${email} not found`);
    });
  });

  describe('update', () => {
    const userId = 1;
    const existingUser = {
      id: userId,
      username: 'olduser',
      email: 'old@example.com',
      supabaseUserId: 'supabase-123',
      isActive: true,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      chatbots: [],
      tenant: { id: 'tenant-1', name: 'Test Tenant', planCode: 'basic' },
      _count: { chatbots: 0 },
    };

    beforeEach(() => {
      prismaService.user.findUnique.mockResolvedValue(existingUser);
    });

    it('✅ 應該成功更新 User', async () => {
      const updateDto: UpdateUserDto = {
        username: 'newuser',
        isActive: false,
      };
      const updatedUser = {
        ...existingUser,
        ...updateDto,
        updatedAt: new Date(),
      };
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(userId, updateDto);

      expect(result).toEqual(updatedUser);
      expect(prismaService.user.findUnique).toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateDto,
        select: {
          id: true,
          username: true,
          email: true,
          supabaseUserId: true,
          isActive: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('✅ 應該支援部分更新（只更新 username）', async () => {
      const updateDto: UpdateUserDto = {
        username: 'newuser',
      };
      const updatedUser = {
        ...existingUser,
        username: 'newuser',
        updatedAt: new Date(),
      };
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(userId, updateDto);

      expect(result.username).toBe('newuser');
      expect(result.email).toBe('old@example.com');
    });

    it('✅ 應該支援更新 email', async () => {
      const updateDto: UpdateUserDto = {
        email: 'new@example.com',
      };
      prismaService.user.findUnique
        .mockResolvedValueOnce(existingUser) // findOne 調用
        .mockResolvedValueOnce(null); // email 檢查
      const updatedUser = {
        ...existingUser,
        email: 'new@example.com',
        updatedAt: new Date(),
      };
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(userId, updateDto);

      expect(result.email).toBe('new@example.com');
      expect(prismaService.user.findUnique).toHaveBeenCalledTimes(2);
    });

    it('❌ 應該在 email 已被其他用戶使用時拒絕更新', async () => {
      const updateDto: UpdateUserDto = {
        email: 'existing@example.com',
      };
      // findOne 會調用 findUnique 一次（返回 existingUser，包含完整欄位）
      // 然後 email 檢查會調用 findUnique 一次（返回其他用戶，只有基本欄位）
      prismaService.user.findUnique
        .mockResolvedValueOnce(existingUser) // findOne 調用（where: { id }）
        .mockResolvedValueOnce({ id: 2, email: 'existing@example.com' } as any); // email 檢查（where: { email }）

      await expect(service.update(userId, updateDto)).rejects.toThrow(BadRequestException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });

    it('✅ 應該允許更新為自己的 email', async () => {
      const updateDto: UpdateUserDto = {
        email: 'old@example.com', // 同一個 email
      };
      prismaService.user.findUnique
        .mockResolvedValueOnce(existingUser) // findOne 調用
        .mockResolvedValueOnce(existingUser); // email 檢查（同一個用戶）
      const updatedUser = {
        ...existingUser,
        updatedAt: new Date(),
      };
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(userId, updateDto);

      expect(result.email).toBe('old@example.com');
      expect(prismaService.user.update).toHaveBeenCalled();
    });

    it('❌ 應該在 User 不存在時拋出 NotFoundException', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.update(userId, { username: 'newuser' })).rejects.toThrow(NotFoundException);
      expect(prismaService.user.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const userId = 1;
    const existingUser = {
      id: userId,
      username: 'testuser',
      email: 'test@example.com',
      supabaseUserId: 'supabase-123',
      isActive: true,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      chatbots: [],
      tenant: { id: 'tenant-1', name: 'Test Tenant', planCode: 'basic' },
      _count: { chatbots: 0 },
    };

    beforeEach(() => {
      prismaService.user.findUnique.mockResolvedValue(existingUser);
    });

    it('✅ 應該成功刪除 User', async () => {
      const deletedUser = {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
      };
      prismaService.user.delete.mockResolvedValue(deletedUser);

      const result = await service.remove(userId);

      expect(result).toEqual(deletedUser);
      expect(prismaService.user.findUnique).toHaveBeenCalled();
      expect(prismaService.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
        },
      });
    });

    it('❌ 應該在 User 不存在時拋出 NotFoundException', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId)).rejects.toThrow(NotFoundException);
      expect(prismaService.user.delete).not.toHaveBeenCalled();
    });
  });
});
