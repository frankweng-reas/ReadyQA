'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * 重設密碼頁面 - 用戶從重設密碼郵件連結進入後，在此設定新密碼
 */
export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword')
  const tCommon = useTranslations('common')
  const params = useParams()
  const router = useRouter()
  const locale = params.locale as string

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { user, loading: authLoading, updatePassword } = useAuth()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}/login?message=${encodeURIComponent('session_expired')}`)
    }
  }, [user, authLoading, router, locale])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!password || password.length < 6) {
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
      const { error: updateError } = await updatePassword(password)

      if (updateError) {
        setError(updateError.message || t('updateFailed'))
        setIsLoading(false)
      } else {
        setSuccess(true)
        setIsLoading(false)
      }
    } catch (err) {
      setError(t('updateFailed'))
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <p className="text-gray-600">{tCommon('loading')}</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white p-8 shadow-xl">
            <div className="mb-6 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
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
            <h2 className="mb-4 text-center text-xl font-semibold text-gray-800">
              {t('successTitle')}
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              {t('successMessage')}
            </p>
            <Link
              href={`/${locale}/login`}
              className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-blue-700"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="inline-block transition-opacity hover:opacity-80">
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

        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-2 text-center text-xl font-semibold text-gray-800">
            {t('title')}
          </h2>
          <p className="mb-6 text-center text-sm text-gray-600">
            {t('description')}
          </p>

          {error && (
            <div
              className="mb-6 rounded-lg border-l-4 border-red-400 bg-red-50 p-4"
              role="alert"
            >
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label={t('newPassword')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('newPasswordPlaceholder')}
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

          <div className="mt-6 text-center">
            <Link
              href={`/${locale}/login`}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              {t('backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
