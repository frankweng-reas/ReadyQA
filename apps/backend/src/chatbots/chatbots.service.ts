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

  /**
   * Touch chatbot - 更新 updatedAt 時間戳
   * 用於記錄用戶訪問/點擊 chatbot 的時間
   */
  async touch(id: string) {
    // 確認 chatbot 存在
    await this.findOne(id);

    // 明確設置 updatedAt 以觸發更新
    // 注意：Prisma 的空物件 data: {} 不會觸發 @updatedAt
    const updated = await this.prisma.chatbot.update({
      where: { id },
      data: {
        updatedAt: new Date(),
      },
    });

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

  async getOverviewStats(id: string, days: number = 30) {
    try {
      // 確認 chatbot 存在
      await this.findOne(id);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // 計算前一期間的日期（用於計算增長率）
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);

      console.log('[ChatbotsService] getOverviewStats:', { id, days, startDate, prevStartDate });

      // 1. KPI 指標
      const [
        currentQueries,
        prevQueries,
        totalFaqs,
        activeFaqs,
        totalSessions,
        activeSessions,
        queryLogsInPeriod,
        performanceStats,
      ] = await Promise.all([
        // 當前期間查詢數
        this.prisma.queryLog.count({
          where: { chatbotId: id, createdAt: { gte: startDate } },
        }),
        // 前期查詢數（用於計算增長率）
        this.prisma.queryLog.count({
          where: {
            chatbotId: id,
            createdAt: { gte: prevStartDate, lt: startDate },
          },
        }),
        // FAQ 總數
        this.prisma.faq.count({ where: { chatbotId: id } }),
        // 啟用的 FAQ 數
        this.prisma.faq.count({ where: { chatbotId: id, status: 'active' } }),
        // Session 總數
        this.prisma.session.count({ where: { chatbotId: id } }),
        // 活躍 Session 數（最近 30 天有查詢）
        this.prisma.session.count({
          where: {
            chatbotId: id,
            queryLogs: { some: { createdAt: { gte: startDate } } },
          },
        }),
        // Feedback 統計 - 需要先查詢 QueryLog IDs，再查詢 QueryLogDetail
        this.prisma.queryLog.findMany({
          where: { chatbotId: id, createdAt: { gte: startDate } },
          select: { id: true },
        }),
        // 查詢效能統計
        this.prisma.queryLog.aggregate({
          where: { chatbotId: id, createdAt: { gte: startDate } },
          _avg: { resultsCnt: true, readCnt: true },
          _count: { id: true },
        }),
      ]);

      console.log('[ChatbotsService] KPI 統計完成:', {
        currentQueries,
        prevQueries,
        totalFaqs,
        activeFaqs,
        totalSessions,
        activeSessions,
        queryLogsCount: queryLogsInPeriod.length,
      });

      // 獲取 feedback 統計
      const logIds = queryLogsInPeriod.map(log => log.id);
      const feedbackStats = logIds.length > 0 
        ? await this.prisma.queryLogDetail.groupBy({
            by: ['userAction'],
            where: { logId: { in: logIds } },
            _count: true,
          })
        : [];

      console.log('[ChatbotsService] Feedback 統計:', feedbackStats);

      // 計算增長率
      const queriesGrowth = prevQueries > 0 
        ? Math.round(((currentQueries - prevQueries) / prevQueries) * 100)
        : 0;

      // 計算滿意度（基於 like/dislike）
      const likeCount = Number(feedbackStats.find(f => f.userAction === 'like')?._count || 0);
      const dislikeCount = Number(feedbackStats.find(f => f.userAction === 'dislike')?._count || 0);
      const viewedCount = Number(feedbackStats.find(f => f.userAction === 'viewed')?._count || 0);
      const totalFeedback = likeCount + dislikeCount;
      const avgSatisfaction = totalFeedback > 0
        ? Number(((likeCount / totalFeedback) * 5).toFixed(1))
        : 0;

      // 2. 查詢趨勢（按日統計）- 簡化版本，如果沒有資料就返回空陣列
      let queryTrend: Array<{ date: string; count: number }> = [];
      try {
        const trendData = await this.prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
          SELECT 
            DATE(created_at) as date,
            CAST(COUNT(*) AS INTEGER) as count
          FROM query_logs
          WHERE chatbot_id = ${id}
            AND created_at >= ${startDate}
          GROUP BY DATE(created_at)
          ORDER BY date ASC
        `;
        queryTrend = trendData.map(item => ({
          date: item.date.toISOString().split('T')[0],
          count: Number(item.count),
        }));
      } catch (error) {
        console.error('[ChatbotsService] 查詢趨勢統計失敗:', error);
        queryTrend = [];
      }

      console.log('[ChatbotsService] 查詢趨勢:', queryTrend.length, '天');

      // 3. 熱門 FAQ TOP 10
      const topFaqs = await this.prisma.faq.findMany({
        where: { chatbotId: id },
        select: { id: true, question: true, hitCount: true },
        orderBy: { hitCount: 'desc' },
        take: 10,
      });

      console.log('[ChatbotsService] 熱門 FAQ:', topFaqs.length, '個');

      // 3.5 不滿意回答 TOP 10（收到最多 dislike 的 FAQ）
      let topDislikedFaqs: Array<{ id: string; question: string; dislikeCount: number }> = [];
      try {
        if (logIds.length > 0) {
          // 獲取所有 dislike 的記錄
          const dislikeDetails = await this.prisma.queryLogDetail.findMany({
            where: {
              logId: { in: logIds },
              userAction: 'dislike',
            },
            include: {
              faq: {
                select: {
                  id: true,
                  question: true,
                },
              },
            },
          });

          // 統計每個 FAQ 的 dislike 數量
          const dislikeMap = new Map<string, { question: string; count: number }>();
          dislikeDetails.forEach(detail => {
            const faqId = detail.faq.id;
            const existing = dislikeMap.get(faqId);
            if (existing) {
              existing.count++;
            } else {
              dislikeMap.set(faqId, {
                question: detail.faq.question,
                count: 1,
              });
            }
          });

          // 轉換為陣列並排序
          topDislikedFaqs = Array.from(dislikeMap.entries())
            .map(([id, data]) => ({
              id,
              question: data.question,
              dislikeCount: data.count,
            }))
            .sort((a, b) => b.dislikeCount - a.dislikeCount)
            .slice(0, 10);
        }
      } catch (error) {
        console.error('[ChatbotsService] 不滿意回答統計失敗:', error);
        topDislikedFaqs = [];
      }

      console.log('[ChatbotsService] 不滿意回答:', topDislikedFaqs.length, '個');

      // 4. Feedback 分佈
      const feedbackDistribution = {
        like: likeCount,
        dislike: dislikeCount,
        viewed: viewedCount,
      };

      // 5. 查詢效能
      const totalQueryCount = performanceStats._count.id || 0;
      const ignoredCount = await this.prisma.queryLog.count({
        where: { chatbotId: id, createdAt: { gte: startDate }, ignored: true },
      });
      const queriesWithResults = await this.prisma.queryLog.count({
        where: { chatbotId: id, createdAt: { gte: startDate }, readCnt: { gt: 0 } },
      });

      const performance = {
        avgResultsCnt: Number((performanceStats._avg.resultsCnt || 0).toFixed(1)),
        avgReadCnt: Number((performanceStats._avg.readCnt || 0).toFixed(1)),
        ignoredRate: totalQueryCount > 0 
          ? Number(((ignoredCount / totalQueryCount) * 100).toFixed(1))
          : 0,
        conversionRate: totalQueryCount > 0
          ? Number(((queriesWithResults / totalQueryCount) * 100).toFixed(1))
          : 0,
      };

      // 6. 分類分佈 - 改用 Prisma 查詢，更安全
      let topicDistribution: Array<{ topicName: string; count: number }> = [];
      try {
        // 先獲取所有 viewed 的 queryLogDetails
        const viewedDetails = await this.prisma.queryLogDetail.findMany({
          where: {
            log: {
              chatbotId: id,
              createdAt: { gte: startDate },
            },
            userAction: 'viewed',
          },
          include: {
            faq: {
              include: {
                topic: true,
              },
            },
          },
        });

        // 手動統計分類分佈
        const topicMap = new Map<string, number>();
        viewedDetails.forEach(detail => {
          const topicName = detail.faq.topic?.name || '未分類';
          topicMap.set(topicName, (topicMap.get(topicName) || 0) + 1);
        });

        // 轉換為陣列並排序
        topicDistribution = Array.from(topicMap.entries())
          .map(([topicName, count]) => ({ topicName, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      } catch (error) {
        console.error('[ChatbotsService] 分類分佈統計失敗:', error);
        topicDistribution = [];
      }

      console.log('[ChatbotsService] 分類分佈:', topicDistribution.length, '個');

      // 7. 警告提醒
      const [noResultQueries, negativeFeedbackCount, emptyTopics] = await Promise.all([
        this.prisma.queryLog.count({
          where: { chatbotId: id, createdAt: { gte: startDate }, resultsCnt: 0 },
        }),
        dislikeCount,
        this.prisma.topic.count({
          where: { chatbotId: id, faqs: { none: {} } },
        }),
      ]);

      // 8. 查詢結果效果統計
      const queriesWithResultsCount = currentQueries - noResultQueries;
      const queryResultEffectiveness = {
        total: currentQueries,
        withResults: queriesWithResultsCount,
        noResults: noResultQueries,
        successRate: currentQueries > 0 
          ? Number(((queriesWithResultsCount / currentQueries) * 100).toFixed(1))
          : 0,
      };

      const result = {
        kpi: {
          totalQueries: currentQueries,
          queriesGrowth,
          totalFaqs,
          activeFaqs,
          totalSessions,
          activeSessions,
          avgSatisfaction,
        },
        queryTrend,
        topFaqs,
        topDislikedFaqs,
        feedbackDistribution,
        performance,
        topicDistribution,
        queryResultEffectiveness,
        alerts: {
          noResultQueries,
          negativeFeedback: negativeFeedbackCount,
          emptyTopics,
        },
      };

      console.log('[ChatbotsService] getOverviewStats 完成');
      return result;
    } catch (error) {
      console.error('[ChatbotsService] getOverviewStats 錯誤:', error);
      throw error;
    }
  }

  async getZeroResultQueries(id: string, days: number = 30, limit: number = 20) {
    try {
      // 確認 chatbot 存在
      await this.findOne(id);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      console.log('[ChatbotsService] getZeroResultQueries:', { id, days, limit, startDate });

      // 獲取零結果查詢，按頻率分組，只顯示未忽略的
      const zeroResultQueries = await this.prisma.queryLog.groupBy({
        by: ['query'],
        where: {
          chatbotId: id,
          createdAt: { gte: startDate },
          resultsCnt: 0,
          ignored: false, // 只顯示未忽略的查詢
        },
        _count: {
          query: true,
        },
        orderBy: {
          _count: {
            query: 'desc',
          },
        },
        take: limit,
      });

      // 獲取每個查詢的最後查詢時間
      const queriesWithDetails = await Promise.all(
        zeroResultQueries.map(async (item) => {
          const lastQuery = await this.prisma.queryLog.findFirst({
            where: {
              chatbotId: id,
              query: item.query,
              resultsCnt: 0,
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              createdAt: true,
            },
          });

          return {
            query: item.query,
            count: item._count.query,
            lastQueriedAt: lastQuery?.createdAt || new Date(),
          };
        })
      );

      console.log('[ChatbotsService] 零結果查詢統計完成:', queriesWithDetails.length, '個');

      return {
        queries: queriesWithDetails,
        total: queriesWithDetails.reduce((sum, q) => sum + q.count, 0),
        period: days,
      };
    } catch (error) {
      console.error('[ChatbotsService] getZeroResultQueries 錯誤:', error);
      throw error;
    }
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

  async updateHomeImage(id: string, filename: string): Promise<string> {
    // 確認 chatbot 存在
    const chatbot = await this.findOne(id);

    // 圖片路徑（相對路徑，供前端使用）
    const imagePath = `/uploads/chatbot-logos/${filename}`;

    // 更新 theme 中的 homePageConfig.backgroundImage
    const currentTheme = (chatbot.theme as any) || {};
    const updatedTheme = {
      ...currentTheme,
      homePageConfig: {
        ...(currentTheme.homePageConfig || {}),
        backgroundImage: imagePath,
      },
    };

    await this.prisma.chatbot.update({
      where: { id },
      data: {
        theme: updatedTheme as any,
      },
    });

    return imagePath;
  }
}


