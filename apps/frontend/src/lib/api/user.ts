/**
 * User API 服務
 * 與 Backend API 通訊
 */

export interface UserProfile {
  id: number
  email: string
  username: string
  tenantId: string | null
  tenant: {
    id: string
    name: string
    planCode: string
    plan: {
      code: string
      name: string
      maxChatbots: number | null
      maxFaqsPerBot: number | null
      maxQueriesPerMo: number | null
      priceTwdMonthly: number
      priceUsdMonthly: number
      enableAnalytics: boolean
      enableApi: boolean
      enableExport: boolean
    }
  } | null
  quota?: {
    chatbots: {
      current: number
      max: number | null
    }
    faqsTotal: {
      current: number
      max: number | null
    }
    queriesMonthly: {
      current: number
      max: number | null
    }
  }
}

interface UserProfileResponse {
  success: boolean
  message: string
  data?: UserProfile
}

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
    console.error('[UserAPI] Failed to get auth token:', error)
    return null
  }
}

export const userApi = {
  /**
   * 取得當前用戶的完整資訊（包含 tenant 和 plan）
   */
  async getProfile(): Promise<UserProfile | null> {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('[UserAPI] No auth token available')
        return null
      }

      const response = await fetch(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        console.error('[UserAPI] Failed to fetch profile:', response.status, response.statusText)
        return null
      }

      const result: UserProfileResponse = await response.json()
      
      if (!result.success || !result.data) {
        console.error('[UserAPI] Profile fetch failed:', result.message)
        return null
      }

      return result.data
    } catch (error) {
      console.error('[UserAPI] Error fetching profile:', error)
      return null
    }
  },
}
