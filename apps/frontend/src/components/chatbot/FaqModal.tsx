'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Toast UI Editor 類型
import type { Editor } from '@toast-ui/editor'

// 導入樣式
import '@toast-ui/editor/dist/toastui-editor.css'

interface Topic {
  id: string
  name: string
  parentId: string | null
}

interface FaqModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  chatbotId: string
  faqData?: {
    id?: string
    question: string
    answer: string
    synonym: string
    status: string
    topicId: string | null
  }
  topics: Topic[]
  onSuccess: () => void
}

export default function FaqModal({
  isOpen,
  onClose,
  mode,
  chatbotId,
  faqData,
  topics,
  onSuccess,
}: FaqModalProps) {
  const t = useTranslations('knowledge')
  const tCommon = useTranslations('common')

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [synonym, setSynonym] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [topicId, setTopicId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  
  // Toast UI Editor 引用
  const editorRef = useRef<Editor | null>(null)
  const editorDivRef = useRef<HTMLDivElement>(null)

  // 圖片上傳處理函數
  const handleImageUpload = async (file: File): Promise<string> => {
    console.log('[FaqModal] 開始上傳圖片:', { name: file.name, size: file.size, type: file.type })
    setIsUploadingImage(true)
    try {
      // 驗證檔案類型
      if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
        const errorMsg = '只允許上傳圖片檔案（jpg, jpeg, png, gif, webp）'
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      // 驗證檔案大小（5MB）
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        const errorMsg = '檔案大小不能超過 5MB'
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      // 使用 FormData 上傳檔案
      const formData = new FormData()
      formData.append('file', file)

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
      const uploadUrl = `${apiBase}/faqs/upload-image`
      console.log('[FaqModal] 上傳到:', uploadUrl)

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      console.log('[FaqModal] 上傳回應狀態:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.message || '圖片上傳失敗'
        setError(errorMsg)
        throw new Error(errorMsg)
      }

      const result = await response.json()
      console.log('[FaqModal] 上傳回應:', result)

      if (result.success && result.data?.imageUrl) {
        // 返回完整的圖片 URL
        const imageBaseUrl = baseUrl.endsWith('/api') ? baseUrl.replace(/\/api$/, '') : baseUrl
        const imageUrl = `${imageBaseUrl}${result.data.imageUrl}`
        console.log('[FaqModal] ✅ 圖片上傳成功:', imageUrl)
        setError('') // 清除錯誤
        return imageUrl
      } else {
        const errorMsg = result.message || '圖片上傳失敗：回應格式錯誤'
        setError(errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('[FaqModal] ❌ 圖片上傳失敗:', error)
      throw error
    } finally {
      setIsUploadingImage(false)
    }
  }

  // 初始化 Toast UI Editor（在數據載入後初始化）
  useEffect(() => {
    if (!isOpen || !editorDivRef.current) return

    // 延遲初始化，確保表單數據已經設置完成
    const timer = setTimeout(async () => {
      // 如果編輯器已存在，先銷毀
      if (editorRef.current) {
        editorRef.current.destroy()
        editorRef.current = null
      }

      const { default: Editor } = await import('@toast-ui/editor')

      // 直接從 faqData 或 answer state 取得初始內容
      let initialContent = ''
      if (mode === 'edit' && faqData?.answer) {
        initialContent = faqData.answer
      } else if (mode === 'create' && faqData?.answer) {
        initialContent = faqData.answer
      } else {
        initialContent = answer || ''
      }

      console.log('[FaqModal] 初始化編輯器', {
        mode,
        faqId: faqData?.id,
        contentLength: initialContent.length,
        contentPreview: initialContent.substring(0, 100)
      })

      const editor = new Editor({
        el: editorDivRef.current!,
        height: '300px',
        initialEditType: 'wysiwyg',
        previewStyle: 'tab',
        initialValue: initialContent,
        hideModeSwitch: false,
        usageStatistics: false,
        events: {
          // 確保 Enter 鍵正常工作
          keydown: (editorType: any, ev: KeyboardEvent) => {
            // 不攔截任何按鍵，讓編輯器正常處理
            return true
          }
        },
        toolbarItems: [
          ['heading', 'bold', 'italic'],
          ['hr', 'quote'],
          ['ul', 'ol'],
          ['table', 'link', 'image'],
        ],
        hooks: {
          addImageBlobHook: async (blob: File | Blob, callback: (url: string, altText: string) => void) => {
            console.log('[FaqModal] addImageBlobHook 觸發')
            try {
              const file = blob instanceof File ? blob : new File([blob], 'image.png', { type: blob.type })
              const url = await handleImageUpload(file)
              callback(url, '圖片')
            } catch (error) {
              console.error('[FaqModal] 圖片上傳 hook 失敗:', error)
            }
          },
        },
      })

      // 監聽內容變化
      editor.on('change', () => {
        const newMarkdown = editor.getMarkdown()
        setAnswer(newMarkdown)
      })

      // 初始化後，同步 answer state
      if (initialContent) {
        setAnswer(initialContent)
      }

      editorRef.current = editor
      console.log('[FaqModal] ✅ Toast UI Editor 初始化完成')
    }, 200) // 延遲 200ms 確保數據和 DOM 都就緒

    return () => {
      clearTimeout(timer)
      if (editorRef.current) {
        console.log('[FaqModal] 銷毀 Toast UI Editor')
        editorRef.current.destroy()
        editorRef.current = null
      }
    }
  }, [isOpen, mode, faqData?.id]) // 依賴 mode 和 faqData.id，確保切換編輯對象時重新初始化
  
  // 調整編輯器高度（全屏模式）
  useEffect(() => {
    if (editorRef.current && isOpen) {
      const newHeight = isFullScreen ? '500px' : '300px'
      editorRef.current.setHeight(newHeight)
      console.log('[FaqModal] 調整編輯器高度:', newHeight)
    }
  }, [isFullScreen, isOpen])

  // 初始化表單數據
  useEffect(() => {
    if (!isOpen) {
      // 關閉時重置
      setQuestion('')
      setAnswer('')
      setSynonym('')
      setStatus('active')
      setTopicId('')
      setError('')
      setIsFullScreen(false)
      return
    }

    if (mode === 'edit' && faqData) {
      console.log('[FaqModal] 編輯模式 - 載入資料:', {
        question: faqData.question,
        answer: faqData.answer?.substring(0, 200),
        answerLength: faqData.answer?.length,
        synonym: faqData.synonym,
        status: faqData.status,
        topicId: faqData.topicId,
      })
      setQuestion(faqData.question || '')
      setAnswer(faqData.answer || '')
      setSynonym(faqData.synonym || '')
      setStatus((faqData.status as 'active' | 'inactive') || 'active')
      setTopicId(faqData.topicId || '')
    } else if (mode === 'create') {
      setQuestion(faqData?.question || '')
      setAnswer(faqData?.answer || '')
      setSynonym('')
      setStatus('active')
      setTopicId('')
    }
  }, [isOpen, mode, faqData])

  // ESC 鍵退出全螢幕
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isFullScreen])

  const validateForm = (): boolean => {
    if (!question.trim()) {
      setError(t('questionRequired'))
      return false
    }
    if (!answer.trim()) {
      setError(t('answerRequired'))
      return false
    }
    setError('')
    return true
  }

  // 獲取 Topic 的完整路徑（用於顯示）
  const getTopicPath = (topicId: string): string => {
    const topic = topics.find(t => t.id === topicId)
    if (!topic) return ''
    
    if (topic.parentId) {
      const parentPath = getTopicPath(topic.parentId)
      return parentPath ? `${parentPath} > ${topic.name}` : topic.name
    }
    
    return topic.name
  }

  // 遞歸渲染 Topic 選項（用於下拉選單）
  const renderTopicOptions = (parentId: string | null = null, level: number = 0): React.ReactNode => {
    const children = topics
      .filter(topic => topic.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
    
    return children.map(topic => {
      const indent = '  '.repeat(level)
      const path = getTopicPath(topic.id)
      
      return (
        <option key={topic.id} value={topic.id}>
          {indent}{path}
        </option>
      )
    })
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)
    setError('')

    try {
      // 生成 FAQ ID（新增時）
      const generateFaqId = () => {
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 11)
        return `${timestamp}_${randomStr}`
      }

      const requestData: any = {
        question: question.trim(),
        answer: answer.trim(),
        synonym: synonym.trim() || '',
        status,
        topicId: topicId || null,
      }

      // 新增時需要 ID 和 chatbotId
      if (mode === 'create') {
        requestData.id = generateFaqId()
        requestData.chatbotId = chatbotId
      }

      const url =
        mode === 'edit'
          ? `${process.env.NEXT_PUBLIC_API_URL}/faqs/${faqData?.id}`
          : `${process.env.NEXT_PUBLIC_API_URL}/faqs`

      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || t('saveFailed'))
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Save FAQ error:', err)
      setError(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 ${isFullScreen ? 'p-0' : ''}`}>
      <div className={`bg-white rounded-lg shadow-2xl ${isFullScreen ? 'w-full h-full rounded-none' : 'w-full max-w-4xl'} flex flex-col`}>
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-lg">
          <div className="flex items-center justify-between pr-32">
            <h2 className="text-2xl font-bold text-white">
              {mode === 'create' ? t('createFaq') : t('editFaq')}
            </h2>
            
            {/* 狀態切換 Toggle Switch */}
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${status === 'active' ? 'text-green-200' : 'text-red-200'}`}
              >
                {status === 'active' ? t('active') : t('inactive')}
              </span>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 ${
                  status === 'active' ? 'bg-green-500' : 'bg-red-500'
                }`}
                onClick={() => setStatus(status === 'active' ? 'inactive' : 'active')}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    status === 'active' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          
          {/* 右上角按鈕 */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {/* 全螢幕按鈕 */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200"
            >
              {isFullScreen ? (
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                  />
                </svg>
              )}
            </button>

            {/* 關閉按鈕 */}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200"
            >
              <svg
                className="w-5 h-5 text-white"
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

        {/* Body */}
        <div className={`px-6 py-6 overflow-y-auto ${isFullScreen ? 'h-[calc(100vh-180px)]' : 'max-h-[60vh]'}`}>
          <div className="space-y-6">
            {/* 問題 */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2.5">
                {t('question')} <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('questionPlaceholder')}
                className="text-base"
              />
            </div>

            {/* 答案 - Toast UI Editor */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2.5">
                {t('answer')} <span className="text-red-500">*</span>
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {t('markdownSupported')}
                </span>
                {isUploadingImage && (
                  <span className="ml-2 text-sm text-blue-600 font-normal">
                    (上傳圖片中...)
                  </span>
                )}
              </label>
              <div 
                ref={editorDivRef} 
                className="border border-gray-300 rounded-lg overflow-visible"
                style={{ position: 'relative', zIndex: 1 }}
              />
            </div>

            {/* 同義詞 */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2.5">
                {t('synonyms')}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({t('optional')})
                </span>
              </label>
              <Input
                type="text"
                value={synonym}
                onChange={(e) => setSynonym(e.target.value)}
                placeholder={t('synonymsPlaceholder')}
                className="text-base"
              />
            </div>

            {/* 主題分類 */}
            <div>
              <label className="block text-base font-semibold text-gray-700 mb-2.5">
                {t('topic')}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({t('optional')})
                </span>
              </label>
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">{t('noTopic')}</option>
                {renderTopicOptions()}
              </select>
            </div>
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 text-base"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 text-base bg-blue-600 hover:bg-blue-700"
          >
            {isSaving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
