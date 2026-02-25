'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * 登入頁面 - 支援多語言
 */
export default function LoginPage() {
  const t = useTranslations('auth.login')
  const tCommon = useTranslations('common')
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = params.locale as string

  // 從 URL 讀取 auth callback 導向的錯誤訊息（例如確認連結過期）
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const urlError = searchParams.get('error') || searchParams.get('message')
    if (urlError) {
      const decoded = decodeURIComponent(urlError)
      setError(decoded === 'session_expired' ? t('sessionExpired') : decoded)
    }
  }, [searchParams, t])

  // 測試帳號：自動填入方便測試
  const [email, setEmail] = useState('test01@test.com')
  const [password, setPassword] = useState('123456')
  const [isLoading, setIsLoading] = useState(false)
  const { signIn, signInWithGoogle } = useAuth()
  const router = useRouter()

  const handleGoogleSignIn = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const { error: googleError } = await signInWithGoogle()
      if (googleError) {
        setError(googleError.message || t('loginError'))
        setIsLoading(false)
      }
      // Google OAuth 會自動跳轉，不需要手動處理
    } catch (err) {
      setError(t('loginError'))
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!email || !password) {
      setError(t('emailRequired'))
      setIsLoading(false)
      return
    }

    try {
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        setError(signInError.message || t('loginFailed'))
        setIsLoading(false)
      } else {
        // 登入成功，手動跳轉到 dashboard
        router.push(`/${locale}/dashboard`)
      }
    } catch (err) {
      setError(t('loginError'))
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <Link
            href="/"
            className="inline-block transition-opacity hover:opacity-80"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ReadQA_logo_1.png"
              alt=""
              className="h-24 w-auto max-w-[280px] object-contain"
              width={280}
              height={96}
            />
          </Link>
        </div>

        {/* 登入表單卡片 */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          {/* 錯誤訊息 */}
          {error && (
            <div
              className="mb-6 rounded-lg border-l-4 border-red-400 bg-red-50 p-4"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Google 登入按鈕 */}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleGoogleSignIn}
            isLoading={isLoading}
            className="mb-6 w-full border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t('continueWithGoogle')}
          </Button>

          {/* 分隔線 */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">{t('or')}</span>
            </div>
          </div>

          {/* 表單 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              autoComplete="email"
              disabled={isLoading}
            />

            <div className="space-y-2">
              <Input
                label={t('password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <div className="flex justify-end">
                <Link
                  href={`/${locale}/forgot-password`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
            >
              {isLoading ? tCommon('loading') : t('submit')}
            </Button>
          </form>

          {/* 註冊連結 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('noAccount')}{' '}
              <Link
                href={`/${locale}/signup`}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t('signUp')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
