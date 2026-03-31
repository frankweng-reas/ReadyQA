'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { getOrCreateUserId } from './user-mapping'

/** 後端 get-or-create-user 是否已嘗試完畢（避免 mapping 失敗時 isLoading 永遠 true） */
export type UserMappingStatus = 'idle' | 'loading' | 'done'

/** 初始化時 getSession 逾時或 Supabase 回傳錯誤（例如專案暫停）— 不應讓 loading 永遠 true */
export type SessionInitErrorKind = 'timeout' | 'supabase_error' | null

/** 逾時略大於 middleware / SSR 合理等待，避免 Supabase 暫慢就誤判 */
const SESSION_INIT_TIMEOUT_MS = 12_000

interface AuthContextType {
  user: User | null
  postgresUserId: number | null // 新增：PostgreSQL user_id
  /** Supabase 已就緒後，後端 user 映射進行中／已結束 */
  userMappingStatus: UserMappingStatus
  /** 首次 getSession 失敗或逾時；成功連線後會清除 */
  sessionInitError: SessionInitErrorKind
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const AUTH_SYNC_CHANNEL = 'qaplus-auth-sync'

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
  const [userMappingStatus, setUserMappingStatus] =
    useState<UserMappingStatus>('idle')
  const [sessionInitError, setSessionInitError] =
    useState<SessionInitErrorKind>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  /** 單一 browser client；勿每次 render 建立新實例，否則 useEffect 會反覆重跑、認證狀態異常 */
  const supabase = useMemo(() => createClient(), [])

  // 統一處理用戶映射邏輯
  const handleUserMapping = async (user: User | null) => {
    if (!user) {
      setPostgresUserId(null)
      setUserMappingStatus('idle')
      return
    }

    try {
      console.log('[AuthProvider] Starting user mapping for:', user.email, 'UUID:', user.id)
      const userId = await getOrCreateUserId(
        user.id,
        user.email,
        user.user_metadata?.name || user.email?.split('@')[0]
      )
      setPostgresUserId(userId)
      console.log('[AuthProvider] PostgreSQL user_id:', userId)
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error('[AuthProvider] 創建用戶記錄失敗:', errMsg, error)
      setPostgresUserId(null)
    } finally {
      setUserMappingStatus('done')
    }
  }

