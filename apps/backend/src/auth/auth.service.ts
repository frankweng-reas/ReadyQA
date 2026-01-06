import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GetOrCreateUserDto } from './dto/get-or-create-user.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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

      // 2. 如果提供了 email，檢查 email 是否已存在
      if (dto.email) {
        const userWithEmail = await this.prisma.user.findUnique({
          where: { email: dto.email },
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

      // 3. 用戶不存在，建立新用戶
      const userEmail = dto.email || `user_${dto.supabaseUserId.substring(0, 8)}@supabase.local`;
      const username = dto.name || 'Supabase User';

      // 使用事務確保 user 和 tenant 一起創建
      const result = await this.prisma.$transaction(async (tx) => {
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
    } catch (error) {
      console.error('[Auth Service] ❌ 獲取或建立用戶失敗:', error);
      throw new BadRequestException(`獲取或建立用戶失敗: ${error.message}`);
    }
  }
}

