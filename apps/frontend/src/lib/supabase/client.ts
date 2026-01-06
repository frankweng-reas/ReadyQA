import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * 建立 Supabase 瀏覽器客戶端
 * 用於客戶端組件中的認證和資料存取
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

