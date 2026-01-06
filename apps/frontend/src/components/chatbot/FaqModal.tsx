'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
      console.error('[FaqModal] Save error:', err)
      setError(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 ${isFullScreen ? '' : 'overflow-y-auto'}`}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`${isFullScreen ? '' : 'flex min-h-full items-center justify-center p-4'}`}>
        <div
          className={`relative bg-white rounded-lg shadow-xl transition-all ${
            isFullScreen
              ? 'fixed inset-4 max-w-none z-[60]'
              : 'w-full max-w-4xl max-h-[90vh]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white">
                {mode === 'create' ? t('createFaqTitle') : t('editFaqTitle')}
              </h3>
            </div>

            <div className="flex items-center space-x-3">
              {/* 狀態切換 */}
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-2 rounded-xl border border-white/20">
                <span className="text-sm text-white/90 font-medium">
                  {t('status')}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setStatus(status === 'active' ? 'inactive' : 'active')
                  }
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                    status === 'active' ? 'bg-green-500 shadow-lg' : 'bg-red-500'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-300 ${
                      status === 'active' ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span
                  className={`text-sm font-semibold ${
                    status === 'active' ? 'text-green-100' : 'text-red-100'
                  }`}
                >
                  {status === 'active' ? t('active') : t('inactive')}
                </span>
              </div>

              {/* 全螢幕按鈕 */}
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200"
                title={isFullScreen ? t('exitFullScreen') : t('fullScreen')}
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

              {/* 答案 */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2.5">
                  {t('answer')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={t('answerPlaceholder')}
                  rows={isFullScreen ? 20 : 10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
                <p className="mt-2 text-sm text-gray-500">
                  {t('markdownSupported')}
                </p>
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
                <p className="mt-2 text-sm text-gray-500">
                  {t('synonymsHint')}
                </p>
              </div>

              {/* 分類 */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2.5">
                  {t('topic')}
                </label>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                >
                  <option value="">{t('selectTopic')}</option>
                  {renderTopicOptions(null, 0)}
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="ml-3 text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                {tCommon('cancel')}
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? t('saving') : tCommon('save')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

