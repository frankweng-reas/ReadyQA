'use client';

import { useState } from 'react';
import { layout } from '@/config/layout';
import FaqList from '@/components/chatbot/v2/FaqList';
import TopicManager from '@/components/chatbot/v2/TopicManager';
import BulkUploadView from '@/components/chatbot/v2/BulkUploadView';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface QAManagerProps {
  chatbotId: string;
}

export default function QAManager({ chatbotId }: QAManagerProps) {
  const t = useTranslations('knowledge');
  const [activeTab, setActiveTab] = useState<'faq-list' | 'topics' | 'bulk-upload'>('faq-list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header
        className="flex-shrink-0 border-b border-header-border shadow-sm flex items-center bg-header-bg mb-4 rounded-lg"
        style={{
          height: layout.header.height,
          paddingLeft: layout.header.padding.x,
          paddingRight: layout.header.padding.x,
        }}
      >
        {/* 標題 */}
        <div className="flex items-center gap-3">
          <svg 
            className="w-6 h-6 text-primary" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h1 className="text-xl font-semibold text-header-text">
            {t('faqHeaderMessage')}
          </h1>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden bg-content-bg rounded-lg">
        {/* Tab 導航 */}
        <div className="flex-shrink-0 border-b border-header-border">
          <div
            className="flex space-x-1"
            style={{
              paddingLeft: layout.content.padding,
              paddingRight: layout.content.padding,
            }}
          >
            <button
              onClick={() => setActiveTab('faq-list')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg',
                activeTab === 'faq-list'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              {t('faqList')}
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg',
                activeTab === 'topics'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              {t('topics')}
            </button>
            <button
              onClick={() => setActiveTab('bulk-upload')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg',
                activeTab === 'bulk-upload'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              {t('bulkUploadTab')}
            </button>
          </div>
        </div>

        {/* 內容區域 */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: layout.content.padding,
          }}
        >
          {activeTab === 'faq-list' && (
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
          {activeTab === 'bulk-upload' && (
            <BulkUploadView
              chatbotId={chatbotId}
              onSuccess={handleRefresh}
            />
          )}
        </div>
      </div>
    </div>
  );
}
