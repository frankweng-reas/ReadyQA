'use client'

import { useTranslations } from 'next-intl'
import type { UserProfile } from '@/lib/api/user'

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

  if (!isOpen || !userProfile?.tenant?.plan) {
    return null
  }

  const plan = userProfile.tenant.plan
  const quota = userProfile.quota

  const formatNumber = (num: number | null) => {
    if (num === null) return t('plan.unlimited')
    return num.toLocaleString()
  }

  const calculatePercentage = (current: number, max: number | null) => {
    if (max === null || max === 0) return 0
    return Math.min((current / max) * 100, 100)
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
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {plan.code}
                  </p>
                </div>
                {plan.priceTwdMonthly > 0 && (
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

            {/* Upgrade Link */}
            <div className="mt-6">
              <a
                href="https://example.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <span>{t('plan.upgrade')}</span>
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
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
