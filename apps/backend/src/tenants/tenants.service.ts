import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto, TenantQueryDto } from './dto/tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: createDto.id },
    });

    if (existing) {
      throw new BadRequestException(`Tenant with id ${createDto.id} already exists`);
    }

    // 檢查 plan 是否存在
    const plan = await this.prisma.plan.findUnique({
      where: { code: createDto.planCode },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with code ${createDto.planCode} not found`);
    }

    return this.prisma.tenant.create({
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
  }

  async findAll(query: TenantQueryDto) {
    const where: any = {};

    if (query.planCode) where.planCode = query.planCode;
    if (query.status) where.status = query.status;

    return this.prisma.tenant.findMany({
      where,
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
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
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

    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }

    return tenant;
  }

  async update(id: string, updateDto: UpdateTenantDto) {
    await this.findOne(id);

    if (updateDto.planCode) {
      const plan = await this.prisma.plan.findUnique({
        where: { code: updateDto.planCode },
      });

      if (!plan) {
        throw new NotFoundException(`Plan with code ${updateDto.planCode} not found`);
      }
    }

    return this.prisma.tenant.update({
      where: { id },
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
  }

  async remove(id: string) {
    await this.findOne(id);

    // 檢查是否有關聯的 chatbots
    const chatbotCount = await this.prisma.chatbot.count({
      where: { tenantId: id },
    });

    if (chatbotCount > 0) {
      throw new BadRequestException(`Cannot delete tenant with ${chatbotCount} chatbots`);
    }

    return this.prisma.tenant.delete({
      where: { id },
    });
  }
}
