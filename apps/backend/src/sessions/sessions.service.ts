import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto, UpdateSessionDto, SessionQueryDto } from './dto/session.dto';
import { randomBytes } from 'node:crypto';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateSessionDto) {
    const existing = await this.prisma.session.findUnique({
      where: { id: createDto.id },
    });

    if (existing) {
      throw new BadRequestException(`Session with id ${createDto.id} already exists`);
    }

    return this.prisma.session.create({
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
  }

  async findAll(query: SessionQueryDto) {
    const where: any = {
      chatbotId: query.chatbotId,
    };

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.active !== undefined) {
      if (query.active) {
        where.expiresAt = { gt: new Date() };
      } else {
        where.expiresAt = { lte: new Date() };
      }
    }

    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              queryLogs: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.session.count({ where }),
    ]);

    return { sessions, total };
  }

  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
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

    if (!session) {
      throw new NotFoundException(`Session with id ${id} not found`);
    }

    return session;
  }

  async findByToken(token: string) {
    const session = await this.prisma.session.findUnique({
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

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.expiresAt < new Date()) {
      throw new BadRequestException('Session expired');
    }

    return session;
  }

  async update(id: string, updateDto: UpdateSessionDto) {
    await this.findOne(id);

    return this.prisma.session.update({
      where: { id },
      data: updateDto,
    });
  }

  async extendExpiry(id: string, days: number = 30) {
    await this.findOne(id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    return this.prisma.session.update({
      where: { id },
      data: {
        expiresAt,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.session.delete({
      where: { id },
    });
  }

  generateSessionToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * 驗證 Session Token
   * 驗證 Session Token
   * 
   * @param token Session Token
   * @param chatbotId Chatbot ID（用於驗證 token 是否屬於該 chatbot）
   * @returns Session 資訊（包含 session_id）
   */
  async verifyToken(token: string, chatbotId: string) {
    // 查找 session
    const session = await this.prisma.session.findUnique({
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

    if (!session) {
      throw new UnauthorizedException('SESSION_NOT_FOUND');
    }

    // 檢查是否過期
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('TOKEN_EXPIRED');
    }

    // 檢查 chatbot_id 是否匹配
    if (session.chatbotId !== chatbotId) {
      throw new UnauthorizedException('CHATBOT_MISMATCH');
    }

    // 注意：已移除查詢次數限制檢查，改用 Rate Limiting + Quota 機制
    // queryCount 仍會累積，用於統計分析

    return {
      session_id: session.id,
      chatbot_id: session.chatbotId,
      tenant_id: session.tenantId,
      query_count: session.queryCount,
      max_queries: session.maxQueries,
    };
  }

  /**
   * 增加 Session 的查詢次數
   * 增加查詢計數
   * 
   * @param sessionId Session ID
   */
  async incrementQueryCount(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        queryCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * 初始化 Session（公開 API）
   * 初始化 Session
   * 
   * @param chatbotId Chatbot ID
   * @param ipAddress 來源 IP（可選）
   * @returns Session 資訊（包含明文 token）
   */
  async initSession(
    chatbotId: string,
    ipAddress?: string,
  ): Promise<{
    token: string;
    expires_at: string;
    max_queries: number;
  }> {
    // 1. 驗證 chatbot 存在且狀態為 active
    const chatbot = await this.prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        tenantId: true,
        status: true,
        isActive: true,
      },
    });

    if (!chatbot) {
      throw new NotFoundException('Chatbot 不存在');
    }

    // 檢查 isActive 狀態
    if (chatbot.isActive !== 'active') {
      throw new BadRequestException('Chatbot 已暫停使用');
    }

    // 2. 生成 token
    const token = this.generateSessionToken();

    // 3. 計算過期時間（預設 30 天）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // 4. 創建 session
    const session = await this.prisma.session.create({
      data: {
        token,
        chatbot: {
          connect: { id: chatbot.id },
        },
        tenant: {
          connect: { id: chatbot.tenantId as string },
        },
        ipAddress,
        expiresAt,
        maxQueries: 50, // 預設 50 次
        queryCount: 0,
      },
    });

    return {
      token: session.token,
      expires_at: session.expiresAt.toISOString(),
      max_queries: session.maxQueries,
    };
  }
}

