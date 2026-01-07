import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { LlmService } from './llm.service';
import { generateEmbedding } from '../common/embedding.service';
import { ChatQueryDto, ChatQueryResponseDto, QABlockDto } from './dto/chat-query.dto';
import { LogFaqActionDto } from './dto/log-faq-action.dto';
import { LogFaqBrowseDto } from './dto/log-faq-browse.dto';
import { randomUUID } from 'crypto';

/**
 * 查詢服務
 * 處理 Chatbot 問答查詢
 */
@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);

  // 預設的混合搜尋參數
  private readonly DEFAULT_BM25_WEIGHT = 0.3;
  private readonly DEFAULT_KNN_WEIGHT = 0.7;
  private readonly DEFAULT_TOP_K = 5;
  private readonly DEFAULT_SIM_THRESHOLD = 0.45; // kNN 相似度閾值
  private readonly DEFAULT_RANK_CONSTANT = 60; // RRF 排名常數

  constructor(
    private readonly prisma: PrismaService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly llmService: LlmService,
  ) {}

  // 注入 SessionsService（用於增加查詢次數）
  private sessionsService: any;

  /**
   * 處理查詢請求
   * 
   * 流程：
   * 1. 生成查詢的 embedding
   * 2. 使用 Elasticsearch 混合搜尋（BM25 + kNN）
   * 3. 發送搜尋結果給 LLM 進行篩選
   * 4. 解析 LLM 回應並返回結果
   * 
   * @param dto 查詢請求 DTO
   * @param sessionId Session ID（用於記錄日誌）
   * @returns 查詢回應 DTO
   */
  async chatWithContext(
    dto: ChatQueryDto,
    sessionId?: string,
  ): Promise<ChatQueryResponseDto> {
    const query = dto.query.trim();
    const chatbotId = dto.chatbot_id;

    this.logger.log(`[Chat] 收到查詢: "${query}" (chatbot: ${chatbotId})`);

    // ========== 步驟 0: 驗證 Chatbot 存在且已啟用 ==========
    const chatbot = await this.prisma.chatbot.findUnique({
      where: { id: chatbotId },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!chatbot) {
      throw new NotFoundException(`Chatbot not found: ${chatbotId}`);
    }

    // 檢查 isActive 狀態（preview mode 跳過檢查）
    // preview mode 用於 design preview / chat mode，即使 chatbot 停用也應該可以使用
    if (dto.mode !== 'preview' && chatbot.isActive !== 'active') {
      this.logger.warn(
        `[Chat] ⚠️ Chatbot ${chatbotId} 未啟用 (isActive: ${chatbot.isActive})`,
      );
      throw new BadRequestException('Chatbot 已暫停使用');
    }
    
    if (dto.mode === 'preview' && chatbot.isActive !== 'active') {
      this.logger.log(
        `[Chat] 🔵 Preview mode: Chatbot ${chatbotId} 停用中，但允許使用 (isActive: ${chatbot.isActive})`,
      );
    }

    this.logger.log(
      `[Chat] ✅ Chatbot ${chatbotId} 已啟用，繼續處理查詢`,
    );

    // ========== 步驟 1: 生成查詢的 embedding ==========
    this.logger.log(`[Chat] 生成查詢 embedding...`);
    let denseVector: number[];
    const embeddingStartTime = Date.now();

    try {
      denseVector = await generateEmbedding(query);
      const embeddingDuration = Date.now() - embeddingStartTime;
      this.logger.log(
        `[Chat] ✅ Embedding 生成成功，維度: ${denseVector.length}，耗時: ${embeddingDuration}ms`,
      );
    } catch (embError: any) {
      this.logger.error(`[Chat] ❌ 生成 embedding 失敗: ${embError.message}`);
      // 如果 embedding 生成失敗，使用 fallback 向量
      this.logger.warn('⚠️ 使用 fallback 向量（全部 0.001）');
      denseVector = new Array(3072).fill(0.001);
    }

    // ========== 步驟 2: 使用 Elasticsearch 混合搜尋 ==========
    this.logger.log(`[Chat] 執行混合搜尋...`);
    let esResults: any[] = [];
    const searchStartTime = Date.now();

    try {
      esResults = await this.elasticsearchService.hybridSearch(
        chatbotId,
        query,
        denseVector,
        this.DEFAULT_TOP_K,
        this.DEFAULT_BM25_WEIGHT,
        this.DEFAULT_KNN_WEIGHT,
        this.DEFAULT_SIM_THRESHOLD,
        this.DEFAULT_RANK_CONSTANT,
      );
      const searchDuration = Date.now() - searchStartTime;
      this.logger.log(
        `[Chat] ✅ 混合搜尋完成，找到 ${esResults.length} 個結果，耗時: ${searchDuration}ms`,
      );
    } catch (searchError: any) {
      this.logger.error(
        `[Chat] ⚠️ Elasticsearch 搜尋失敗（繼續執行）: ${searchError.message}`,
      );
      // 搜尋失敗不影響 LLM 調用，繼續執行
    }

    // ========== 步驟 3: 發送搜尋結果給 LLM ==========
    this.logger.log(`[Chat] 發送搜尋結果給 LLM...`);
    const llmStartTime = Date.now();

    let llmResponse: {
      content: string;
      model: string;
      provider: string;
      usage: any;
    };

    try {
      llmResponse = await this.llmService.sendFaqToLlm(query, esResults);
      const llmDuration = Date.now() - llmStartTime;
      this.logger.log(`[Chat] ✅ LLM 調用成功，耗時: ${llmDuration}ms`);
    } catch (llmError: any) {
      this.logger.error(`[Chat] ❌ LLM 調用失敗: ${llmError.message}`);
      throw new Error(`LLM 服務暫時無法使用: ${llmError.message}`);
    }

    // ========== 步驟 4: 解析 LLM 回應 ==========
    this.logger.log(`[Chat] 解析 LLM 回應...`);

    // 構建 FAQ Map（faq_id -> FAQ）
    const faqMap = new Map(esResults.map((faq) => [faq.faq_id, faq]));

    // 解析 LLM 回應（會從資料庫查詢完整的 FAQ 數據，包含 layout 和 images）
    const parsedResult = await this.llmService.parseLlmResponse(
      llmResponse,
      faqMap,
      this.prisma, // 傳入 PrismaService 實例
    );

    this.logger.log(
      `[Chat] ✅ 解析完成，返回 ${parsedResult.qa_blocks.length} 個 QABlock`,
    );

    // ========== 步驟 5: 記錄搜尋日誌並增加查詢次數 ==========
    let returnLogId: string | null = null;
    if (sessionId) {
      try {
        // 記錄搜尋日誌
        const logId = randomUUID();
        const searchLog = await this.prisma.queryLog.create({
          data: {
            id: logId,
            session: {
              connect: { id: sessionId },
            },
            chatbot: {
              connect: { id: chatbotId },
            },
            query,
            resultsCnt: parsedResult.qa_blocks.length,
            readCnt: 0, // 由前端後續更新
          },
        });
        returnLogId = searchLog.id;
        this.logger.log(
          `[Chat] ✅ 已記錄搜尋日誌: log_id=${returnLogId}, session_id=${sessionId}, results_count=${parsedResult.qa_blocks.length}`,
        );

        // 增加 session 的查詢次數
        await this.prisma.session.update({
          where: { id: sessionId },
          data: {
            queryCount: {
              increment: 1,
            },
          },
        });
        this.logger.log(
          `[Chat] ✅ 已增加 session 查詢次數: session_id=${sessionId}`,
        );
      } catch (logError: any) {
        this.logger.warn(
          `[Chat] ⚠️ 記錄搜尋日誌失敗（不影響結果）: ${logError.message}`,
        );
      }
    } else {
      this.logger.warn(
        `[Chat] ⚠️ 沒有 session_id，跳過記錄搜尋日誌`,
      );
    }

    // ========== 步驟 6: 返回結果 ==========
    return {
      intro: parsedResult.intro || undefined,
      qa_blocks: parsedResult.qa_blocks as QABlockDto[],
      log_id: returnLogId || undefined,
    };
  }

  /**
   * 記錄 FAQ 操作
   * 
   * @param dto LogFaqActionDto
   */
  async logFaqAction(dto: LogFaqActionDto): Promise<void> {
    const { log_id, faq_id, action } = dto;

    this.logger.log(
      `[Log FAQ Action] 處理操作: log_id=${log_id}, faq_id=${faq_id}, action=${action}`,
    );

    // ========== 驗證 log_id 是否存在 ==========
    const searchLog = await this.prisma.queryLog.findUnique({
      where: { id: log_id },
    });

    if (!searchLog) {
      this.logger.warn(`[Log FAQ Action] 找不到 log_id: ${log_id}`);
      throw new NotFoundException(`找不到 log_id: ${log_id}`);
    }

    // ========== 驗證 faq_id 是否存在 ==========
    const faq = await this.prisma.faq.findUnique({
      where: { id: faq_id },
    });

    if (!faq) {
      this.logger.warn(`[Log FAQ Action] 找不到 faq_id: ${faq_id}`);
      throw new NotFoundException(`找不到 faq_id: ${faq_id}`);
    }

    // ========== 插入或更新 QueryLogDetail ==========
    try {
      await this.prisma.queryLogDetail.upsert({
        where: {
          logId_faqId: {
            logId: log_id,
            faqId: faq_id,
          },
        },
        update: {
          userAction: action,
        },
        create: {
          logId: log_id,
          faqId: faq_id,
          userAction: action,
        },
      });

      this.logger.log(
        `[Log FAQ Action] ✅ 成功記錄操作: log_id=${log_id}, faq_id=${faq_id}, action=${action}`,
      );

      // ========== 如果是 viewed，更新相關統計 ==========
      if (action === 'viewed') {
        try {
          // 更新 queryLog 的 readCnt（展開的 FAQ 數量）
          const viewedCount = await this.prisma.queryLogDetail.count({
            where: {
              logId: log_id,
              userAction: 'viewed',
            },
          });

          await this.prisma.queryLog.update({
            where: { id: log_id },
            data: {
              readCnt: viewedCount,
            },
          });

          this.logger.log(
            `[Log FAQ Action] ✅ 已更新 readCnt: log_id=${log_id}, count=${viewedCount}`,
          );

          // 更新 FAQ 的 hitCount（點擊次數）
          await this.prisma.faq.update({
            where: { id: faq_id },
            data: {
              hitCount: {
                increment: 1,
              },
            },
          });

          this.logger.log(
            `[Log FAQ Action] ✅ 已增加 FAQ hitCount: faq_id=${faq_id}`,
          );
        } catch (updateError: any) {
          // 統計更新失敗不影響主要操作
          this.logger.warn(
            `[Log FAQ Action] ⚠️ 更新統計失敗（不影響操作記錄）: ${updateError.message}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `[Log FAQ Action] ❌ 記錄操作失敗: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('記錄操作失敗');
    }
  }

  /**
   * 記錄 FAQ 直接瀏覽
   * 
   * 當用戶直接點擊 FAQ（非搜尋結果）時，記錄到 QueryLog 和 QueryLogDetail
   * 
   * @param dto LogFaqBrowseDto
   * @param sessionId Session ID（可選）
   * @returns log_id（如果有 session_id）
   */
  async logFaqBrowse(
    dto: LogFaqBrowseDto,
    sessionId?: string,
  ): Promise<string | null> {
    const { chatbot_id, faq_id } = dto;

    this.logger.log(
      `[Log FAQ Browse] 處理直接瀏覽: chatbot_id=${chatbot_id}, faq_id=${faq_id}, session_id=${sessionId}`,
    );

    // ========== 驗證 FAQ 是否存在並獲取 question ==========
    const faq = await this.prisma.faq.findFirst({
      where: {
        id: faq_id,
        chatbotId: chatbot_id,
      },
      select: {
        id: true,
        question: true,
      },
    });

    if (!faq) {
      this.logger.warn(
        `[Log FAQ Browse] 找不到 FAQ: faq_id=${faq_id}, chatbot_id=${chatbot_id}`,
      );
      throw new NotFoundException(`找不到 FAQ: ${faq_id}`);
    }

    // ========== 如果有 session_id，記錄搜尋日誌 ==========
    let returnLogId: string | null = null;

    if (sessionId) {
      try {
        // 1. 記錄 QueryLog（query 使用 FAQ 的 question）
        const logId = randomUUID();
        const searchLog = await this.prisma.queryLog.create({
          data: {
            id: logId,
            session: {
              connect: { id: sessionId },
            },
            chatbot: {
              connect: { id: chatbot_id },
            },
            query: faq.question, // 使用 FAQ 的 question 作為 query
            resultsCnt: 1, // 只顯示一個 FAQ
            readCnt: 1, // 直接展開
          },
        });
        returnLogId = searchLog.id;

        // 2. 記錄 QueryLogDetail（action = 'viewed'）
        await this.prisma.queryLogDetail.create({
          data: {
            logId: returnLogId,
            faqId: faq_id,
            userAction: 'viewed',
          },
        });

        // 3. 更新 FAQ 的 hitCount 和 lastHitAt
        await this.prisma.faq.update({
          where: { id: faq_id },
          data: {
            hitCount: {
              increment: 1,
            },
            lastHitAt: new Date(),
          },
        });

        // 4. 增加 session 的查詢次數
        await this.prisma.session.update({
          where: { id: sessionId },
          data: {
            queryCount: {
              increment: 1,
            },
          },
        });

        this.logger.log(
          `[Log FAQ Browse] ✅ 已記錄 FAQ 瀏覽: log_id=${returnLogId}, faq_id=${faq_id}, session_id=${sessionId}`,
        );
      } catch (error: any) {
        this.logger.warn(
          `[Log FAQ Browse] ⚠️ 記錄失敗（不影響功能）: ${error.message}`,
        );
        // 記錄失敗不影響功能，繼續執行
      }
    } else {
      this.logger.warn(
        `[Log FAQ Browse] ⚠️ 沒有 session_id，跳過記錄`,
      );
    }

    return returnLogId;
  }
}

