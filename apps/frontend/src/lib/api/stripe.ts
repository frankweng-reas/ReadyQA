/**
 * Stripe API 服務
 * 與 Backend Stripe API 通訊
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

/**
 * 取得當前用戶的 Supabase token
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch (error) {
    console.error('[StripeAPI] Failed to get auth token:', error)
    return null
  }
}

export interface Plan {
  code: string
  name: string
  maxChatbots: number | null
  maxFaqsPerBot: number | null
  maxQueriesPerMo: number | null
  enableAnalytics: boolean
  enableApi: boolean
  enableExport: boolean
  priceUsdMonthly: number
  priceTwdMonthly: number
  currencyDefault: string
  stripePriceId: string | null
  createdAt: string
}

export interface PaymentFailedInfo {
  hasFailedPayment: boolean
  subscriptionStatus: string | null
  failedInvoices: Array<{
    invoiceId: string
    amount: number
    currency: string
    failedAt: Date
    reason: string
    nextRetryAt?: Date | null
  }>
  canRetry: boolean
}

export interface FailedInvoice {
  invoiceId: string
  amount: number
  currency: string
  status: string
  failedAt: Date
  reason: string
  invoiceUrl: string | null
  nextRetryAt: Date | null
}

interface PlansResponse {
  success: boolean
  data: Plan[]
}

interface CreateCheckoutSessionResponse {
  success: boolean
  message: string
  data?: {
    sessionId: string
    url: string
  }
}

export const stripeApi = {
  /**
   * 取得所有方案列表
   */
  async getPlans(): Promise<Plan[]> {
    try {
      const response = await fetch(`${API_URL}/plans`)
      
      if (!response.ok) {
        console.error('[StripeAPI] Failed to fetch plans:', response.status, response.statusText)
        return []
      }

      const result: PlansResponse = await response.json()
      
      if (!result.success || !result.data) {
        console.error('[StripeAPI] Plans fetch failed')
        return []
      }

      return result.data
    } catch (error) {
      console.error('[StripeAPI] Error fetching plans:', error)
      return []
    }
  },

  /**
   * 建立 Stripe Checkout Session
   */
  async createCheckoutSession(
    planCode: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<{ sessionId: string; url: string } | null> {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('[StripeAPI] No auth token available')
        return null
      }

      const response = await fetch(`${API_URL}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planCode,
          successUrl,
          cancelUrl,
        }),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          // 如果回應不是 JSON，使用狀態文字
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('[StripeAPI] Failed to create checkout session:', response.status, errorData)
        
        // NestJS 異常格式可能是 { statusCode, message } 或 { message }
        const errorMessage = errorData.message || errorData.error || `Failed to create checkout session (${response.status})`
        throw new Error(errorMessage)
      }

      const result: CreateCheckoutSessionResponse = await response.json()
      
      // 檢查後端返回的 success 欄位
      if (!result.success) {
        console.error('[StripeAPI] Checkout session creation failed:', result.message)
        throw new Error(result.message || 'Failed to create checkout session')
      }
      
      if (!result.data) {
        console.error('[StripeAPI] No data returned from checkout session creation')
        throw new Error('No checkout session data returned')
      }

      return result.data
    } catch (error) {
      console.error('[StripeAPI] Error creating checkout session:', error)
      throw error
    }
  },

  /**
   * 取消訂閱
   */
  async cancelSubscription(
    cancelAtPeriodEnd: boolean = true,
  ): Promise<{ subscriptionId: string; canceledAt: Date | null; cancelAtPeriodEnd: boolean } | null> {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('[StripeAPI] No auth token available')
        return null
      }

      const response = await fetch(`${API_URL}/stripe/cancel-subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelAtPeriodEnd,
        }),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('[StripeAPI] Failed to cancel subscription:', response.status, errorData)
        
        const errorMessage = errorData.message || errorData.error || `Failed to cancel subscription (${response.status})`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.success) {
        console.error('[StripeAPI] Subscription cancellation failed:', result.message)
        throw new Error(result.message || 'Failed to cancel subscription')
      }
      
      if (!result.data) {
        console.error('[StripeAPI] No data returned from subscription cancellation')
        throw new Error('No cancellation data returned')
      }

      return result.data
    } catch (error) {
      console.error('[StripeAPI] Error canceling subscription:', error)
      throw error
    }
  },

  /**
   * 重新啟用訂閱（取消「取消」設定）
   */
  async reactivateSubscription(): Promise<{ subscriptionId: string; message: string } | null> {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('[StripeAPI] No auth token available')
        return null
      }

      const response = await fetch(`${API_URL}/stripe/reactivate-subscription`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('[StripeAPI] Failed to reactivate subscription:', response.status, errorData)
        
        const errorMessage = errorData.message || errorData.error || `Failed to reactivate subscription (${response.status})`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.success) {
        console.error('[StripeAPI] Subscription reactivation failed:', result.message)
        throw new Error(result.message || 'Failed to reactivate subscription')
      }
      
      if (!result.data) {
        console.error('[StripeAPI] No data returned from subscription reactivation')
        throw new Error('No reactivation data returned')
      }

      return result.data
    } catch (error) {
      console.error('[StripeAPI] Error reactivating subscription:', error)
      throw error
    }
  },

  /**
   * 取得付款失敗資訊
   */
  async getPaymentFailedInfo(): Promise<PaymentFailedInfo | null> {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('[StripeAPI] No auth token available')
        return null
      }

      const response = await fetch(`${API_URL}/stripe/payment-failed-info`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('[StripeAPI] Failed to get payment failed info:', response.status, errorData)
        
        const errorMessage = errorData.message || errorData.error || `Failed to get payment failed info (${response.status})`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.success) {
        console.error('[StripeAPI] Get payment failed info failed:', result.message)
        throw new Error(result.message || 'Failed to get payment failed info')
      }
      
      if (!result.data) {
        console.error('[StripeAPI] No data returned from payment failed info')
        return null
      }

      return result.data
    } catch (error) {
      console.error('[StripeAPI] Error getting payment failed info:', error)
      throw error
    }
  },

  /**
   * 取得失敗的發票列表
   */
  async getFailedInvoices(): Promise<FailedInvoice[]> {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('[StripeAPI] No auth token available')
        return []
      }

      const response = await fetch(`${API_URL}/stripe/failed-invoices`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('[StripeAPI] Failed to get failed invoices:', response.status, errorData)
        
        const errorMessage = errorData.message || errorData.error || `Failed to get failed invoices (${response.status})`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.success) {
        console.error('[StripeAPI] Get failed invoices failed:', result.message)
        throw new Error(result.message || 'Failed to get failed invoices')
      }
      
      if (!result.data) {
        console.error('[StripeAPI] No data returned from failed invoices')
        return []
      }

      return result.data
    } catch (error) {
      console.error('[StripeAPI] Error getting failed invoices:', error)
      throw error
    }
  },

  /**
   * 更新付款方式
   */
  async updatePaymentMethod(paymentMethodId: string): Promise<{ subscriptionId: string; status: string; message: string } | null> {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('[StripeAPI] No auth token available')
        return null
      }

      const response = await fetch(`${API_URL}/stripe/update-payment-method`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentMethodId,
        }),
      })

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
        }
        console.error('[StripeAPI] Failed to update payment method:', response.status, errorData)
        
        const errorMessage = errorData.message || errorData.error || `Failed to update payment method (${response.status})`
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.success) {
        console.error('[StripeAPI] Update payment method failed:', result.message)
        throw new Error(result.message || 'Failed to update payment method')
      }
      
      if (!result.data) {
        console.error('[StripeAPI] No data returned from update payment method')
        throw new Error('No update data returned')
      }

      return result.data
    } catch (error) {
      console.error('[StripeAPI] Error updating payment method:', error)
      throw error
    }
  },
}
