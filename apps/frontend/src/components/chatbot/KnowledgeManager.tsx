'use client'

import { useState } from 'react'
import KnowledgeSidebar from './KnowledgeSidebar'
import FaqList from './FaqList'
import TopicManager from './TopicManager'
import BulkUploadView from './BulkUploadView'

type KnowledgeSubView = 'list' | 'topics' | 'bulk-upload'

interface KnowledgeManagerProps {
  chatbotId: string
}

export default function KnowledgeManager({ chatbotId }: KnowledgeManagerProps) {
  const [subView, setSubView] = useState<KnowledgeSubView>('list')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* 二級 Sidebar */}
      <KnowledgeSidebar
        currentSubView={subView}
        onSubViewChange={setSubView}
      />

      {/* 主內容區 */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-lg shadow m-6">
          {subView === 'list' && (
            <div className="p-6">
              <FaqList
                chatbotId={chatbotId}
                refreshTrigger={refreshTrigger}
                onRefresh={handleRefresh}
              />
            </div>
          )}
          {subView === 'topics' && (
            <div className="p-6">
              <TopicManager
                chatbotId={chatbotId}
                onRefresh={handleRefresh}
              />
            </div>
          )}
          {subView === 'bulk-upload' && (
            <BulkUploadView
              chatbotId={chatbotId}
              onSuccess={handleRefresh}
            />
          )}
        </div>
      </div>
    </div>
  )
}

