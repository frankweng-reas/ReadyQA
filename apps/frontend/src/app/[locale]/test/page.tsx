'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/auth-provider'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { stripeApi } from '@/lib/api/stripe'
import TestSidebar from '@/components/test/TestSidebar'

type TestView = 'subscription' | 'other'
type SubscriptionTab = 'create' | 'upgrade' | 'payment-failed'

interface DebugData {
  tenant: {
    id: string
    name: string
    planCode: string
    stripeCustomerId: string | null
  }
  subscriptions: Array<{
    id: string
    planCode: string
    status: string
    stripeSubscriptionId: string
    createdAt: string
    cancelAtPeriodEnd?: boolean
  }>
  stripeSubscriptions?: Array<{
    id: string
    status: string
    planCode: string | null
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    canceledAt: string | null
    priceId: string | null
    priceAmount: number | null
    priceCurrency: string | null
    customerId: string | null
    metadata: Record<string, any>
    hasPendingPriceChange?: boolean
    nextPeriodPlanCode?: string | null
    previousPlanCode?: string | null
    nextPeriodStart?: string | null
    nextPeriodEnd?: string | null
    error?: string
  }>
  payments: Array<{
    id: string
    amount: number
    currency: string
    status: string
    createdAt: string
  }>
}

export default function TestPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const t = useTranslations('test')
  const [currentView, setCurrentView] = useState<TestView>('subscription')
  const [activeSubscriptionTab, setActiveSubscriptionTab] = useState<SubscriptionTab>('create')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processLog, setProcessLog] = useState<string[]>([])
  const [data, setData] = useState<DebugData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [showChecklist, setShowChecklist] = useState(false)
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; label: string; checked: boolean }>>([])

  // 載入數據
  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  // 載入測試清單
  useEffect(() => {
    const STORAGE_KEY = 'testChecklist'
    const defaultItems = [
      { id: '1', label: '清除測試資料 → 新增 Starter 訂閱' },
      { id: '2', label: '清除測試資料 → 新增 Pro 訂閱' },
      { id: '3', label: '清除測試資料 → 新增 Enterprise 訂閱' },
      { id: '4', label: 'Starter → 升級到 Pro' },
      { id: '5', label: 'Starter → 升級到 Enterprise' },
      { id: '6', label: 'Pro → 升級到 Enterprise' },
      { id: '7', label: 'Enterprise → 降級到 Pro' },
      { id: '8', label: 'Enterprise → 降級到 Starter' },
      { id: '9', label: 'Pro → 降級到 Starter' },
      { id: '10', label: '任何方案 → 降級到 Free（取消訂閱）' },
      { id: '11', label: '續訂測試 → 快轉一個月' },
    ]

    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const savedItems = JSON.parse(saved)
        // 合併新項目：如果 defaultItems 中有新項目，添加到 savedItems
        const savedIds = new Set(savedItems.map((item: { id: string }) => item.id))
        const newItems = defaultItems
          .filter(item => !savedIds.has(item.id))
          .map(item => ({ ...item, checked: false }))
        const mergedItems = [...savedItems, ...newItems]
        setChecklistItems(mergedItems)
        // 更新 localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedItems))
      } catch (error) {
        console.error('[TestPage] Failed to load checklist:', error)
        setChecklistItems(defaultItems.map(item => ({ ...item, checked: false })))
      }
    } else {
      setChecklistItems(defaultItems.map(item => ({ ...item, checked: false })))
    }
  }, [])

  // 切換清單項目
  const toggleChecklistItem = (id: string) => {
    const STORAGE_KEY = 'testChecklist'
    const updated = checklistItems.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    )
    setChecklistItems(updated)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('[TestPage] Failed to save checklist:', error)
    }
  }

  // 從 sessionStorage 恢復處理日誌
  useEffect(() => {
    const savedLogs = sessionStorage.getItem('testPageProcessLog')
    if (savedLogs) {
      try {
        const logs = JSON.parse(savedLogs)
        setProcessLog(logs)
        // 清除 sessionStorage
        sessionStorage.removeItem('testPageProcessLog')
      } catch (error) {
        console.error('[TestPage] Failed to restore process log:', error)
      }
    }
  }, [])

  // 檢查付款成功/取消參數
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      const addLog = (msg: string) => {
        console.log(msg)
        setProcessLog(prev => {
          const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
          // 保存到 sessionStorage
          sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
          return newLogs
        })
      }
      addLog('✅ 訂閱成功！')
      // 清除 URL 參數並重新載入數據
      window.history.replaceState({}, '', window.location.pathname)
      loadData()
    } else if (urlParams.get('canceled') === 'true') {
      const addLog = (msg: string) => {
        console.log(msg)
        setProcessLog(prev => {
          const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
          // 保存到 sessionStorage
          sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
          return newLogs
        })
      }
      addLog('❌ 已取消訂閱')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const loadData = async () => {
    try {
      setIsLoadingData(true)
      setDataError(null)

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setDataError('未找到登入憑證，請重新登入')
        setIsLoadingData(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/debug/user-data`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        setDataError(`API 錯誤 (${response.status}): ${text}`)
        setIsLoadingData(false)
        return
      }

      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setDataError(result.message || '載入失敗')
      }
    } catch (err: any) {
      console.error('[TestPage] Error loading data:', err)
      setDataError(`錯誤: ${err.message || '未知錯誤'}`)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handleCreateSubscription = async (planCode: string) => {
    if (isProcessing) return

    setIsProcessing(true)
    setProcessLog([])
    // 清除之前的 sessionStorage
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => {
        const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
        // 保存到 sessionStorage
        sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
        return newLogs
      })
    }

    try {
      addLog(`🚀 開始訂閱 ${planCode}`)

      const locale = params.locale as string
      const successUrl = `${window.location.origin}/${locale}/test?success=true`
      const cancelUrl = `${window.location.origin}/${locale}/test?canceled=true`

      addLog(`📡 調用 API: createCheckoutSession`)

      const result = await stripeApi.createCheckoutSession(planCode, successUrl, cancelUrl)

      addLog(`📦 結果: success=true, has_url=${!!result?.url}`)

      if (result && result.url) {
        addLog(`✓ 取得 URL: ${result.url.substring(0, 50)}...`)

        // 檢查是否為本地 success URL（代表直接升級）或 Stripe URL（代表新訂閱）
        if (result.url.includes(window.location.origin)) {
          addLog('✓ 直接升級成功，重新載入數據...')
          // 清除 URL 參數並重新載入數據
          setTimeout(() => {
            window.history.replaceState({}, '', window.location.pathname)
            loadData()
            setIsProcessing(false)
          }, 1000)
        } else {
          addLog('✓ 準備跳轉到 Stripe 付款頁面...')
          // 跳轉到 Stripe Checkout 前，確保日誌已保存到 sessionStorage
          // 日誌會在 addLog 中自動保存
          setTimeout(() => {
            window.location.href = result.url
          }, 1000)
        }
      } else {
        addLog(`❌ 失敗: 未取得 URL`)
        setIsProcessing(false)
      }
    } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Create subscription error:', err)
      setIsProcessing(false)
    }
  }

  const handleCreateTestClockSubscription = async (planCode: string) => {
    if (isProcessing) return

    setIsProcessing(true)
    setProcessLog([])
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => {
        const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
        sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
        return newLogs
      })
    }

    try {
      addLog(`⏰ 開始創建 Test Clock 訂閱: ${planCode}`)

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        addLog('❌ 未找到登入憑證')
        setIsProcessing(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/test-clock/create-subscription`

      addLog(`📡 調用 API: ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planCode }),
      })

      addLog(`📥 收到回應: ${response.status}`)

      if (!response.ok) {
        const text = await response.text()
        addLog(`❌ API 錯誤: ${text}`)
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      addLog(`📦 結果: ${JSON.stringify(result.data)}`)

      if (result.success) {
        addLog(`✓ 訂閱創建成功！`)
        addLog(`  - Subscription ID: ${result.data.subscriptionId}`)
        addLog(`  - Customer ID: ${result.data.customerId}`)
        addLog(`  - Test Clock ID: ${result.data.testClockId}`)
        addLog(`⏳ 等待 webhook 處理（約 2-3 秒）...`)

        // 等待 webhook 處理完成後再載入數據
        setTimeout(async () => {
          addLog(`🔄 開始載入數據...`)
          await loadData()
          addLog(`✓ 數據載入完成`)
          setIsProcessing(false)
        }, 3000)
      } else {
        addLog(`❌ 失敗: ${result.message || '未知錯誤'}`)
        setIsProcessing(false)
      }
      } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Test Clock subscription error:', err)
      setIsProcessing(false)
    }
  }

  const handleAdvanceTestClock = async (months: number = 1) => {
    if (isProcessing) return

    setIsProcessing(true)
    setProcessLog([])
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => {
        const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
        sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
        return newLogs
      })
    }

    try {
      addLog(`⏩ 開始快轉 Test Clock: +${months} 個月`)

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        addLog('❌ 未找到登入憑證')
        setIsProcessing(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/test-clock/advance`

      addLog(`📡 調用 API: ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ months }),
      })

      addLog(`📥 收到回應: ${response.status}`)

      if (!response.ok) {
        const text = await response.text()
        addLog(`❌ API 錯誤: ${text}`)
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      addLog(`📦 結果: ${JSON.stringify(result.data)}`)

      if (result.success) {
        const newTime = new Date(result.data.frozenTimeDate).toLocaleString('zh-TW')
        const processedInvoices = result.data.processedInvoices || 0

        addLog(`✓ Test Clock 快轉成功！`)
        addLog(`  - 新時間: ${newTime}`)

        if (processedInvoices > 0) {
          addLog(`  - 已處理 ${processedInvoices} 筆 invoice（自動 finalize & pay）`)
        }

        setTimeout(async () => {
          await loadData()
          setIsProcessing(false)
        }, 2000)
      } else {
        addLog(`❌ 失敗: ${result.message || '未知錯誤'}`)
        setIsProcessing(false)
      }
    } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Advance test clock error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTestPaymentFailed = async () => {
    if (isProcessing) return

    if (!confirm(t('subscription.paymentFailed.confirmTrigger'))) {
      return
    }

    setIsProcessing(true)
    setProcessLog([])
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => {
        const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
        sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
        return newLogs
      })
    }

    try {
      addLog(`⚠️ 開始模擬付款失敗`)

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        addLog('❌ 未找到登入憑證')
        setIsProcessing(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/test/trigger-payment-failed`

      addLog(`📡 調用 API: ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      addLog(`📥 收到回應: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        let errorText = ''
        try {
          const errorJson = await response.json()
          errorText = errorJson.message || JSON.stringify(errorJson)
        } catch {
          errorText = await response.text()
        }
        addLog(`❌ API 錯誤 (${response.status}): ${errorText}`)
        addLog('⚠️ 可能的原因：')
        addLog('   1. 沒有找到 active 訂閱')
        addLog('   2. 後端服務未運行')
        addLog('   3. 資料庫連接異常')
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      addLog(`📦 結果: success=${result.success}`)
      
      if (result.success) {
        addLog(`✓ ${result.message}`)
        if (result.data?.paymentId) {
          addLog(`📌 Payment ID: ${result.data.paymentId}`)
        }
        if (result.data?.subscriptionStatus) {
          addLog(`📊 訂閱狀態: ${result.data.subscriptionStatus}`)
        }
        if (result.data?.note) {
          addLog(`ℹ️ 說明: ${result.data.note}`)
        }
        addLog('✅ 付款失敗已成功模擬')
        addLog('✅ Payment 記錄已創建 (status: failed)')
        addLog('✅ 訂閱狀態已更新 (status: past_due)')
        addLog('ℹ️ 請點擊「重新載入」或前往 Dashboard 查看結果')
        
        // 3 秒後自動重新載入資料
        setTimeout(async () => {
          addLog('🔄 自動重新載入資料...')
          await loadData()
          addLog('✓ 資料載入完成')
          addLog('📋 請檢查下方「Payments」區塊是否有 failed 記錄')
          setIsProcessing(false)
        }, 3000)
      } else {
        addLog(`❌ 失敗: ${result.message || '未知錯誤'}`)
        setIsProcessing(false)
      }
    } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Test payment failed error:', err)
      setIsProcessing(false)
    }
  }

  const handleGetPaymentFailedInfo = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setProcessLog([])
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => {
        const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
        sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
        return newLogs
      })
    }

    try {
      addLog(`📋 開始查詢付款失敗資訊`)

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        addLog('❌ 未找到登入憑證')
        setIsProcessing(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/payment-failed-info`

      addLog(`📡 調用 API: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      addLog(`📥 收到回應: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const text = await response.text()
        addLog(`❌ API 錯誤: ${text}`)
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      addLog(`📦 結果: success=${result.success}`)
      
      if (result.success && result.data) {
        addLog(`✓ hasFailedPayment: ${result.data.hasFailedPayment}`)
        addLog(`✓ subscriptionStatus: ${result.data.subscriptionStatus}`)
        addLog(`✓ failedInvoices: ${result.data.failedInvoices.length} 筆`)
        addLog(`✓ canRetry: ${result.data.canRetry}`)
        
        if (result.data.failedInvoices.length > 0) {
          const invoice = result.data.failedInvoices[0]
          addLog(`📄 最新失敗發票:`)
          addLog(`   - invoiceId: ${invoice.invoiceId}`)
          addLog(`   - amount: $${invoice.amount} ${invoice.currency}`)
          addLog(`   - reason: ${invoice.reason}`)
          addLog(`   - failedAt: ${new Date(invoice.failedAt).toLocaleString('zh-TW')}`)
          if (invoice.nextRetryAt) {
            addLog(`   - nextRetryAt: ${new Date(invoice.nextRetryAt).toLocaleString('zh-TW')}`)
          }
        }
      } else {
        addLog(`❌ 失敗: ${result.message || '未知錯誤'}`)
      }
    } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Get payment failed info error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCreateTestPayment = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setProcessLog([])
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => {
        const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
        sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
        return newLogs
      })
    }

    try {
      addLog(`🧪 開始創建測試 Payment 記錄`)

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        addLog('❌ 未找到登入憑證')
        setIsProcessing(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/test/create-test-payment`

      addLog(`📡 調用 API: ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      addLog(`📥 收到回應: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        let errorText = ''
        try {
          const errorJson = await response.json()
          errorText = errorJson.message || JSON.stringify(errorJson)
        } catch {
          errorText = await response.text()
        }
        addLog(`❌ API 錯誤 (${response.status}): ${errorText}`)
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      addLog(`📦 結果: success=${result.success}`)
      
      if (result.success && result.data) {
        addLog(`✅ 測試 Payment 記錄創建成功！`)
        addLog(`   - Payment ID: ${result.data.paymentId}`)
        addLog(`   - Subscription ID: ${result.data.subscriptionId}`)
        addLog(`   - Amount: ${result.data.amount} ${result.data.currency}`)
        addLog(`   - Status: ${result.data.status}`)
        addLog(`🔄 自動重新載入資料...`)
        
        setTimeout(async () => {
          await loadData()
          addLog('✓ 資料載入完成')
          addLog('📋 請檢查下方「Payments」區塊是否有新的測試記錄')
          setIsProcessing(false)
        }, 1000)
      } else {
        addLog(`❌ 失敗: ${result.message || '未知錯誤'}`)
        setIsProcessing(false)
      }
    } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Create test payment error:', err)
      setIsProcessing(false)
    }
  }

  const handleGetFailedInvoices = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setProcessLog([])
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => {
        const newLogs = [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]
        sessionStorage.setItem('testPageProcessLog', JSON.stringify(newLogs))
        return newLogs
      })
    }

    try {
      addLog(`📄 開始查詢失敗發票列表`)

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        addLog('❌ 未找到登入憑證')
        setIsProcessing(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/failed-invoices`

      addLog(`📡 調用 API: ${url}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      addLog(`📥 收到回應: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const text = await response.text()
        addLog(`❌ API 錯誤: ${text}`)
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      addLog(`📦 結果: success=${result.success}`)
      
      if (result.success && result.data) {
        addLog(`✓ 找到 ${result.data.length} 筆失敗發票`)
        
        if (result.data.length > 0) {
          result.data.forEach((invoice: any, index: number) => {
            addLog(`📄 發票 ${index + 1}:`)
            addLog(`   - invoiceId: ${invoice.invoiceId}`)
            addLog(`   - amount: $${invoice.amount} ${invoice.currency}`)
            addLog(`   - status: ${invoice.status}`)
            addLog(`   - reason: ${invoice.reason}`)
            addLog(`   - failedAt: ${new Date(invoice.failedAt).toLocaleString('zh-TW')}`)
            if (invoice.nextRetryAt) {
              addLog(`   - nextRetryAt: ${new Date(invoice.nextRetryAt).toLocaleString('zh-TW')}`)
            }
            if (invoice.invoiceUrl) {
              addLog(`   - invoiceUrl: ${invoice.invoiceUrl}`)
            }
          })
        } else {
          addLog('ℹ️ 目前沒有失敗發票')
        }
      } else {
        addLog(`❌ 失敗: ${result.message || '未知錯誤'}`)
      }
    } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Get failed invoices error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearTestData = async () => {
    if (isProcessing) return

    setIsProcessing(true)
    setProcessLog([])
    // 清除 sessionStorage
    sessionStorage.removeItem('testPageProcessLog')

    const addLog = (msg: string) => {
      console.log(msg)
      setProcessLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
    }

    try {
      addLog('🗑️ 開始清除測試資料')

      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        addLog('❌ 未找到登入憑證')
        setIsProcessing(false)
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const url = `${API_URL}/stripe/clear-test-data`

      addLog(`📡 調用清除 API: ${url}`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      addLog(`📥 收到回應: ${response.status}`)

      if (!response.ok) {
        const text = await response.text()
        addLog(`❌ API 錯誤: ${text}`)
        setIsProcessing(false)
        return
      }

      const result = await response.json()
      addLog(`📦 結果: ${JSON.stringify(result.data)}`)

      if (result.success) {
        const data = result.data
        addLog(`✓ 清除完成！`)
        addLog(`  - 刪除 ${data.deletedPayments} 筆 Payment`)
        addLog(`  - 刪除 ${data.deletedSubscriptions} 筆 Subscription`)
        addLog(`  - 取消 ${data.canceledStripeSubscriptions} 個 Stripe 訂閱`)
        addLog(`  - 重置為 Free 方案`)

        // 重新載入資料
        await loadData()
      } else {
        addLog(`❌ 失敗: ${result.message || '未知錯誤'}`)
      }
    } catch (err: any) {
      const errorMsg = err.message || '未知錯誤'
      addLog(`❌ 例外錯誤: ${errorMsg}`)
      console.error('[TestPage] Clear error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-lg text-gray-600">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 左側 Sidebar */}
      <TestSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        locale={params.locale as string}
      />

      {/* 右側主內容區 */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="container mx-auto p-8">
          {currentView === 'subscription' && (
            <div className="flex flex-col h-full gap-6">
              {/* 上方容器 - Tab 區域 */}
              <div className="flex-shrink-0 rounded-lg bg-blue-100 shadow">
                <div className="border-b border-gray-200">
                  <div className="flex items-center justify-between px-6">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => setActiveSubscriptionTab('create')}
                        className={cn(
                          'px-4 py-3 text-lg font-medium border-b-2 transition-all rounded-t-lg flex items-center gap-2',
                          activeSubscriptionTab === 'create'
                            ? 'text-blue-700 border-blue-600 bg-white shadow-sm font-semibold'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/50'
                        )}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>{t('subscription.tabs.create')}</span>
                      </button>
                      <button
                        onClick={() => setActiveSubscriptionTab('upgrade')}
                        className={cn(
                          'px-4 py-3 text-lg font-medium border-b-2 transition-all rounded-t-lg flex items-center gap-2',
                          activeSubscriptionTab === 'upgrade'
                            ? 'text-blue-700 border-blue-600 bg-white shadow-sm font-semibold'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/50'
                        )}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span>{t('subscription.tabs.upgrade')}</span>
                      </button>
                      <button
                        onClick={() => setActiveSubscriptionTab('payment-failed')}
                        className={cn(
                          'px-4 py-3 text-lg font-medium border-b-2 transition-all rounded-t-lg flex items-center gap-2',
                          activeSubscriptionTab === 'payment-failed'
                            ? 'text-blue-700 border-blue-600 bg-white shadow-sm font-semibold'
                            : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-white/50'
                        )}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{t('subscription.tabs.paymentFailed')}</span>
                      </button>
                    </div>
                    <button
                      onClick={handleClearTestData}
                      disabled={isProcessing}
                      className="rounded-lg bg-red-600 px-4 py-2 text-base font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>{t('subscription.clearTestData')}</span>
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {activeSubscriptionTab === 'create' && (
                    <div>
                      {/* 訂閱方案按鈕 */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => handleCreateSubscription('starter')}
                          disabled={isProcessing}
                          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isProcessing ? t('subscription.processing') : t('subscription.plans.starter')}
                        </button>
                        <button
                          onClick={() => handleCreateSubscription('pro')}
                          disabled={isProcessing}
                          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isProcessing ? t('subscription.processing') : t('subscription.plans.pro')}
                        </button>
                        <button
                          onClick={() => handleCreateSubscription('enterprise')}
                          disabled={isProcessing}
                          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isProcessing ? t('subscription.processing') : t('subscription.plans.enterprise')}
                        </button>
                      </div>
                    </div>
                  )}
                  {activeSubscriptionTab === 'upgrade' && (
                    <div>
                      <div className="mb-4 rounded-lg bg-yellow-50 p-4 border border-yellow-200">
                        <p className="text-lg text-yellow-900">
                          ⚠️ <strong>降級說明</strong>：降級會在當前計費週期結束時生效，不會立即改變方案也不會退款。需要使用 Test Clock 來測試降級生效。
                        </p>
                      </div>

                      <div className="mb-6">
                        <h3 className="mb-3 text-lg font-semibold text-gray-900">步驟 ① - 創建 Test Clock 訂閱：</h3>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleCreateTestClockSubscription('starter')}
                            disabled={isProcessing}
                            className="rounded-lg bg-purple-600 px-6 py-3 text-lg font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? t('subscription.processing') : '⏰ Starter $10'}
                          </button>
                          <button
                            onClick={() => handleCreateTestClockSubscription('pro')}
                            disabled={isProcessing}
                            className="rounded-lg bg-purple-600 px-6 py-3 text-lg font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? t('subscription.processing') : '⏰ Pro $30'}
                          </button>
                          <button
                            onClick={() => handleCreateTestClockSubscription('enterprise')}
                            disabled={isProcessing}
                            className="rounded-lg bg-purple-600 px-6 py-3 text-lg font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? t('subscription.processing') : '⏰ Enterprise $100'}
                          </button>
                        </div>
                      </div>

                      <div className="mb-6">
                        <h3 className="mb-3 text-lg font-semibold text-gray-900">步驟 ② - 執行降級：</h3>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleCreateSubscription('free')}
                            disabled={isProcessing}
                            className="rounded-lg bg-red-600 px-6 py-3 text-lg font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? t('subscription.processing') : '任何方案 → Free (取消)'}
                          </button>
                          <button
                            onClick={() => handleCreateSubscription('starter')}
                            disabled={isProcessing}
                            className="rounded-lg bg-yellow-600 px-6 py-3 text-lg font-semibold text-white hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? t('subscription.processing') : 'Pro/Enterprise → Starter'}
                          </button>
                          <button
                            onClick={() => handleCreateSubscription('pro')}
                            disabled={isProcessing}
                            className="rounded-lg bg-yellow-600 px-6 py-3 text-lg font-semibold text-white hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? t('subscription.processing') : 'Enterprise → Pro'}
                          </button>
                        </div>
                      </div>

                      <div className="mb-6">
                        <h3 className="mb-3 text-lg font-semibold text-gray-900">步驟 ③ - 快轉 Test Clock（觸發降級生效）：</h3>
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => handleAdvanceTestClock(1)}
                            disabled={isProcessing}
                            className="rounded-lg bg-indigo-600 px-6 py-3 text-lg font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? t('subscription.processing') : '⏩ 快轉 +1 個月'}
                          </button>
                        </div>
                        <p className="mt-2 text-base text-gray-600">
                          💡 快轉後，Stripe 會自動產生 invoice 並觸發 webhook，降級會在當前週期結束時生效
                        </p>
                      </div>
                    </div>
                  )}
                  {activeSubscriptionTab === 'payment-failed' && (
                    <div>
                      <div className="mb-4 rounded-lg bg-red-50 p-4 border border-yellow-200">
                        <p className="text-lg text-red-900">
                          📋 <strong>{t('subscription.paymentFailed.testSteps')}</strong>：
                          <ul className="mt-2 ml-4 list-disc">
                            <li>確保有 active 訂閱</li>
                            <li>點擊「觸發付款失敗 (模擬)」按鈕</li>
                            <li>查看 Process Log，確認執行結果</li>
                            <li>點擊「重新載入」查看更新後的資料</li>
                            <li>前往 Dashboard 查看付款失敗警告橫幅</li>
                          </ul>
                        </p>
                      </div>
                      <div className="space-y-3">
                        <button
                          onClick={handleTestPaymentFailed}
                          disabled={isProcessing || !data?.subscriptions.some(sub => sub.status === 'active' || sub.status === 'trialing')}
                          className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isProcessing ? t('subscription.processing') : `⚠️ ${t('subscription.paymentFailed.triggerPaymentFailed')}`}
                        </button>
                        {!data?.subscriptions.some(sub => sub.status === 'active' || sub.status === 'trialing') && (
                          <p className="text-base text-gray-500">
                            ℹ️ {t('subscription.paymentFailed.noActiveSubscription')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 下方容器 - 顯示結果 */}
              <div className="flex-1 overflow-y-auto rounded-lg bg-white p-6 shadow">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {t('subscription.bottomTitle')}
                  </h2>
                  <button
                    onClick={loadData}
                    disabled={isLoadingData}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoadingData ? t('subscription.reloading') : t('subscription.reload')}
                  </button>
                </div>

                {/* 處理日誌 */}
                {processLog.length > 0 && (
                  <div className="mb-6 rounded-lg bg-gray-50 p-4 shadow-inner">
                    <h3 className="mb-2 text-base font-semibold text-gray-700">
                      {t('subscription.processLog')}
                    </h3>
                    <div className="space-y-1 font-mono text-base max-h-48 overflow-y-auto">
                      {processLog.map((log, index) => (
                        <div key={index} className="text-gray-600">{log}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 數據顯示區域 */}
                {isLoadingData ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-gray-600">{t('subscription.loadingData')}</p>
                  </div>
                ) : dataError ? (
                  <div className="rounded-lg bg-red-50 p-4">
                    <p className="text-red-700">{dataError}</p>
                  </div>
                ) : data ? (
                  <div className="space-y-6">
                    {/* 1. Tenant 資訊 */}
                    <div className="rounded-lg bg-white border border-gray-200 p-6">
                      <div className="flex items-center gap-4 text-base whitespace-nowrap overflow-x-auto">
                        <span className="text-lg font-semibold text-gray-900">{t('subscription.tenantInfo')}:</span>
                        <span className="text-gray-600">{t('subscription.tenantId')}:</span>
                        <span className="font-mono">{data.tenant.id}</span>
                        {data.tenant.name && (
                          <span className="text-gray-700">({data.tenant.name})</span>
                        )}
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-600">{t('subscription.currentPlan')}:</span>
                        <span className="text-2xl font-bold text-blue-600">{data.tenant.planCode}</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-600">{t('subscription.stripeCustomerId')}:</span>
                        <span className="font-mono">{data.tenant.stripeCustomerId || '-'}</span>
                      </div>
                    </div>

                    {/* 2. Stripe Subscriptions 資訊 */}
                    <div className="rounded-lg bg-yellow-100 border border-gray-200 p-6">
                      <h3 className="mb-4 text-lg font-semibold text-gray-900">
                        {t('subscription.stripeSubscriptions')} ({data.stripeSubscriptions?.length || 0})
                      </h3>
                      {!data.stripeSubscriptions || data.stripeSubscriptions.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          {t('subscription.noStripeSubscriptions')}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-48">
                                  {t('subscription.table.stripeId')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-32">
                                  {t('subscription.table.plan')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-32">
                                  {t('subscription.table.status')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-32">
                                  {t('subscription.table.cancelAtPeriodEnd')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.periodStart')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.periodEnd')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {data.stripeSubscriptions.map((stripeSub) => (
                                <tr key={stripeSub.id}>
                                  <td className="px-4 py-2 text-base font-mono">
                                    <div className="flex items-center gap-2">
                                      <span
                                        title={stripeSub.id}
                                        className={stripeSub.error ? 'text-red-600' : ''}
                                      >
                                        {stripeSub.error ? (
                                          <span className="text-red-600">{stripeSub.id.substring(0, 20)}...</span>
                                        ) : (
                                          stripeSub.id.substring(0, 20) + '...'
                                        )}
                                      </span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(stripeSub.id);
                                        }}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                        title={t('subscription.copyId')}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-base font-semibold">
                                        {stripeSub.planCode || '-'}
                                      </span>
                                      {/* 如果有 previousPlanCode，顯示生效狀態 */}
                                      {stripeSub.previousPlanCode && stripeSub.previousPlanCode !== stripeSub.planCode && (
                                        <span className={`text-sm font-medium ${
                                          stripeSub.hasPendingPriceChange ? 'text-blue-600' : 'text-green-600'
                                        }`}>
                                          {stripeSub.hasPendingPriceChange 
                                            ? `(${t('subscription.nextPeriod')})`
                                            : `(${t('subscription.effective')})`
                                          }
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2">
                                    {stripeSub.error ? (
                                      <span className="text-red-600 text-base">{stripeSub.error}</span>
                                    ) : (
                                      <span
                                        className={`inline-block rounded px-2 py-1 text-base font-medium ${
                                          stripeSub.status === 'active'
                                            ? 'bg-green-100 text-green-800'
                                            : stripeSub.status === 'canceled'
                                            ? 'bg-red-100 text-red-800'
                                            : stripeSub.status === 'trialing'
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}
                                      >
                                        {stripeSub.status}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    {stripeSub.cancelAtPeriodEnd ? (
                                      <span className="inline-block rounded bg-orange-100 px-2 py-1 text-base font-medium text-orange-800">
                                        {t('subscription.cancelAtPeriodEnd')}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-base text-gray-600">
                                    {stripeSub.currentPeriodStart
                                      ? new Date(stripeSub.currentPeriodStart).toLocaleString('zh-TW', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : '-'}
                                  </td>
                                  <td className="px-4 py-2 text-base text-gray-600">
                                    {stripeSub.currentPeriodEnd
                                      ? new Date(stripeSub.currentPeriodEnd).toLocaleString('zh-TW', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 3. Subscriptions 表格 */}
                    <div className="rounded-lg bg-white border border-gray-200 p-6">
                      <h3 className="mb-4 text-lg font-semibold text-gray-900">
                        {t('subscription.subscriptions')} ({data.subscriptions.length})
                      </h3>
                      {data.subscriptions.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          {t('subscription.noSubscriptions')}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-48">
                                  {t('subscription.table.id')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-32">
                                  {t('subscription.table.plan')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-32">
                                  {t('subscription.table.status')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600 w-32">
                                  {t('subscription.table.cancelAtPeriodEnd')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.stripeId')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.createdAt')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {data.subscriptions.map((sub) => (
                                <tr key={sub.id}>
                                  <td className="px-4 py-2 text-base font-mono">
                                    <div className="flex items-center gap-2">
                                      <span title={sub.id}>{sub.id.substring(0, 20)}...</span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(sub.id)
                                        }}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                        title={t('subscription.copyId')}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-base font-semibold">{sub.planCode}</td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`inline-block rounded px-2 py-1 text-base font-medium ${
                                        sub.status === 'active'
                                          ? 'bg-green-100 text-green-800'
                                          : sub.status === 'canceled'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {sub.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2">
                                    {sub.cancelAtPeriodEnd ? (
                                      <span className="inline-block rounded bg-orange-100 px-2 py-1 text-base font-medium text-orange-800">
                                        {t('subscription.cancelAtPeriodEnd')}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-base font-mono">
                                    <div className="flex items-center gap-2">
                                      <span title={sub.stripeSubscriptionId}>
                                        {sub.stripeSubscriptionId.substring(0, 20)}...
                                      </span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(sub.stripeSubscriptionId)
                                        }}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                        title={t('subscription.copyId')}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-base text-gray-600">
                                    {new Date(sub.createdAt).toLocaleString('zh-TW')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* 4. Payments 表格 */}
                    <div className="rounded-lg bg-white border border-gray-200 p-6">
                      <h3 className="mb-4 text-lg font-semibold text-gray-900">
                        {t('subscription.payments')} ({data.payments.length})
                      </h3>
                      {data.payments.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          {t('subscription.noPayments')}
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.id')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.amount')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.status')}
                                </th>
                                <th className="px-4 py-2 text-left text-base font-medium text-gray-600">
                                  {t('subscription.table.paidAt')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {data.payments.map((payment) => (
                                <tr key={payment.id}>
                                  <td className="px-4 py-2 text-base font-mono">
                                    <div className="flex items-center gap-2">
                                      <span title={payment.id}>
                                        {payment.id.substring(0, 30)}...
                                      </span>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(payment.id)
                                        }}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                        title={t('subscription.copyId')}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-base font-semibold">
                                    ${payment.amount} {payment.currency}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`inline-block rounded px-2 py-1 text-base font-medium ${
                                        payment.status === 'succeeded'
                                          ? 'bg-green-100 text-green-800'
                                          : payment.status === 'failed'
                                          ? 'bg-red-100 text-red-800'
                                          : payment.status === 'pending'
                                          ? 'bg-yellow-100 text-yellow-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {payment.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-base text-gray-600">
                                    {new Date(payment.createdAt).toLocaleString('zh-TW')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">{t('subscription.bottomDescription')}</p>
                )}
              </div>
            </div>
          )}

          {currentView === 'other' && (
            <div>
              <h1 className="mb-6 text-3xl font-bold text-gray-900">
                {t('other.title')}
              </h1>
              <div className="rounded-lg bg-white p-6 shadow">
                <p className="text-gray-600">{t('other.description')}</p>
                {/* 這裡可以添加其他測試的內容 */}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 測試清單滑出面板 */}
      {currentView === 'subscription' && (
        <>
          {/* 遮罩層 */}
          {showChecklist && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => setShowChecklist(false)}
            />
          )}

          {/* 滑出面板 */}
          <div
            className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
              showChecklist ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="h-full flex flex-col">
              {/* 標題欄 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">測試清單</h2>
                <button
                  onClick={() => setShowChecklist(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 清單內容 */}
              <div className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-3">
                  {checklistItems.map((item) => (
                    <li key={item.id} className="flex items-start">
                      <input
                        type="checkbox"
                        id={`checklist-${item.id}`}
                        checked={item.checked}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label
                        htmlFor={`checklist-${item.id}`}
                        className={`ml-2 text-lg cursor-pointer flex-1 ${
                          item.checked ? 'text-gray-500' : 'text-gray-900'
                        }`}
                      >
                        {item.label}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 打開清單的浮動按鈕 */}
          <button
            onClick={() => setShowChecklist(true)}
            className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
            title="測試清單"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {checklistItems.filter(item => item.checked).length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {checklistItems.filter(item => item.checked).length}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  )
}
