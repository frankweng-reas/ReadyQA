'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FaqList from './FaqList'
import TopicManager from './TopicManager'

interface KnowledgeManagerProps {
  chatbotId: string
}

export default function KnowledgeManager({ chatbotId }: KnowledgeManagerProps) {
  const t = useTranslations('knowledge')
  const [activeTab, setActiveTab] = useState<'list' | 'topics'>('list')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Sub Tabs */}
      <div className="border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('list')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'list'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('faqList')}
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'topics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('topics')}
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'list' && (
          <FaqList 
            chatbotId={chatbotId} 
            refreshTrigger={refreshTrigger}
            onRefresh={handleRefresh}
          />
        )}
        {activeTab === 'topics' && (
          <TopicManager 
            chatbotId={chatbotId}
            onRefresh={handleRefresh}
          />
        )}
      </div>
    </div>
  )
}

