'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-provider'
import { stripeApi, type Plan } from '@/lib/api/stripe'
import { userApi, type UserProfile } from '@/lib/api/user'
import { useNotification } from '@/hooks/useNotification'

export default function PlansPage() {
  const t = useTranslations('plans')
  const tCommon = useTranslations('common')
  const notify = useNotification()
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [plans, setPlans] = useState<Plan[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [processingPlan, setProcessingPlan] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login`)
    }
  }, [user, loading, router, locale])

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  // 檢查付款成功/取消參數
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      notify.success(t('upgradeSuccess'))
      // 重新載入用戶資料
      loadUserProfile()
      // 清除 URL 參數
      window.history.replaceState({}, '', `/${locale}/plans`)
    } else if (urlParams.get('canceled') === 'true') {
      notify.info(t('upgradeCanceled'))
      // 清除 URL 參數
      window.history.replaceState({}, '', `/${locale}/plans`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  const loadData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([loadPlans(), loadUserProfile()])
    } catch (error) {
      console.error('[PlansPage] Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadPlans = async () => {
    try {
      const data = await stripeApi.getPlans()
      setPlans(data)
    } catch (error) {
      console.error('[PlansPage] Failed to load plans:', error)
      notify.error(t('loadPlansFailed'))
    }
  }

  const loadUserProfile = async () => {
    try {
      const profile = await userApi.getProfile()
      if (profile) {
        setUserProfile(profile)
      }
    } catch (error) {
      console.error('[PlansPage] Failed to load user profile:', error)
    }
  }

  const handleUpgrade = async (planCode: string) => {
    if (processingPlan) return

    try {
      setProcessingPlan(planCode)
      
      // 確保 URL 格式正確
      const successUrl = new URL(`/${locale}/plans?success=true`, window.location.origin).href
      const cancelUrl = new URL(`/${locale}/plans?canceled=true`, window.location.origin).href

      const result = await stripeApi.createCheckoutSession(planCode, successUrl, cancelUrl)

      if (result && result.url) {
        // 檢查是否為升級（URL 是 successUrl 而不是 Stripe Checkout URL）
        if (result.url.includes(window.location.origin)) {
          // 這是升級，直接導向成功頁面
          window.location.href = result.url
        } else {
          // 這是新訂閱，導向 Stripe Checkout
          window.location.href = result.url
        }
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error: any) {
      console.error('[PlansPage] Failed to create checkout session:', error)
      const errorMessage = error?.message || t('createCheckoutFailed')
      console.error('[PlansPage] Error details:', {
        message: errorMessage,
        planCode,
        error: error,
      })
      notify.error(errorMessage)
      setProcessingPlan(null)
    }
  }

  const currentPlanCode = userProfile?.tenant?.planCode || 'free'
  
  // 定義方案等級（用於判斷升級或降級）
  const planTiers: { [key: string]: number } = {
    'free': 0,
    'starter': 1,
    'pro': 2,
    'enterprise': 3,
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-gray-600">{tCommon('loading')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
              <p className="mt-2 text-gray-600">{t('subtitle')}</p>
            </div>
            <button
              onClick={() => router.push(`/${locale}/dashboard`)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {tCommon('back')}
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isCurrentPlan = plan.code === currentPlanCode
            const isFree = plan.code === 'free'
            
            // 判斷升級或降級
            const currentTier = planTiers[currentPlanCode] || 0
            const targetTier = planTiers[plan.code] || 0
            const isUpgrade = targetTier > currentTier
            const isDowngrade = targetTier < currentTier && targetTier > 0 // 排除降到 free
            const canChange = !isCurrentPlan && !isFree && plan.stripePriceId && (isUpgrade || isDowngrade)

            return (
              <div
                key={plan.code}
                className={`relative rounded-2xl border-2 bg-white p-8 shadow-lg transition-all ${
                  isCurrentPlan
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-blue-500 px-4 py-1 text-base font-semibold text-white">
                      {t('currentPlan')}
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-6 text-center">
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                </div>

                {/* Price */}
                <div className="mb-6 text-center">
                  <div className="text-4xl font-bold text-gray-900">
                    ${plan.priceTwdMonthly.toLocaleString()}
                  </div>
                  <div className="mt-1 text-base text-gray-600">{t('perMonth')}</div>
                </div>

                {/* Features */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between text-base">
                    <span className="text-gray-600">{t('maxChatbots')}</span>
                    <span className="font-medium text-gray-900">
                      {plan.maxChatbots === null ? t('unlimited') : plan.maxChatbots}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-base">
                    <span className="text-gray-600">{t('maxFaqsPerBot')}</span>
                    <span className="font-medium text-gray-900">
                      {plan.maxFaqsPerBot === null ? t('unlimited') : plan.maxFaqsPerBot}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-base">
                    <span className="text-gray-600">{t('maxQueriesPerMo')}</span>
                    <span className="font-medium text-gray-900">
                      {plan.maxQueriesPerMo === null ? t('unlimited') : plan.maxQueriesPerMo.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Feature Icons */}
                <div className="mb-6 space-y-2 border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2 text-base">
                    <div
                      className={`h-4 w-4 rounded-full ${
                        plan.enableAnalytics ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-gray-700">{t('analytics')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-base">
                    <div
                      className={`h-4 w-4 rounded-full ${
                        plan.enableApi ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-gray-700">{t('api')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-base">
                    <div
                      className={`h-4 w-4 rounded-full ${
                        plan.enableExport ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-gray-700">{t('export')}</span>
                  </div>
                </div>

                {/* 降級說明（僅在降級時顯示） */}
                {isDowngrade && (
                  <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                    <div className="flex items-start gap-2">
                      <svg
                        className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-yellow-900">
                          {t('downgradeWarning')}
                        </h4>
                        <p className="mt-1 text-base text-yellow-800">
                          {t('downgradeWarningDesc')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-6">
                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full rounded-lg bg-gray-100 px-4 py-3 font-semibold text-gray-400"
                    >
                      {t('currentPlanButton')}
                    </button>
                  ) : isFree ? (
                    <button
                      disabled
                      className="w-full rounded-lg bg-gray-100 px-4 py-3 font-semibold text-gray-400"
                    >
                      {t('freePlan')}
                    </button>
                  ) : canChange ? (
                    <button
                      onClick={() => handleUpgrade(plan.code)}
                      disabled={!!processingPlan}
                      className={`w-full rounded-lg px-4 py-3 font-semibold text-white transition-colors ${
                        processingPlan === plan.code
                          ? isUpgrade
                            ? 'bg-blue-400 cursor-not-allowed'
                            : 'bg-orange-400 cursor-not-allowed'
                          : isUpgrade
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      {processingPlan === plan.code 
                        ? tCommon('loading') 
                        : isUpgrade 
                          ? t('upgradeButton') 
                          : t('downgradeButton')}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full rounded-lg bg-gray-100 px-4 py-3 font-semibold text-gray-400"
                    >
                      {t('comingSoon')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
