'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { topicApi } from '@/lib/api/topic'
import QACardEditor from '@/components/chatbot/v2/QACardEditor'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import { useNotification } from '@/hooks/useNotification'

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
  const notify = useNotification()

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
  const [activeFilter, setActiveFilter] = useState<'' | 'active' | 'inactive' | 'uncategorized'>('')
  
  // 批量操作狀態
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBatchActions, setShowBatchActions] = useState(false)
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false)
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)

  // 計算統計數據
  const stats = {
    total: faqs.length,
    active: faqs.filter((faq) => faq.status === 'active').length,
    inactive: faqs.filter((faq) => faq.status === 'inactive').length,
    uncategorized: faqs.filter((faq) => !faq.topicId).length,
  }

  const handleFilterClick = (filter: '' | 'active' | 'inactive' | 'uncategorized') => {
    setActiveFilter(activeFilter === filter ? '' : filter)
  }

  const loadFaqs = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/faqs?chatbotId=${chatbotId}&limit=500`
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

  useEffect(() => {
    loadFaqs()
    loadTopics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatbotId, refreshTrigger])

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
      notify.success(t('deleteSuccess'))
    } catch (error) {
      console.error('[FaqList] Failed to delete FAQ:', error)
      notify.error(t('deleteFailed'))
      setShowDeleteConfirm(false)
      setFaqToDelete(null)
    }
  }

  const handleModalSuccess = () => {
    onRefresh()
    setShowModal(false)
  }

  // 批量操作函數
  const handleSelectAll = () => {
    if (selectedIds.length === filteredFaqs.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredFaqs.map(faq => faq.id))
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleBatchUpdateTopic = async (topicId: string | null) => {
    try {
      setIsBatchProcessing(true)
      const promises = selectedIds.map(id =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/faqs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topicId }),
        })
      )
      await Promise.all(promises)
      setSelectedIds([])
      setShowBatchActions(false)
      onRefresh()
      notify.success(t('updateSuccess'))
    } catch (error) {
      console.error('[FaqList] Batch update failed:', error)
      notify.error(t('saveFailed'))
    } finally {
      setIsBatchProcessing(false)
    }
  }

  const handleBatchUpdateStatus = async (status: 'active' | 'inactive') => {
    try {
      setIsBatchProcessing(true)
      const promises = selectedIds.map(id =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/faqs/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      )
      await Promise.all(promises)
      setSelectedIds([])
      setShowBatchActions(false)
      onRefresh()
      notify.success(t('updateSuccess'))
    } catch (error) {
      console.error('[FaqList] Batch update status failed:', error)
      notify.error(t('saveFailed'))
    } finally {
      setIsBatchProcessing(false)
    }
  }

  const handleBatchDelete = async () => {
    setShowBatchDeleteConfirm(true)
  }

  const confirmBatchDelete = async () => {
    try {
      setIsBatchProcessing(true)
      const promises = selectedIds.map(id =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/faqs/${id}`, {
          method: 'DELETE',
        })
      )
      await Promise.all(promises)
      setSelectedIds([])
      setShowBatchActions(false)
      setShowBatchDeleteConfirm(false)
      onRefresh()
      notify.success(t('deleteSuccess'))
    } catch (error) {
      console.error('[FaqList] Batch delete failed:', error)
      notify.error(t('deleteFailed'))
      setShowBatchDeleteConfirm(false)
    } finally {
      setIsBatchProcessing(false)
    }
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
    // 統計按鈕篩選
    if (activeFilter) {
      if (activeFilter === 'active' && faq.status !== 'active') return false
      if (activeFilter === 'inactive' && faq.status !== 'inactive') return false
      if (activeFilter === 'uncategorized' && faq.topicId) return false
    }

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
      {/* 批量操作欄 */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-base font-medium text-blue-900">
              {isBatchProcessing ? '處理中...' : `已選擇 ${selectedIds.length} 個項目`}
            </span>
            {isBatchProcessing ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="text-base text-gray-600">正在批量處理...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  className="px-3 py-1.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchUpdateTopic(e.target.value === 'null' ? null : e.target.value)
                      e.target.value = ''
                    }
                  }}
                  defaultValue=""
                  disabled={isBatchProcessing}
                >
                  <option value="">設定分類</option>
                  <option value="null">{t('noTopic')}</option>
                  {renderTopicOptions(null, 0)}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBatchUpdateStatus('active')}
                  disabled={isBatchProcessing}
                >
                  啟用
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleBatchUpdateStatus('inactive')}
                  disabled={isBatchProcessing}
                >
                  停用
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleBatchDelete}
                  disabled={isBatchProcessing}
                >
                  刪除
                </Button>
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds([])}
            disabled={isBatchProcessing}
          >
            取消選擇
          </Button>
        </div>
      )}

      {/* 工具列 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* 搜尋框 */}
          <Input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-60"
          />

          {/* Topic 篩選 */}
          <Select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="w-48"
          >
            <option value="">{t('allTopics')}</option>
            <option value="uncategorized">{t('uncategorized')}</option>
            {renderTopicOptions(null, 0)}
          </Select>

          {/* 統計按鈕 */}
          <button 
            onClick={() => handleFilterClick('')}
            className={cn(
              'px-4 py-2 text-lg font-medium rounded-full border transition-colors whitespace-nowrap',
              activeFilter === '' 
                ? 'bg-primary text-white border-primary'
                : 'bg-grey text-text border-header-border hover:bg-grey/80'
            )}
          >
            {t('statsTotal', { count: stats.total })}
          </button>
          <button 
            onClick={() => handleFilterClick('active')}
            className={cn(
              'px-4 py-2 text-lg font-medium rounded-full border transition-colors whitespace-nowrap',
              activeFilter === 'active' 
                ? 'bg-primary text-white border-primary'
                : 'bg-grey text-text border-header-border hover:bg-grey/80'
            )}
          >
            {t('statsActive', { count: stats.active })}
          </button>
          <button 
            onClick={() => handleFilterClick('inactive')}
            className={cn(
              'px-4 py-2 text-lg font-medium rounded-full border transition-colors whitespace-nowrap',
              activeFilter === 'inactive' 
                ? 'bg-primary text-white border-primary'
                : 'bg-grey text-text border-header-border hover:bg-grey/80'
            )}
          >
            {t('statsInactive', { count: stats.inactive })}
          </button>
          <button 
            onClick={() => handleFilterClick('uncategorized')}
            className={cn(
              'px-4 py-2 text-lg font-medium rounded-full border transition-colors whitespace-nowrap',
              activeFilter === 'uncategorized' 
                ? 'bg-primary text-white border-primary'
                : 'bg-grey text-text border-header-border hover:bg-grey/80'
            )}
          >
            {t('statsUncategorized', { count: stats.uncategorized })}
          </button>
        </div>

        {/* 新增問答按鈕 */}
        <Button 
          onClick={handleCreate} 
          variant="primary" 
          className="whitespace-nowrap"
        >
          + {t('createFaq')}
        </Button>
      </div>

      {/* FAQ 列表 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary border-t-transparent mx-auto"></div>
        </div>
      ) : filteredFaqs.length === 0 ? (
        <div className="text-center py-12 text-label">
          {searchQuery || selectedTopicId ? t('noResultsFound') : t('noFaqs')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y border-disabled">
            <thead className="bg-grey">
              <tr>
                <th className="px-4 py-3 text-center text-base font-medium uppercase tracking-wider text-label w-12">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredFaqs.length && filteredFaqs.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-left text-base font-medium uppercase tracking-wider text-label">
                  {t('question')}
                </th>
                <th className="px-6 py-3 text-left text-base font-medium uppercase tracking-wider text-label">
                  {t('answer')}
                </th>
                <th className="px-6 py-3 text-left text-base font-medium uppercase tracking-wider text-label">
                  {t('topic')}
                </th>
                <th className="px-6 py-3 text-left text-base font-medium uppercase tracking-wider text-label">
                  {t('status')}
                </th>
                <th className="px-2 py-3 text-center text-base font-medium uppercase tracking-wider text-label">
                  {tCommon('edit')}
                </th>
                <th className="px-2 py-3 text-center text-base font-medium uppercase tracking-wider text-label">
                  {tCommon('delete')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y bg-content-bg border-disabled">
              {filteredFaqs.map(faq => {
                const topic = topics.find(t => t.id === faq.topicId)
                
                return (
                  <tr 
                    key={faq.id} 
                    className="transition-colors hover:bg-grey"
                  >
                    <td className="px-4 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(faq.id)}
                        onChange={() => handleSelectOne(faq.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-2 max-w-xs truncate text-base text-text">
                      {faq.question}
                    </td>
                    <td className="px-6 py-2 max-w-md truncate text-base text-label">
                      {faq.answer}
                    </td>
                    <td className="px-6 py-2 text-base text-label">
                      {topic ? getTopicPath(topic.id) : <span className="text-disabled">{t('uncategorized')}</span>}
                    </td>
                    <td className="px-6 py-2">
                      <div className="flex items-center justify-center">
                        <div 
                          className={cn(
                            'w-3 h-3 rounded-full',
                            faq.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                          )}
                        ></div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button
                        className="p-2 rounded-full transition-colors text-primary hover:bg-primary/10"
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
                        className="p-2 rounded-full transition-colors text-red-600 hover:bg-red-50"
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
      <QACardEditor
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

      {/* 批量刪除確認對話框 */}
      <ConfirmDialog
        isOpen={showBatchDeleteConfirm}
        title={t('deleteConfirm')}
        message={`確定要刪除 ${selectedIds.length} 個問答嗎？此操作無法復原。`}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        onConfirm={confirmBatchDelete}
        onCancel={() => setShowBatchDeleteConfirm(false)}
        type="danger"
      />
    </div>
  )
}
