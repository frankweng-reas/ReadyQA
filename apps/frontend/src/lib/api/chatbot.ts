/**
 * Chatbot API 服務
 * 與 Backend Prisma API 通訊
 */

interface Chatbot {
  id: string
  name: string
  description: string | null
  status: string
  isActive: string
  createdAt: string
  updatedAt: string
  _count?: {
    faqs: number
    topics: number
  }
}

interface ChatbotResponse {
  success: boolean
  data: Chatbot[]
  total: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export const chatbotApi = {
  /**
   * 取得 Chatbot 列表
   */
  async getAll(userId?: number): Promise<Chatbot[]> {
    const params = new URLSearchParams()
    if (userId) {
      params.append('userId', userId.toString())
    }

    const url = `${API_URL}/chatbots${params.toString() ? `?${params}` : ''}`
    
    console.log('[ChatbotAPI] Fetching chatbots from:', url)
    const startTime = Date.now()
    
    const response = await fetch(url, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    const duration = Date.now() - startTime
    console.log(`[ChatbotAPI] API response time: ${duration}ms`)

    if (!response.ok) {
      console.error('[ChatbotAPI] Failed to fetch:', response.status, response.statusText)
      throw new Error('Failed to fetch chatbots')
    }

    const result: ChatbotResponse = await response.json()
    console.log('[ChatbotAPI] Fetched chatbots:', result.data.length)
    return result.data
  },

  /**
   * 取得 Chatbot 公開狀態（用於檢查是否啟用）
   */
  async getPublicStatus(id: string): Promise<{
    success: boolean
    data: {
      id: string
      name: string
      isActive: string
    }
  }> {
    console.log('[ChatbotAPI] 🔵 Fetching chatbot public status:', id)
    
    const response = await fetch(`${API_URL}/chatbots/${id}/public-status`)

    if (!response.ok) {
      throw new Error('Failed to fetch chatbot status')
    }

    const result = await response.json()
    console.log('[ChatbotAPI] 🔵 Get chatbot status response:', result)
    
    return result
  },

  /**
   * 取得單一 Chatbot
   */
  async getOne(id: string): Promise<Chatbot> {
    console.log('[ChatbotAPI] 🔵 Fetching chatbot:', id)
    
    const response = await fetch(`${API_URL}/chatbots/${id}`)

    if (!response.ok) {
      throw new Error('Failed to fetch chatbot')
    }

    const result = await response.json()
    console.log('[ChatbotAPI] 🔵 Get chatbot response:', result)
    
    // Backend 回傳格式是 { success: true, data: {...} }
    return result.data || result
  },

  /**
   * 建立 Chatbot
   */
  async create(data: {
    id: string
    name: string
    description?: string
    userId: number
    status?: string
  }): Promise<Chatbot> {
    const response = await fetch(`${API_URL}/chatbots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to create chatbot')
    }

    const result = await response.json()
    return result.data
  },

  /**
   * 更新 Chatbot
   */
  async update(
    id: string,
    data: Partial<{
      name: string
      description: string
      status: string
      isActive: string
      theme: any  // 允許更新 theme
    }>
  ): Promise<Chatbot> {
    console.log('[ChatbotAPI] 🔵 Updating chatbot:', id)
    console.log('[ChatbotAPI] 🔵 Update data:', data)
    
    if (data.theme) {
      console.log('[ChatbotAPI] 🔵 Theme 欄位數量:', Object.keys(data.theme).length)
      console.log('[ChatbotAPI] 🔵 Theme 內容預覽:', JSON.stringify(data.theme).substring(0, 200) + '...')
    }
    
    if (data.isActive) {
      console.log('[ChatbotAPI] 🔵 isActive 更新為:', data.isActive)
    }
    
    const response = await fetch(`${API_URL}/chatbots/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[ChatbotAPI] ❌ Update failed:', response.status, errorData)
      throw new Error(errorData.message || 'Failed to update chatbot')
    }

    const result = await response.json()
    console.log('[ChatbotAPI] ✅ Update successful, result:', result)
    return result.data
  },

  /**
   * 刪除 Chatbot
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/chatbots/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Failed to delete chatbot')
    }
  },

  /**
   * 取得 Chatbot 統計
   */
  async getStats(id: string) {
    const response = await fetch(`${API_URL}/chatbots/${id}/stats`)

    if (!response.ok) {
      throw new Error('Failed to fetch stats')
    }

    const result = await response.json()
    return result.data
  },
}

