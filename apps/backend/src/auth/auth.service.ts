import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService, PrismaTransactionClient } from '../prisma/prisma.service';
import { QuotaService } from '../common/quota.service';
import { GetOrCreateUserDto } from './dto/get-or-create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotaService: QuotaService,
  ) {}

  /**
   * 根據 Supabase UUID 獲取用戶完整資訊（包含 tenant、plan 和配額使用情況）
   */
  async getUserProfile(supabaseUserId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { supabaseUserId },
        select: {
          id: true,
          email: true,
          username: true,
          tenantId: true,
          tenant: {
            select: {
              id: true,
              name: true,
              planCode: true,
              plan: {
                select: {
                  code: true,
                  name: true,
                  maxChatbots: true,
                  maxFaqsPerBot: true,
                  maxQueriesPerMo: true,
                  priceTwdMonthly: true,
                  priceUsdMonthly: true,
                  enableAnalytics: true,
                  enableApi: true,
                  enableExport: true,
                },
              },
            },
          },
        },
      });

      if (!user || !user.tenantId) {
        return null;
      }

      // 取得配額使用情況
      const tenantId = user.tenantId;
      
      if (!tenantId) {
        console.warn(`[Auth Service] ⚠️ tenantId 為 null，無法統計配額`);
        return {
          ...user,
          quota: {
            chatbots: { current: 0, max: null },
            faqsTotal: { current: 0, max: null },
            queriesMonthly: { current: 0, max: null },
          },
        };
      }
      
      console.log(`[Auth Service] 📊 開始統計配額使用情況，tenantId: ${tenantId} (type: ${typeof tenantId})`);
      
      // 1. 統計 chatbots 數量
      const chatbotCount = await this.prisma.chatbot.count({
        where: { tenantId },
      });
      console.log(`[Auth Service] 📊 Chatbots 數量: ${chatbotCount}`);

      // 取得訂閱資訊
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          cancelAtPeriodEnd: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          planCode: true,
        },
      });

      // 2. 統計整個 tenant 的 FAQ 總數（只計算 active 狀態，與 QuotaService 一致）
      const faqsTotalCount = await this.prisma.faq.count({
        where: {
          chatbot: { tenantId },
          status: 'active',
        },
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Auth Service] ⚠️ 統計 FAQ 失敗（可能 tenant 無 chatbot）: ${msg}`);
        return 0;
      });
      console.log(`[Auth Service] 📊 FAQ 總數（active）: ${faqsTotalCount}`);

      // 3. 取得本月查詢次數
      const monthlyQueryCount = await this.quotaService.getMonthlyQueryCount(tenantId);
      console.log(`[Auth Service] 📊 本月查詢次數: ${monthlyQueryCount}`);

      return {
        ...user,
        subscription,
        quota: {
          chatbots: {
            current: chatbotCount,
            max: user.tenant?.plan.maxChatbots ?? null,
          },
          faqsTotal: {
            current: faqsTotalCount,
            max: user.tenant?.plan.maxFaqsPerBot ?? null, // 此欄位現在代表整個 tenant 的 FAQ 總數限制
          },
          queriesMonthly: {
            current: monthlyQueryCount,
            max: user.tenant?.plan.maxQueriesPerMo ?? null,
          },
        },
      };
    } catch (error) {
      console.error('[Auth Service] ❌ 獲取用戶資訊失敗:', error);
      throw new BadRequestException(`獲取用戶資訊失敗: ${error.message}`);
    }
  }

  /**
   * 根據 Supabase UUID 獲取或建立對應的 PostgreSQL user_id
   * 認證服務
   */
  async getOrCreateUser(dto: GetOrCreateUserDto) {
    try {
      // 1. 查詢是否已存在對應的 supabase_user_id
      let user = await this.prisma.user.findUnique({
        where: { supabaseUserId: dto.supabaseUserId },
        select: {
          id: true,
          email: true,
          username: true,
          supabaseUserId: true,
          tenantId: true,
        },
      });

      if (user) {
        console.log(`[Auth Service] ✅ 找到現有用戶（通過 supabase_user_id）: ${dto.supabaseUserId} -> user_id=${user.id}`);
        return {
          success: true,
          message: '用戶已存在',
          userId: user.id,
          created: false,
        };
      }

      // 2. 如果提供了 email，檢查 email 是否已存在（不區分大小寫，避免 Google 與 DB 格式差異）
      if (dto.email) {
        const emailNormalized = dto.email.trim().toLowerCase();
        const userWithEmail = await this.prisma.user.findFirst({
          where: {
            email: { equals: emailNormalized, mode: 'insensitive' as const },
          },
          select: {
            id: true,
            email: true,
            username: true,
            supabaseUserId: true,
            tenantId: true,
            _count: {
              select: { chatbots: true },
            },
          },
        });

        if (userWithEmail) {
          // Email 已存在，更新該用戶的 supabase_user_id（如果為 NULL 或不同）
          if (!userWithEmail.supabaseUserId) {
            // supabase_user_id 為 NULL，可以安全更新
            const updatedUser = await this.prisma.user.update({
              where: { id: userWithEmail.id },
              data: { supabaseUserId: dto.supabaseUserId },
              select: { id: true },
            });

            console.log(`[Auth Service] ✅ 更新現有用戶的 supabase_user_id: email=${dto.email} -> user_id=${userWithEmail.id}`);
            return {
              success: true,
              message: '已更新用戶的 Supabase ID',
              userId: updatedUser.id,
              created: false,
            };
          } else if (userWithEmail.supabaseUserId === dto.supabaseUserId) {
            // supabase_user_id 已匹配，直接返回
            console.log(`[Auth Service] ✅ 找到現有用戶（通過 email）: ${dto.email} -> user_id=${userWithEmail.id}`);
            return {
              success: true,
              message: '用戶已存在',
              userId: userWithEmail.id,
              created: false,
            };
          } else {
            // supabase_user_id 不同，智能合併：更新 UUID 以保留現有資料
            const chatbotCount = userWithEmail._count.chatbots;
            
            await this.prisma.user.update({
              where: { id: userWithEmail.id },
              data: { supabaseUserId: dto.supabaseUserId },
            });

            console.log(`[Auth Service] ✅ 智能合併：更新 supabase_user_id（保留 ${chatbotCount} 個 chatbot）`);
            return {
              success: true,
              message: chatbotCount > 0 
                ? `已更新用戶的 Supabase ID（已保留 ${chatbotCount} 個 chatbot）`
                : '已更新用戶的 Supabase ID',
              userId: userWithEmail.id,
              created: false,
            };
          }
        }
      }

      // 3. 用戶不存在，建立新用戶（email 正規化為小寫，避免重複）
      const userEmail = (dto.email?.trim().toLowerCase()) || `user_${dto.supabaseUserId.substring(0, 8)}@supabase.local`;
      const username = dto.name || 'Supabase User';

      // 使用事務確保 user 和 tenant 一起創建
      const result = await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // 創建用戶（先不設置 tenantId）
        const newUser = await tx.user.create({
          data: {
            email: userEmail,
            username,
            supabaseUserId: dto.supabaseUserId,
            isActive: true,
            // tenantId 會在創建 tenant 後更新
          },
          select: { id: true },
        });

        // tenant_id = user_id (字串)
        const tenantId = String(newUser.id);

        // 創建 tenant（檢查 free plan 是否存在）
        try {
          const freePlan = await tx.plan.findUnique({
            where: { code: 'free' },
          });

          if (!freePlan) {
            console.log(`[Auth Service] ⚠️  方案代碼 'free' 不存在，跳過 tenant 創建`);
          } else {
            // 檢查 tenant_id 是否已存在
            const existingTenant = await tx.tenant.findUnique({
              where: { id: tenantId },
            });

            if (existingTenant) {
              console.log(`[Auth Service] ⚠️  Tenant '${tenantId}' 已存在，跳過創建`);
            } else {
              // 創建 tenant
              await tx.tenant.create({
                data: {
                  id: tenantId,
                  name: username,
                  planCode: 'free',
                  status: 'active',
                },
              });
              console.log(`[Auth Service] ✅ 建立 tenant: tenant_id=${tenantId}, plan_code=free`);
            }
          }
        } catch (tenantError) {
          // Tenant 創建失敗，只記錄錯誤，不影響 user 創建
          console.error(`[Auth Service] ⚠️  Tenant 創建失敗（不影響用戶創建）:`, tenantError);
        }

        // 更新 users.tenantId
        await tx.user.update({
          where: { id: newUser.id },
          data: { tenantId },
        });

        return newUser;
      });

      console.log(`[Auth Service] ✅ 建立新用戶: supabase_user_id=${dto.supabaseUserId} -> user_id=${result.id}, tenant_id=${result.id}`);

      return {
        success: true,
        message: '用戶建立成功',
        userId: result.id,
        created: true,
      };
    } catch (error: any) {
      // 若為 email 唯一約束錯誤（競態或大小寫差異），嘗試以 email 查找並更新
      const isUniqueError =
        error?.code === 'P2002' ||
        (error?.message && error.message.includes('Unique constraint'));
      if (isUniqueError && dto.email) {
        const fallbackUser = await this.prisma.user.findFirst({
          where: {
            email: { equals: dto.email.trim(), mode: 'insensitive' as const },
          },
          select: { id: true },
        });
        if (fallbackUser) {
          await this.prisma.user.update({
            where: { id: fallbackUser.id },
            data: { supabaseUserId: dto.supabaseUserId },
          });
          console.log(`[Auth Service] ✅ 唯一約束 fallback：已更新 user_id=${fallbackUser.id} 的 supabase_user_id`);
          return {
            success: true,
            message: '已更新用戶的 Supabase ID',
            userId: fallbackUser.id,
            created: false,
          };
        }
      }
      console.error('[Auth Service] ❌ 獲取或建立用戶失敗:', error);
      throw new BadRequestException(`獲取或建立用戶失敗: ${error.message}`);
    }
  }
}

