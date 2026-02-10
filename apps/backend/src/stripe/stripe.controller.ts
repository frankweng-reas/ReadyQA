import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { StripeService } from './stripe.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthService } from '../auth/auth.service';

@ApiTags('stripe')
@Controller('stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly authService: AuthService,
  ) {}

  @Post('create-checkout-session')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '建立 Stripe Checkout Session（需要認證）' })
  async createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @CurrentUser() supabaseUser: any,
  ) {
    try {
      // 取得用戶資訊
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      // 設定預設 URL
      const successUrl =
        dto.successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?success=true`;
      const cancelUrl =
        dto.cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?canceled=true`;

      const result = await this.stripeService.createCheckoutSession(
        userProfile.tenantId,
        dto.planCode,
        userProfile.email,
        successUrl,
        cancelUrl,
      );

      return {
        success: true,
        message: 'Checkout session created successfully',
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error creating checkout session:', error);
      
      // 如果是 NestJS 的 HTTP 異常，直接拋出讓 NestJS 處理
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // 其他錯誤返回 500
      throw new BadRequestException(error.message || 'Failed to create checkout session');
    }
  }

  @Post('cancel-subscription')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取消訂閱（需要認證）' })
  async cancelSubscription(
    @Body() dto: CancelSubscriptionDto,
    @CurrentUser() supabaseUser: any,
  ) {
    try {
      // 取得用戶資訊
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.cancelSubscription(
        userProfile.tenantId,
        dto.cancelAtPeriodEnd ?? true,
      );

      return {
        success: true,
        message: dto.cancelAtPeriodEnd
          ? 'Subscription will be canceled at the end of the billing period'
          : 'Subscription canceled immediately',
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error canceling subscription:', error);
      
      // 如果是 NestJS 的 HTTP 異常，直接拋出讓 NestJS 處理
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // 其他錯誤返回 500
      throw new BadRequestException(error.message || 'Failed to cancel subscription');
    }
  }

  @Post('reactivate-subscription')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '重新啟用訂閱（取消「取消」設定）' })
  async reactivateSubscription(@CurrentUser() supabaseUser: any) {
    try {
      // 取得用戶資訊
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.reactivateSubscription(userProfile.tenantId);

      return {
        success: true,
        message: 'Subscription reactivated successfully',
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error reactivating subscription:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(error.message || 'Failed to reactivate subscription');
    }
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe Webhook 端點（不需要認證，使用 Stripe 簽名驗證）' })
  @ApiBody({ description: 'Stripe webhook payload' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    console.log('[Webhook] Received webhook request');
    
    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return {
        success: false,
        message: 'Missing stripe-signature header',
      };
    }

    try {
      // 取得 raw body（在 NestJS 中，當 rawBody: true 時，req.rawBody 會包含原始 body）
      const rawBody = req.rawBody;
      if (!rawBody) {
        console.error('[Webhook] Missing raw body');
        return {
          success: false,
          message: 'Missing raw body',
        };
      }

      console.log('[Webhook] Verifying signature...');
      // 驗證 Webhook 簽名
      const event = this.stripeService.verifyWebhookSignature(
        rawBody,
        signature,
      );

      console.log(`[Webhook] Signature verified, event type: ${event.type}, event id: ${event.id}`);
      
      // 處理事件
      await this.stripeService.handleWebhookEvent(event);

      console.log(`[Webhook] Event ${event.id} processed successfully`);
      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      console.error('[Webhook] Error processing webhook:', error.message);
      console.error('[Webhook] Error stack:', error.stack);
      return {
        success: false,
        message: error.message || 'Webhook processing failed',
      };
    }
  }

  @Get('debug/user-data')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取得當前用戶的調試資訊' })
  async debugUserData(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.getUserDebugData(userProfile.tenantId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Post('sync-payments')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '從 Stripe 同步付款記錄' })
  async syncPayments(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.syncPaymentsFromStripe(userProfile.tenantId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * 清除測試資料（僅開發環境使用）
   */
  @Post('clear-test-data')
  @UseGuards(SupabaseAuthGuard)
  async clearTestData(@CurrentUser() supabaseUser: any) {
    const userId = supabaseUser.id; // 使用 CurrentUser decorator
    const result = await this.stripeService.clearTestData(userId);
    return { success: true, data: result };
  }

  /**
   * 創建 Test Clock 訂閱（測試用）
   */
  @Post('test-clock/create-subscription')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '創建綁定 Test Clock 的訂閱（測試用）' })
  async createTestClockSubscription(
    @Body() body: { planCode: string },
    @CurrentUser() supabaseUser: any,
  ) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.createTestClockSubscription(
        userProfile.tenantId,
        body.planCode,
        userProfile.email,
      );

      return {
        success: true,
        message: 'Test Clock subscription created successfully',
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error creating test clock subscription:', error);
      throw new BadRequestException(error.message || 'Failed to create test clock subscription');
    }
  }

  /**
   * 快轉 Test Clock（測試用）
   */
  @Post('test-clock/advance')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '快轉 Test Clock 時間（測試用）' })
  async advanceTestClock(
    @Body() body: { months?: number },
    @CurrentUser() supabaseUser: any,
  ) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const months = body.months || 1;
      const result = await this.stripeService.advanceTestClock(months, userProfile.tenantId);

      return {
        success: true,
        message: result.message,
        data: {
          frozenTime: result.frozenTime,
          frozenTimeDate: new Date(result.frozenTime * 1000).toISOString(),
          processedInvoices: result.processedInvoices,
        },
      };
    } catch (error) {
      console.error('[Stripe Controller] Error advancing test clock:', error);
      throw new BadRequestException(error.message || 'Failed to advance test clock');
    }
  }

  /**
   * 取得付款失敗資訊
   */
  @Get('payment-failed-info')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取得付款失敗資訊' })
  async getPaymentFailedInfo(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.getPaymentFailedInfo(userProfile.tenantId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error getting payment failed info:', error);
      throw new BadRequestException(error.message || 'Failed to get payment failed info');
    }
  }

  /**
   * 取得失敗的發票列表
   */
  @Get('failed-invoices')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '取得失敗的發票列表' })
  async getFailedInvoices(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.getFailedInvoices(userProfile.tenantId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error getting failed invoices:', error);
      throw new BadRequestException(error.message || 'Failed to get failed invoices');
    }
  }

  /**
   * 更新付款方式
   */
  @Post('update-payment-method')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新付款方式' })
  async updatePaymentMethod(
    @Body() body: { paymentMethodId: string },
    @CurrentUser() supabaseUser: any,
  ) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      if (!body.paymentMethodId) {
        throw new BadRequestException('Payment method ID is required');
      }

      const result = await this.stripeService.updatePaymentMethod(
        userProfile.tenantId,
        body.paymentMethodId,
      );
      
      return {
        success: true,
        message: result.message,
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error updating payment method:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      throw new BadRequestException(error.message || 'Failed to update payment method');
    }
  }

  @Post('test/trigger-payment-failed')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '測試：觸發付款失敗 webhook (僅供開發測試)' })
  async triggerPaymentFailed(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.triggerTestPaymentFailed(userProfile.tenantId);
      
      return {
        success: true,
        message: 'Payment failed webhook triggered',
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error triggering payment failed:', error);
      throw new BadRequestException(error.message || 'Failed to trigger payment failed webhook');
    }
  }

  @Post('test/create-test-payment')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '測試：直接創建測試 Payment 記錄 (僅供開發測試)' })
  async createTestPayment(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.createTestPaymentRecord(userProfile.tenantId);
      
      return {
        success: true,
        message: 'Test payment record created successfully',
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error creating test payment:', error);
      throw new BadRequestException(error.message || 'Failed to create test payment record');
    }
  }

  @Post('test/update-to-failed-card')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '測試：更新訂閱付款方式為失敗測試卡 (僅供開發測試)' })
  async updateToFailedCard(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        return {
          success: false,
          message: 'User profile or tenant not found',
        };
      }

      const result = await this.stripeService.updateSubscriptionToFailedCard(userProfile.tenantId);
      
      return {
        success: true,
        message: 'Subscription payment method updated to failed card',
        data: result,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error updating to failed card:', error);
      throw new BadRequestException(error.message || 'Failed to update payment method');
    }
  }

  @Post('create-billing-portal-session')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '創建 Stripe Billing Portal Session，用於更新付款方式' })
  async createBillingPortalSession(@CurrentUser() supabaseUser: any) {
    try {
      const userProfile = await this.authService.getUserProfile(supabaseUser.id);
      if (!userProfile || !userProfile.tenantId) {
        throw new BadRequestException('User profile or tenant not found');
      }

      const session = await this.stripeService.createBillingPortalSession(userProfile.tenantId);
      
      return {
        success: true,
        url: session.url,
      };
    } catch (error) {
      console.error('[Stripe Controller] Error creating billing portal session:', error);
      throw new BadRequestException(error.message || 'Failed to create billing portal session');
    }
  }
}
