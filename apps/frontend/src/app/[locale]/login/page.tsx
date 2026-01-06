'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  const locale = params.locale as string
  
  // 測試帳號：自動填入方便測試
  const [email, setEmail] = useState('test01@test.com')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

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
        {/* Logo 和標題 */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-block transition-opacity hover:opacity-80"
          >
            <h1 className="mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent">
              {tCommon('appName')}
            </h1>
          </Link>
          <p className="text-lg text-gray-600">{t('title')}</p>
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
                href="/signup"
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t('signUp')}
              </Link>
            </p>
          </div>
        </div>

        {/* 測試帳號提示 */}
        <div className="mt-4 rounded-lg bg-blue-50 p-4 text-center">
          <p className="mb-1 text-sm font-medium text-blue-800">
            {t('testAccountInfo')}
          </p>
          <p className="text-sm text-blue-700">
            {t('testAccountEmail')}
          </p>
          <p className="text-sm text-blue-700">
            {t('testAccountPassword')}
          </p>
        </div>
      </div>
    </div>
  )
}
