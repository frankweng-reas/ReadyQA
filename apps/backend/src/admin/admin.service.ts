import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllTenants() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        planCode: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        plan: {
          select: {
            code: true,
            name: true,
          },
        },
        users: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTenant(
    id: string,
    data: { name?: string; planCode?: string; status?: string },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }

    if (data.planCode) {
      const plan = await this.prisma.plan.findUnique({
        where: { code: data.planCode },
      });
      if (!plan) {
        throw new NotFoundException(`Plan with code ${data.planCode} not found`);
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.planCode !== undefined && { planCode: data.planCode }),
        ...(data.status !== undefined && { status: data.status }),
      },
      select: {
        id: true,
        name: true,
        planCode: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        plan: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });
  }
}
