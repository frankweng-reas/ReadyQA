import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CreateChatbotDto, UpdateChatbotDto, ChatbotQueryDto } from './dto/chatbot.dto';
import { getDefaultTheme, getDefaultDomainWhitelist, generateChatbotId } from './default-theme';

/**
 * Chatbots Service
 * 
 * 測試覆蓋率: 80%
 * 
 * TODO: 未測試的部分
 * - Line 27-35: TenantId 自動取得邏輯（當未提供 tenantId 時從 user 取得）
 * - Line 62-72: ES 索引創建失敗處理（try-catch 區塊）
 * - Line 176: ES 索引刪除失敗處理
 * - Line 211-230: updateLogo() 方法
 */
@Injectable()
export class ChatbotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async create(createDto: CreateChatbotDto) {
    // 如果沒有提供 ID，自動生成
    const chatbotId = createDto.id || generateChatbotId();

    // 檢查 ID 是否已存在
    const existing = await this.prisma.chatbot.findUnique({
      where: { id: chatbotId },
    });

    if (existing) {
      throw new BadRequestException(`Chatbot with id ${chatbotId} already exists`);
    }

    // 如果沒有提供 tenantId，從 user 取得
    let tenantId: string | undefined = createDto.tenantId;
    if (!tenantId && createDto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: createDto.userId },
        select: { tenantId: true },
      });
      tenantId = user?.tenantId || undefined;
    }

    // 準備創建資料，設置預設值
    const data: any = {
      id: chatbotId,
      userId: createDto.userId,
      tenantId: tenantId,
      name: createDto.name,
      description: createDto.description || null,
      // status 欄位保留用，目前沒有控制功能，預設為 'published'
      status: createDto.status || 'published',
      isActive: createDto.isActive || 'active',
      // 如果沒有提供 theme，使用預設主題
      theme: createDto.theme || getDefaultTheme(),
      // 如果沒有提供 domainWhitelist，使用預設值
      domainWhitelist: createDto.domainWhitelist || getDefaultDomainWhitelist(),
    };

    const chatbot = await this.prisma.chatbot.create({
      data,
    });

    // 創建 Elasticsearch 索引（如果 ES 可用）
    // ES 索引創建失敗不影響 chatbot 創建
    if (this.elasticsearchService.isAvailable()) {
      try {
        const esCreated = await this.elasticsearchService.createFaqIndex(chatbotId);
        if (!esCreated) {
          console.warn(
            `[ChatbotsService] ES 索引創建失敗，但 chatbot 已創建: ${chatbotId}`,
          );
        }
      } catch (esError) {
        console.error(
          `[ChatbotsService] ES 索引創建異常（不影響 chatbot 創建）:`,
          esError,
        );
      }
    }

    return chatbot;
  }

  async findAll(query: ChatbotQueryDto) {
    const where: any = {};

    if (query.userId) where.userId = query.userId;
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.status) where.status = query.status;
    if (query.isActive) where.isActive = query.isActive;

    return this.prisma.chatbot.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            faqs: true,
            topics: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const chatbot = await this.prisma.chatbot.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
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
            faqs: true,
            topics: true,
            sessions: true,
          },
        },
      },
    });

    if (!chatbot) {
      throw new NotFoundException(`Chatbot with id ${id} not found`);
    }

    return chatbot;
  }

  async update(id: string, updateDto: UpdateChatbotDto) {
    // 確認 chatbot 存在
    await this.findOne(id);

    console.log(`[ChatbotsService] Updating chatbot ${id} with:`, updateDto);

    // 直接更新（Frontend 會傳完整的 theme）
    const updated = await this.prisma.chatbot.update({
      where: { id },
      data: updateDto,
    });

    console.log(`[ChatbotsService] ✅ Chatbot ${id} updated successfully. isActive:`, updated.isActive);

    return updated;
  }

  async remove(id: string) {
    // 確認 chatbot 存在
    await this.findOne(id);

    // 刪除 Elasticsearch 索引（如果存在）
    if (this.elasticsearchService.isAvailable()) {
      try {
        await this.elasticsearchService.deleteFaqIndex(id);
      } catch (error) {
        console.warn(
          `[ChatbotsService] ES 索引刪除失敗（不影響 chatbot 刪除）:`,
          error.message,
        );
      }
    }

    return this.prisma.chatbot.delete({
      where: { id },
    });
  }

  async getStats(id: string) {
    const chatbot = await this.findOne(id);

    const [faqCount, topicCount, sessionCount, queryLogCount] = await Promise.all([
      this.prisma.faq.count({ where: { chatbotId: id } }),
      this.prisma.topic.count({ where: { chatbotId: id } }),
      this.prisma.session.count({ where: { chatbotId: id } }),
      this.prisma.queryLog.count({ where: { chatbotId: id } }),
    ]);

    return {
      chatbot,
      stats: {
        faqCount,
        topicCount,
        sessionCount,
        queryLogCount,
      },
    };
  }

  async updateLogo(id: string, filename: string): Promise<string> {
    // 確認 chatbot 存在
    const chatbot = await this.findOne(id);

    // Logo 路徑（相對路徑，供前端使用）
    const logoPath = `/uploads/chatbot-logos/${filename}`;

    // 更新 theme 中的 headerLogo
    const currentTheme = (chatbot.theme as any) || {};
    const updatedTheme = {
      ...currentTheme,
      headerLogo: logoPath,
    };

    await this.prisma.chatbot.update({
      where: { id },
      data: {
        theme: updatedTheme as any,
      },
    });

    return logoPath;
  }
}


