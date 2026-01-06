'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { topicApi } from '@/lib/api/topic'
import FaqModal from './FaqModal'

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

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/faqs/${id}`,
        { method: 'DELETE' }
      )
      
      if (!response.ok) throw new Error('Failed to delete FAQ')
      
      onRefresh()
    } catch (error) {
      console.error('[FaqList] Failed to delete FAQ:', error)
      alert(t('deleteFailed'))
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
      {/* 工具列 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* 搜尋框 */}
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />

          {/* Topic 篩選 */}
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">{t('allTopics')}</option>
            <option value="uncategorized">{t('uncategorized')}</option>
            {renderTopicOptions(null, 0)}
          </select>
        </div>

        <Button onClick={handleCreate}>
          + {t('createFaq')}
        </Button>
      </div>

      {/* 統計 */}
      <div className="text-sm text-gray-600">
        {t('showingCount', { 
          count: filteredFaqs.length,
          total: faqs.length 
        })}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('question')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('answer')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('topic')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('status')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t('hitCount')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredFaqs.map(faq => {
                const topic = topics.find(t => t.id === faq.topicId)
                
                return (
                  <tr key={faq.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {faq.question}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                      {faq.answer}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {topic ? getTopicPath(topic.id) : <span className="text-gray-400">{t('uncategorized')}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        faq.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {faq.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {faq.hitCount || 0}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => handleEdit(faq)}
                      >
                        {tCommon('edit')}
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        onClick={() => handleDelete(faq.id)}
                      >
                        {tCommon('delete')}
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
    </div>
  )
}

