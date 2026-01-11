'use client'

import { useState, useEffect } from 'react'
import ChatbotWidget from '@/components/chatbot/ChatbotWidget'
import { ChatbotTheme } from '@/types/chat'

interface ChatbotPageProps {
  params: {
    id: string
    locale: string
  }
}

export default function ChatbotPage({ params }: ChatbotPageProps) {
  const chatbotId = params.id
  const [isLoading, setIsLoading] = useState(true)
  const [theme, setTheme] = useState<ChatbotTheme | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)

  // 載入 chatbot 配置
  useEffect(() => {
    const loadChatbotConfig = async () => {
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/chatbots/${chatbotId}/public-config`
        console.log('[ChatbotPage] 載入配置:', apiUrl)
        
        const response = await fetch(apiUrl, { 
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (response.ok) {
          const result = await response.json()
          console.log('[ChatbotPage] 配置載入成功:', result)
          if (result.success && result.data) {
            setTheme(result.data.theme)
          } else {
            setAccessError('載入配置失敗')
          }
        } else if (response.status === 403) {
          // 白名單驗證失敗
          const errorData = await response.json().catch(() => ({ message: '未授權的網域' }))
          setAccessError(errorData.message || '此 chatbot 只能通過授權網站嵌入使用。如需使用，請聯繫管理員將您的網域加入白名單。')
        } else {
          console.error('[ChatbotPage] 載入配置失敗:', response.status, response.statusText)
          setAccessError('找不到此 chatbot')
        }
      } catch (error) {
        console.error('[ChatbotPage] 載入 chatbot 配置時發生錯誤:', error)
        setAccessError('載入 chatbot 配置失敗')
      } finally {
        setIsLoading(false)
      }
    }

    loadChatbotConfig()
  }, [chatbotId])

  // 處理關閉按鈕
  const handleClose = () => {
    // 如果在 iframe 中，通知父視窗關閉
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'closeChatbot' }, '*')
    } else {
      // 如果不在 iframe 中，嘗試關閉視窗
      try {
        window.close()
      } catch (e) {
        // 無法關閉視窗時，什麼都不做
      }
    }
  }

  if (isLoading || !theme) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: theme?.chatBackgroundColor || '#ffffff' }}>
        <div className="text-center">
          {accessError ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">訪問被拒絕</h2>
              <p className="text-gray-600 max-w-md mx-auto">{accessError}</p>
            </>
          ) : (
            <>
              <div className="w-8 h-8 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600">載入中...</p>
            </>
          )}
        </div>
      </div>
    )
  }

  // 如果有訪問錯誤，顯示錯誤頁面
  if (accessError) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">訪問被拒絕</h2>
          <p className="text-gray-600 mb-4">{accessError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col">
      <ChatbotWidget
        chatbotId={chatbotId}
        theme={theme}
        mode="embedded"
        showCloseButton={theme.showCloseButton ?? true}
        onClose={handleClose}
      />
    </div>
  )
}

