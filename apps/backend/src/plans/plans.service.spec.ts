import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlansService', () => {
  let service: PlansService;
  let prismaService: any;

  const mockPrismaService = {
    plan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const mockPlans = [
      {
        code: 'basic',
        name: '基本方案',
        priceTwdMonthly: 0,
        description: '基本功能',
      },
      {
        code: 'premium',
        name: '進階方案',
        priceTwdMonthly: 500,
        description: '進階功能',
      },
      {
        code: 'enterprise',
        name: '企業方案',
        priceTwdMonthly: 2000,
        description: '企業功能',
      },
    ];

    it('✅ 應該成功查詢所有 Plans', async () => {
      prismaService.plan.findMany.mockResolvedValue(mockPlans);

      const result = await service.findAll();

      expect(result).toEqual(mockPlans);
      expect(prismaService.plan.findMany).toHaveBeenCalledWith({
        orderBy: {
          priceTwdMonthly: 'asc',
        },
      });
    });

    it('✅ 應該按價格升序排序', async () => {
      const unsortedPlans = [
        { code: 'premium', priceTwdMonthly: 500 },
        { code: 'basic', priceTwdMonthly: 0 },
        { code: 'enterprise', priceTwdMonthly: 2000 },
      ];
      prismaService.plan.findMany.mockResolvedValue(unsortedPlans);

      const result = await service.findAll();

      expect(prismaService.plan.findMany).toHaveBeenCalledWith({
        orderBy: {
          priceTwdMonthly: 'asc',
        },
      });
    });

    it('✅ 應該返回空陣列當沒有 Plans', async () => {
      prismaService.plan.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    const planCode = 'basic';
    const mockPlan = {
      code: planCode,
      name: '基本方案',
      priceTwdMonthly: 0,
      description: '基本功能',
    };

    it('✅ 應該成功查詢單一 Plan', async () => {
      prismaService.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.findOne(planCode);

      expect(result).toEqual(mockPlan);
      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { code: planCode },
      });
    });

    it('❌ 應該在 Plan 不存在時拋出 NotFoundException', async () => {
      prismaService.plan.findUnique.mockResolvedValue(null);

      await expect(service.findOne(planCode)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(planCode)).rejects.toThrow(`Plan with code ${planCode} not found`);
    });

    it('✅ 應該支援不同的 plan code', async () => {
      const premiumPlan = {
        code: 'premium',
        name: '進階方案',
        priceTwdMonthly: 500,
      };
      prismaService.plan.findUnique.mockResolvedValue(premiumPlan);

      const result = await service.findOne('premium');

      expect(result.code).toBe('premium');
      expect(prismaService.plan.findUnique).toHaveBeenCalledWith({
        where: { code: 'premium' },
      });
    });
  });
});
