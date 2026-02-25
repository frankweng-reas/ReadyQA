import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService, PrismaTransactionClient } from '../prisma/prisma.service';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
  }

  /**
   * 建立 Checkout Session
   */
  async createCheckoutSession(
    tenantId: string,
    planCode: string,
    customerEmail: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ sessionId: string; url: string }> {
    try {
      // 取得方案資訊
      const plan = await this.prisma.plan.findUnique({
        where: { code: planCode },
      });

      if (!plan) {
        throw new NotFoundException(`Plan with code ${planCode} not found`);
      }

      // 特殊處理：free plan 允許沒有 stripePriceId（用於取消訂閱）
      if (!plan.stripePriceId && planCode !== 'free') {
        throw new BadRequestException(`Plan ${planCode} does not have a Stripe Price ID configured`);
      }

      // 驗證 Price 是否為 recurring 類型（free plan 跳過）
      if (plan.stripePriceId) {
        try {
          const price = await this.stripe.prices.retrieve(plan.stripePriceId);
          if (!price.recurring) {
            throw new BadRequestException(
              `Price ${plan.stripePriceId} is not a recurring price. Please use a recurring price for subscriptions.`
            );
          }
        } catch (error) {
          if (error instanceof BadRequestException) {
            throw error;
          }
          this.logger.warn(`Failed to verify price ${plan.stripePriceId}: ${error.message}`);
          // 繼續執行，讓 Stripe API 自己驗證
        }
      }

      // 取得租戶資訊
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
        },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant with id ${tenantId} not found`);
      }

      // 直接從資料庫查詢 active/trialing 訂閱（不依賴 include）
      const existingSubscriptions = await this.prisma.subscription.findMany({
        where: {
          tenantId,
          status: {
            in: ['active', 'trialing'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      this.logger.log(
        `[Checkout Session] Tenant ${tenantId} has ${existingSubscriptions.length} active/trialing subscriptions`
      );

      // 如果有多個 active 訂閱，這是異常情況，只保留最新的
      const existingSubscription = existingSubscriptions.length > 0 ? existingSubscriptions[0] : null;

      if (existingSubscriptions.length > 1) {
        this.logger.warn(
          `[Checkout Session] Found ${existingSubscriptions.length} active subscriptions for tenant ${tenantId}. ` +
          `This should not happen. Will use the most recent one.`
        );
      }

      if (existingSubscription) {
        this.logger.log(
          `[Checkout Session] Found active subscription: ${existingSubscription.id}, ` +
          `planCode: ${existingSubscription.planCode}, ` +
          `stripeSubscriptionId: ${existingSubscription.stripeSubscriptionId}`
        );
      } else {
        this.logger.log(`[Checkout Session] No active subscription found`);
        
        // 如果沒有訂閱且選擇 free，直接返回（已經是 free）
        if (planCode === 'free') {
          throw new BadRequestException('You are already on the free plan (no active subscription)');
        }
      }

      if (existingSubscription) {
        // 特殊處理：降級到 Free = 取消訂閱（期末生效）
        if (planCode === 'free') {
          this.logger.log(
            `[Cancel Subscription] Downgrade to free - canceling subscription ${existingSubscription.stripeSubscriptionId} at period end`
          );

          // 設定訂閱在期末取消
          await this.stripe.subscriptions.update(
            existingSubscription.stripeSubscriptionId,
            {
              cancel_at_period_end: true,
            }
          );

          this.logger.log(`[Cancel Subscription] Subscription ${existingSubscription.stripeSubscriptionId} will be canceled at period end`);

          return {
            sessionId: existingSubscription.stripeSubscriptionId,
            url: successUrl,
          };
        }
        
        // 檢查是否要升級到不同方案
        if (existingSubscription.planCode !== planCode) {
          // 驗證新 Price 是否為 recurring 類型
          if (!plan.stripePriceId) {
            throw new BadRequestException(`Plan ${planCode} does not have a Stripe Price ID configured`);
          }
          try {
            const newPrice = await this.stripe.prices.retrieve(plan.stripePriceId);
            if (!newPrice.recurring) {
              throw new BadRequestException(
                `Price ${plan.stripePriceId} is not a recurring price. Cannot upgrade to non-recurring price.`
              );
            }
          } catch (error) {
            if (error instanceof BadRequestException) {
              throw error;
            }
            this.logger.warn(`Failed to verify price ${plan.stripePriceId}: ${error.message}`);
          }

          // 升級/降級現有訂閱
          const stripeSubscription = await this.stripe.subscriptions.retrieve(
            existingSubscription.stripeSubscriptionId,
            {
              expand: ['items.data.price'], // 展開 price 資訊以便日誌記錄
            }
          );

          // 取得當前的 subscription item
          const currentItem = stripeSubscription.items.data[0];
          const currentPriceId = currentItem.price.id;

          // 檢查是否為降級或升級
          const currentPlan = await this.prisma.plan.findUnique({
            where: { code: existingSubscription.planCode },
          });

          if (!currentPlan) {
            throw new BadRequestException('Current plan not found');
          }

          const isUpgrade = plan.priceTwdMonthly > currentPlan.priceTwdMonthly;
          const isDowngrade = plan.priceTwdMonthly < currentPlan.priceTwdMonthly;

          if (isDowngrade) {
            // 降級：直接更新 subscription，使用 proration_behavior: 'none'
            this.logger.log(
              `[Downgrade] Downgrading from ${existingSubscription.planCode} to ${planCode} (no proration)`
            );

            // 檢查是否已經綁定到 schedule，如果有需要先釋放
            const scheduleId = stripeSubscription.schedule as string | null;
            if (scheduleId) {
              this.logger.log(`[Downgrade] Found existing schedule ${scheduleId}, releasing subscription...`);
              
              // 釋放訂閱（從 schedule 中移除）
              await this.stripe.subscriptionSchedules.release(scheduleId);
              
              this.logger.log(`[Downgrade] Subscription released from schedule`);
            }

            // 現在可以直接更新訂閱
            if (!plan.stripePriceId) {
              throw new BadRequestException(`Plan ${planCode} does not have a Stripe Price ID configured`);
            }
            
            // 獲取當前 subscription 的週期結束時間（降級生效的時間）
            const currentPeriodEnd = stripeSubscription.current_period_end;
            
            await this.stripe.subscriptions.update(
              existingSubscription.stripeSubscriptionId,
              {
                items: [
                  {
                    id: currentItem.id,
                    price: plan.stripePriceId,
                  },
                ],
                proration_behavior: 'none', // 不收費也不退款
                metadata: {
                  tenantId,
                  planCode,
                  previousPlanCode: existingSubscription.planCode,
                  downgradePeriodEnd: currentPeriodEnd.toString(), // 記錄降級時的週期結束時間（降級生效的時間）
                },
              }
            );

            this.logger.log(`[Downgrade] Subscription ${existingSubscription.stripeSubscriptionId} updated to ${plan.stripePriceId}`);

            // 不立即更新資料庫 planCode（等下個週期才收費時，webhook 會更新）
            this.logger.log(`[Downgrade] Downgrade complete, new price will apply at next billing cycle`);

            return {
              sessionId: existingSubscription.stripeSubscriptionId,
              url: successUrl,
            };
          }

          if (isUpgrade) {
            // 升級：立即生效並收取差價
            if (!plan.stripePriceId) {
              throw new BadRequestException(`Plan ${planCode} does not have a Stripe Price ID configured`);
            }
            
            const currentPriceAmount = (await this.stripe.prices.retrieve(currentPriceId)).unit_amount || 0;
            const newPriceAmount = (await this.stripe.prices.retrieve(plan.stripePriceId)).unit_amount || 0;

            this.logger.log(
              `[Upgrade] Updating subscription ${existingSubscription.stripeSubscriptionId}: ` +
              `from ${existingSubscription.planCode} (${currentPriceId}, $${currentPriceAmount / 100}) ` +
              `to ${planCode} (${plan.stripePriceId}, $${newPriceAmount / 100})`
            );

            // 更新訂閱的價格
            const updatedSubscription = await this.stripe.subscriptions.update(
              existingSubscription.stripeSubscriptionId,
              {
                items: [
                  {
                    id: currentItem.id,
                    price: plan.stripePriceId, // 已在上方檢查過不為 null
                  },
                ],
                metadata: {
                  tenantId,
                  planCode,
                  previousPlanCode: existingSubscription.planCode,
                },
                proration_behavior: 'always_invoice', // 立即按比例計費
                billing_cycle_anchor: 'unchanged',
              }
            );

            this.logger.log(
              `[Upgrade] Subscription updated successfully. ` +
              `Latest invoice: ${updatedSubscription.latest_invoice || 'none'}`
            );

            // 如果有產生 invoice，記錄詳細資訊
            if (updatedSubscription.latest_invoice) {
              const invoice = await this.stripe.invoices.retrieve(
                updatedSubscription.latest_invoice as string,
                { expand: ['lines.data'] }
              );
              
              const prorationItems = invoice.lines?.data?.filter(
                (line: any) => line.proration === true
              ) || [];

              this.logger.log(
                `[Upgrade Invoice] Invoice ${invoice.id}: ` +
                `billing_reason=${invoice.billing_reason}, ` +
                `amount_paid=${invoice.amount_paid / 100}, ` +
                `proration_items=${prorationItems.length}`
              );
            }

            // 更新資料庫
            await this.prisma.subscription.update({
              where: { id: existingSubscription.id },
              data: {
                planCode,
                updatedAt: new Date(),
              },
            });

            // 更新 Tenant planCode
            await this.prisma.tenant.update({
              where: { id: tenantId },
              data: { planCode },
            });

            this.logger.log(
              `Upgraded subscription ${existingSubscription.id} from ${existingSubscription.planCode} to ${planCode}`
            );

            // 升級不需要跳轉到 Stripe，直接返回成功頁面
            return {
              sessionId: existingSubscription.stripeSubscriptionId,
              url: successUrl,
            };
          }

          // 返回一個假的 session URL，因為我們已經直接更新了訂閱
          // 前端應該導向成功頁面
          return {
            sessionId: existingSubscription.stripeSubscriptionId,
            url: successUrl, // 直接導向成功頁面
          };
        } else {
          // 已經是相同方案，不需要做任何事
          throw new BadRequestException(`You are already subscribed to the ${planCode} plan`);
        }
      }

      // 沒有現有訂閱，建立新的 Checkout Session
      let stripeCustomerId: string;
      
      // 創建新的 Stripe Customer
      const customer = await this.stripe.customers.create({
        email: customerEmail,
        metadata: {
          tenantId,
        },
      });
      stripeCustomerId = customer.id;
      
      this.logger.log(`[Checkout Session] Created new Stripe customer: ${stripeCustomerId}`);

      // 建立 Checkout Session（僅用於新訂閱）
      if (!plan.stripePriceId) {
        throw new BadRequestException(`Plan ${planCode} does not have a Stripe Price ID configured`);
      }
      
      const session = await this.stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          tenantId,
          planCode,
        },
        subscription_data: {
          metadata: {
            tenantId,
            planCode,
          },
        },
      });

      this.logger.log(`Created checkout session ${session.id} for tenant ${tenantId}, plan ${planCode}`);

      return {
        sessionId: session.id,
        url: session.url || '',
      };
    } catch (error) {
      this.logger.error(`Error creating checkout session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 取消訂閱
   */
  async cancelSubscription(
    tenantId: string,
    cancelAtPeriodEnd: boolean = true,
  ): Promise<{ subscriptionId: string; canceledAt: Date | null; cancelAtPeriodEnd: boolean }> {
    try {
      // 取得租戶的訂閱記錄
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: {
            in: ['active', 'trialing'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        throw new NotFoundException(`No active subscription found for tenant ${tenantId}`);
      }

      let updatedStripeSubscription: Stripe.Subscription;

      // 呼叫 Stripe API 取消訂閱
      if (cancelAtPeriodEnd) {
        // 設定在期間結束時取消
        updatedStripeSubscription = await this.stripe.subscriptions.update(
          subscription.stripeSubscriptionId,
          {
            cancel_at_period_end: true,
          }
        );
      } else {
        // 立即取消訂閱
        updatedStripeSubscription = await this.stripe.subscriptions.cancel(
          subscription.stripeSubscriptionId
        );
      }

      // 更新資料庫記錄
      const updateData: any = {
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        updatedAt: new Date(),
      };

      if (cancelAtPeriodEnd) {
        // 期間結束時取消：status 保持不變，canceledAt 為 null
        updateData.canceledAt = null;
        // status 保持原來的狀態（active 或 trialing）
      } else {
        // 立即取消：status 變為 canceled，canceledAt 設為現在
        updateData.status = 'canceled';
        updateData.canceledAt = updatedStripeSubscription.canceled_at
          ? new Date(updatedStripeSubscription.canceled_at * 1000)
          : new Date();
      }

      const updatedSubscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: updateData,
      });

      this.logger.log(
        `Updated subscription ${subscription.id}: cancelAtPeriodEnd=${cancelAtPeriodEnd}, status=${updatedSubscription.status}, canceledAt=${updatedSubscription.canceledAt}`
      );

      // 如果立即取消，同時更新 Tenant planCode 為 free
      if (!cancelAtPeriodEnd) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { planCode: 'free' },
        });
      }

      this.logger.log(
        `Subscription ${subscription.id} canceled for tenant ${tenantId}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}`
      );

      return {
        subscriptionId: updatedSubscription.id,
        canceledAt: updatedSubscription.canceledAt,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
      };
    } catch (error) {
      this.logger.error(`Error canceling subscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 重新啟用訂閱（取消「取消」設定）
   */
  async reactivateSubscription(
    tenantId: string,
  ): Promise<{ subscriptionId: string; message: string }> {
    try {
      // 取得租戶的訂閱記錄（只能重新啟用還在期內且已設定取消的訂閱）
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: {
            in: ['active', 'trialing'],
          },
          cancelAtPeriodEnd: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        throw new BadRequestException(
          `No active subscription with cancel_at_period_end found. ` +
          `You can only reactivate a subscription that is still active but scheduled to cancel.`
        );
      }

      // 呼叫 Stripe API 取消「取消」設定
      const updatedStripeSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: false,
        }
      );

      // 更新資料庫記錄
      const updatedSubscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `Subscription ${subscription.id} reactivated for tenant ${tenantId}`
      );

      return {
        subscriptionId: subscription.id,
        message: 'Subscription reactivated successfully. It will continue at the end of the current period.',
      };
    } catch (error) {
      this.logger.error(`Error reactivating subscription: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 驗證 Webhook 簽名
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (error) {
      this.logger.error(`Webhook signature verification failed: ${error.message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * 處理 checkout.session.completed 事件
   */
  async handleCheckoutSessionCompleted(event: Stripe.CheckoutSessionCompletedEvent) {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const planCode = session.metadata?.planCode;

      if (!tenantId || !planCode) {
        this.logger.warn(`Missing metadata in checkout session ${session.id}`);
        return;
      }

      // 取得訂閱資訊
      const subscriptionId = session.subscription as string;
      if (!subscriptionId) {
        this.logger.warn(`No subscription ID in checkout session ${session.id}`);
        return;
      }

      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      const customerId = subscription.customer as string;

      // 取得最新的 invoice（訂閱的第一筆付款）
      let invoice: Stripe.Invoice | null = null;
      let paymentIntent: Stripe.PaymentIntent | null = null;
      
      if (session.invoice) {
        invoice = await this.stripe.invoices.retrieve(session.invoice as string);
        if (invoice.payment_intent) {
          paymentIntent = await this.stripe.paymentIntents.retrieve(
            invoice.payment_intent as string
          );
        }
      } else if (session.payment_intent) {
        // 如果沒有 invoice，直接取得 payment_intent
        paymentIntent = await this.stripe.paymentIntents.retrieve(
          session.payment_intent as string
        );
      }

      // 使用事務處理
      await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // 建立或更新 Subscription 記錄
        const subscriptionRecord = await tx.subscription.upsert({
          where: { stripeSubscriptionId: subscriptionId },
          update: {
            status: subscription.status,
            planCode,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            updatedAt: new Date(),
          },
          create: {
            id: subscriptionId,
            tenantId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            planCode,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          },
        });

        // 如果有付款資訊，建立 Payment 記錄
        if (paymentIntent && paymentIntent.status === 'succeeded') {
          const amount = paymentIntent.amount / 100; // Stripe 金額以分為單位
          const currency = paymentIntent.currency.toUpperCase();

          // 檢查是否已存在 Payment 記錄（避免重複建立）
          const existingPayment = await tx.payment.findUnique({
            where: { stripePaymentIntentId: paymentIntent.id },
          });

          if (!existingPayment) {
            // 使用 Stripe Payment Intent ID 作為 Payment ID（格式: pi_xxxxx）
            await tx.payment.create({
              data: {
                id: `pay_${paymentIntent.id}`, // 加上前綴避免與其他 ID 衝突
                subscriptionId: subscriptionRecord.id,
                tenantId,
                amount,
                currency,
                status: 'succeeded', // Stripe 使用 'succeeded' 狀態
                stripePaymentIntentId: paymentIntent.id,
                stripeInvoiceId: invoice?.id || null,
                paidAt: new Date(paymentIntent.created * 1000),
              },
            });

            this.logger.log(
              `Created payment record for tenant ${tenantId}, amount ${amount} ${currency}`
            );
          }
        }

        // 更新 Tenant 的 planCode
        await tx.tenant.update({
          where: { id: tenantId },
          data: { planCode },
        });

        this.logger.log(`Updated tenant ${tenantId} to plan ${planCode} after successful checkout`);
      });
    } catch (error) {
      this.logger.error(`Error handling checkout.session.completed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 處理 customer.subscription.updated 事件
   */
  async handleSubscriptionUpdated(event: Stripe.CustomerSubscriptionUpdatedEvent) {
    try {
      let subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenantId;
      let planCode = subscription.metadata?.planCode;

      this.logger.log(`[Subscription Updated] Received: ${subscription.id}, tenantId: ${tenantId}, planCode from metadata: ${planCode}, status: ${subscription.status}`);
      this.logger.log(`[Subscription Updated] Period timestamps from webhook: start=${subscription.current_period_start}, end=${subscription.current_period_end}`);

      // 如果 webhook 沒有完整資料，從 Stripe API 取得完整的 subscription
      if (!subscription.current_period_start || !subscription.current_period_end) {
        this.logger.warn(`[Subscription Updated] Missing period info in webhook, fetching from Stripe API`);
        subscription = await this.stripe.subscriptions.retrieve(subscription.id);
        this.logger.log(`[Subscription Updated] Fetched from API: start=${subscription.current_period_start}, end=${subscription.current_period_end}`);
      }

      // 如果 metadata 沒有 planCode，從 price 取得
      if (!planCode && subscription.items?.data?.[0]?.price?.id) {
        const priceId = subscription.items.data[0].price.id;
        const plan = await this.prisma.plan.findFirst({
          where: { stripePriceId: priceId },
        });
        if (plan) {
          planCode = plan.code;
          this.logger.log(`[Subscription Updated] planCode not in metadata, derived from price: ${planCode}`);
        }
      }

      if (!tenantId || !planCode) {
        this.logger.warn(`Missing metadata in subscription ${subscription.id}, tenantId: ${tenantId}, planCode: ${planCode}`);
        return;
      }

      const customerId = subscription.customer as string;

      // 驗證並轉換日期（防止 Invalid Date）
      const currentPeriodStart = subscription.current_period_start 
        ? new Date(subscription.current_period_start * 1000) 
        : new Date();
      const currentPeriodEnd = subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000) 
        : new Date();
      const canceledAt = subscription.canceled_at 
        ? new Date(subscription.canceled_at * 1000) 
        : null;

      // 檢查日期有效性
      if (isNaN(currentPeriodStart.getTime()) || isNaN(currentPeriodEnd.getTime())) {
        this.logger.error(`Invalid date in subscription ${subscription.id}: start=${subscription.current_period_start}, end=${subscription.current_period_end}`);
        return;
      }

      this.logger.log(`[Subscription Updated] ${subscription.id}, status: ${subscription.status}, plan: ${planCode}, period: ${currentPeriodStart.toISOString()} - ${currentPeriodEnd.toISOString()}`);

      // 簡化邏輯：只更新狀態，不動 planCode（planCode 由 invoice.payment_succeeded 處理）
      await this.prisma.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        update: {
          status: subscription.status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          canceledAt,
          metadata: subscription.metadata as any,
          updatedAt: new Date(),
        },
        create: {
          id: subscription.id,
          tenantId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          planCode, // 新建時設定，但之後不在這裡更新
          status: subscription.status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          canceledAt,
          metadata: subscription.metadata as any,
        },
      });

      this.logger.log(`Updated subscription ${subscription.id} status to ${subscription.status}`);
    } catch (error) {
      this.logger.error(`Error handling customer.subscription.updated: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 處理 customer.subscription.deleted 事件
   */
  async handleSubscriptionDeleted(event: Stripe.CustomerSubscriptionDeletedEvent) {
    try {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenantId;

      if (!tenantId) {
        this.logger.warn(`Missing tenantId in subscription ${subscription.id}`);
        return;
      }

      await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // 更新 Subscription 狀態為 canceled
        await tx.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // 將 Tenant planCode 設為 'free'
        await tx.tenant.update({
          where: { id: tenantId },
          data: { planCode: 'free' },
        });

        this.logger.log(`Canceled subscription for tenant ${tenantId}, set plan to free`);
      });
    } catch (error) {
      this.logger.error(`Error handling customer.subscription.deleted: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 處理 invoice.payment_succeeded 事件（包括 proration）
   * 
   * 注意：Stripe CLI 和生產環境可能發送不同的事件類型：
   * - 開發環境：invoice_payment.paid
   * - 生產環境：invoice.payment_succeeded
   */
  async handleInvoicePaymentSucceeded(event: Stripe.InvoicePaymentSucceededEvent) {
    try {
      let invoice = event.data.object as Stripe.Invoice;
      
      // 記錄原始事件類型以便監控環境差異
      this.logger.log(`[Invoice Payment] Event type: ${event.type}, Invoice: ${invoice.id}`);
      
      // 如果 invoice 數據不完整（例如 invoice_payment.paid 事件），從 Stripe 獲取完整數據
      if (!invoice.subscription || !invoice.billing_reason) {
        this.logger.warn(`[Invoice Payment] Incomplete invoice data (${invoice.id}), fetching from Stripe...`);
        try {
          invoice = await this.stripe.invoices.retrieve(invoice.id, {
            expand: ['lines.data', 'payment_intent'],
          });
        } catch (error) {
          this.logger.error(`[Invoice Payment] Failed to fetch invoice from Stripe: ${error.message}`);
          throw error;
        }
      }
      
      // 確保 subscriptionId 是字符串
      const subscriptionId = typeof invoice.subscription === 'string' 
        ? invoice.subscription 
        : (invoice.subscription as any)?.id;

      this.logger.log(`[Invoice Payment] Received invoice.payment_succeeded: ${invoice.id}, subscription: ${subscriptionId}, billing_reason: ${invoice.billing_reason}`);

      if (!subscriptionId) {
        this.logger.warn(`[Invoice Payment] Invoice ${invoice.id} has no subscription - SKIPPING`);
        return;
      }

      // 取得訂閱資訊（先從資料庫查，查不到就從 Stripe 取得）
      let subscription = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (!subscription) {
        this.logger.warn(
          `[Invoice Payment] Subscription ${subscriptionId} not found in database, fetching from Stripe...`
        );
        
        // 從 Stripe 取得訂閱資訊
        try {
          const stripeSubscription = await this.stripe.subscriptions.retrieve(subscriptionId);
          const tenantId = stripeSubscription.metadata?.tenantId;
          
          if (!tenantId) {
            this.logger.warn(`No tenantId in Stripe subscription ${subscriptionId} metadata`);
            return;
          }
          
          // 從 price 取得 plan
          const priceId = stripeSubscription.items.data[0]?.price?.id;
          const plan = await this.prisma.plan.findFirst({
            where: { stripePriceId: priceId },
          });
          
          if (!plan) {
            this.logger.warn(`Plan not found for price ${priceId}`);
            return;
          }
          
          // 創建訂閱記錄
          subscription = await this.prisma.subscription.create({
            data: {
              id: subscriptionId,
              tenantId,
              stripeCustomerId: stripeSubscription.customer as string,
              stripeSubscriptionId: subscriptionId,
              planCode: plan.code,
              status: stripeSubscription.status,
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
            },
          });
          
          this.logger.log(`Created missing subscription record ${subscription.id} for invoice processing`);
        } catch (error) {
          this.logger.error(`[Invoice Payment] Failed to create subscription from Stripe data: ${error.message} - SKIPPING PAYMENT`);
          return;
        }
      }

      this.logger.log(`[Invoice Payment] Found subscription ${subscription.id}, continuing to process payment...`);

      // 檢查是否為 proration invoice（升級/降級產生的差價）
      const isProration = invoice.billing_reason === 'subscription_update';

      // subscription_create: 檢查是否已經在 checkout.session.completed 處理過
      if (invoice.billing_reason === 'subscription_create') {
        // 檢查是否有對應的 payment 記錄（如果有，代表已經在 checkout.session.completed 處理過）
        const existingPaymentForSubscription = await this.prisma.payment.findFirst({
          where: {
            subscriptionId: subscription.id,
            stripeInvoiceId: invoice.id,
          },
        });

        if (existingPaymentForSubscription) {
          this.logger.log(
            `[Invoice Payment] Skipping subscription_create invoice ${invoice.id} - ` +
            `REASON: already handled by checkout.session.completed (payment exists)`
          );
          return;
        }

        // 如果沒有 payment 記錄，表示這是直接創建的訂閱（如 Test Clock），需要記錄
        this.logger.log(
          `[Invoice Payment] Processing subscription_create invoice ${invoice.id} - ` +
          `REASON: no existing payment found (likely Test Clock subscription)`
        );
      }

      this.logger.log(`[Invoice Payment] Invoice ${invoice.id} passed subscription_create check, continuing...`);

      // 取得 payment intent
      const paymentIntentId = typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : (invoice.payment_intent as any)?.id;
        
      if (!paymentIntentId) {
        this.logger.warn(`[Invoice Payment] Invoice ${invoice.id} has no payment intent - SKIPPING`);
        return;
      }

      this.logger.log(`[Invoice Payment] Payment intent found: ${paymentIntentId}`);

      // 檢查是否已存在 Payment 記錄（防止 webhook 重複發送）
      const existingPayment = await this.prisma.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      // 如果已存在 Payment 記錄
      if (existingPayment) {
        // 如果狀態是 failed，現在付款成功了，更新為 succeeded
        if (existingPayment.status === 'failed') {
          this.logger.log(`[Invoice Payment] Updating failed payment to succeeded: ${existingPayment.id}`);
          await this.prisma.payment.update({
            where: { id: existingPayment.id },
            data: {
              status: 'succeeded',
              paidAt: invoice.status_transitions?.paid_at 
                ? new Date(invoice.status_transitions.paid_at * 1000)
                : new Date(),
            },
          });
          this.logger.log(`[Invoice Payment] ✅ Updated payment ${existingPayment.id} from failed to succeeded`);
        } else if (existingPayment.status === 'succeeded') {
          // 已經是 succeeded，記錄日誌但繼續處理（因為 subscription_cycle 可能需要更新 planCode）
          this.logger.log(`[Invoice Payment] Payment already succeeded: ${existingPayment.id} (webhook duplicate?)`);
        }

        // 對於 subscription_cycle，即使 payment 已存在，也要檢查並更新 Tenant planCode（降級生效）
        if (invoice.billing_reason === 'subscription_cycle') {
        this.logger.log(`[Invoice Payment] Payment already exists, but checking if tenant planCode needs update (subscription_cycle)...`);
        
        // 優先從 line item metadata 取得 planCode，否則從 price 判斷
        let actualPlanCode = invoice.lines?.data?.[0]?.metadata?.planCode as string | undefined;
        
        if (!actualPlanCode) {
          const priceId = invoice.lines?.data?.[0]?.price?.id;
          if (priceId) {
            const plan = await this.prisma.plan.findFirst({
              where: { stripePriceId: priceId },
            });
            if (plan) {
              actualPlanCode = plan.code;
            }
          }
        }
        
        if (actualPlanCode) {
          this.logger.log(`[Subscription Cycle] Derived actual planCode: ${actualPlanCode}`);
          
          const tenant = await this.prisma.tenant.findUnique({
            where: { id: subscription.tenantId },
            select: { planCode: true },
          });

          if (tenant && tenant.planCode !== actualPlanCode) {
            await this.prisma.tenant.update({
              where: { id: subscription.tenantId },
              data: { planCode: actualPlanCode },
            });
            this.logger.log(
              `[Subscription Cycle] Updated tenant ${subscription.tenantId} plan: ` +
              `${tenant.planCode} -> ${actualPlanCode} (downgrade now applied)`
            );
          }
          
          // 也更新 Subscription planCode
          if (subscription.planCode !== actualPlanCode) {
            await this.prisma.subscription.update({
              where: { id: subscription.id },
              data: { planCode: actualPlanCode },
            });
            this.logger.log(
              `[Subscription Cycle] Updated subscription ${subscription.id} planCode: ` +
              `${subscription.planCode} -> ${actualPlanCode}`
            );
          }
        }
        
          return; // Payment 已存在，planCode 已處理，不需要重複創建
        } else {
          // 非 subscription_cycle，payment 已存在，直接返回
          return;
        }
      }

      this.logger.log(`[Invoice Payment] No existing payment found, will create new record...`);

      // 取得所有 line items 以便分析
      const allLineItems = invoice.lines?.data || [];
      const prorationItems = allLineItems.filter(
        (line: any) => line.proration === true
      );
      const regularItems = allLineItems.filter(
        (line: any) => line.proration !== true
      );

      // 記錄詳細資訊以便除錯
      this.logger.log(
        `[Invoice Analysis] Invoice ${invoice.id}: ` +
        `billing_reason=${invoice.billing_reason}, ` +
        `amount_paid=${invoice.amount_paid / 100}, ` +
        `total=${invoice.total / 100}, ` +
        `subtotal=${invoice.subtotal / 100}, ` +
        `isProration=${isProration}, ` +
        `prorationItems=${prorationItems.length}, ` +
        `regularItems=${regularItems.length}`
      );

      // 計算要記錄的金額
      let amount: number;
      const currency = invoice.currency.toUpperCase();

      // 如果是 proration invoice，優先計算 proration amount
      if (isProration) {
        const prorationItems = invoice.lines?.data?.filter(
          (line: any) => line.proration === true
        ) || [];

        if (prorationItems.length > 0) {
          // 有 proration line items，計算 proration 總額
          const prorationTotal = prorationItems.reduce(
            (sum: number, line: any) => sum + (line.amount || 0),
            0
          );
          amount = Math.abs(prorationTotal) / 100;
          
          this.logger.log(
            `[Proration Payment] Invoice ${invoice.id}: ` +
            `proration_total=${prorationTotal / 100} ${currency}, ` +
            `recorded_amount=${amount} ${currency}`
          );
        } else {
          // 沒有 proration line items，使用 amount_paid（這是實際支付的差價）
          amount = invoice.amount_paid / 100;
          
          this.logger.log(
            `[Proration Payment] Invoice ${invoice.id}: ` +
            `no proration line items, using amount_paid=${amount} ${currency}`
          );
        }

        await this.prisma.payment.create({
          data: {
            id: `pay_${paymentIntentId}`,
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            amount,
            currency,
            status: 'succeeded',
            stripePaymentIntentId: paymentIntentId,
            stripeInvoiceId: invoice.id,
            paidAt: invoice.status_transitions?.paid_at 
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : new Date(),
          },
        });

        this.logger.log(
          `Created proration payment record for invoice ${invoice.id}, amount ${amount} ${currency}`
        );
        return;
      }

      // 定期續約 invoice（subscription_cycle），記錄全額
      if (invoice.billing_reason === 'subscription_cycle') {
        amount = invoice.amount_paid / 100;
        
        this.logger.log(
          `Processing subscription_cycle invoice ${invoice.id}: ` +
          `amount=${amount} ${currency}`
        );

        // 從 invoice 的實際 price 判斷真正的 planCode（Stripe 是 source of truth）
        // 優先從 line item metadata 取得 planCode，否則從 price 判斷
        let actualPlanCode = invoice.lines?.data?.[0]?.metadata?.planCode as string | undefined;
        
        if (!actualPlanCode) {
          const priceId = invoice.lines?.data?.[0]?.price?.id;
          if (priceId) {
            const plan = await this.prisma.plan.findFirst({
              where: { stripePriceId: priceId },
            });
            if (plan) {
              actualPlanCode = plan.code;
              this.logger.log(
                `[Subscription Cycle] Derived actual planCode from invoice price: ${actualPlanCode} (price: ${priceId})`
              );
            }
          }
        } else {
          this.logger.log(
            `[Subscription Cycle] Derived actual planCode from line item metadata: ${actualPlanCode}`
          );
        }

        await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
          // 創建 payment 記錄
          await tx.payment.create({
            data: {
              id: `pay_${paymentIntentId}`,
              subscriptionId: subscription.id,
              tenantId: subscription.tenantId,
              amount,
              currency,
              status: 'succeeded',
              stripePaymentIntentId: paymentIntentId,
              stripeInvoiceId: invoice.id,
              paidAt: invoice.status_transitions?.paid_at 
                ? new Date(invoice.status_transitions.paid_at * 1000)
                : new Date(),
            },
          });

          // 續訂時，更新 Subscription 和 Tenant planCode 為實際的 planCode
          const tenant = await tx.tenant.findUnique({
            where: { id: subscription.tenantId },
            select: { planCode: true },
          });

          // 更新 Subscription planCode
          if (actualPlanCode && actualPlanCode !== subscription.planCode) {
            await tx.subscription.update({
              where: { id: subscription.id },
              data: { planCode: actualPlanCode },
            });
            this.logger.log(
              `[Subscription Cycle] Updated subscription ${subscription.id} planCode: ` +
              `${subscription.planCode} -> ${actualPlanCode}`
            );
          }

          // 更新 Tenant planCode（降級在這裡生效）
          if (actualPlanCode && tenant && tenant.planCode !== actualPlanCode) {
            await tx.tenant.update({
              where: { id: subscription.tenantId },
              data: { planCode: actualPlanCode },
            });
            this.logger.log(
              `[Subscription Cycle] Updated tenant ${subscription.tenantId} plan: ` +
              `${tenant.planCode} -> ${actualPlanCode} (downgrade now applied)`
            );
          }
        });

        this.logger.log(
          `Created payment record for subscription_cycle invoice ${invoice.id}, amount ${amount} ${currency}`
        );
        return;
      }

      // 其他類型的 invoice，記錄 amount_paid
      amount = invoice.amount_paid / 100;

      this.logger.log(
        `Processing other invoice type ${invoice.id}: ` +
        `billing_reason=${invoice.billing_reason}, ` +
        `amount=${amount} ${currency}`
      );

      // 統一邏輯：從 invoice 讀取 planCode 並更新（包括 subscription_create, manual 等）
      let actualPlanCode = invoice.lines?.data?.[0]?.metadata?.planCode as string | undefined;
      
      if (!actualPlanCode) {
        const priceId = invoice.lines?.data?.[0]?.price?.id;
        if (priceId) {
          const plan = await this.prisma.plan.findFirst({
            where: { stripePriceId: priceId },
          });
          if (plan) {
            actualPlanCode = plan.code;
            this.logger.log(`[Invoice Payment] Derived planCode from price: ${actualPlanCode} (${priceId})`);
          }
        }
      } else {
        this.logger.log(`[Invoice Payment] Derived planCode from metadata: ${actualPlanCode}`);
      }

      await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // 創建 payment 記錄
        await tx.payment.create({
          data: {
            id: `pay_${paymentIntentId}`,
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            amount,
            currency,
            status: 'succeeded',
            stripePaymentIntentId: paymentIntentId,
            stripeInvoiceId: invoice.id,
            paidAt: invoice.status_transitions?.paid_at 
              ? new Date(invoice.status_transitions.paid_at * 1000)
              : new Date(),
          },
        });

        // 更新 Subscription 和 Tenant planCode（統一邏輯）
        if (actualPlanCode) {
          // 更新 Subscription
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { planCode: actualPlanCode },
          });
          
          // 更新 Tenant
          await tx.tenant.update({
            where: { id: subscription.tenantId },
            data: { planCode: actualPlanCode },
          });
          
          this.logger.log(
            `[Invoice Payment] Updated planCode to ${actualPlanCode} ` +
            `(subscription: ${subscription.id}, tenant: ${subscription.tenantId})`
          );
        }
      });

      this.logger.log(
        `Created payment record for invoice ${invoice.id}, amount ${amount} ${currency} ` +
        `(billing_reason=${invoice.billing_reason})`
      );
    } catch (error) {
      this.logger.error(
        `[Invoice Payment] CRITICAL ERROR handling invoice.payment_succeeded: ${error.message}`,
        error.stack
      );
      // 記錄詳細信息以便調試生產問題
      this.logger.error(`[Invoice Payment] Event ID: ${event.id}, Type: ${event.type}`);
      throw error;
    }
  }

  /**
   * 處理 invoice.payment_failed 事件
   */
  async handleInvoicePaymentFailed(event: Stripe.InvoicePaymentFailedEvent) {
    try {
      let invoice = event.data.object as Stripe.Invoice;
      
      this.logger.log(`[Invoice Payment Failed] ========== START PROCESSING ==========`);
      this.logger.log(`[Invoice Payment Failed] Received webhook event: ${event.id}, type: ${event.type}`);
      this.logger.log(`[Invoice Payment Failed] Invoice ID: ${invoice.id}`);
      this.logger.log(`[Invoice Payment Failed] Invoice object keys: ${Object.keys(invoice).join(', ')}`);
      
      // 如果 invoice 數據不完整，從 Stripe 獲取完整數據
      if (!invoice.subscription || !invoice.payment_intent) {
        this.logger.warn(`[Invoice Payment Failed] Incomplete invoice data (${invoice.id}), fetching from Stripe...`);
        try {
          invoice = await this.stripe.invoices.retrieve(invoice.id, {
            expand: ['payment_intent', 'subscription'],
          });
          this.logger.log(`[Invoice Payment Failed] Fetched invoice from Stripe: ${invoice.id}`);
        } catch (error) {
          this.logger.error(`[Invoice Payment Failed] Failed to fetch invoice from Stripe: ${error.message}`);
          throw error;
        }
      }
      
      // 確保 subscriptionId 是字符串
      const subscriptionId = typeof invoice.subscription === 'string' 
        ? invoice.subscription 
        : (invoice.subscription as any)?.id;

      this.logger.log(`[Invoice Payment Failed] Invoice ${invoice.id}, subscription: ${subscriptionId || 'NONE'}`);
      this.logger.log(`[Invoice Payment Failed] Invoice customer: ${typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as any)?.id || 'NONE'}`);
      this.logger.log(`[Invoice Payment Failed] Invoice payment_intent: ${typeof invoice.payment_intent === 'string' ? invoice.payment_intent : (invoice.payment_intent as any)?.id || 'NONE'}`);

      if (!subscriptionId) {
        this.logger.warn(`[Invoice Payment Failed] Invoice ${invoice.id} has no subscription - This might be a test event from 'stripe trigger'`);
        
        // 嘗試通過 customer ID 來找到訂閱
        const customerId = typeof invoice.customer === 'string' 
          ? invoice.customer 
          : (invoice.customer as any)?.id;
        
        if (customerId) {
          this.logger.log(`[Invoice Payment Failed] Trying to find subscription by customer ID: ${customerId}`);
          
          // 找到該 customer 的最新 active subscription
          const subscriptionByCustomer = await this.prisma.subscription.findFirst({
            where: {
              stripeCustomerId: customerId,
              status: { in: ['active', 'trialing', 'past_due'] },
            },
            orderBy: {
              createdAt: 'desc',
            },
          });
          
          if (subscriptionByCustomer) {
            this.logger.log(`[Invoice Payment Failed] Found subscription by customer ID: ${subscriptionByCustomer.stripeSubscriptionId}`);
            // 使用找到的 subscription 繼續處理
            const subscription = subscriptionByCustomer;
            // 跳過 subscriptionId 檢查，直接使用找到的 subscription
            // 但我們需要從 invoice 取得 payment intent
            const paymentIntentId = typeof invoice.payment_intent === 'string'
              ? invoice.payment_intent
              : (invoice.payment_intent as any)?.id;
              
            if (!paymentIntentId) {
              this.logger.warn(`[Invoice Payment Failed] Invoice ${invoice.id} has no payment intent - SKIPPING`);
              return;
            }
            
            // 檢查是否已存在 Payment 記錄
            const existingPayment = await this.prisma.payment.findUnique({
              where: { stripePaymentIntentId: paymentIntentId },
            });

            if (existingPayment) {
              this.logger.warn(`[Invoice Payment Failed] Payment record already exists for paymentIntent ${paymentIntentId} - SKIPPING`);
              return;
            }

            // 取得錯誤資訊
            let errorMessage = null;
            try {
              const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
              if (paymentIntent.last_payment_error) {
                errorMessage = paymentIntent.last_payment_error.message || null;
              }
            } catch (error) {
              this.logger.warn(`[Invoice Payment Failed] Failed to fetch PaymentIntent: ${error.message}`);
            }

            const amount = invoice.amount_due / 100;
            const currency = invoice.currency.toUpperCase();

            // 創建失敗的 payment 記錄
            try {
              const payment = await this.prisma.payment.create({
                data: {
                  id: `pay_${paymentIntentId}`,
                  subscriptionId: subscription.id,
                  tenantId: subscription.tenantId,
                  amount,
                  currency,
                  status: 'failed',
                  stripePaymentIntentId: paymentIntentId,
                  stripeInvoiceId: invoice.id,
                  paidAt: null,
                },
              });

              this.logger.log(`[Invoice Payment Failed] ✅ Successfully created payment record using customer ID match`);
              this.logger.log(`[Invoice Payment Failed] Payment ID: ${payment.id}, Subscription: ${subscription.stripeSubscriptionId}`);
              return;
            } catch (dbError: any) {
              if (dbError.code === 'P2002') {
                this.logger.warn(`[Invoice Payment Failed] Payment record already exists - SKIPPING`);
                return;
              }
              this.logger.error(`[Invoice Payment Failed] Failed to create payment record: ${dbError.message}`);
              throw dbError;
            }
          }
        }
        
        this.logger.warn(`[Invoice Payment Failed] SKIPPING - Cannot match this event to a database subscription`);
        this.logger.log(`[Invoice Payment Failed] ========== END PROCESSING (NO MATCH) ==========`);
        return;
      }

      // 取得訂閱資訊
      this.logger.log(`[Invoice Payment Failed] Looking up subscription in database: ${subscriptionId}`);
      const subscription = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (!subscription) {
        this.logger.warn(`[Invoice Payment Failed] Subscription ${subscriptionId} not found in database`);
        this.logger.warn(`[Invoice Payment Failed] This might be a test event that doesn't match your actual subscription`);
        this.logger.warn(`[Invoice Payment Failed] SKIPPING - Cannot create payment record without matching subscription`);
        this.logger.log(`[Invoice Payment Failed] ========== END PROCESSING (SUBSCRIPTION NOT FOUND) ==========`);
        return;
      }

      this.logger.log(`[Invoice Payment Failed] ✅ Found matching subscription in database: ${subscription.id} (tenant: ${subscription.tenantId})`);

      // 取得 payment intent ID
      const paymentIntentId = typeof invoice.payment_intent === 'string'
        ? invoice.payment_intent
        : (invoice.payment_intent as any)?.id;
        
      if (!paymentIntentId) {
        this.logger.warn(`[Invoice Payment Failed] Invoice ${invoice.id} has no payment intent - SKIPPING`);
        return;
      }

      this.logger.log(`[Invoice Payment Failed] Payment intent: ${paymentIntentId}`);

      // 檢查是否已存在 Payment 記錄（防止 webhook 重複發送）
      const existingPayment = await this.prisma.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (existingPayment) {
        this.logger.warn(`[Invoice Payment Failed] Payment record already exists for invoice ${invoice.id} (paymentIntent: ${paymentIntentId}) - SKIPPING`);
        return;
      }

      // 從 Stripe API 取得 PaymentIntent 以獲取錯誤資訊
      let errorReason = null;
      let errorCode = null;
      let errorMessage = null;
      let errorType = null;

      try {
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.last_payment_error) {
          errorCode = paymentIntent.last_payment_error.code || null;
          errorMessage = paymentIntent.last_payment_error.message || null;
          errorType = paymentIntent.last_payment_error.type || null;
          
          errorReason = JSON.stringify({
            code: errorCode,
            message: errorMessage,
            type: errorType,
          });
          
          this.logger.log(
            `[Invoice Payment Failed] Error details: ` +
            `code=${errorCode}, type=${errorType}, message=${errorMessage}`
          );
        }
      } catch (error) {
        this.logger.warn(`[Invoice Payment Failed] Failed to fetch PaymentIntent: ${error.message}`);
        // 繼續執行，即使無法取得錯誤詳情
      }

      const amount = invoice.amount_due / 100;
      const currency = invoice.currency.toUpperCase();

      // 創建失敗的 payment 記錄
      this.logger.log(`[Invoice Payment Failed] Preparing to create payment record...`);
      this.logger.log(`[Invoice Payment Failed] Payment data: {
        id: pay_${paymentIntentId},
        subscriptionId: ${subscription.id},
        tenantId: ${subscription.tenantId},
        amount: ${amount},
        currency: ${currency},
        status: failed,
        stripePaymentIntentId: ${paymentIntentId},
        stripeInvoiceId: ${invoice.id}
      }`);
      
      try {
        const payment = await this.prisma.payment.create({
          data: {
            id: `pay_${paymentIntentId}`,
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            amount,
            currency,
            status: 'failed',
            stripePaymentIntentId: paymentIntentId,
            stripeInvoiceId: invoice.id,
            paidAt: null, // 付款失敗，沒有 paidAt
          },
        });

        this.logger.log(
          `[Invoice Payment Failed] ✅✅✅ Successfully created failed payment record ✅✅✅`
        );
        this.logger.log(
          `[Invoice Payment Failed] Payment ID: ${payment.id}`
        );
        this.logger.log(
          `[Invoice Payment Failed] Invoice: ${invoice.id}`
        );
        this.logger.log(
          `[Invoice Payment Failed] Amount: ${amount} ${currency}`
        );
        this.logger.log(
          `[Invoice Payment Failed] Reason: ${errorMessage || 'unknown'}`
        );
        this.logger.log(`[Invoice Payment Failed] ========== END PROCESSING (SUCCESS) ==========`);
      } catch (dbError: any) {
        this.logger.error(`[Invoice Payment Failed] ❌❌❌ Database error occurred ❌❌❌`);
        this.logger.error(`[Invoice Payment Failed] Error code: ${dbError.code}`);
        this.logger.error(`[Invoice Payment Failed] Error message: ${dbError.message}`);
        this.logger.error(`[Invoice Payment Failed] Error meta: ${JSON.stringify(dbError.meta || {})}`);
        
        // 檢查是否為重複記錄錯誤
        if (dbError.code === 'P2002') {
          this.logger.warn(`[Invoice Payment Failed] Payment record already exists for paymentIntent ${paymentIntentId} - SKIPPING (duplicate webhook?)`);
          this.logger.log(`[Invoice Payment Failed] ========== END PROCESSING (DUPLICATE) ==========`);
          return;
        }
        this.logger.error(`[Invoice Payment Failed] Failed to create payment record: ${dbError.message}`);
        this.logger.log(`[Invoice Payment Failed] ========== END PROCESSING (ERROR) ==========`);
        throw dbError;
      }
      
      // 注意：訂閱狀態由 customer.subscription.updated webhook 處理，這裡不更新
      this.logger.log(
        `[Invoice Payment Failed] ℹ️ Subscription status will be updated by customer.subscription.updated webhook`
      );
    } catch (error) {
      this.logger.error(`[Invoice Payment Failed] ========== CRITICAL ERROR ==========`);
      this.logger.error(
        `[Invoice Payment Failed] CRITICAL ERROR handling invoice.payment_failed: ${error.message}`
      );
      this.logger.error(`[Invoice Payment Failed] Error stack: ${error.stack}`);
      this.logger.error(`[Invoice Payment Failed] Event ID: ${event.id}, Type: ${event.type}`);
      this.logger.error(`[Invoice Payment Failed] ========== END PROCESSING (CRITICAL ERROR) ==========`);
      throw error;
    }
  }

  /**
   * 處理 Webhook 事件
   */
  async handleWebhookEvent(event: Stripe.Event) {
    this.logger.log(`[Webhook Handler] Received webhook event: ${event.type} (ID: ${event.id})`);
    this.logger.log(`[Webhook Handler] Event created: ${new Date(event.created * 1000).toISOString()}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          this.logger.log(`[Webhook Handler] Processing checkout.session.completed...`);
          await this.handleCheckoutSessionCompleted(event as Stripe.CheckoutSessionCompletedEvent);
          this.logger.log(`[Webhook Handler] ✅ checkout.session.completed processed successfully`);
          break;
        case 'customer.subscription.updated':
          this.logger.log(`[Webhook Handler] Processing customer.subscription.updated...`);
          await this.handleSubscriptionUpdated(event as Stripe.CustomerSubscriptionUpdatedEvent);
          this.logger.log(`[Webhook Handler] ✅ customer.subscription.updated processed successfully`);
          break;
        case 'customer.subscription.deleted':
          this.logger.log(`[Webhook Handler] Processing customer.subscription.deleted...`);
          await this.handleSubscriptionDeleted(event as Stripe.CustomerSubscriptionDeletedEvent);
          this.logger.log(`[Webhook Handler] ✅ customer.subscription.deleted processed successfully`);
          break;
        case 'invoice.payment_succeeded':
          this.logger.log(`[Webhook Handler] Processing invoice.payment_succeeded...`);
          await this.handleInvoicePaymentSucceeded(event as Stripe.InvoicePaymentSucceededEvent);
          this.logger.log(`[Webhook Handler] ✅ invoice.payment_succeeded processed successfully`);
          break;
        case 'invoice.payment_failed':
          this.logger.log(`[Webhook Handler] Processing invoice.payment_failed...`);
          await this.handleInvoicePaymentFailed(event as Stripe.InvoicePaymentFailedEvent);
          this.logger.log(`[Webhook Handler] ✅ invoice.payment_failed processed successfully`);
          break;
        default:
          // 特殊處理：某些 Stripe CLI 版本會發送 invoice_payment.paid 或 invoice.paid
          if ((event as any).type === 'invoice_payment.paid' || (event as any).type === 'invoice.paid') {
            this.logger.log(`[Webhook Handler] Processing alternative payment event type: ${(event as any).type}...`);
            await this.handleInvoicePaymentSucceeded(event as any);
            this.logger.log(`[Webhook Handler] ✅ ${(event as any).type} processed successfully`);
          } else {
            this.logger.log(`[Webhook Handler] ⚠️ Unhandled webhook event type: ${event.type}`);
          }
      }
    } catch (error) {
      this.logger.error(`[Webhook Handler] ❌ Error processing webhook event ${event.id} (${event.type}): ${error.message}`);
      this.logger.error(`[Webhook Handler] Error stack: ${error.stack}`);
      throw error; // 重新拋出錯誤，讓上層處理
    }
  }

  /**
   * 取得用戶的調試資訊（簡化版）
   */
  async getUserDebugData(tenantId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          planCode: true,
        },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      const subscriptions = await this.prisma.subscription.findMany({
        where: { tenantId },
        select: {
          id: true,
          planCode: true,
          status: true,
          stripeSubscriptionId: true,
          stripeCustomerId: true,
          cancelAtPeriodEnd: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // 從第一個訂閱獲取 stripeCustomerId（如果有的話）
      const stripeCustomerId = subscriptions.length > 0 ? subscriptions[0].stripeCustomerId : null;

      // 從 Stripe API 獲取訂閱詳細資訊
      const stripeSubscriptions = [];
      for (const sub of subscriptions) {
        if (sub.stripeSubscriptionId) {
          try {
            const stripeSub = await this.stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
            
            // 如實呈現 metadata 資訊，讓用戶自行判斷
            const metadata = stripeSub.metadata || {};
            const currentPlanCode = metadata.planCode || null;
            const previousPlanCode = metadata.previousPlanCode || null;
            
            // 如果有 previousPlanCode，表示有方案變更
            // 檢查是否為降級（新價格 < 舊價格）
            let hasPendingPriceChange = false;
            let nextPeriodStart: string | null = null;
            let nextPeriodEnd: string | null = null;
            
            if (previousPlanCode && currentPlanCode && previousPlanCode !== currentPlanCode) {
              // 查詢方案價格來判斷是升級還是降級
              const previousPlan = await this.prisma.plan.findUnique({
                where: { code: previousPlanCode },
                select: { priceTwdMonthly: true, stripePriceId: true },
              });
              const currentPlan = await this.prisma.plan.findUnique({
                where: { code: currentPlanCode },
                select: { priceTwdMonthly: true, stripePriceId: true },
              });
              
              // 如果新價格 < 舊價格，表示是降級
              if (previousPlan && currentPlan && currentPlan.priceTwdMonthly < previousPlan.priceTwdMonthly) {
                // 降級場景：使用 proration_behavior: 'none' 時，價格變更在下個週期生效
                // 判斷邏輯：比較當前 subscription 的價格 ID 與舊價格 ID
                // 如果當前價格 ID = 新價格，且 ≠ 舊價格，表示降級已設定
                // 但我們需要判斷是否已生效：檢查當前週期的開始時間
                // 如果當前週期的開始時間 >= 降級設定的時間 + 一個週期，表示降級已生效
                
                // 獲取當前 subscription 的價格 ID
                const currentSubscriptionPriceId = stripeSub.items?.data?.[0]?.price?.id || null;
                
                if (currentSubscriptionPriceId && previousPlan.stripePriceId && currentPlan.stripePriceId) {
                  // 如果當前 subscription 的價格 ID 已經是新價格，且不等於舊價格
                  if (currentSubscriptionPriceId === currentPlan.stripePriceId && 
                      currentSubscriptionPriceId !== previousPlan.stripePriceId) {
                    // 降級已設定，現在判斷是否已生效
                    // 獲取當前週期的開始時間
                    const currentPeriodStart = stripeSub.current_period_start;
                    // 獲取降級時的週期結束時間（從 metadata）
                    const downgradePeriodEnd = metadata.downgradePeriodEnd 
                      ? parseInt(metadata.downgradePeriodEnd)
                      : null;
                    
                    if (downgradePeriodEnd) {
                      // 如果當前週期的開始時間 >= 降級時的週期結束時間，表示降級已生效
                      // 因為降級是在上個週期設定的，如果當前週期已經開始（>= 上個週期結束時間），表示降級已生效
                      if (currentPeriodStart >= downgradePeriodEnd) {
                        // 當前週期已經是新價格的週期，降級已生效
                        hasPendingPriceChange = false;
                      } else {
                        // 當前週期還是舊價格的週期，降級尚未生效
                        hasPendingPriceChange = true;
                      }
                    } else {
                      // 如果沒有 downgradePeriodEnd（舊資料），預設為尚未生效
                      hasPendingPriceChange = true;
                    }
                  }
                }
              }
            }
            
            // 調試：輸出 Stripe subscription 的所有時間相關欄位
            this.logger.log(`[Debug] Subscription ${stripeSub.id} time fields:`);
            this.logger.log(`  - current_period_start: ${stripeSub.current_period_start} (${new Date(stripeSub.current_period_start * 1000).toISOString()})`);
            this.logger.log(`  - current_period_end: ${stripeSub.current_period_end} (${new Date(stripeSub.current_period_end * 1000).toISOString()})`);
            this.logger.log(`  - billing_cycle_anchor: ${stripeSub.billing_cycle_anchor || 'null'}`);
            this.logger.log(`  - trial_start: ${stripeSub.trial_start || 'null'}`);
            this.logger.log(`  - trial_end: ${stripeSub.trial_end || 'null'}`);
            this.logger.log(`  - cancel_at: ${stripeSub.cancel_at || 'null'}`);
            this.logger.log(`  - canceled_at: ${stripeSub.canceled_at || 'null'}`);
            this.logger.log(`  - ended_at: ${stripeSub.ended_at || 'null'}`);
            
            stripeSubscriptions.push({
              id: stripeSub.id,
              status: stripeSub.status,
              planCode: currentPlanCode || null,
              currentPeriodStart: new Date(stripeSub.current_period_start * 1000).toISOString(),
              currentPeriodEnd: new Date(stripeSub.current_period_end * 1000).toISOString(),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end || false,
              canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000).toISOString() : null,
              priceId: stripeSub.items?.data?.[0]?.price?.id || null,
              priceAmount: stripeSub.items?.data?.[0]?.price?.unit_amount || null,
              priceCurrency: stripeSub.items?.data?.[0]?.price?.currency || null,
              customerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id || null,
              metadata: metadata,
              // 下個週期生效的新價格資訊（僅降級時為 true）
              hasPendingPriceChange: hasPendingPriceChange || false,
              nextPeriodPlanCode: hasPendingPriceChange ? currentPlanCode : null,
              previousPlanCode: previousPlanCode || null,
              // 下個週期的時間（從 Stripe upcoming invoice 獲取）
              nextPeriodStart: nextPeriodStart,
              nextPeriodEnd: nextPeriodEnd,
            });
          } catch (error) {
            this.logger.warn(`Failed to retrieve Stripe subscription ${sub.stripeSubscriptionId}: ${error.message}`);
            // 如果獲取失敗，仍然添加基本信息
            stripeSubscriptions.push({
              id: sub.stripeSubscriptionId,
              status: 'unknown',
              error: error.message,
            });
          }
        }
      }

      const payments = await this.prisma.payment.findMany({
        where: { tenantId },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          planCode: tenant.planCode,
          stripeCustomerId,
        },
        subscriptions,
        stripeSubscriptions,
        payments,
      };
    } catch (error) {
      this.logger.error(`Error in getUserDebugData: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 從 Stripe 同步付款記錄
   */
  async syncPaymentsFromStripe(tenantId: string) {
    try {
      this.logger.log(`[Sync Payments] Starting sync for tenant ${tenantId}`);

      // 取得該租戶的所有訂閱
      const subscriptions = await this.prisma.subscription.findMany({
        where: { tenantId },
      });

      if (subscriptions.length === 0) {
        this.logger.log(`[Sync Payments] No subscriptions found for tenant ${tenantId}`);
        return { syncedCount: 0, message: 'No subscriptions found' };
      }

      let syncedCount = 0;

      // 對每個訂閱，從 Stripe 取得所有 invoices
      for (const subscription of subscriptions) {
        this.logger.log(`[Sync Payments] Checking subscription ${subscription.stripeSubscriptionId}`);

        try {
          // 從 Stripe 取得該訂閱的所有 invoices
          const invoices = await this.stripe.invoices.list({
            subscription: subscription.stripeSubscriptionId,
            limit: 100,
          });

          this.logger.log(`[Sync Payments] Found ${invoices.data.length} invoices for subscription ${subscription.stripeSubscriptionId}`);

          for (const invoice of invoices.data) {
            // 只處理已付款的 invoice
            if (invoice.status !== 'paid' || !invoice.payment_intent) {
              continue;
            }

            const paymentIntentId = invoice.payment_intent as string;

            // 檢查是否已存在
            const existingPayment = await this.prisma.payment.findUnique({
              where: { stripePaymentIntentId: paymentIntentId },
            });

            if (existingPayment) {
              this.logger.log(`[Sync Payments] Payment ${paymentIntentId} already exists, skipping`);
              continue;
            }

            // 取得詳細的 payment intent 資訊
            const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

            // 計算金額
            let amount: number;
            const currency = invoice.currency.toUpperCase();

            // 對於 proration invoice（升級差價），只記錄 proration amount
            if (invoice.billing_reason === 'subscription_update') {
              const prorationItems = invoice.lines?.data?.filter(
                (line: any) => line.proration === true
              ) || [];

              if (prorationItems.length > 0) {
                const prorationTotal = prorationItems.reduce(
                  (sum: number, line: any) => sum + (line.amount || 0),
                  0
                );
                amount = Math.abs(prorationTotal) / 100;
              } else {
                amount = invoice.amount_paid / 100;
              }

              this.logger.log(
                `[Sync Payments] Proration invoice ${invoice.id}: amount=${amount} ${currency}`
              );
            } else {
              // 一般付款，使用 amount_paid
              amount = invoice.amount_paid / 100;
              this.logger.log(
                `[Sync Payments] Regular invoice ${invoice.id}: amount=${amount} ${currency}`
              );
            }

            // 創建 Payment 記錄
            await this.prisma.payment.create({
              data: {
                id: `pay_${paymentIntentId}`,
                subscriptionId: subscription.id,
                tenantId,
                amount,
                currency,
                status: 'succeeded',
                stripePaymentIntentId: paymentIntentId,
                stripeInvoiceId: invoice.id,
                paidAt: invoice.status_transitions?.paid_at
                  ? new Date(invoice.status_transitions.paid_at * 1000)
                  : new Date(),
              },
            });

            syncedCount++;
            this.logger.log(
              `[Sync Payments] Created payment record for invoice ${invoice.id}, amount ${amount} ${currency}`
            );
          }
        } catch (error) {
          this.logger.error(
            `[Sync Payments] Error processing subscription ${subscription.stripeSubscriptionId}: ${error.message}`
          );
          // 繼續處理下一個訂閱
        }
      }

      this.logger.log(`[Sync Payments] Sync completed, created ${syncedCount} payment records`);

      return {
        syncedCount,
        message: `Successfully synced ${syncedCount} payment record(s)`,
      };
    } catch (error) {
      this.logger.error(`Error in syncPaymentsFromStripe: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 清除測試資料（僅開發環境）
   */
  async clearTestData(supabaseUserId: string) {
    this.logger.log(`[Clear Test Data] Starting for user: ${supabaseUserId}`);

    // 1. 找到用戶的 tenant
    const user = await this.prisma.user.findUnique({
      where: { supabaseUserId },
      select: { 
        id: true,
        tenant: {
          select: {
            id: true,
            planCode: true,
          }
        }
      },
    });

    if (!user?.tenant) {
      this.logger.warn(`[Clear Test Data] No tenant found for user ${supabaseUserId}`);
      return { message: 'No tenant found' };
    }

    const tenantId = user.tenant.id;

    // 2. 找到所有訂閱
    const subscriptions = await this.prisma.subscription.findMany({
      where: { tenantId },
      select: {
        id: true,
        stripeSubscriptionId: true,
        stripeCustomerId: true,
      },
    });

    this.logger.log(`[Clear Test Data] Found ${subscriptions.length} subscriptions for tenant ${tenantId}`);

    // 3. 取消所有 Stripe 訂閱並刪除對應的 customer
    const canceledStripeSubscriptions = [];
    const deletedCustomers = [];
    const processedCustomers = new Set<string>(); // 避免重複刪除同一個 customer

    for (const sub of subscriptions) {
      try {
        // 取消訂閱
        await this.stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        canceledStripeSubscriptions.push(sub.stripeSubscriptionId);
        this.logger.log(`[Clear Test Data] Canceled Stripe subscription: ${sub.stripeSubscriptionId}`);
      } catch (error) {
        // 如果訂閱已經不存在於 Stripe，忽略錯誤
        if (error.code === 'resource_missing') {
          this.logger.warn(`[Clear Test Data] Stripe subscription not found: ${sub.stripeSubscriptionId}`);
        } else {
          this.logger.error(`[Clear Test Data] Failed to cancel Stripe subscription ${sub.stripeSubscriptionId}: ${error.message}`);
        }
      }

      // 刪除對應的 Stripe customer（避免累積 Test Clock 客戶）
      if (sub.stripeCustomerId && !processedCustomers.has(sub.stripeCustomerId)) {
        try {
          await this.stripe.customers.del(sub.stripeCustomerId);
          deletedCustomers.push(sub.stripeCustomerId);
          processedCustomers.add(sub.stripeCustomerId);
          this.logger.log(`[Clear Test Data] Deleted Stripe customer: ${sub.stripeCustomerId}`);
        } catch (error) {
          if (error.code === 'resource_missing') {
            this.logger.warn(`[Clear Test Data] Stripe customer not found: ${sub.stripeCustomerId}`);
          } else {
            this.logger.error(`[Clear Test Data] Failed to delete Stripe customer ${sub.stripeCustomerId}: ${error.message}`);
          }
        }
      }
    }

    // 4. 刪除資料庫中的 Payment 記錄
    const deletedPayments = await this.prisma.payment.deleteMany({
      where: { tenantId },
    });

    this.logger.log(`[Clear Test Data] Deleted ${deletedPayments.count} payment records`);

    // 5. 刪除資料庫中的 Subscription 記錄
    const deletedSubscriptions = await this.prisma.subscription.deleteMany({
      where: { tenantId },
    });

    this.logger.log(`[Clear Test Data] Deleted ${deletedSubscriptions.count} subscription records`);

    // 6. 重設 Tenant planCode 為 free
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { planCode: 'free' },
    });

    this.logger.log(`[Clear Test Data] Reset tenant ${tenantId} to free plan`);

    return {
      message: 'Test data cleared successfully',
      tenantId,
      deletedPayments: deletedPayments.count,
      deletedSubscriptions: deletedSubscriptions.count,
      canceledStripeSubscriptions: canceledStripeSubscriptions.length,
      deletedCustomers: deletedCustomers.length,
    };
  }

  /**
   * 創建 Test Clock 訂閱（測試用）
   * 每次創建時都會創建新的 Test Clock（從當前時間開始），避免時間累積問題
   */
  async createTestClockSubscription(
    tenantId: string,
    planCode: string,
    customerEmail: string,
  ): Promise<{ subscriptionId: string; customerId: string; testClockId: string }> {
    // 每次創建新的 Test Clock（從當前時間開始）
    const now = Math.floor(Date.now() / 1000);
    const testClock = await this.stripe.testHelpers.testClocks.create({
      frozen_time: now,
      name: `QAPlus Test - ${new Date().toISOString()}`,
    });
    const testClockId = testClock.id;

    this.logger.log(`[Test Clock] Created new test clock: ${testClockId} at ${new Date(now * 1000).toISOString()}`);

    // 取得方案資訊
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
    });

    if (!plan || !plan.stripePriceId) {
      throw new NotFoundException(`Plan ${planCode} not found or missing Stripe Price ID`);
    }

    // 創建或取得 Stripe Customer（綁定 Test Clock）
    let stripeCustomerId: string | null = null;
    
    // 從現有訂閱中取得 stripeCustomerId（如果有的話）
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: ['active', 'trialing'],
        },
      },
      select: { stripeCustomerId: true },
    });

    if (existingSubscription?.stripeCustomerId) {
      // 檢查現有 customer 是否綁定到 test clock
      try {
        const customer = await this.stripe.customers.retrieve(existingSubscription.stripeCustomerId);
        if ('deleted' in customer && customer.deleted) {
          this.logger.warn(`[Test Clock] Customer ${existingSubscription.stripeCustomerId} is deleted, creating new customer`);
          stripeCustomerId = null;
        } else if ((customer as Stripe.Customer).test_clock !== testClockId) {
          this.logger.warn(`[Test Clock] Customer ${existingSubscription.stripeCustomerId} is not bound to test clock, creating new customer`);
          stripeCustomerId = null;
        } else {
          stripeCustomerId = existingSubscription.stripeCustomerId;
          this.logger.log(`[Test Clock] Using existing customer: ${stripeCustomerId}`);
        }
      } catch (error) {
        this.logger.warn(`[Test Clock] Failed to retrieve customer: ${error.message}`);
        stripeCustomerId = null;
      }
    }

    if (!stripeCustomerId) {
      // 創建新 customer（綁定 Test Clock）
      const customer = await this.stripe.customers.create({
        email: customerEmail,
        test_clock: testClockId,
        metadata: {
          tenantId,
        },
      });
      stripeCustomerId = customer.id;
      this.logger.log(`[Test Clock] Created new customer: ${stripeCustomerId}`);
      
      // 注意：stripeCustomerId 存在 Subscription 中，不在 Tenant 中
      // 不需要更新 Tenant 表
    }

    // 創建測試付款方式
    const paymentMethod = await this.stripe.paymentMethods.create({
      type: 'card',
      card: {
        token: 'tok_visa',
      },
    });

    // 綁定付款方式到 customer
    await this.stripe.paymentMethods.attach(paymentMethod.id, {
      customer: stripeCustomerId,
    });

    // 設為預設付款方式
    await this.stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });

    this.logger.log(`[Test Clock] Created payment method: ${paymentMethod.id}`);

    // 創建訂閱（綁定 Test Clock）
    const subscription = await this.stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: plan.stripePriceId,
        },
      ],
      metadata: {
        tenantId,
        planCode,
      },
    });

    this.logger.log(`[Test Clock] Created subscription: ${subscription.id}, status: ${subscription.status}`);

    return {
      subscriptionId: subscription.id,
      customerId: stripeCustomerId,
      testClockId,
    };
  }

  /**
   * 快轉 Test Clock（測試用）
   * 快轉最近創建的 Test Clock，並自動處理產生的 draft invoice
   */
  async advanceTestClock(months: number = 1, tenantId?: string): Promise<{ frozenTime: number; message: string; processedInvoices: number }> {
    // 找到最近的訂閱使用的 Test Clock
    let testClockId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (tenantId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { 
          tenantId,
          status: { in: ['active', 'trialing'] },
        },
        select: { stripeSubscriptionId: true },
        orderBy: { createdAt: 'desc' },
      });

      if (subscription?.stripeSubscriptionId) {
        stripeSubscriptionId = subscription.stripeSubscriptionId;
        const stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
        const customer = await this.stripe.customers.retrieve(stripeSubscription.customer as string);
        testClockId = (customer as any).test_clock;
      }
    }

    if (!testClockId || !stripeSubscriptionId) {
      throw new BadRequestException('No active Test Clock subscription found');
    }

    // 檢查 customer 的預設付款方式（stripeSubscriptionId 已由上方 throw 保證非 null）
    const stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId!);
    const customer = await this.stripe.customers.retrieve(stripeSubscription.customer as string);
    const customerId = (customer as Stripe.Customer).id;
    
    const customerDetails = await this.stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method'],
    });
    
    const defaultPaymentMethod = (customerDetails as Stripe.Customer).invoice_settings?.default_payment_method;
    if (typeof defaultPaymentMethod === 'object' && defaultPaymentMethod) {
      const pm = defaultPaymentMethod as Stripe.PaymentMethod;
      this.logger.log(`[Test Clock] Customer default payment method: ${pm.id}, type: ${pm.type}, card last4: ${pm.card?.last4 || 'N/A'}`);
    } else {
      this.logger.warn(`[Test Clock] Customer has no default payment method set`);
    }

    // 取得當前 Test Clock 狀態
    const testClock = await this.stripe.testHelpers.testClocks.retrieve(testClockId);
    const currentTime = testClock.frozen_time;

    // 計算新時間（快轉 N 個月）
    const newTime = currentTime + months * 30 * 24 * 60 * 60; // 簡單計算：每個月 30 天

    this.logger.log(
      `[Test Clock] Advancing test clock ${testClockId} from ${currentTime} to ${newTime} (+${months} months)`
    );

    // 快轉 Test Clock
    const updatedClock = await this.stripe.testHelpers.testClocks.advance(testClockId, {
      frozen_time: newTime,
    });

    this.logger.log(`[Test Clock] Test clock advanced successfully. New time: ${updatedClock.frozen_time}`);

    // 等待並重試，確保 Stripe 有時間產生 draft invoice
    let processedInvoices = 0;
    const maxRetries = 5;
    const retryDelay = 2000; // 2 秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`[Test Clock] Attempt ${attempt}/${maxRetries}: Looking for draft invoices for subscription ${stripeSubscriptionId}...`);
        
        const invoices = await this.stripe.invoices.list({
          subscription: stripeSubscriptionId,
          status: 'draft',
          limit: 5,
        });

        this.logger.log(`[Test Clock] Found ${invoices.data.length} draft invoices`);

        if (invoices.data.length === 0) {
          if (attempt < maxRetries) {
            this.logger.log(`[Test Clock] No draft invoices yet, waiting ${retryDelay/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            this.logger.warn(`[Test Clock] No draft invoices found after ${maxRetries} attempts`);
            break;
          }
        }

        // 找到 draft invoices，處理它們
        for (const invoice of invoices.data) {
          try {
            this.logger.log(`[Test Clock] Processing draft invoice ${invoice.id}...`);
            
            // Finalize invoice
            const finalizedInvoice = await this.stripe.invoices.finalizeInvoice(invoice.id);
            this.logger.log(`[Test Clock] Invoice ${invoice.id} finalized, status: ${finalizedInvoice.status}`);

            // Pay invoice（如果付款方式已更新為失敗卡，這裡會失敗）
            try {
              const paidInvoice = await this.stripe.invoices.pay(invoice.id);
              this.logger.log(`[Test Clock] ✅ Invoice ${invoice.id} paid successfully: ${paidInvoice.amount_paid / 100} ${paidInvoice.currency.toUpperCase()}`);
              processedInvoices++;
            } catch (payError: any) {
              // 付款失敗是預期的（如果已更新為失敗卡）
              this.logger.log(`[Test Clock] ❌ Invoice ${invoice.id} payment failed (expected if failed card is set): ${payError.message}`);
              this.logger.log(`[Test Clock] Invoice status: ${finalizedInvoice.status}, payment intent: ${finalizedInvoice.payment_intent || 'none'}`);
              
              // 檢查 invoice 狀態
              const updatedInvoice = await this.stripe.invoices.retrieve(invoice.id);
              this.logger.log(`[Test Clock] Updated invoice status: ${updatedInvoice.status}`);
              
              // 即使付款失敗，也算處理過（因為我們嘗試了）
              processedInvoices++;
            }
          } catch (error) {
            this.logger.error(`[Test Clock] Failed to process invoice ${invoice.id}: ${error.message}`);
          }
        }

        if (processedInvoices > 0) {
          this.logger.log(`[Test Clock] Successfully processed ${processedInvoices} draft invoice(s)`);
        }
        
        break; // 成功處理，跳出重試循環
      } catch (error) {
        this.logger.error(`[Test Clock] Attempt ${attempt} error: ${error.message}`);
        if (attempt === maxRetries) {
          this.logger.error(`[Test Clock] Failed to process draft invoices after ${maxRetries} attempts`);
        } else {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    return {
      frozenTime: updatedClock.frozen_time,
      message: `Test clock advanced by ${months} month(s)${processedInvoices > 0 ? `, processed ${processedInvoices} invoice(s)` : ''}`,
      processedInvoices,
    };
  }

  /**
   * 取得付款失敗資訊
   */
  async getPaymentFailedInfo(tenantId: string) {
    try {
      this.logger.log(`[Payment Failed Info] Getting info for tenant ${tenantId}`);

      // 取得租戶的訂閱資訊
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: {
            in: ['active', 'past_due', 'trialing'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        return {
          hasFailedPayment: false,
          subscriptionStatus: null,
          failedInvoices: [],
          canRetry: false,
        };
      }

      // 取得失敗的付款記錄
      const failedPayments = await this.prisma.payment.findMany({
        where: {
          tenantId,
          subscriptionId: subscription.id,
          status: 'failed',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      // 如果有失敗的付款，從 Stripe 取得發票詳情
      const failedInvoices = [];
      
      for (const payment of failedPayments) {
        // 如果沒有 stripeInvoiceId，使用基本資訊
        if (!payment.stripeInvoiceId) {
          this.logger.log(`[Payment Failed Info] Payment ${payment.id} has no stripeInvoiceId, using basic info`);
          failedInvoices.push({
            invoiceId: payment.id, // 使用 payment ID 作為 invoice ID
            amount: payment.amount,
            currency: payment.currency,
            failedAt: payment.createdAt,
            reason: '付款失敗（無發票資訊）',
            nextRetryAt: null,
          });
          continue;
        }
        
        // 檢查是否為測試記錄（ID 包含 test）
        const isTestPayment = payment.stripeInvoiceId.includes('test');
        
        if (isTestPayment) {
            // 測試記錄：使用模擬資料
            this.logger.log(`[Payment Failed Info] Test payment detected, using mock data`);
            failedInvoices.push({
              invoiceId: payment.stripeInvoiceId,
              amount: payment.amount,
              currency: payment.currency,
              failedAt: payment.createdAt,
              reason: '測試模擬：付款失敗（此為測試資料）',
              nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 小時後
            });
          } else {
            // 真實記錄：從 Stripe API 取得
            try {
              const invoice = await this.stripe.invoices.retrieve(payment.stripeInvoiceId, {
                expand: ['payment_intent'],
              });
              
              // 取得失敗原因
              let reason = 'Unknown error';
              
              // 優先從 payment intent 取得錯誤
              if (invoice.payment_intent && typeof invoice.payment_intent === 'object') {
                const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
                if (paymentIntent.last_payment_error) {
                  reason = paymentIntent.last_payment_error.message || paymentIntent.last_payment_error.type || 'Payment failed';
                } else if (paymentIntent.status === 'requires_payment_method') {
                  reason = '沒有付款方式';
                }
              }
              
              // 如果沒有 payment intent 錯誤，檢查 invoice 的錯誤
              if (reason === 'Unknown error' && invoice.last_finalization_error) {
                reason = invoice.last_finalization_error.message || 'Invoice finalization failed';
              }
              
              // 如果還是沒有，根據 invoice 狀態判斷
              if (reason === 'Unknown error') {
                if (invoice.status === 'open' && invoice.attempt_count === 0) {
                  reason = '尚未嘗試付款';
                } else if (invoice.status === 'open' && invoice.attempt_count > 0) {
                  reason = '付款嘗試失敗';
                } else if (invoice.status === 'uncollectible') {
                  reason = '無法收款';
                }
              }
              
              failedInvoices.push({
                invoiceId: invoice.id,
                amount: payment.amount,
                currency: payment.currency,
                failedAt: payment.createdAt,
                reason,
                nextRetryAt: invoice.next_payment_attempt 
                  ? new Date(invoice.next_payment_attempt * 1000)
                  : null,
              });
            } catch (error) {
              this.logger.warn(`[Payment Failed Info] Failed to fetch invoice ${payment.stripeInvoiceId}: ${error.message}`);
              // 即使 Stripe API 失敗，也返回基本資訊
              failedInvoices.push({
                invoiceId: payment.stripeInvoiceId,
                amount: payment.amount,
                currency: payment.currency,
                failedAt: payment.createdAt,
                reason: '無法取得詳細資訊',
                nextRetryAt: null,
              });
            }
          }
      }

      const hasFailedPayment = subscription.status === 'past_due' || failedInvoices.length > 0;

      return {
        hasFailedPayment,
        subscriptionStatus: subscription.status,
        failedInvoices,
        canRetry: hasFailedPayment,
      };
    } catch (error) {
      this.logger.error(`[Payment Failed Info] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 取得失敗的發票列表
   */
  async getFailedInvoices(tenantId: string) {
    try {
      this.logger.log(`[Failed Invoices] Getting failed invoices for tenant ${tenantId}`);

      // 取得失敗的付款記錄
      const failedPayments = await this.prisma.payment.findMany({
        where: {
          tenantId,
          status: 'failed',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      });

      const invoices = [];

      for (const payment of failedPayments) {
        if (payment.stripeInvoiceId) {
          try {
            const invoice = await this.stripe.invoices.retrieve(payment.stripeInvoiceId, {
              expand: ['payment_intent'],
            });

            // 取得錯誤原因
            let errorReason = 'Unknown error';
            if (invoice.payment_intent && typeof invoice.payment_intent !== 'string') {
              const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
              if (paymentIntent.last_payment_error) {
                errorReason = paymentIntent.last_payment_error.message || errorReason;
              }
            }

            invoices.push({
              invoiceId: invoice.id,
              amount: payment.amount,
              currency: payment.currency,
              status: invoice.status,
              failedAt: payment.createdAt,
              reason: errorReason,
              invoiceUrl: invoice.hosted_invoice_url,
              nextRetryAt: invoice.next_payment_attempt 
                ? new Date(invoice.next_payment_attempt * 1000)
                : null,
            });
          } catch (error) {
            this.logger.warn(`[Failed Invoices] Failed to fetch invoice ${payment.stripeInvoiceId}: ${error.message}`);
          }
        }
      }

      return invoices;
    } catch (error) {
      this.logger.error(`[Failed Invoices] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 更新付款方式
   */
  async updatePaymentMethod(tenantId: string, paymentMethodId: string) {
    try {
      this.logger.log(`[Update Payment Method] Updating for tenant ${tenantId}, paymentMethod: ${paymentMethodId}`);

      // 取得租戶的訂閱
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: {
            in: ['active', 'past_due', 'trialing'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        throw new NotFoundException(`No active subscription found for tenant ${tenantId}`);
      }

      // 更新 Stripe 訂閱的預設付款方式
      const updatedSubscription = await this.stripe.subscriptions.update(
        subscription.stripeSubscriptionId,
        {
          default_payment_method: paymentMethodId,
        }
      );

      this.logger.log(
        `[Update Payment Method] Updated subscription ${subscription.stripeSubscriptionId} ` +
        `with payment method ${paymentMethodId}`
      );

      // 注意：不手動觸發重試，Stripe 會自動使用新的付款方式重試

      return {
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status,
        message: 'Payment method updated successfully. Stripe will automatically retry the payment.',
      };
    } catch (error) {
      this.logger.error(`[Update Payment Method] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 測試：直接創建測試 Payment 記錄 (僅供開發測試)
   * 用於驗證資料庫連接和 schema 是否正確
   */
  async createTestPaymentRecord(tenantId: string) {
    try {
      this.logger.log(`[Create Test Payment] Starting for tenant: ${tenantId}`);

      // 1. 找到該 tenant 的 active subscription
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: ['active', 'trialing', 'past_due'] },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        throw new NotFoundException(`No subscription found for tenant ${tenantId}`);
      }

      this.logger.log(`[Create Test Payment] Found subscription: ${subscription.id}`);

      // 2. 創建測試 payment 記錄
      const testPaymentIntentId = `pi_test_${Date.now()}`;
      const testInvoiceId = `in_test_${Date.now()}`;

      this.logger.log(`[Create Test Payment] Creating payment record with ID: pay_${testPaymentIntentId}`);

      // 使用事務同時創建 payment 和更新訂閱狀態
      const result = await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
        // 2.1 創建 failed payment 記錄
        const payment = await tx.payment.create({
          data: {
            id: `pay_${testPaymentIntentId}`,
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            amount: 10.0,
            currency: 'TWD',
            status: 'failed',
            stripePaymentIntentId: testPaymentIntentId,
            stripeInvoiceId: testInvoiceId,
            paidAt: null,
          },
        });

        this.logger.log(`[Create Test Payment] ✅ Created payment record: ${payment.id}`);

        // 2.2 更新訂閱狀態為 past_due（模擬 Stripe webhook 效果）
        const updatedSubscription = await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'past_due',
            updatedAt: new Date(),
          },
        });

        this.logger.log(`[Create Test Payment] ✅ Updated subscription status to past_due: ${updatedSubscription.id}`);

        return {
          payment,
          subscription: updatedSubscription,
        };
      });

      return {
        paymentId: result.payment.id,
        subscriptionId: result.subscription.id,
        subscriptionStatus: result.subscription.status,
        tenantId: result.subscription.tenantId,
        amount: result.payment.amount,
        currency: result.payment.currency,
        status: result.payment.status,
        message: 'Test payment failed: created payment record and updated subscription to past_due',
      };
    } catch (error) {
      this.logger.error(`[Create Test Payment] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 測試：觸發付款失敗 webhook (僅供開發測試)
   * 
   * 策略：使用 stripe trigger 命令，並通過 --override 參數指定實際的 subscription ID，
   * 這樣 webhook 事件就會包含實際的 subscription，能夠正確匹配資料庫中的記錄。
   */
  async triggerTestPaymentFailed(tenantId: string) {
    try {
      this.logger.log(`[Trigger Test Payment Failed] Starting for tenant: ${tenantId}`);

      // 直接調用 createTestPaymentRecord 來創建測試 Payment 記錄
      // 這比使用 stripe trigger 更可靠，因為 stripe trigger 生成的測試事件
      // 包含的 customer/subscription ID 不會匹配數據庫中的真實記錄
      this.logger.log(`[Trigger Test Payment Failed] Using direct database insertion instead of stripe trigger`);
      
      const result = await this.createTestPaymentRecord(tenantId);
      
      this.logger.log(`[Trigger Test Payment Failed] ✅ Successfully created failed payment record`);
      
      return {
        success: true,
        paymentId: result.paymentId,
        subscriptionId: result.subscriptionId,
        message: 'Failed payment record created successfully',
        note: 'This directly creates a test payment record in the database instead of using stripe trigger, which is more reliable for testing.',
      };
    } catch (error) {
      this.logger.error(`[Trigger Test Payment Failed] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 刪除 Test Clock 訂閱的付款方式
   * 用於測試付款失敗流程（當沒有付款方式時，Stripe 嘗試收款會失敗）
   */
  async updateSubscriptionToFailedCard(tenantId: string) {
    try {
      this.logger.log(`[Delete Payment Method] Starting for tenant: ${tenantId}`);

      // 1. 找到該 tenant 的 active subscription
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: ['active', 'trialing', 'past_due'] },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        throw new NotFoundException(`No subscription found for tenant ${tenantId}`);
      }

      this.logger.log(`[Delete Payment Method] Found subscription: ${subscription.stripeSubscriptionId}, customer: ${subscription.stripeCustomerId}`);

      // 2. 取得 customer 的所有付款方式
      const customer = await this.stripe.customers.retrieve(subscription.stripeCustomerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      
      const existingDefaultPM = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
      let deletedPaymentMethods: string[] = [];
      
      if (typeof existingDefaultPM === 'object' && existingDefaultPM) {
        const existingPM = existingDefaultPM as Stripe.PaymentMethod;
        this.logger.log(`[Delete Payment Method] Current default payment method: ${existingPM.id}, card last4: ${existingPM.card?.last4 || 'N/A'}`);
        
        // 3. 刪除預設付款方式
        try {
          await this.stripe.paymentMethods.detach(existingPM.id);
          deletedPaymentMethods.push(existingPM.id);
          this.logger.log(`[Delete Payment Method] ✅ Deleted default payment method: ${existingPM.id}`);
        } catch (error: any) {
          this.logger.warn(`[Delete Payment Method] Failed to delete default payment method: ${error.message}`);
        }
      } else if (typeof existingDefaultPM === 'string') {
        try {
          await this.stripe.paymentMethods.detach(existingDefaultPM);
          deletedPaymentMethods.push(existingDefaultPM);
          this.logger.log(`[Delete Payment Method] ✅ Deleted default payment method: ${existingDefaultPM}`);
        } catch (error: any) {
          this.logger.warn(`[Delete Payment Method] Failed to delete default payment method: ${error.message}`);
        }
      }

      // 4. 列出並刪除所有其他付款方式
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: subscription.stripeCustomerId,
        type: 'card',
      });

      this.logger.log(`[Delete Payment Method] Found ${paymentMethods.data.length} payment method(s) for customer`);

      for (const pm of paymentMethods.data) {
        if (!deletedPaymentMethods.includes(pm.id)) {
          try {
            await this.stripe.paymentMethods.detach(pm.id);
            deletedPaymentMethods.push(pm.id);
            this.logger.log(`[Delete Payment Method] ✅ Deleted payment method: ${pm.id}`);
          } catch (error: any) {
            this.logger.warn(`[Delete Payment Method] Failed to delete payment method ${pm.id}: ${error.message}`);
          }
        }
      }

      // 5. 清除 customer 的預設付款方式設定
      await this.stripe.customers.update(subscription.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: undefined,
        },
      });
      this.logger.log(`[Delete Payment Method] ✅ Cleared default payment method setting`);

      // 6. 驗證刪除是否成功
      const updatedCustomer = await this.stripe.customers.retrieve(subscription.stripeCustomerId, {
        expand: ['invoice_settings.default_payment_method'],
      });
      
      const newDefaultPM = (updatedCustomer as Stripe.Customer).invoice_settings?.default_payment_method;
      const remainingPMs = await this.stripe.paymentMethods.list({
        customer: subscription.stripeCustomerId,
        type: 'card',
      });

      if (newDefaultPM === null && remainingPMs.data.length === 0) {
        this.logger.log(`[Delete Payment Method] ✅ Verified: All payment methods deleted, no default payment method`);
      } else {
        this.logger.warn(`[Delete Payment Method] ⚠️ Warning: Still has ${remainingPMs.data.length} payment method(s) or default payment method: ${newDefaultPM}`);
      }

      return {
        success: true,
        customerId: subscription.stripeCustomerId,
        subscriptionId: subscription.stripeSubscriptionId,
        deletedPaymentMethods: deletedPaymentMethods,
        message: 'All payment methods deleted. Next invoice payment will fail due to no payment method.',
        note: 'When Stripe attempts to charge the subscription, it will fail because there is no payment method, and trigger invoice.payment_failed webhook.',
      };
    } catch (error) {
      this.logger.error(`[Delete Payment Method] Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 創建 Stripe Billing Portal Session
   * 用於讓用戶更新付款方式、查看發票、管理訂閱
   */
  async createBillingPortalSession(tenantId: string) {
    try {
      this.logger.log(`[Billing Portal] Creating session for tenant: ${tenantId}`);

      // 1. 找到 tenant 的 subscription
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          tenantId,
          status: { in: ['active', 'trialing', 'past_due', 'unpaid'] },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!subscription) {
        throw new NotFoundException(`No subscription found for tenant ${tenantId}`);
      }

      this.logger.log(`[Billing Portal] Found subscription: ${subscription.stripeSubscriptionId}, customer: ${subscription.stripeCustomerId}`);

      // 2. 創建 Billing Portal Session
      const session = await this.stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/zh-TW/dashboard`,
      });

      this.logger.log(`[Billing Portal] ✅ Session created: ${session.id}, URL: ${session.url}`);

      return {
        id: session.id,
        url: session.url,
      };
    } catch (error) {
      this.logger.error(`[Billing Portal] Error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
