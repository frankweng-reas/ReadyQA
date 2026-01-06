'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getOrCreateUserId } from './user-mapping'

interface AuthContextType {
  user: User | null
  postgresUserId: number | null // 新增：PostgreSQL user_id
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Auth Provider - 提供認證狀態和方法
 * 
 * 改進點：
 * 1. 完整的 TypeScript 型別
 * 2. 錯誤處理更完善
 * 3. 效能優化（減少不必要的重渲染）
 * 4. 自動建立 tenant
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [postgresUserId, setPostgresUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // 統一處理用戶映射邏輯
  const handleUserMapping = async (user: User | null) => {
    if (!user) {
      setPostgresUserId(null)
      return
    }

    try {
      const userId = await getOrCreateUserId(
        user.id,
        user.email,
        user.user_metadata?.name || user.email?.split('@')[0]
      )
      setPostgresUserId(userId)
      console.log('[AuthProvider] PostgreSQL user_id:', userId)
    } catch (error) {
      console.error('[AuthProvider] 創建用戶記錄失敗:', error)
      setPostgresUserId(null)
    }
  }

  useEffect(() => {
    // 檢查初始 session
    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        
        // 確保 PostgreSQL 有對應記錄
        await handleUserMapping(session?.user ?? null)
      } catch (error) {
        console.error('Failed to get session:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // 監聽認證狀態變化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state changed:', event, session?.user?.email)
      setUser(session?.user ?? null)
      
      // 確保 PostgreSQL 有對應記錄
      await handleUserMapping(session?.user ?? null)
      
      setLoading(false)
      
      // 移除自動跳轉邏輯，避免離開/回來瀏覽器時誤觸發
      // 登入跳轉由 login page 的 signIn 成功後處理
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { error }
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('登入失敗'),
      }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setPostgresUserId(null)
    // 使用預設 locale
    router.push('/zh-TW/login')
  }

  const value = {
    user,
    postgresUserId,
    loading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * useAuth Hook - 取得認證狀態
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

