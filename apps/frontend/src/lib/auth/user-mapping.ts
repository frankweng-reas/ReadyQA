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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 秒逾時
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
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const result = await response.json().catch(() => null)

    if (!response.ok) {
      const msg = result?.message || result?.error || `API 請求失敗: ${response.status}`
      throw new Error(msg)
    }

    const typedResult = result as GetOrCreateUserResponse
    if (!typedResult?.success) {
      throw new Error(typedResult?.message || '獲取用戶 ID 失敗')
    }

    // 檢查是否發生了帳號合併
    const isMerged = typedResult.message?.includes('已更新') || typedResult.message?.includes('智能合併') || typedResult.message?.includes('保留')

    if (isMerged && !result.created) {
      // 帳號已合併，在 sessionStorage 中標記
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('account_merged', 'true')
        sessionStorage.setItem('account_merged_message', result.message)
      }
    }

    console.log(`[User Mapping] ✅ Supabase UUID: ${supabaseUserId} -> PostgreSQL user_id: ${typedResult.userId} (${typedResult.created ? '新建' : '已存在'})`)
    
    if (isMerged) {
      console.log(`[User Mapping] 🔄 帳號已合併: ${typedResult.message}`)
    }

    return typedResult.userId
    } catch (error) {
    console.error('[User Mapping] ❌ 獲取用戶 ID 失敗:', error)
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('連線逾時，請確認後端 API 是否正常運行')
      }
      if (error.message === 'Failed to fetch') {
        throw new Error(
          '無法連線至後端 API，請確認：1) 後端已啟動 2) API 網址正確（NEXT_PUBLIC_API_URL）3) 防火牆已開放 8000'
        )
      }
    }
    throw error
  }
}

