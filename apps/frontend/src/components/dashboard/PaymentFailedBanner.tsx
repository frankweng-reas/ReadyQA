'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { stripeApi, type PaymentFailedInfo } from '@/lib/api/stripe'
import { useNotification } from '@/hooks/useNotification'

export default function PaymentFailedBanner() {
  const t = useTranslations('paymentFailed')
  const tCommon = useTranslations('common')
  const notify = useNotification()
  
  const [paymentInfo, setPaymentInfo] = useState<PaymentFailedInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadPaymentFailedInfo()
  }, [])

  const loadPaymentFailedInfo = async () => {
    try {
      setIsLoading(true)
      const info = await stripeApi.getPaymentFailedInfo()
      setPaymentInfo(info)
    } catch (error) {
      console.error('[PaymentFailedBanner] Failed to load payment info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdatePaymentMethod = async () => {
    try {
      setIsUpdating(true)
      
      // 調用後端 API 創建 Billing Portal Session
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        notify.error(tCommon('error'))
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const response = await fetch(`${API_URL}/stripe/create-billing-portal-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create billing portal session')
      }

      const result = await response.json()
      
      if (result.success && result.url) {
        // 重定向到 Stripe Billing Portal
        window.location.href = result.url
      } else {
        throw new Error('Invalid response from server')
      }
    } catch (error) {
      console.error('[PaymentFailedBanner] Error creating billing portal session:', error)
      notify.error(t('updateFailed'))
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return null
  }

  // 如果沒有付款失敗，不顯示 banner
  if (!paymentInfo || !paymentInfo.hasFailedPayment) {
    return null
  }

  const latestFailedInvoice = paymentInfo.failedInvoices[0]

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
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
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-base font-medium text-yellow-800">
            {t('warningTitle')}
          </h3>
          
          <div className="mt-2 text-base text-yellow-700">
            <p>{t('message')}</p>
            <p className="mt-1">{t('gracePeriodMessage')}</p>
          </div>

          {latestFailedInvoice && latestFailedInvoice.nextRetryAt && (
            <p className="mt-2 text-base text-yellow-700">
              {t('nextRetryAt', {
                date: new Date(latestFailedInvoice.nextRetryAt).toLocaleString('zh-TW'),
              })}
            </p>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={handleUpdatePaymentMethod}
              disabled={isUpdating}
              className={`rounded-md px-4 py-2 text-base font-medium text-white transition-colors ${
                isUpdating
                  ? 'bg-yellow-400 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              {isUpdating ? t('updatingPaymentMethod') : t('updatePaymentMethod')}
            </button>

            <button
              onClick={() => setShowDetails(!showDetails)}
              className="rounded-md border border-yellow-600 px-4 py-2 text-base font-medium text-yellow-600 transition-colors hover:bg-yellow-100"
            >
              {t('viewDetails')}
            </button>
          </div>

          {showDetails && latestFailedInvoice && (
            <div className="mt-4 rounded-lg bg-white p-4 shadow">
              <h4 className="text-base font-semibold text-gray-900">
                {t('invoiceDetails')}
              </h4>
              <dl className="mt-2 space-y-2 text-base">
                <div className="flex justify-between">
                  <dt className="text-gray-600">{t('amount')}:</dt>
                  <dd className="font-medium text-gray-900">
                    ${latestFailedInvoice.amount} {latestFailedInvoice.currency}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">{t('failedAt')}:</dt>
                  <dd className="font-medium text-gray-900">
                    {new Date(latestFailedInvoice.failedAt).toLocaleString('zh-TW')}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">{t('reason')}:</dt>
                  <dd className="font-medium text-gray-900">
                    {latestFailedInvoice.reason}
                  </dd>
                </div>
              </dl>
              
              <p className="mt-4 text-base text-gray-600">
                {t('retryInfo')}
              </p>
            </div>
          )}
        </div>

        <div className="ml-auto flex-shrink-0">
          <button
            onClick={() => {
              // 關閉 banner（可以保存到 localStorage 避免重複顯示）
              setPaymentInfo(null)
            }}
            className="inline-flex rounded-md p-1.5 text-yellow-500 hover:bg-yellow-100 focus:outline-none"
          >
            <span className="sr-only">{tCommon('cancel')}</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
