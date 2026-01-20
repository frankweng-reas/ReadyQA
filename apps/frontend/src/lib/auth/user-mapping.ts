import { createClient } from '@/lib/supabase/client'

interface GetOrCreateUserResponse {
  success: boolean
  message: string
  userId: number
  created: boolean
}

/**
 * 從 Supabase UUID 獲取或建立對應的 PostgreSQL user_id
 */
export async function getOrCreateUserId(
  supabaseUserId: string,
  email?: string,
  name?: string
): Promise<number> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
    const response = await fetch(`${API_URL}/auth/get-or-create-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        supabaseUserId,
        email,
        name,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 請求失敗: ${response.status}`)
    }

    const result: GetOrCreateUserResponse = await response.json()

    if (!result.success) {
      throw new Error(result.message || '獲取用戶 ID 失敗')
    }

    // 檢查是否發生了帳號合併
    const isMerged = result.message.includes('已更新') || result.message.includes('智能合併') || result.message.includes('保留')

    if (isMerged && !result.created) {
      // 帳號已合併，在 sessionStorage 中標記
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('account_merged', 'true')
        sessionStorage.setItem('account_merged_message', result.message)
      }
    }

    console.log(`[User Mapping] ✅ Supabase UUID: ${supabaseUserId} -> PostgreSQL user_id: ${result.userId} (${result.created ? '新建' : '已存在'})`)
    
    if (isMerged) {
      console.log(`[User Mapping] 🔄 帳號已合併: ${result.message}`)
    }

    return result.userId
  } catch (error) {
    console.error('[User Mapping] ❌ 獲取用戶 ID 失敗:', error)
    throw error
  }
}

