import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { QuotaService } from '../common/quota.service';
import { CreateFaqDto, UpdateFaqDto, FaqQueryDto, BulkUploadFaqDto, BulkUploadFaqItemDto } from './dto/faq.dto';
import { generateEmbedding } from '../common/embedding.service';

/**
 * FAQ 管理 Service
 * 
 * 測試覆蓋率: 29.59% (參考 /test/faqs.e2e-spec.ts)
 * 
 * ✅ 已測試的功能:
 * - create() - 建立 FAQ
 * - findAll() - 取得列表（含分頁）
 * - findOne() - 取得單一 FAQ
 * - update() - 更新 FAQ
 * - remove() - 刪除 FAQ
 * - incrementHitCount() - 記錄點擊
 * 
 * ❌ 未測試的功能（Line 22, 55-61, 66-80, 94, 172, 195, 236-239, 254-255, 270-568）:
 * - FAQ 重複檢查 (line 22)
 * - Elasticsearch 同步失敗處理 (line 55-61, 66-80)
 * - saveFaqToElasticsearch() - ES 寫入方法 (line 270-330)
 * - updateFaqInElasticsearch() - ES 更新方法 (line 332-397)
 * - deleteFaqFromElasticsearch() - ES 刪除方法 (line 399-428)
 * - syncAllFaqsToElasticsearch() - 批量同步到 ES (line 430-544)
 * - bulkUpload() - 批量上傳 FAQ (line 154-261)
 * - generateEmbedding 失敗處理 (line 94, 172, 195)
 * 
 * TODO: 需要測試的場景
 * 1. Elasticsearch 連線失敗時，資料庫操作應該正常完成
 * 2. bulkUpload 的錯誤處理和部分成功的情況
 * 3. Embedding 生成失敗時的降級處理
 */
