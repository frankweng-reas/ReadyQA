import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { CreateFaqDto, UpdateFaqDto, FaqQueryDto } from './dto/faq.dto';
import { generateEmbedding } from '../common/embedding.service';

@Injectable()
export class FaqsService {
  private readonly logger = new Logger(FaqsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async create(createDto: CreateFaqDto) {
    const existing = await this.prisma.faq.findUnique({
      where: { id: createDto.id },
    });

    if (existing) {
      throw new BadRequestException(`FAQ with id ${createDto.id} already exists`);
    }

    // ========== 步驟 1: 寫入 PostgreSQL ==========
    const faq = await this.prisma.faq.create({
      data: createDto,
      include: {
        topic: true,
        chatbot: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    this.logger.log(`✅ FAQ 已寫入 PostgreSQL: ${faq.id}`);

    // ========== 步驟 2: 寫入 Elasticsearch ==========
    if (this.elasticsearchService.isAvailable()) {
      try {
        const success = await this.saveFaqToElasticsearch(
          createDto.chatbotId,
          faq.id,
          faq.question,
          faq.answer,
          faq.synonym,
          faq.status,
        );

        if (!success) {
          // ES 失敗，回滾 PostgreSQL
          this.logger.warn(`⚠️ ES 寫入失敗，回滾 PostgreSQL: ${faq.id}`);
          try {
            await this.prisma.faq.delete({ where: { id: faq.id } });
          } catch (deleteError) {
            this.logger.error(`回滾失敗: ${deleteError.message}`);
          }
          throw new BadRequestException('保存到 Elasticsearch 失敗，已回滾');
        }

        this.logger.log(`✅ FAQ 已同步到 Elasticsearch: ${faq.id}`);
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error; // 重新拋出已處理的錯誤
        }
        this.logger.error(`❌ ES 同步失敗: ${error.message}`, error.stack);
        // 回滾 PostgreSQL
        try {
          await this.prisma.faq.delete({ where: { id: faq.id } });
          this.logger.log(`已回滾 PostgreSQL 記錄: ${faq.id}`);
        } catch (deleteError) {
          this.logger.error(`回滾失敗: ${deleteError.message}`);
        }
        throw new BadRequestException(`保存失敗: ${error.message}`);
      }
    } else {
      this.logger.warn('⚠️ Elasticsearch 未連接，跳過 ES 同步');
    }

    return faq;
  }

  async findAll(query: FaqQueryDto) {
    const where: any = {
      chatbotId: query.chatbotId,
    };

    if (query.topicId) where.topicId = query.topicId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { question: { contains: query.search, mode: 'insensitive' } },
        { answer: { contains: query.search, mode: 'insensitive' } },
        { synonym: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [faqs, total] = await Promise.all([
      this.prisma.faq.findMany({
        where,
        include: {
          topic: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.faq.count({ where }),
    ]);

    return { faqs, total };
  }

  async findOne(id: string) {
    const faq = await this.prisma.faq.findUnique({
      where: { id },
      include: {
        topic: true,
        chatbot: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!faq) {
      throw new NotFoundException(`FAQ with id ${id} not found`);
    }

    return faq;
  }

  async update(id: string, updateDto: UpdateFaqDto) {
    const existingFaq = await this.findOne(id);

    // 更新 PostgreSQL
    const updatedFaq = await this.prisma.faq.update({
      where: { id },
      data: updateDto,
      include: {
        topic: true,
      },
    });

    this.logger.log(`✅ FAQ 已更新 PostgreSQL: ${id}`);

    // 同步到 Elasticsearch
    if (this.elasticsearchService.isAvailable()) {
      try {
        await this.saveFaqToElasticsearch(
          existingFaq.chatbotId,
          updatedFaq.id,
          updatedFaq.question,
          updatedFaq.answer,
          updatedFaq.synonym,
          updatedFaq.status,
        );
        this.logger.log(`✅ FAQ 已同步到 Elasticsearch: ${id}`);
      } catch (error) {
        this.logger.error(`⚠️ ES 更新失敗（不影響 PostgreSQL）: ${error.message}`);
      }
    }

    return updatedFaq;
  }

  async remove(id: string) {
    const faq = await this.findOne(id);

    // 刪除 PostgreSQL
    const result = await this.prisma.faq.delete({
      where: { id },
    });

    this.logger.log(`✅ FAQ 已從 PostgreSQL 刪除: ${id}`);

    // 刪除 Elasticsearch
    if (this.elasticsearchService.isAvailable()) {
      try {
        await this.deleteFaqFromElasticsearch(faq.chatbotId, id);
        this.logger.log(`✅ FAQ 已從 Elasticsearch 刪除: ${id}`);
      } catch (error) {
        this.logger.error(`⚠️ ES 刪除失敗（不影響 PostgreSQL）: ${error.message}`);
      }
    }

    return result;
  }

  async incrementHitCount(id: string) {
    return this.prisma.faq.update({
      where: { id },
      data: {
        hitCount: { increment: 1 },
        lastHitAt: new Date(),
      },
    });
  }

  /**
   * 保存 FAQ 到 Elasticsearch
   * 更新 FAQ
   */
  private async saveFaqToElasticsearch(
    chatbotId: string,
    faqId: string,
    question: string,
    answer: string,
    synonym: string,
    status: string,
  ): Promise<boolean> {
    try {
      // 生成 embedding（使用 question 生成向量）
      let denseVector: number[];
      const startTime = Date.now();

      try {
        denseVector = await generateEmbedding(question);
        const duration = Date.now() - startTime;
        this.logger.debug(
          `✅ Embedding 生成成功，維度: ${denseVector.length}，耗時: ${duration}ms`,
        );
      } catch (embError: any) {
        this.logger.error(`❌ 生成 embedding 失敗: ${embError.message}`);
        // 如果 embedding 生成失敗，使用 fallback 向量
        this.logger.warn('⚠️ 使用 fallback 向量（全部 0.001）');
        denseVector = new Array(3072).fill(0.001);
      }

      const success = await this.elasticsearchService.saveFaq(
        chatbotId,
        faqId,
        question,
        answer,
        synonym,
        status,
        denseVector,
      );

      return success;
    } catch (error: any) {
      this.logger.error(`保存到 ES 失敗: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 從 Elasticsearch 刪除 FAQ
   */
  private async deleteFaqFromElasticsearch(
    chatbotId: string,
    faqId: string,
  ): Promise<boolean> {
    try {
      const success = await this.elasticsearchService.deleteFaq(chatbotId, faqId);
      return success;
    } catch (error) {
      this.logger.error(`從 ES 刪除失敗: ${error.message}`, error.stack);
      throw error;
    }
  }
}


