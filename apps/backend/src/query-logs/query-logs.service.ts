import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateQueryLogDto,
  CreateQueryLogDetailDto,
  QueryLogQueryDto,
} from './dto/query-log.dto';

@Injectable()
export class QueryLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateQueryLogDto) {
    const existing = await this.prisma.queryLog.findUnique({
      where: { id: createDto.id },
    });

    if (existing) {
      throw new BadRequestException(`QueryLog with id ${createDto.id} already exists`);
    }

    return this.prisma.queryLog.create({
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
  }

  async findAll(query: QueryLogQueryDto) {
    const where: any = {
      chatbotId: query.chatbotId,
    };

    if (query.sessionId) where.sessionId = query.sessionId;
    if (query.ignored !== undefined) where.ignored = query.ignored;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.queryLog.findMany({
        where,
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
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.queryLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findOne(id: string) {
    const log = await this.prisma.queryLog.findUnique({
      where: { id },
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

    if (!log) {
      throw new NotFoundException(`QueryLog with id ${id} not found`);
    }

    return log;
  }

  async createDetail(createDto: CreateQueryLogDetailDto) {
    const existing = await this.prisma.queryLogDetail.findUnique({
      where: {
        logId_faqId: {
          logId: createDto.logId,
          faqId: createDto.faqId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`QueryLogDetail for log ${createDto.logId} and faq ${createDto.faqId} already exists`);
    }

    return this.prisma.queryLogDetail.create({
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
  }

  async getDetailsByLog(logId: string) {
    return this.prisma.queryLogDetail.findMany({
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
  }

  async remove(id: string) {
    await this.findOne(id);

    // Delete all details first
    await this.prisma.queryLogDetail.deleteMany({
      where: { logId: id },
    });

    return this.prisma.queryLog.delete({
      where: { id },
    });
  }

  async getStats(chatbotId: string, startDate?: Date, endDate?: Date) {
    const where: any = { chatbotId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [totalQueries, avgResults, ignoredCount] = await Promise.all([
      this.prisma.queryLog.count({ where }),
      this.prisma.queryLog.aggregate({
        where,
        _avg: { resultsCnt: true, readCnt: true },
      }),
      this.prisma.queryLog.count({ where: { ...where, ignored: true } }),
    ]);

    return {
      totalQueries,
      avgResultsCnt: avgResults._avg.resultsCnt || 0,
      avgReadCnt: avgResults._avg.readCnt || 0,
      ignoredCount,
    };
  }
}

