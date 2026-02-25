'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * 忘記密碼頁面 - 輸入 Email 發送重設密碼連結
 */
export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword')
  const tCommon = useTranslations('common')
  const params = useParams()
  const locale = params.locale as string

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { resetPasswordForEmail } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!email.trim()) {
      setError(t('emailRequired'))
      setIsLoading(false)
      return
    }

    try {
      const { error: resetError } = await resetPasswordForEmail(email.trim())

      if (resetError) {
        setError(resetError.message || t('sendFailed'))
        setIsLoading(false)
      } else {
        setSuccess(true)
        setIsLoading(false)
      }
    } catch (err) {
      setError(t('sendFailed'))
      setIsLoading(false)
    }
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
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="mb-4 text-center text-xl font-semibold text-gray-800">
              {t('checkEmail')}
            </h2>
            <p className="mb-6 text-center text-sm text-gray-600">
              {t('checkEmailMessage')}
            </p>
            <Link
              href={`/${locale}/login`}
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50"
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
              label={t('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              required
              autoComplete="email"
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
