import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto, TenantQueryDto } from './dto/tenant.dto';

describe('TenantsService', () => {
  let service: TenantsService;
  let prismaService: any;

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
    },
    chatbot: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTenantDto = {
      id: 'tenant-1',
      name: '測試租戶',
      planCode: 'basic',
      status: 'active',
    };

    const mockPlan = {
      code: 'basic',
      name: '基本方案',
    };

    const createdTenant = {
      ...createDto,
      plan: mockPlan,
    };

    it('✅ 應該成功創建 Tenant', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.tenant.create.mockResolvedValue(createdTenant);

      const result = await service.create(createDto);

      expect(result).toEqual(createdTenant);
      expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.id },
      });
      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { code: createDto.planCode },
      });
      expect(prismaService.tenant.create).toHaveBeenCalledWith({
        data: createDto,
        include: {
          plan: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      });
    });

    it('❌ 應該拒絕重複的 ID', async () => {
      prismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' } as any);

      await expect(service.create(createDto)).rejects.toThrow(BadRequestException);
      await expect(service.create(createDto)).rejects.toThrow('Tenant with id tenant-1 already exists');
      expect(prismaService.plan.findUnique).not.toHaveBeenCalled();
      expect(prismaService.tenant.create).not.toHaveBeenCalled();
    });

    it('❌ 應該在 Plan 不存在時拋出 NotFoundException', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);
      prismaService.plan.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
      await expect(service.create(createDto)).rejects.toThrow('Plan with code basic not found');
      expect(prismaService.tenant.create).not.toHaveBeenCalled();
    });

    it('✅ 應該支援沒有 status 的 Tenant', async () => {
      const createDtoWithoutStatus = {
        id: 'tenant-2',
        name: '測試租戶2',
        planCode: 'basic',
      };
      prismaService.tenant.findUnique.mockResolvedValue(null);
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);
      prismaService.tenant.create.mockResolvedValue({
        ...createDtoWithoutStatus,
        plan: mockPlan,
      });

      const result = await service.create(createDtoWithoutStatus);

      expect(result.status).toBeUndefined();
      expect(prismaService.tenant.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const mockTenants = [
      {
        id: 'tenant-1',
        name: '租戶1',
        planCode: 'basic',
        status: 'active',
        plan: { code: 'basic', name: '基本方案' },
        _count: { users: 5, chatbots: 3, sessions: 10 },
      },
      {
        id: 'tenant-2',
        name: '租戶2',
        planCode: 'premium',
        status: 'active',
        plan: { code: 'premium', name: '進階方案' },
        _count: { users: 10, chatbots: 5, sessions: 20 },
      },
    ];

    it('✅ 應該成功查詢所有 Tenants', async () => {
      const queryDto: TenantQueryDto = {};
      prismaService.tenant.findMany.mockResolvedValue(mockTenants);

      const result = await service.findAll(queryDto);

      expect(result).toEqual(mockTenants);
      expect(prismaService.tenant.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          plan: {
            select: {
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              users: true,
              chatbots: true,
              sessions: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('✅ 應該支援 planCode 過濾', async () => {
      const queryDto: TenantQueryDto = {
        planCode: 'basic',
      };
      prismaService.tenant.findMany.mockResolvedValue([mockTenants[0]]);

      const result = await service.findAll(queryDto);

      expect(result).toHaveLength(1);
      expect(prismaService.tenant.findMany).toHaveBeenCalledWith({
        where: {
          planCode: 'basic',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('✅ 應該支援 status 過濾', async () => {
      const queryDto: TenantQueryDto = {
        status: 'active',
      };
      prismaService.tenant.findMany.mockResolvedValue(mockTenants);

      const result = await service.findAll(queryDto);

      expect(result).toEqual(mockTenants);
      expect(prismaService.tenant.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('✅ 應該支援同時使用 planCode 和 status 過濾', async () => {
      const queryDto: TenantQueryDto = {
        planCode: 'basic',
        status: 'active',
      };
      prismaService.tenant.findMany.mockResolvedValue([mockTenants[0]]);

      const result = await service.findAll(queryDto);

      expect(result).toHaveLength(1);
      expect(prismaService.tenant.findMany).toHaveBeenCalledWith({
        where: {
          planCode: 'basic',
          status: 'active',
        },
        include: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it('✅ 應該返回空陣列當沒有 Tenants', async () => {
      const queryDto: TenantQueryDto = {};
      prismaService.tenant.findMany.mockResolvedValue([]);

      const result = await service.findAll(queryDto);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-1';
    const mockTenant = {
      id: tenantId,
      name: '測試租戶',
      planCode: 'basic',
      status: 'active',
      plan: {
        code: 'basic',
        name: '基本方案',
      },
      users: [],
      chatbots: [],
      _count: {
        users: 5,
        chatbots: 3,
        sessions: 10,
      },
    };

    it('✅ 應該成功查詢單一 Tenant', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findOne(tenantId);

      expect(result).toEqual(mockTenant);
      expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: tenantId },
        include: {
          plan: true,
          users: {
            select: {
              id: true,
              username: true,
              email: true,
              isActive: true,
            },
          },
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
          _count: {
            select: {
              users: true,
              chatbots: true,
              sessions: true,
            },
          },
        },
      });
    });

    it('❌ 應該在 Tenant 不存在時拋出 NotFoundException', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne(tenantId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(tenantId)).rejects.toThrow(`Tenant with id ${tenantId} not found`);
    });

    it('✅ 應該包含 plan 資訊', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.findOne(tenantId);

      expect(result.plan).toBeDefined();
      expect(result.plan.code).toBe('basic');
    });

    it('✅ 應該包含 users 和 chatbots', async () => {
      const tenantWithRelations = {
        ...mockTenant,
        users: [
          { id: 1, username: 'user1', email: 'user1@test.com', isActive: true },
        ],
        chatbots: [
          { id: 'chatbot-1', name: 'Chatbot 1', status: 'published' },
        ],
      };
      prismaService.tenant.findUnique.mockResolvedValue(tenantWithRelations);

      const result = await service.findOne(tenantId);

      expect(result.users).toHaveLength(1);
      expect(result.chatbots).toHaveLength(1);
    });
  });

  describe('update', () => {
    const tenantId = 'tenant-1';
    const existingTenant = {
      id: tenantId,
      name: '舊名稱',
      planCode: 'basic',
      status: 'active',
      plan: { code: 'basic', name: '基本方案' },
      users: [],
      chatbots: [],
      _count: { users: 0, chatbots: 0, sessions: 0 },
    };

    beforeEach(() => {
      prismaService.tenant.findUnique.mockResolvedValue(existingTenant);
    });

    it('✅ 應該成功更新 Tenant', async () => {
      const updateDto: UpdateTenantDto = {
        name: '新名稱',
        status: 'inactive',
      };
      const updatedTenant = {
        ...existingTenant,
        ...updateDto,
        plan: { code: 'basic', name: '基本方案' },
      };
      prismaService.tenant.update.mockResolvedValue(updatedTenant);

      const result = await service.update(tenantId, updateDto);

      expect(result).toEqual(updatedTenant);
      expect(prismaService.tenant.findUnique).toHaveBeenCalled();
      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: updateDto,
        include: {
          plan: {
            select: {
              code: true,
              name: true,
            },
          },
        },
      });
    });

    it('✅ 應該支援部分更新（只更新 name）', async () => {
      const updateDto: UpdateTenantDto = {
        name: '新名稱',
      };
      const updatedTenant = {
        ...existingTenant,
        name: '新名稱',
        plan: { code: 'basic', name: '基本方案' },
      };
      prismaService.tenant.update.mockResolvedValue(updatedTenant);

      const result = await service.update(tenantId, updateDto);

      expect(result.name).toBe('新名稱');
    });

    it('✅ 應該支援更新 planCode', async () => {
      const newPlan = { code: 'premium', name: '進階方案' };
      const updateDto: UpdateTenantDto = {
        planCode: 'premium',
      };
      prismaService.plan.findUnique.mockResolvedValue(newPlan);
      const updatedTenant = {
        ...existingTenant,
        planCode: 'premium',
        plan: newPlan,
      };
      prismaService.tenant.update.mockResolvedValue(updatedTenant);

      const result = await service.update(tenantId, updateDto);

      expect(result.planCode).toBe('premium');
      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { code: 'premium' },
      });
    });

    it('❌ 應該在更新 planCode 時檢查 Plan 是否存在', async () => {
      const updateDto: UpdateTenantDto = {
        planCode: 'invalid-plan',
      };
      prismaService.plan.findUnique.mockResolvedValue(null);

      await expect(service.update(tenantId, updateDto)).rejects.toThrow(NotFoundException);
      await expect(service.update(tenantId, updateDto)).rejects.toThrow('Plan with code invalid-plan not found');
      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });

    it('❌ 應該在 Tenant 不存在時拋出 NotFoundException', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.update(tenantId, { name: '新名稱' })).rejects.toThrow(NotFoundException);
      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });

    it('✅ 應該只更新提供的欄位', async () => {
      const updateDto: UpdateTenantDto = {
        name: '新名稱',
        status: 'inactive',
      };
      const updatedTenant = {
        ...existingTenant,
        name: '新名稱',
        status: 'inactive',
        planCode: 'basic', // 未更新
        plan: { code: 'basic', name: '基本方案' },
      };
      prismaService.tenant.update.mockResolvedValue(updatedTenant);

      const result = await service.update(tenantId, updateDto);

      expect(result.name).toBe('新名稱');
      expect(result.status).toBe('inactive');
      expect(result.planCode).toBe('basic');
    });
  });

  describe('remove', () => {
    const tenantId = 'tenant-1';
    const existingTenant = {
      id: tenantId,
      name: '測試租戶',
      planCode: 'basic',
      status: 'active',
      plan: { code: 'basic', name: '基本方案' },
      users: [],
      chatbots: [],
      _count: { users: 0, chatbots: 0, sessions: 0 },
    };

    beforeEach(() => {
      prismaService.tenant.findUnique.mockResolvedValue(existingTenant);
    });

    it('✅ 應該成功刪除 Tenant', async () => {
      prismaService.chatbot.count.mockResolvedValue(0);
      prismaService.tenant.delete.mockResolvedValue(existingTenant);

      const result = await service.remove(tenantId);

      expect(result).toEqual(existingTenant);
      expect(prismaService.tenant.findUnique).toHaveBeenCalled();
      expect(prismaService.chatbot.count).toHaveBeenCalledWith({
        where: { tenantId },
      });
      expect(prismaService.tenant.delete).toHaveBeenCalledWith({
        where: { id: tenantId },
      });
    });

    it('❌ 應該在有關聯的 chatbots 時拒絕刪除', async () => {
      prismaService.chatbot.count.mockResolvedValue(5);

      await expect(service.remove(tenantId)).rejects.toThrow(BadRequestException);
      await expect(service.remove(tenantId)).rejects.toThrow('Cannot delete tenant with 5 chatbots');
      expect(prismaService.tenant.delete).not.toHaveBeenCalled();
    });

    it('❌ 應該在 Tenant 不存在時拋出 NotFoundException', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.remove(tenantId)).rejects.toThrow(NotFoundException);
      expect(prismaService.chatbot.count).not.toHaveBeenCalled();
      expect(prismaService.tenant.delete).not.toHaveBeenCalled();
    });

    it('✅ 應該允許刪除有 0 個 chatbots 的 Tenant', async () => {
      prismaService.chatbot.count.mockResolvedValue(0);
      prismaService.tenant.delete.mockResolvedValue(existingTenant);

      await service.remove(tenantId);

      expect(prismaService.tenant.delete).toHaveBeenCalled();
    });
  });
});
