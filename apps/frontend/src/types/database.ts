/**
 * Supabase 資料庫型別定義
 * 可使用 supabase gen types typescript 自動生成
 */
export type Database = {
  public: {
    Tables: {
      // 這裡可以加入其他 table 的型別定義
    }
  }
}

/**
 * 用戶型別
 */
export interface User {
  id: string
  email: string
  role?: string
  created_at: string
}

