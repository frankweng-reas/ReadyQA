import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { generateEmbedding } from '../common/embedding.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

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

  /**
   * 將 PostgreSQL 所有 FAQ 重新同步到 Elasticsearch
   * 用於 ES 資料遺失或損壞時的全量修復
   */
  async syncAllFaqsToEs(chatbotId?: string): Promise<{
    total: number;
    success: number;
    failed: number;
    skipped: number;
    errors: Array<{ faqId: string; error: string }>;
  }> {
    if (!this.elasticsearchService.isAvailable()) {
      throw new Error('Elasticsearch 未連接，無法執行同步');
    }

    const where = chatbotId ? { chatbotId } : {};
    const faqs = await this.prisma.faq.findMany({
      where,
      select: {
        id: true,
        chatbotId: true,
        question: true,
        answer: true,
        synonym: true,
        status: true,
      },
      orderBy: { chatbotId: 'asc' },
    });

    this.logger.log(`[SyncES] 開始同步 ${faqs.length} 筆 FAQ 到 Elasticsearch`);

    let success = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ faqId: string; error: string }> = [];

    for (const faq of faqs) {
      if (!faq.question?.trim()) {
        skipped++;
        continue;
      }

      try {
        let denseVector: number[];
        try {
          denseVector = await generateEmbedding(faq.question);
        } catch (embErr: any) {
          this.logger.warn(`[SyncES] Embedding 失敗，使用 fallback: ${faq.id}`);
          denseVector = new Array(3072).fill(0.001);
        }

        const ok = await this.elasticsearchService.saveFaq(
          faq.chatbotId,
          faq.id,
          faq.question,
          faq.answer,
          faq.synonym,
          faq.status,
          denseVector,
        );

        if (ok) {
          success++;
          this.logger.debug(`[SyncES] ✅ ${faq.id}`);
        } else {
          failed++;
          errors.push({ faqId: faq.id, error: 'saveFaq 回傳 false' });
        }
      } catch (err: any) {
        failed++;
        errors.push({ faqId: faq.id, error: err.message });
        this.logger.error(`[SyncES] ❌ ${faq.id}: ${err.message}`);
      }
    }

    this.logger.log(
      `[SyncES] 完成。總計: ${faqs.length}, 成功: ${success}, 失敗: ${failed}, 跳過: ${skipped}`,
    );

    return { total: faqs.length, success, failed, skipped, errors };
  }
}
