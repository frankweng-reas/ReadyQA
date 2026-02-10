'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import type { UserProfile } from '@/lib/api/user'
import { stripeApi } from '@/lib/api/stripe'
import { userApi } from '@/lib/api/user'
import { useNotification } from '@/hooks/useNotification'

interface PlanQuotaModalProps {
  userProfile: UserProfile | null
  isOpen: boolean
  onClose: () => void
}

export default function PlanQuotaModal({
  userProfile,
  isOpen,
  onClose,
}: PlanQuotaModalProps) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common')
  const notify = useNotification()
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)

  // 如果 modal 未開啟，不顯示
  if (!isOpen) {
    return null
  }

  // 如果沒有 userProfile 或 plan 資訊，顯示載入狀態或預設值
  const plan = userProfile?.tenant?.plan
  const quota = userProfile?.quota
  const subscription = userProfile?.subscription
  const isPaidPlan = plan?.code !== 'free' && plan?.code !== undefined
  
  // 訂閱狀態：是否已設定期末取消且仍在期內
  const isCancelScheduled = subscription?.cancelAtPeriodEnd && 
    (subscription?.status === 'active' || subscription?.status === 'trialing')

  const formatNumber = (num: number | null) => {
    if (num === null) return t('plan.unlimited')
    return num.toLocaleString()
  }

  const calculatePercentage = (current: number, max: number | null) => {
    if (max === null || max === 0) return 0
    return Math.min((current / max) * 100, 100)
  }

  const handleCancelSubscription = async () => {
    if (isCanceling) return

    try {
      setIsCanceling(true)
      // 固定使用期間結束時取消
      await stripeApi.cancelSubscription(true)
      
      notify.success(t('plan.cancelAtPeriodEndSuccess'))
      
      // 重新載入用戶資料
      const updatedProfile = await userApi.getProfile()
      if (updatedProfile) {
        // 透過父組件更新，這裡先關閉對話框
        setShowCancelDialog(false)
        // 延遲關閉 modal，讓用戶看到成功訊息
        setTimeout(() => {
          onClose()
          // 觸發頁面重新載入以更新資料
          window.location.reload()
        }, 1500)
      }
    } catch (error: any) {
      console.error('[PlanQuotaModal] Failed to cancel subscription:', error)
      notify.error(error.message || t('plan.cancelFailed'))
      setIsCanceling(false)
    }
  }

  const handleReactivateSubscription = async () => {
    if (isReactivating) return

    try {
      setIsReactivating(true)
      await stripeApi.reactivateSubscription()
      
      notify.success(t('plan.reactivateSuccess'))
      
      // 重新載入用戶資料
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error: any) {
      console.error('[PlanQuotaModal] Failed to reactivate subscription:', error)
      notify.error(error.message || t('plan.reactivateFailed'))
      setIsReactivating(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* Header */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {t('plan.title')}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {t('plan.subtitle')}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Plan Info */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-2 text-sm font-medium text-gray-500">
                {t('plan.currentPlan')}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {plan?.name || t('plan.freePlan')}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {plan?.code || 'free'}
                  </p>
                </div>
                {plan && plan.priceTwdMonthly > 0 && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ${plan.priceTwdMonthly.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      {t('plan.perMonth')}
                    </div>
                  </div>
                )}
              </div>

              {/* 訂閱取消狀態警告 */}
              {isCancelScheduled && subscription?.currentPeriodEnd && (
                <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-orange-900">
                        {t('plan.subscriptionStatus')}
                      </h4>
                      <p className="mt-1 text-sm text-orange-800">
                        {t('plan.subscriptionCancelScheduled', {
                          date: new Date(subscription.currentPeriodEnd).toLocaleDateString('zh-TW'),
                        })}
                      </p>
                      <p className="mt-1 text-xs text-orange-700">
                        {t('plan.subscriptionCancelScheduledDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quota Usage */}
            {quota && (
              <div className="space-y-5">
                <h3 className="text-lg font-semibold text-gray-900">
                  {t('plan.quotaUsage')}
                </h3>

                {/* Chatbots Quota */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {t('plan.chatbots')}
                    </span>
                    <span className="text-gray-600">
                      {quota.chatbots.current} / {formatNumber(quota.chatbots.max)}
                    </span>
                  </div>
                  {quota.chatbots.max !== null && (
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${calculatePercentage(
                            quota.chatbots.current,
                            quota.chatbots.max
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Total FAQs Quota */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {t('plan.faqsTotal')}
                    </span>
                    <span className="text-gray-600">
                      {quota.faqsTotal.current} / {formatNumber(quota.faqsTotal.max)}
                    </span>
                  </div>
                  {quota.faqsTotal.max !== null && (
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{
                          width: `${calculatePercentage(
                            quota.faqsTotal.current,
                            quota.faqsTotal.max
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Monthly Queries Quota */}
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {t('plan.queriesMonthly')}
                    </span>
                    <span className="text-gray-600">
                      {quota.queriesMonthly.current} / {formatNumber(quota.queriesMonthly.max)}
                    </span>
                  </div>
                  {quota.queriesMonthly.max !== null && (
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{
                          width: `${calculatePercentage(
                            quota.queriesMonthly.current,
                            quota.queriesMonthly.max
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Features */}
            {plan && (
              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  {t('plan.features')}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-5 w-5 rounded-full ${
                        plan.enableAnalytics
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm text-gray-700">
                      {t('plan.analytics')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-5 w-5 rounded-full ${
                        plan.enableApi ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm text-gray-700">
                      {t('plan.api')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-5 w-5 rounded-full ${
                        plan.enableExport
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm text-gray-700">
                      {t('plan.export')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              {/* 重新啟用訂閱按鈕（僅在已設定期末取消時顯示） */}
              {isCancelScheduled && (
                <button
                  onClick={handleReactivateSubscription}
                  disabled={isReactivating}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-green-300 bg-green-50 px-4 py-3 font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>{isReactivating ? tCommon('loading') : t('plan.reactivateSubscription')}</span>
                </button>
              )}

              {/* 取消訂閱按鈕（僅在有付費方案且未設定取消時顯示） */}
              {isPaidPlan && !isCancelScheduled && (
                <button
                  onClick={() => setShowCancelDialog(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 font-semibold text-red-600 transition-colors hover:bg-red-100"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span>{t('plan.cancelSubscription')}</span>
                </button>
              )}

              {/* 升級/變更方案按鈕 */}
              <button
                onClick={() => {
                  onClose()
                  router.push(`/${locale}/plans`)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                <span>{t('plan.upgrade')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Subscription Dialog */}
      {showCancelDialog && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black bg-opacity-50"
            onClick={() => !isCanceling && setShowCancelDialog(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="px-6 py-5">
                <h3 className="text-xl font-bold text-gray-900">
                  {t('plan.cancelSubscriptionTitle')}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {t('plan.cancelSubscriptionMessage')}
                </p>
              </div>

              <div className="px-6 py-4">
                <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0"
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
                      <div className="font-medium text-gray-900">
                        {t('plan.cancelAtPeriodEnd')}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {t('plan.cancelAtPeriodEndDesc')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  disabled={isCanceling}
                  className="flex-1 px-4 py-3 text-base font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={isCanceling}
                  className="flex-1 px-4 py-3 text-base font-medium text-white bg-orange-600 rounded-xl hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCanceling ? tCommon('loading') : t('plan.confirmCancel')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {notify.ConfirmDialog}
    </>
  )
}
