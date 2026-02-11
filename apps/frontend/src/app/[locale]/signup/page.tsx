'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Modal from '@/components/ui/Modal'

/**
 * 註冊頁面 - 支援多語言
 */
export default function SignupPage() {
  const t = useTranslations('auth.signup')
  const tCommon = useTranslations('common')
  const params = useParams()
  const locale = params.locale as string
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { signUp, signInWithGoogle } = useAuth()
  const router = useRouter()

  const handleGoogleSignIn = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const { error: googleError } = await signInWithGoogle()
      if (googleError) {
        setError(googleError.message || t('signupError'))
        setIsLoading(false)
      }
      // Google OAuth 會自動跳轉，不需要手動處理
    } catch (err) {
      setError(t('signupError'))
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // 驗證
    if (!email || !password || !confirmPassword) {
      setError(t('emailRequired'))
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError(t('passwordTooShort'))
      setIsLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError(t('passwordMismatch'))
      setIsLoading(false)
      return
    }

    try {
      const { error: signUpError } = await signUp(email, password)

      if (signUpError) {
        setError(signUpError.message || t('signupFailed'))
        setIsLoading(false)
      } else {
        // 註冊成功，顯示成功彈窗
        setIsLoading(false)
        setShowSuccessModal(true)
        // 清空表單
        setEmail('')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setError(t('signupError'))
      setIsLoading(false)
    }
  }

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false)
    router.push(`/${locale}/login`)
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

        {/* 註冊表單卡片 */}
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

            <Input
              label={t('password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              required
              autoComplete="new-password"
              disabled={isLoading}
            />

            <Input
              label={t('confirmPassword')}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmPasswordPlaceholder')}
              required
              autoComplete="new-password"
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

          {/* 登入連結 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {t('hasAccount')}{' '}
              <Link
                href={`/${locale}/login`}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {t('signIn')}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* 成功彈窗 */}
      <Modal
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        title={t('signupSuccess')}
        maxWidth="md"
        icon={
          <svg
            className="w-6 h-6 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        footer={
          <div className="flex justify-end">
            <Button
              onClick={handleCloseSuccessModal}
              variant="primary"
              size="lg"
            >
              {t('signIn')}
            </Button>
          </div>
        }
      >
        <div className="text-center py-4">
          <div className="mb-4 flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-10 h-10 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <p className="text-gray-700 text-lg leading-relaxed">
            {t('emailConfirmMessage')}
          </p>
        </div>
      </Modal>
    </div>
  )
}