@Injectable()
export class FaqsService {
  private readonly logger = new Logger(FaqsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly quotaService: QuotaService,
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
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
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
   * 批量更新 FAQ 的 sortOrder
   * 用於排序管理頁面統一更新排序
   */
  async batchUpdateSortOrder(chatbotId: string, updates: Array<{ id: string; sortOrder: number }>) {
    if (!updates || updates.length === 0) {
      this.logger.log('⚠️ 批量更新 sortOrder: 沒有需要更新的項目');
      return { success: true, updated: 0 };
    }

    this.logger.log(`[FaqsService] 批量更新 ${updates.length} 個 FAQ 的 sortOrder`);

    // 驗證所有 FAQ 都屬於該 chatbot
    const faqIds = updates.map(u => u.id);
    const existingFaqs = await this.prisma.faq.findMany({
      where: {
        id: { in: faqIds },
        chatbotId,
      },
      select: { id: true },
    });

    if (existingFaqs.length !== faqIds.length) {
      const missingIds = faqIds.filter(id => !existingFaqs.find(f => f.id === id));
      this.logger.error(`[FaqsService] 部分 FAQ 不屬於此 chatbot: ${missingIds.join(', ')}`);
      throw new BadRequestException(`Some FAQs do not belong to this chatbot: ${missingIds.join(', ')}`);
    }

    // 批量更新
    const updatePromises = updates.map(update =>
      this.prisma.faq.update({
        where: { id: update.id },
        data: { sortOrder: update.sortOrder },
      })
    );

    await Promise.all(updatePromises);

    this.logger.log(`✅ 批量更新 ${updates.length} 個 FAQ 的 sortOrder 完成`);

    return { success: true, updated: updates.length };
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

  /**
   * 批量上傳 FAQ
   */
  async bulkUpload(dto: BulkUploadFaqDto) {
    if (!dto.faqs || dto.faqs.length === 0) {
      throw new BadRequestException('FAQ 列表不能為空');
    }

    this.logger.log(`[Bulk Upload] 開始處理 ${dto.faqs.length} 個 FAQ`);

    // 步驟 0: 檢查重複（批量查詢現有的 question）
    const questionsToCheck = dto.faqs
      .map(faq => faq.question.trim())
      .filter(q => q.length > 0);

    const existingFaqs = await this.prisma.faq.findMany({
      where: {
        chatbotId: dto.chatbotId,
        question: { in: questionsToCheck },
      },
      select: { question: true },
    });

    const existingQuestions = new Set(existingFaqs.map(f => f.question));
    this.logger.log(`[Bulk Upload] 發現 ${existingQuestions.size} 個重複的問題`);

    // 過濾掉重複的 FAQ
    const faqsToProcess: BulkUploadFaqItemDto[] = [];
    const skippedResults: any[] = [];

    for (const faq of dto.faqs) {
      const question = faq.question.trim();
      if (existingQuestions.has(question)) {
        skippedResults.push({
          success: false,
          question: question,
          answer: faq.answer,
          skipped: true,
          skip_reason: '問題已存在（重複）',
        });
      } else {
        faqsToProcess.push(faq);
      }
    }

    if (faqsToProcess.length === 0) {
      return {
        success: true,
        total_count: dto.faqs.length,
        success_count: 0,
        failed_count: 0,
        skipped_count: skippedResults.length,
        results: skippedResults,
        message: `所有 ${dto.faqs.length} 個 FAQ 都已存在（重複），已跳過`,
      };
    }

    this.logger.log(`[Bulk Upload] 過濾後，需要處理 ${faqsToProcess.length} 個新 FAQ`);

    // 檢查 FAQ 總量配額（tenant 總量，與單筆建立一致）
    const quotaCheck = await this.quotaService.checkCanCreateFaq(dto.chatbotId);
    if (!quotaCheck.allowed) {
      throw new BadRequestException(quotaCheck.reason);
    }
    if (
      quotaCheck.max_count !== null &&
      quotaCheck.current_count + faqsToProcess.length > quotaCheck.max_count
    ) {
      throw new BadRequestException(
        `本次將新增 ${faqsToProcess.length} 個 FAQ，將超過方案限制（目前 ${quotaCheck.current_count}/${quotaCheck.max_count}），請升級方案`,
      );
    }

    // 步驟 1: 並行生成 Embedding
    const embeddingPromises = faqsToProcess.map(async (faq) => {
      const question = faq.question.trim();
      const answer = faq.answer.trim();

      if (!question || !answer) {
        return {
          faq,
          faqId: null,
          embedding: null,
          error: '問題或答案不能為空',
        };
      }

      try {
        const embedding = await generateEmbedding(question);
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 11);
        const faqId = `${timestamp}_${randomStr}`;

        return {
          faq,
          faqId,
          embedding,
          error: null,
        };
      } catch (error: any) {
        return {
          faq,
          faqId: null,
          embedding: null,
          error: `生成 Embedding 失敗: ${error.message}`,
        };
      }
    });

    const embeddingResults = await Promise.all(embeddingPromises);

    // 整理結果
    const faqsToSave: Array<{
      faqId: string;
      question: string;
      answer: string;
      synonym: string;
      topicId: string | null;
      status: string;
      embedding: number[];
    }> = [];
    const errorResults: any[] = [];

    for (const result of embeddingResults) {
      if (result.error) {
        errorResults.push({
          success: false,
          question: result.faq.question,
          answer: result.faq.answer,
          error: result.error,
        });
      } else if (result.faqId && result.embedding) {
        faqsToSave.push({
          faqId: result.faqId,
          question: result.faq.question.trim(),
          answer: result.faq.answer.trim(),
          synonym: result.faq.synonym?.trim() || '',
          topicId: result.faq.topicId || null,
          status: result.faq.status || 'active',
          embedding: result.embedding,
        });
      }
    }

    this.logger.log(`[Bulk Upload] Embedding 生成完成: ${faqsToSave.length}/${dto.faqs.length} 成功`);

    // 步驟 2: 批量寫入 PostgreSQL
    const successfulFaqs: any[] = [];
    const faqIdsToRollback: string[] = [];

    if (faqsToSave.length > 0) {
      if (!this.elasticsearchService.isAvailable()) {
        throw new BadRequestException('Elasticsearch 未連接，無法進行批量上傳');
      }

      // 檢查索引是否存在
      const indexName = `faq_${dto.chatbotId}`;
      const client = this.elasticsearchService['client'];
      if (!client) {
        throw new BadRequestException('Elasticsearch client 未初始化');
      }
      const indexExists = await client.indices.exists({ index: indexName });
      if (!indexExists) {
        throw new BadRequestException(`索引不存在: ${indexName}`);
      }

      // 寫入 PostgreSQL
      for (const faqData of faqsToSave) {
        try {
          await this.prisma.faq.create({
            data: {
              id: faqData.faqId,
              chatbotId: dto.chatbotId,
              question: faqData.question,
              answer: faqData.answer,
              synonym: faqData.synonym,
              status: faqData.status,
              topicId: faqData.topicId,
              layout: 'text',
            },
          });

          successfulFaqs.push(faqData);
          faqIdsToRollback.push(faqData.faqId);
        } catch (error: any) {
          this.logger.error(`[Bulk Upload] PostgreSQL 寫入失敗: ${faqData.faqId}`, error);
          errorResults.push({
            success: false,
            question: faqData.question,
            answer: faqData.answer,
            error: `PostgreSQL 寫入失敗: ${error.message}`,
          });
        }
      }

      this.logger.log(`[Bulk Upload] PostgreSQL 寫入完成: ${successfulFaqs.length} 筆`);

      // 步驟 3: 批量寫入 Elasticsearch
      if (successfulFaqs.length > 0) {
        try {
          const esData = successfulFaqs.map((faq) => ({
            faq_id: faq.faqId,
            question: faq.question,
            answer: faq.answer,
            synonym: faq.synonym,
            status: faq.status,
            dense_vector: faq.embedding,
          }));

          // 使用批量保存
          const esFailedFaqIds: string[] = [];

          for (const esItem of esData) {
            try {
              const success = await this.elasticsearchService.saveFaq(
                dto.chatbotId,
                esItem.faq_id,
                esItem.question,
                esItem.answer,
                esItem.synonym,
                esItem.status,
                esItem.dense_vector,
              );
              if (!success) {
                esFailedFaqIds.push(esItem.faq_id);
                // 記錄錯誤結果
                const failedFaq = successfulFaqs.find(f => f.faqId === esItem.faq_id);
                if (failedFaq) {
                  errorResults.push({
                    success: false,
                    question: failedFaq.question,
                    answer: failedFaq.answer,
                    error: 'Elasticsearch 保存失敗',
                  });
                  // 從成功列表中移除
                  const index = successfulFaqs.findIndex(f => f.faqId === esItem.faq_id);
                  if (index > -1) {
                    successfulFaqs.splice(index, 1);
                  }
                }
              }
            } catch (error: any) {
              this.logger.error(`[Bulk Upload] ES 保存失敗: ${esItem.faq_id}`, error);
              esFailedFaqIds.push(esItem.faq_id);
              // 記錄錯誤結果
              const failedFaq = successfulFaqs.find(f => f.faqId === esItem.faq_id);
              if (failedFaq) {
                errorResults.push({
                  success: false,
                  question: failedFaq.question,
                  answer: failedFaq.answer,
                  error: `Elasticsearch 保存失敗: ${error.message}`,
                });
                // 從成功列表中移除
                const index = successfulFaqs.findIndex(f => f.faqId === esItem.faq_id);
                if (index > -1) {
                  successfulFaqs.splice(index, 1);
                }
              }
            }
          }

          const esSuccessCount = esData.length - esFailedFaqIds.length;
          this.logger.log(`[Bulk Upload] Elasticsearch 寫入完成: 成功 ${esSuccessCount}, 失敗 ${esFailedFaqIds.length}`);

          // 如果 ES 有失敗，回滾對應的 PostgreSQL 記錄
          if (esFailedFaqIds.length > 0) {
            for (const faqId of esFailedFaqIds) {
              try {
                await this.prisma.faq.delete({ where: { id: faqId } });
                // 從回滾列表中移除
                const index = faqIdsToRollback.indexOf(faqId);
                if (index > -1) {
                  faqIdsToRollback.splice(index, 1);
                }
              } catch (rollbackError: any) {
                this.logger.error(`[Bulk Upload] 回滾失敗 (faq_id: ${faqId}): ${rollbackError.message}`);
              }
            }
          }
        } catch (error: any) {
          // ES 錯誤，回滾 PostgreSQL
          for (const faqId of faqIdsToRollback) {
            try {
              await this.prisma.faq.delete({ where: { id: faqId } });
            } catch (rollbackError: any) {
              this.logger.error(`[Bulk Upload] 回滾失敗 (faq_id: ${faqId}): ${rollbackError.message}`);
            }
          }
          throw error;
        }
      }
    }

    // 構建結果
    const successResults = successfulFaqs.map((faq) => ({
      success: true,
      question: faq.question,
      answer: faq.answer,
      faq_id: faq.faqId,
    }));

    const allResults = [...successResults, ...skippedResults, ...errorResults];
    const successCount = successResults.length;
    const failedCount = errorResults.length;
    const skippedCount = skippedResults.length;

    return {
      success: failedCount === 0,
      total_count: dto.faqs.length,
      success_count: successCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      results: allResults,
      message: `批量保存完成: 新增 ${successCount} 筆，跳過 ${skippedCount} 筆（重複），失敗 ${failedCount} 筆`,
    };
  }
}


