/**
 * Quota Service - 配額檢查服務
 * 
 * 根據租戶的方案檢查使用限制（每月查詢次數）
 * 參考：answergo/backend/app/services/quota_service.py
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  current_count: number;
  max_count: number | null;
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 獲取租戶本月的查詢次數（從 query_logs 統計）
   * 
   * @param tenantId - 租戶 ID
   * @returns 本月查詢次數
   */
  async getMonthlyQueryCount(tenantId: string): Promise<number> {
    const startTime = Date.now();

    try {
      // 統計本月的查詢次數（從本月 1 日 00:00:00 開始）
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const count = await this.prisma.queryLog.count({
        where: {
          chatbot: {
            tenantId,
          },
          createdAt: {
            gte: startOfMonth,
          },
          ignored: false,
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[QuotaService] ⏱️  getMonthlyQueryCount: ${duration}ms, count: ${count}`,
      );

      return count;
    } catch (error) {
      this.logger.error(
        `[QuotaService] ❌ getMonthlyQueryCount 錯誤: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 檢查是否可以執行查詢（檢查租戶的每月查詢配額）
   * 
   * @param chatbotId - Chatbot ID
   * @returns 檢查結果
   */
  async checkCanQuery(chatbotId: string): Promise<QuotaCheckResult> {
    const startTime = Date.now();

    try {
      // 1. 獲取 chatbot 的 tenant_id 和方案資訊（一次查詢）
      const chatbot = await this.prisma.chatbot.findUnique({
        where: { id: chatbotId },
        include: {
          tenant: {
            include: {
              plan: true,
            },
          },
        },
      });

      if (!chatbot) {
        return {
          allowed: false,
          reason: 'Chatbot 不存在',
          current_count: 0,
          max_count: 0,
        };
      }

      if (!chatbot.tenant) {
        return {
          allowed: false,
          reason: '租戶不存在或已停用',
          current_count: 0,
          max_count: 0,
        };
      }

      const tenantId = chatbot.tenantId;
      const maxQueriesPerMo = chatbot.tenant.plan.maxQueriesPerMo;

      // 2. NULL = 無限制
      if (maxQueriesPerMo === null) {
        const duration = Date.now() - startTime;
        this.logger.log(
          `[QuotaService] ⏱️  checkCanQuery (無限制): ${duration}ms`,
        );
        return {
          allowed: true,
          current_count: 0,
          max_count: null,
        };
      }

      // 檢查 tenantId 是否存在
      if (!tenantId) {
        return {
          allowed: false,
          reason: '租戶 ID 不存在',
          current_count: 0,
          max_count: maxQueriesPerMo,
        };
      }

      // 3. 獲取本月查詢次數
      const currentCount = await this.getMonthlyQueryCount(tenantId);

      const duration = Date.now() - startTime;
      this.logger.log(
        `[QuotaService] ⏱️  checkCanQuery: ${duration}ms, current: ${currentCount}, max: ${maxQueriesPerMo}`,
      );

      // 4. 檢查是否超過限制
      if (currentCount >= maxQueriesPerMo) {
        return {
          allowed: false,
          reason: '已達到每月查詢次數限制，請升級方案',
          current_count: currentCount,
          max_count: maxQueriesPerMo,
        };
      }

      return {
        allowed: true,
        current_count: currentCount,
        max_count: maxQueriesPerMo,
      };
    } catch (error) {
      this.logger.error(
        `[QuotaService] ❌ checkCanQuery 錯誤: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 確保查詢配額未超限（簡化版，只檢查配額）
   * 如果超過配額，自動拋出 BadRequestException
   * 
   * @param chatbotId - Chatbot ID
   * @throws BadRequestException - 如果超過配額
   */
  async ensureQueryQuota(chatbotId: string): Promise<void> {
    const quotaCheck = await this.checkCanQuery(chatbotId);

    if (!quotaCheck.allowed) {
      this.logger.warn(
        `[QuotaService] ⚠️  查詢配額超限: ${quotaCheck.reason}`,
      );
      throw new BadRequestException(
        quotaCheck.reason || '已達到每月查詢次數限制，請升級方案',
      );
    }
  }

  /**
   * 檢查是否可以創建 Chatbot（檢查租戶的 Chatbot 數量配額）
   * 
   * @param userId - 用戶 ID
   * @returns 檢查結果
   */
  async checkCanCreateChatbot(userId: number): Promise<QuotaCheckResult> {
    const startTime = Date.now();

    try {
      // 1. 獲取用戶的 tenant 和 plan 資訊
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          tenant: {
            include: {
              plan: true,
            },
          },
        },
      });

      if (!user) {
        return {
          allowed: false,
          reason: '用戶不存在',
          current_count: 0,
          max_count: 0,
        };
      }

      if (!user.tenant) {
        return {
          allowed: false,
          reason: '租戶不存在或已停用',
          current_count: 0,
          max_count: 0,
        };
      }

      const tenantId = user.tenantId;
      const maxChatbots = user.tenant.plan.maxChatbots;

      // 2. NULL = 無限制
      if (maxChatbots === null) {
        const duration = Date.now() - startTime;
        this.logger.log(
          `[QuotaService] ⏱️  checkCanCreateChatbot (無限制): ${duration}ms`,
        );
        return {
          allowed: true,
          current_count: 0,
          max_count: null,
        };
      }

      // 3. 統計當前 chatbot 數量
      const currentCount = await this.prisma.chatbot.count({
        where: {
          tenantId,
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[QuotaService] ⏱️  checkCanCreateChatbot: ${duration}ms, current: ${currentCount}, max: ${maxChatbots}`,
      );

      // 4. 檢查是否超過限制
      if (currentCount >= maxChatbots) {
        return {
          allowed: false,
          reason: `已達到方案限制（${maxChatbots} 個 chatbot），請升級方案`,
          current_count: currentCount,
          max_count: maxChatbots,
        };
      }

      return {
        allowed: true,
        current_count: currentCount,
        max_count: maxChatbots,
      };
    } catch (error) {
      this.logger.error(
        `[QuotaService] ❌ checkCanCreateChatbot 錯誤: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 檢查是否可以創建 FAQ（檢查 chatbot 的 FAQ 數量配額）
   * 
   * @param chatbotId - Chatbot ID
   * @returns 檢查結果
   */
  async checkCanCreateFaq(chatbotId: string): Promise<QuotaCheckResult> {
    const startTime = Date.now();

    try {
      // 1. 獲取 chatbot 的 tenant 和 plan 資訊
      const chatbot = await this.prisma.chatbot.findUnique({
        where: { id: chatbotId },
        include: {
          tenant: {
            include: {
              plan: true,
            },
          },
        },
      });

      if (!chatbot) {
        return {
          allowed: false,
          reason: 'Chatbot 不存在',
          current_count: 0,
          max_count: 0,
        };
      }

      if (!chatbot.tenant) {
        return {
          allowed: false,
          reason: '租戶不存在或已停用',
          current_count: 0,
          max_count: 0,
        };
      }

      const maxFaqsPerBot = chatbot.tenant.plan.maxFaqsPerBot;

      // 2. NULL = 無限制
      if (maxFaqsPerBot === null) {
        const duration = Date.now() - startTime;
        this.logger.log(
          `[QuotaService] ⏱️  checkCanCreateFaq (無限制): ${duration}ms`,
        );
        return {
          allowed: true,
          current_count: 0,
          max_count: null,
        };
      }

      // 3. 統計當前 FAQ 數量（只計算 active 狀態）
      const currentCount = await this.prisma.faq.count({
        where: {
          chatbotId,
          status: 'active',
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `[QuotaService] ⏱️  checkCanCreateFaq: ${duration}ms, current: ${currentCount}, max: ${maxFaqsPerBot}`,
      );

      // 4. 檢查是否超過限制
      if (currentCount >= maxFaqsPerBot) {
        return {
          allowed: false,
          reason: `此 chatbot 已達到 FAQ 數量限制（${maxFaqsPerBot} 個），請升級方案`,
          current_count: currentCount,
          max_count: maxFaqsPerBot,
        };
      }

      return {
        allowed: true,
        current_count: currentCount,
        max_count: maxFaqsPerBot,
      };
    } catch (error) {
      this.logger.error(
        `[QuotaService] ❌ checkCanCreateFaq 錯誤: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 獲取租戶的配額使用情況
   * 
   * @param tenantId - 租戶 ID
   * @returns 配額使用情況
   */
  async getQuotaUsage(tenantId: string): Promise<{
    plan: { code: string; name: string };
    usage: {
      queries_monthly: { current: number; max: number | null };
    };
  }> {
    const startTime = Date.now();

    try {
      // 1. 獲取租戶和方案資訊
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId, status: 'active' },
        include: {
          plan: true,
        },
      });

      if (!tenant) {
        throw new BadRequestException('租戶方案不存在或已停用');
      }

      // 2. 獲取本月查詢次數
      const currentCount = await this.getMonthlyQueryCount(tenantId);

      const duration = Date.now() - startTime;
      this.logger.log(`[QuotaService] ⏱️  getQuotaUsage: ${duration}ms`);

      return {
        plan: {
          code: tenant.planCode,
          name: tenant.plan.name,
        },
        usage: {
          queries_monthly: {
            current: currentCount,
            max: tenant.plan.maxQueriesPerMo,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `[QuotaService] ❌ getQuotaUsage 錯誤: ${error.message}`,
      );
      throw error;
    }
  }
}
