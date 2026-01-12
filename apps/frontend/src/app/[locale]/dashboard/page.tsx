'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { chatbotApi } from '@/lib/api/chatbot'
import { useNotification } from '@/hooks/useNotification'

/**
 * Dashboard/Home 頁面 - Chatbot 列表
 */

interface Chatbot {
  id: string
  name: string
  description: string | null
  status: string
  isActive: string
  theme?: any // ChatbotTheme
  createdAt: string
  updatedAt: string
  _count?: {
    faqs: number
    topics: number
  }
}

export default function DashboardPage() {
  const t = useTranslations('dashboard')
  const tAuth = useTranslations('auth')
  const tCommon = useTranslations('common')
  const notify = useNotification()
  const { user, loading, signOut, postgresUserId } = useAuth()
  const router = useRouter()
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNewChatbotModal, setShowNewChatbotModal] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({})
  const [editingChatbot, setEditingChatbot] = useState<Chatbot | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const newChatbotNameRef = useRef<HTMLInputElement>(null)
  const newChatbotDescRef = useRef<HTMLInputElement>(null)
  const editChatbotNameRef = useRef<HTMLInputElement>(null)
  const editChatbotDescRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  // 載入 chatbots
  useEffect(() => {
    if (user) {
      console.log('[Dashboard] User logged in, loading chatbots...')
      loadChatbots()
    }
  }, [user])

  const loadChatbots = async () => {
    try {
      console.log('[Dashboard] Loading chatbots...')
      setIsLoading(true)
      const data = await chatbotApi.getAll()
      console.log('[Dashboard] Chatbots loaded:', data.length)
      // 按照 updatedAt 降序排序（最近更新的在前）
      const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime()
        const dateB = new Date(b.updatedAt).getTime()
        return dateB - dateA
      })
      setChatbots(sortedData)
    } catch (error) {
      console.error('[Dashboard] Failed to load chatbots:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateChatbot = async () => {
    const name = newChatbotNameRef.current?.value?.trim()
    const description = newChatbotDescRef.current?.value?.trim()

    if (!name) {
      alert(t('alerts.nameRequired'))
      return
    }

    if (!postgresUserId) {
      alert('請先登入')
      return
    }

    setIsCreating(true)
    try {
      // 生成唯一 ID（後端也會生成，但前端先生成用於追蹤）
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 11)
      const id = `${timestamp}_${randomStr}`

      await chatbotApi.create({
        id, // 後端如果沒有提供會自動生成
        name,
        description: description || undefined,
        userId: postgresUserId, // 使用實際的 postgresUserId
        status: 'published', // 狀態欄位保留用，目前沒有控制功能
        // theme 和 domainWhitelist 由後端自動設置預設值
      })

      // 重新載入列表
      await loadChatbots()

      // 關閉 modal
      setShowNewChatbotModal(false)
      if (newChatbotNameRef.current) newChatbotNameRef.current.value = ''
      if (newChatbotDescRef.current) newChatbotDescRef.current.value = ''
    } catch (error: any) {
      console.error('Failed to create chatbot:', error)
      // 提取錯誤訊息（從 Error.message）
      const errorMessage = error?.message || t('alerts.createFailed')
      notify.error(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteChatbot = async (id: string, name: string) => {
    if (!confirm(t('alerts.deleteConfirm', { name }))) {
      return
    }

    try {
      await chatbotApi.delete(id)
      await loadChatbots()
      setOpenMenuId(null)
    } catch (error) {
      console.error('Failed to delete chatbot:', error)
      alert(t('alerts.deleteFailed'))
    }
  }

  const handleToggleActive = async (
    e: React.MouseEvent,
    id: string,
    currentStatus: string | undefined
  ) => {
    e.stopPropagation()
    
    console.log(`[Dashboard] handleToggleActive called - id: ${id}, currentStatus: ${currentStatus}`)
    
    // 如果 currentStatus 是 undefined，默認設為 'inactive'
    const status = currentStatus || 'inactive'
    
    // 驗證狀態值
    if (status !== 'active' && status !== 'inactive') {
      console.error(`[Dashboard] ❌ Chatbot ${id} 的 isActive 值為 "${status}"，必須是 'active' 或 'inactive'`)
      alert(t('alerts.invalidStatus'))
      return
    }
    
    const newStatus = status === 'active' ? 'inactive' : 'active'
    console.log(`[Dashboard] 準備切換狀態: ${status} => ${newStatus}`)

    try {
      console.log(`[Dashboard] 正在呼叫 API 更新...`)
      await chatbotApi.update(id, { isActive: newStatus })
      console.log(`[Dashboard] ✅ API 更新成功，重新載入列表`)
      await loadChatbots()
      console.log(`[Dashboard] ✅ 列表重新載入完成`)
      // 顯示成功訊息（使用 alert，因為目前沒有 Toast 系統）
      // 未來可以改用 Toast 通知
    } catch (error) {
      console.error('[Dashboard] ❌ Failed to toggle status:', error)
      alert(t('alerts.updateStatusFailed'))
    }
  }

  const handleEditChatbot = (chatbot: Chatbot) => {
    setEditingChatbot(chatbot)
    setOpenMenuId(null)
  }

  const handleUpdateChatbot = async () => {
    if (!editingChatbot) return

    const name = editChatbotNameRef.current?.value?.trim()
    const description = editChatbotDescRef.current?.value?.trim()

    if (!name) {
      alert(t('alerts.nameRequired'))
      return
    }

    setIsUpdating(true)
    try {
      await chatbotApi.update(editingChatbot.id, {
        name,
        description: description || undefined,
      })
      await loadChatbots()
      setEditingChatbot(null)
    } catch (error) {
      console.error('[Dashboard] Failed to update chatbot:', error)
      alert(t('alerts.updateFailed'))
    } finally {
      setIsUpdating(false)
    }
  }

  const formatLastModified = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    )

    if (diffInHours < 1) return t('time.justNow')
    if (diffInHours < 24) return t('time.hoursAgo', { hours: diffInHours })
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return t('time.daysAgo', { days: diffInDays })
    return date.toLocaleDateString()
  }

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.chatbot-menu')) {
        setOpenMenuId(null)
      }
    }

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  if (loading || (user && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-lg text-gray-600">{t('loadingTitle')}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 shadow-sm" style={{ backgroundColor: '#3a5858' }}>
        <div className="container mx-auto px-4">
          <div className="flex h-32 items-center justify-between">
            {/* 應用名稱 */}
            <div className="flex items-center">
              <h1 className="text-4xl font-bold text-white">
                {tCommon('appName')}
              </h1>
            </div>

            {/* 右側：用戶資訊 */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 rounded-3xl border border-white border-opacity-30 bg-white bg-opacity-10 px-6 py-2 text-white transition-colors hover:bg-opacity-20"
                  style={{ minWidth: '180px' }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white bg-opacity-20">
                    <span className="text-sm font-semibold text-white">
                      {user.email?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-white">
                      {user.email}
                    </p>
                  </div>
                  <svg
                    className={`h-4 w-4 text-white transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* 下拉選單 */}
                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          signOut()
                        }}
                        className="flex w-full items-center justify-center gap-2 px-5 py-3 font-medium text-red-600 transition-colors hover:bg-red-50"
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
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        <span className="text-sm">{tAuth('logout')}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 主內容區 */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-7xl">
            {/* 標題和按鈕區域 */}
            <div className="mb-8 rounded-2xl bg-gray-50 px-8 py-6 shadow-lg border-2 border-gray-300">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="mb-2 text-3xl font-bold text-gray-900">
                    {t('pageTitle')}
                  </h1>
                  <p className="text-lg text-gray-600">
                    {t('pageSubtitle')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowNewChatbotModal(true)}
                    className="rounded-full px-6 py-3 font-bold text-white shadow-lg transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#18333D' }}
                  >
                    + New
                  </button>
                </div>
              </div>
            </div>

            {/* 編輯 Chatbot Modal */}
            {editingChatbot && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
                  {isUpdating && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-black bg-opacity-30">
                      <div className="mx-4 flex max-w-sm items-center space-x-4 rounded-2xl bg-white px-6 py-5 shadow-2xl">
                        <div className="h-10 w-10 flex-shrink-0 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                        <div className="flex-1">
                          <p className="mb-1 text-base font-semibold text-gray-900">
                            {tCommon('saving')}
                          </p>
                          <p className="text-sm text-gray-600">{t('pleaseWait')}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      {t('chatbots.editModalTitle')}
                    </h3>
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {t('chatbots.name')}
                      </label>
                      <input
                        ref={editChatbotNameRef}
                        type="text"
                        defaultValue={editingChatbot.name}
                        placeholder={t('chatbots.namePlaceholder')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {t('chatbots.description')}
                      </label>
                      <input
                        ref={editChatbotDescRef}
                        type="text"
                        defaultValue={editingChatbot.description || ''}
                        placeholder={t('chatbots.descriptionPlaceholder')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 bg-gray-50 px-6 py-4">
                    <button
                      onClick={() => setEditingChatbot(null)}
                      className="rounded-full bg-gray-100 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-200"
                      disabled={isUpdating}
                    >
                      {tCommon('cancel')}
                    </button>
                    <button
                      onClick={handleUpdateChatbot}
                      className="rounded-full bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                      disabled={isUpdating}
                    >
                      {tCommon('save')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 新增 Chatbot Modal */}
            {showNewChatbotModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
                  {isCreating && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-black bg-opacity-30">
                      <div className="mx-4 flex max-w-sm items-center space-x-4 rounded-2xl bg-white px-6 py-5 shadow-2xl">
                        <div className="h-10 w-10 flex-shrink-0 animate-spin rounded-full border-4 border-green-600 border-t-transparent"></div>
                        <div className="flex-1">
                          <p className="mb-1 text-base font-semibold text-gray-900">
                            {t('chatbots.createModalCreating')}
                          </p>
                          <p className="text-sm text-gray-600">{t('pleaseWait')}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      {t('chatbots.createModalTitle')}
                    </h3>
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {t('chatbots.name')}
                      </label>
                      <input
                        ref={newChatbotNameRef}
                        type="text"
                        placeholder={t('chatbots.namePlaceholder')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="mb-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        {t('chatbots.description')}
                      </label>
                      <input
                        ref={newChatbotDescRef}
                        type="text"
                        placeholder={t('chatbots.descriptionPlaceholder')}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 bg-gray-50 px-6 py-4">
                    <button
                      onClick={() => setShowNewChatbotModal(false)}
                      className="rounded-full bg-gray-100 px-4 py-2 text-gray-600 transition-colors hover:bg-gray-200"
                      disabled={isCreating}
                    >
                      {tCommon('cancel')}
                    </button>
                    <button
                      onClick={handleCreateChatbot}
                      className="rounded-full bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                      disabled={isCreating}
                    >
                      {t('chatbots.createButtonText')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Chatbot 列表 */}
            {isLoading ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  {t('loadingTitle')}
                </h3>
                <p className="text-gray-600">{t('loadingMessage')}</p>
              </div>
            ) : chatbots.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    className="h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  {t('noChatbotsTitle')}
                </h3>
                <p className="text-gray-600">
                  {t('noChatbotsMessage')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {chatbots.map((chatbot) => {
                  // 注意：isActive 的判斷已移到下方 UI 渲染邏輯中進行驗證

                  return (
                    <div
                      key={chatbot.id}
                      onClick={() => router.push(`/chatbots/${chatbot.id}`)}
                      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
                      style={{
                        boxShadow:
                          '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                      }}
                    >
                      {/* 背景裝飾 */}
                      <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-gradient-to-br from-blue-50 to-purple-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

                      {/* 內容 */}
                      <div className="relative flex flex-1 flex-col p-6">
                        {/* 右上角選單 */}
                        <div
                          className="chatbot-menu absolute right-4 top-4 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(
                                openMenuId === chatbot.id ? null : chatbot.id
                              )
                            }}
                            className="rounded-full p-2 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-gray-100 hover:text-gray-700"
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
                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                              />
                            </svg>
                          </button>

                          {/* 下拉選單 */}
                          {openMenuId === chatbot.id && (
                            <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white/95 py-2 shadow-xl backdrop-blur-sm">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditChatbot(chatbot)
                                }}
                                className="mx-1 flex w-full items-center space-x-3 rounded-full px-4 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                <span className="font-medium">{tCommon('edit')}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteChatbot(chatbot.id, chatbot.name)
                                }}
                                className="mx-1 flex w-full items-center space-x-3 rounded-full px-4 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                <span className="font-medium">{t('chatbots.delete')}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* 圖標和標題 */}
                        <div className="mb-4 flex flex-1 items-start gap-4">
                          <div className="flex-shrink-0">
                            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:border-gray-300 group-hover:shadow-xl">
                              {chatbot.theme?.headerLogo && !logoErrors[chatbot.id] ? (
                                <img
                                  src={chatbot.theme.headerLogo.startsWith('http') 
                                    ? chatbot.theme.headerLogo 
                                    : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${chatbot.theme.headerLogo}`}
                                  alt={`${chatbot.name} logo`}
                                  className="h-full w-full object-cover"
                                  onError={() => {
                                    setLogoErrors(prev => ({ ...prev, [chatbot.id]: true }));
                                  }}
                                />
                              ) : (
                                <svg
                                  className="h-8 w-8 text-gray-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1 pt-1">
                            <h3 className="mb-1.5 truncate text-xl font-bold text-gray-900 transition-colors duration-200 group-hover:text-blue-600">
                              {chatbot.name}
                            </h3>
                            {chatbot.description && (
                              <p className="line-clamp-2 text-sm leading-relaxed text-gray-600">
                                {chatbot.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 底部資訊 */}
                        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
                          <div className="flex items-center text-xs text-gray-500">
                            <svg
                              className="mr-1.5 h-4 w-4 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="font-medium">
                              {formatLastModified(chatbot.updatedAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* 狀態開關 */}
                            {(() => {
                              // 驗證 isActive：必須是 'active' 或 'inactive'，不能為 undefined/null
                              if (chatbot.isActive === undefined || chatbot.isActive === null) {
                                console.error(`[Dashboard] ❌ Chatbot "${chatbot.name}" (${chatbot.id}) 的 isActive 為 ${chatbot.isActive}，必須設置為 'active' 或 'inactive'`)
                                return (
                                  <div className="flex items-center gap-2 text-xs text-red-600">
                                    <span>{t('alerts.statusError')}</span>
                                  </div>
                                )
                              }
                              if (chatbot.isActive !== 'active' && chatbot.isActive !== 'inactive') {
                                console.error(`[Dashboard] ❌ Chatbot "${chatbot.name}" (${chatbot.id}) 的 isActive 值為 "${chatbot.isActive}"，必須是 'active' 或 'inactive'`)
                                return (
                                  <div className="flex items-center gap-2 text-xs text-red-600">
                                    <span>{t('alerts.statusError')}</span>
                                  </div>
                                )
                              }
                              
                              const isActive = chatbot.isActive === 'active'
                              return (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-medium ${isActive ? 'text-green-600' : 'text-red-600'}`}
                                  >
                                    {isActive ? t('chatbots.active') : t('chatbots.inactive')}
                                  </span>
                                  <button
                                    type="button"
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive ? 'bg-green-600 focus:ring-green-500' : 'bg-red-500 focus:ring-red-500'}`}
                                    onClick={(e) =>
                                      handleToggleActive(e, chatbot.id, chatbot.isActive)
                                    }
                                  >
                                    <span
                                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`}
                                    />
                                  </button>
                                </div>
                              )
                            })()}

                            {/* 箭頭 */}
                            <div className="text-blue-500 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ConfirmDialog */}
      {notify.ConfirmDialog}
    </div>
  )
}