  useEffect(() => {
    // 檢查初始 session
    const initAuth = async () => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      try {
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('AUTH_SESSION_TIMEOUT')),
            SESSION_INIT_TIMEOUT_MS
          )
        })
        const {
          data: { session },
          error: sessionError,
        } = (await Promise.race([sessionPromise, timeoutPromise])) as Awaited<
          ReturnType<typeof supabase.auth.getSession>
        >
        if (timeoutId) clearTimeout(timeoutId)

        if (sessionError) {
          console.error('[AuthProvider] getSession error:', sessionError.message)
          setSessionInitError('supabase_error')
          setUser(null)
          setPostgresUserId(null)
          setUserMappingStatus('idle')
          setLoading(false)
          return
        }

        setSessionInitError(null)

        if (session?.user) {
          console.log('[AuthProvider] Supabase 專案:', process.env.NEXT_PUBLIC_SUPABASE_URL)
          console.log('[AuthProvider] Supabase User ID:', session.user.id, '(請用此 ID 在 Supabase SQL Editor 查詢: SELECT * FROM auth.users WHERE id = \'' + session.user.id + '\')')
        }
        setUser(session?.user ?? null)
        // 先結束 loading，避免 API 慢或失敗時卡在轉圈圈
        setLoading(false)
        if (session?.user) {
          setUserMappingStatus('loading')
        } else {
          setUserMappingStatus('idle')
        }
        void handleUserMapping(session?.user ?? null)
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId)
        if (error instanceof Error && error.message === 'AUTH_SESSION_TIMEOUT') {
          console.error(
            '[AuthProvider] getSession 逾時（常見：Supabase 專案暫停、DNS、網路不穩）'
          )
          setSessionInitError('timeout')
        } else {
          console.error('[AuthProvider] Failed to get session:', error)
          setSessionInitError('supabase_error')
        }
        setUser(null)
        setPostgresUserId(null)
        setUserMappingStatus('idle')
        setLoading(false)
      }
    }

    initAuth()

    // 監聽認證狀態變化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthProvider] Auth state changed:', event, session?.user?.email)
      if (session?.user) {
        setSessionInitError(null)
        console.log('[AuthProvider] Supabase 專案:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log('[AuthProvider] Supabase User ID:', session.user.id, '(請用此 ID 在 Supabase SQL Editor 查詢: SELECT * FROM auth.users WHERE id = \'' + session.user.id + '\')')
      }
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) {
        setUserMappingStatus('loading')
      } else {
        setUserMappingStatus('idle')
      }
      void handleUserMapping(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  // 跨分頁登出同步：監聽其他分頁的登出事件
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL)
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'LOGOUT') {
        setUser(null)
        setPostgresUserId(null)
        setUserMappingStatus('idle')
        setSessionInitError(null)
        const pathParts = window.location.pathname.split('/').filter(Boolean)
        const locale = pathParts[0] || 'zh-TW'
        router.push(`/${locale}/login`)
      }
    }

    return () => {
      channel.close()
    }
  }, [router])

  const signIn = async (email: string, password: string) => {
    setSessionInitError(null)
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

  const signUp = async (email: string, password: string, name?: string) => {
    setSessionInitError(null)
    try {
      // emailRedirectTo：確認信連結點擊後導向的 URL，需在 Supabase Redirect URLs 白名單中
      const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []
      const locale = pathParts[0] || 'zh-TW'
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/${locale}/auth/callback`
          : undefined

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
          },
          ...(redirectTo && { emailRedirectTo: redirectTo }),
        },
      })

      if (error) {
        console.error('[AuthProvider] signUp error:', error.message)
        return { error }
      }

      // 若需 email 確認，data.user 存在但 data.session 可能為 null
      if (data?.user && !data?.session) {
        console.log('[AuthProvider] 註冊成功，請至信箱點擊確認連結')
      }
      return { error: null }
    } catch (error) {
      console.error('[AuthProvider] signUp exception:', error)
      return {
        error: error instanceof Error ? error : new Error('註冊失敗'),
      }
    }
  }

  const signInWithGoogle = async () => {
    setSessionInitError(null)
    try {
      if (typeof window === 'undefined') {
        return { error: new Error('Google 登入只能在客戶端執行') }
      }

      // 從當前 URL 獲取 locale（格式：/zh-TW/login 或 /en/signup）
      const pathParts = window.location.pathname.split('/').filter(Boolean)
      const locale = pathParts[0] || 'zh-TW'
      const redirectTo = `${window.location.origin}/${locale}/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      })

      if (error) {
        return { error }
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Google 登入失敗'),
      }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setPostgresUserId(null)
    setUserMappingStatus('idle')
    setSessionInitError(null)

    // 通知其他分頁同步登出
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL)
      channel.postMessage({ type: 'LOGOUT' })
      channel.close()
    }

    const pathParts = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []
    const locale = pathParts[0] || 'zh-TW'
    router.push(`/${locale}/login`)
  }

  const resetPasswordForEmail = async (email: string) => {
    try {
      if (typeof window === 'undefined') {
        return { error: new Error('忘記密碼只能在客戶端執行') }
      }

      const pathParts = window.location.pathname.split('/').filter(Boolean)
      const locale = pathParts[0] || 'zh-TW'
      const redirectTo = `${window.location.origin}/${locale}/auth/reset-callback`

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) {
        return { error }
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('發送重設密碼郵件失敗'),
      }
    }
  }

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) {
        return { error }
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('更新密碼失敗'),
      }
    }
  }

  const value = {
    user,
    postgresUserId,
    userMappingStatus,
    sessionInitError,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPasswordForEmail,
    updatePassword,
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

