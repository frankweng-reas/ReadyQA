import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.plan.findMany({
      orderBy: {
        priceTwdMonthly: 'asc',
      },
    });
  }

  async findOne(code: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { code },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with code ${code} not found`);
    }

    return plan;
  }
}

