'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { topicApi } from '@/lib/api/topic'
import FaqModal from './FaqModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface FAQ {
  id: string
  question: string
  answer: string
  synonym: string
  status: string
  topicId: string | null
  hitCount: number
  createdAt: string
  updatedAt: string
}

interface Topic {
  id: string
  name: string
  parentId: string | null
}

interface FaqListProps {
  chatbotId: string
  refreshTrigger: number
  onRefresh: () => void
}

export default function FaqList({ chatbotId, refreshTrigger, onRefresh }: FaqListProps) {
  const t = useTranslations('knowledge')
  const tCommon = useTranslations('common')

  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [faqToDelete, setFaqToDelete] = useState<{ id: string; question: string } | null>(null)

  useEffect(() => {
    loadFaqs()
    loadTopics()
  }, [chatbotId, refreshTrigger])

  const loadFaqs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/faqs?chatbotId=${chatbotId}`
      )
      if (!response.ok) throw new Error('Failed to load FAQs')
      
      const result = await response.json()
      setFaqs(result.data || [])
    } catch (error) {
      console.error('[FaqList] Failed to load FAQs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTopics = async () => {
    try {
      const data = await topicApi.getAll(chatbotId)
      setTopics(data)
    } catch (error) {
      console.error('[FaqList] Failed to load topics:', error)
    }
  }

  const handleCreate = () => {
    setSelectedFaq(null)
    setModalMode('create')
    setShowModal(true)
  }

  const handleEdit = (faq: FAQ) => {
    setSelectedFaq(faq)
    setModalMode('edit')
    setShowModal(true)
  }

  const handleDelete = (id: string, question: string) => {
    setFaqToDelete({ id, question })
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!faqToDelete) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/faqs/${faqToDelete.id}`,
        { method: 'DELETE' }
      )
      
      if (!response.ok) throw new Error('Failed to delete FAQ')
      
      setShowDeleteConfirm(false)
      setFaqToDelete(null)
      onRefresh()
    } catch (error) {
      console.error('[FaqList] Failed to delete FAQ:', error)
      alert(t('deleteFailed'))
      setShowDeleteConfirm(false)
      setFaqToDelete(null)
    }
  }

  const handleModalSuccess = () => {
    onRefresh()
    setShowModal(false)
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

  // 過濾 FAQs
  const filteredFaqs = faqs.filter(faq => {
    // Topic 過濾
    if (selectedTopicId) {
      if (selectedTopicId === 'uncategorized') {
        if (faq.topicId) return false
      } else {
        if (faq.topicId !== selectedTopicId) return false
      }
    }

    // 搜尋過濾
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return (
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query)
      )
    }

    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-cyan-50 border-b border-cyan-200 px-6 py-4 -mx-6 -mt-6 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 pl-2">{t('faqList')}</h2>
          <Button onClick={handleCreate} className="rounded-full bg-cyan-600 hover:bg-cyan-700 text-white">
            + {t('createFaq')}
          </Button>
        </div>
      </div>

      {/* 工具列 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* 搜尋框 */}
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md rounded-full border-gray-400 py-2.5"
          />

          {/* Topic 篩選 */}
          <div className="relative">
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="border border-gray-400 rounded-full px-4 py-2.5 pr-10 text-sm min-w-[180px] appearance-none bg-white cursor-pointer"
            >
              <option value="">{t('allTopics')}</option>
              <option value="uncategorized">{t('uncategorized')}</option>
              {renderTopicOptions(null, 0)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ 列表 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {searchQuery || selectedTopicId ? t('noResultsFound') : t('noFaqs')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500 uppercase tracking-wider">
                  {t('question')}
                </th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500 uppercase tracking-wider">
                  {t('answer')}
                </th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500 uppercase tracking-wider">
                  {t('topic')}
                </th>
                <th className="px-6 py-3 text-left text-base font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-2 py-3 text-center text-base font-medium text-gray-500 uppercase tracking-wider">
                  {tCommon('edit')}
                </th>
                <th className="px-2 py-3 text-center text-base font-medium text-gray-500 uppercase tracking-wider">
                  {tCommon('delete')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFaqs.map(faq => {
                const topic = topics.find(t => t.id === faq.topicId)
                
                return (
                  <tr key={faq.id} className="hover:bg-gray-50">
                    <td className="px-6 py-2 text-sm text-gray-900 max-w-xs truncate">
                      {faq.question}
                    </td>
                    <td className="px-6 py-2 text-sm text-gray-600 max-w-md truncate">
                      {faq.answer}
                    </td>
                    <td className="px-6 py-2 text-sm text-gray-600">
                      {topic ? getTopicPath(topic.id) : <span className="text-gray-400">{t('uncategorized')}</span>}
                    </td>
                    <td className="px-6 py-2">
                      <div className="flex items-center justify-center">
                        <div className={`w-3 h-3 rounded-full ${
                          faq.status === 'active' 
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}></div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        onClick={() => handleEdit(faq)}
                        title={tCommon('edit')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        onClick={() => handleDelete(faq.id, faq.question)}
                        title={tCommon('delete')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增/編輯 Modal */}
      <FaqModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        mode={modalMode}
        chatbotId={chatbotId}
        faqData={
          selectedFaq
            ? {
                id: selectedFaq.id,
                question: selectedFaq.question,
                answer: selectedFaq.answer,
                synonym: selectedFaq.synonym,
                status: selectedFaq.status,
                topicId: selectedFaq.topicId,
              }
            : undefined
        }
        topics={topics}
        onSuccess={handleModalSuccess}
      />

      {/* 刪除確認對話框 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('deleteConfirm')}
        message={faqToDelete ? `確定要刪除「${faqToDelete.question}」嗎？此操作無法復原。` : ''}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false)
          setFaqToDelete(null)
        }}
        type="danger"
      />
    </div>
  )
}

