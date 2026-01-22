'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNotification } from '@/hooks/useNotification'

// Toast UI Editor 類型
// @ts-ignore
import type { Editor } from '@toast-ui/editor'

// 導入樣式
import '@toast-ui/editor/dist/toastui-editor.css'

interface Topic {
  id: string
  name: string
  parentId: string | null
  sortOrder?: number
}

interface QACardEditorProps {
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

export default function QACardEditor({
  isOpen,
  onClose,
  mode,
  chatbotId,
  faqData,
  topics,
  onSuccess,
}: QACardEditorProps) {
  const t = useTranslations('knowledge')
  const tCommon = useTranslations('common')
  const notify = useNotification()

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [synonym, setSynonym] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [topicId, setTopicId] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  
  // Toast UI Editor 引用
  const editorRef = useRef<Editor | null>(null)
  const editorDivRef = useRef<HTMLDivElement>(null)

  // 圖片上傳處理函數
  const handleImageUpload = async (file: File): Promise<string> => {
    console.log('[QACardEditor] 開始上傳圖片:', { name: file.name, size: file.size, type: file.type })
    setIsUploadingImage(true)
    try {
      // 驗證檔案類型
      if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
        const errorMsg = '只允許上傳圖片檔案（jpg, jpeg, png, gif, webp）'
        notify.error(errorMsg)
        throw new Error(errorMsg)
      }

      // 驗證檔案大小（5MB）
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        const errorMsg = '檔案大小不能超過 5MB'
        notify.error(errorMsg)
        throw new Error(errorMsg)
      }

      // 使用 FormData 上傳檔案
      const formData = new FormData()
      formData.append('file', file)

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
      const uploadUrl = `${apiBase}/faqs/upload-image`
      console.log('[QACardEditor] 上傳到:', uploadUrl)

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      console.log('[QACardEditor] 上傳回應狀態:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.message || '圖片上傳失敗'
        notify.error(errorMsg)
        throw new Error(errorMsg)
      }

      const result = await response.json()
      console.log('[QACardEditor] 上傳回應:', result)

      if (result.success && result.data?.imageUrl) {
        // 返回完整的圖片 URL
        const imageBaseUrl = baseUrl.endsWith('/api') ? baseUrl.replace(/\/api$/, '') : baseUrl
        const imageUrl = `${imageBaseUrl}${result.data.imageUrl}`
        console.log('[QACardEditor] ✅ 圖片上傳成功:', imageUrl)
        return imageUrl
      } else {
        const errorMsg = result.message || '圖片上傳失敗：回應格式錯誤'
        notify.error(errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('[QACardEditor] ❌ 圖片上傳失敗:', error)
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
      // 檢查 DOM 節點是否還存在
      if (!editorDivRef.current || !isOpen) return

      // 如果編輯器已存在，先銷毀
      if (editorRef.current) {
        try {
          editorRef.current.destroy()
        } catch (error) {
          console.error('[QACardEditor] 銷毀舊編輯器時發生錯誤:', error)
        }
        editorRef.current = null
      }

      // @ts-ignore
      const { default: Editor } = await import('@toast-ui/editor')

      // 再次檢查 DOM 節點是否還存在（異步操作後）
      if (!editorDivRef.current || !isOpen) return

      // 直接從 faqData 或 answer state 取得初始內容
      let initialContent = ''
      if (mode === 'edit' && faqData?.answer) {
        initialContent = faqData.answer
      } else if (mode === 'create' && faqData?.answer) {
        initialContent = faqData.answer
      } else {
        initialContent = answer || ''
      }

      console.log('[QACardEditor] 初始化編輯器', {
        mode,
        faqId: faqData?.id,
        contentLength: initialContent.length,
        contentPreview: initialContent.substring(0, 100)
      })

      const editor = new Editor({
        el: editorDivRef.current!,
        height: '100%',
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
            console.log('[QACardEditor] addImageBlobHook 觸發')
            try {
              const file = blob instanceof File ? blob : new File([blob], 'image.png', { type: blob.type })
              const url = await handleImageUpload(file)
              callback(url, '圖片')
            } catch (error) {
              console.error('[QACardEditor] 圖片上傳 hook 失敗:', error)
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
      console.log('[QACardEditor] ✅ Toast UI Editor 初始化完成')
    }, 200) // 延遲 200ms 確保數據和 DOM 都就緒

    return () => {
      clearTimeout(timer)
      if (editorRef.current) {
        try {
          console.log('[QACardEditor] 銷毀 Toast UI Editor')
          // 先清空編輯器內容再銷毀
          if (editorDivRef.current) {
            editorRef.current.destroy()
            // 清空容器，確保沒有殘留的 DOM
            editorDivRef.current.innerHTML = ''
          }
        } catch (error) {
          // 完全忽略銷毀時的錯誤，避免中斷應用程式
          console.warn('[QACardEditor] 編輯器銷毀時發生錯誤（已忽略）:', error)
        } finally {
          editorRef.current = null
        }
      }
    }
  }, [isOpen, mode, faqData?.id]) // 依賴 mode 和 faqData.id，確保切換編輯對象時重新初始化

  // 初始化表單數據
  useEffect(() => {
    if (!isOpen) {
      // 關閉時重置
      setQuestion('')
      setAnswer('')
      setSynonym('')
      setStatus('active')
      setTopicId('')
      return
    }

    if (mode === 'edit' && faqData) {
      console.log('[QACardEditor] 編輯模式 - 載入資料:', {
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

  const validateForm = (): boolean => {
    if (!question.trim()) {
      notify.error(t('questionRequired'))
      return false
    }
    if (!answer.trim()) {
      notify.error(t('answerRequired'))
      return false
    }
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
  const renderTopicOptions = (parentId: string | null = null, level: number = 0): React.ReactNode[] => {
    const children = topics
      .filter(topic => topic.parentId === parentId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    
    const options: React.ReactNode[] = []
    
    children.forEach(topic => {
      const indent = '  '.repeat(level)
      const path = getTopicPath(topic.id)
      
      options.push(
        <option key={topic.id} value={topic.id}>
          {indent}{path}
        </option>
      )
      
      // 遞歸渲染子層級
      const childOptions = renderTopicOptions(topic.id, level + 1)
      options.push(...childOptions)
    })
    
    return options
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)

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
    } catch (err: any) {
      console.error('[QACardEditor] Save FAQ error:', err)
      // 提取錯誤訊息（從 Error.message）
      const errorMessage = err?.message || t('saveFailed')
      notify.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Top Container */}
        <div className="flex-shrink-0 px-6 pt-4 pb-0">
          <div className="rounded-lg border border-header-border shadow-sm bg-header-bg py-3 px-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {t('qaCard')}
              </h2>
              {/* 狀態切換 Toggle Switch */}
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-white">
                  {status === 'active' ? t('active') : t('inactive')}
                </span>
                <button
                  type="button"
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 ${
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
          </div>
        </div>

        {/* Content Area - Left and Right Containers */}
        <div className="flex-1 flex gap-4 overflow-hidden pt-4 px-6 pb-3">
          {/* Left Container */}
          <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 pt-2 px-2 pb-1 flex flex-col overflow-hidden">
            {/* 問題 */}
            <div className="flex-shrink-0 mb-6">
              <label className="block text-base font-semibold text-gray-700 mb-2.5">
                {t('question')} <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t('questionPlaceholder')}
                className="text-base rounded"
              />
            </div>

            {/* 答案 - Toast UI Editor */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-base font-semibold text-gray-700 mb-2.5 flex-shrink-0">
                {t('answer')} <span className="text-red-500">*</span>
                <span className="ml-2 text-base font-normal text-gray-500">
                  {t('markdownSupported')}
                </span>
                {isUploadingImage && (
                  <span className="ml-2 text-base text-blue-600 font-normal">
                    (上傳圖片中...)
                  </span>
                )}
              </label>
              <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden bg-white min-h-0">
                <div 
                  ref={editorDivRef} 
                  className="h-full text-base"
                  style={{ position: 'relative', zIndex: 1 }}
                />
              </div>
            </div>
          </div>

          {/* Right Container */}
          <div className="w-[200px] flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 pt-2 px-2 pb-1 flex flex-col overflow-hidden">
            {/* 主題分類 */}
            <div className="flex-shrink-0 mb-6">
              <label className="block text-base font-semibold text-gray-700 mb-2.5">
                {t('topic')}
                <span className="ml-2 text-base font-normal text-gray-500">
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

            {/* 同義詞 */}
            <div className="flex-1 flex flex-col min-h-0">
              <label className="block text-base font-semibold text-gray-700 mb-2.5 flex-shrink-0">
                {t('synonyms')}
                <span className="ml-2 text-base font-normal text-gray-500">
                  ({t('optional')})
                </span>
              </label>
              <textarea
                value={synonym}
                onChange={(e) => setSynonym(e.target.value)}
                className="flex-1 w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none outline-none"
                placeholder={t('synonymsPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-2 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2 text-base"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 text-base"
          >
            {isSaving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
