'use client';

import { useState, useEffect } from 'react';
import { layout } from '@/config/layout';
import FaqList from '@/components/chatbot/v2/FaqList';
import TopicManager from '@/components/chatbot/v2/TopicManager';
import BulkUploadView from '@/components/chatbot/v2/BulkUploadView';
import AIMultiCard from '@/components/chatbot/v2/AIMultiCard';
import QACardEditor from '@/components/chatbot/v2/QACardEditor';
import SortManager from '@/components/chatbot/v2/SortManager';
import HelpModal from '@/components/ui/HelpModal';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface Topic {
  id: string
  name: string
  parentId: string | null
}

interface QAManagerProps {
  chatbotId: string;
}

export default function QAManager({ chatbotId }: QAManagerProps) {
  const t = useTranslations('knowledge');
  const tCommon = useTranslations('common');
  const [activeTab, setActiveTab] = useState<'faq-list' | 'topics' | 'bulk-upload' | 'ai-cards' | 'sort'>('faq-list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showQACardEditor, setShowQACardEditor] = useState(false);
  const [qaCardMode, setQaCardMode] = useState<'create' | 'edit'>('create');
  const [qaCardData, setQaCardData] = useState<any>(null);
  const [qaCardSaveCallback, setQaCardSaveCallback] = useState<((cardId: string) => void) | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);

  // 載入 topics
  useEffect(() => {
    const loadTopics = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/topics?chatbotId=${chatbotId}`
        )
        if (response.ok) {
          const result = await response.json()
          // API 回傳格式: { success: true, data: [...], total: 6 }
          setTopics(result.data || [])
        }
      } catch (error) {
        console.error('[QAManager] 載入 topics 失敗:', error)
      }
    }
    loadTopics()
  }, [chatbotId, refreshTrigger])

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleQnACardOpen = (mode: 'create' | 'edit', faqData?: any, onSaveSuccess?: (cardId: string) => void) => {
    setQaCardMode(mode);
    setQaCardData(faqData);
    setQaCardSaveCallback(() => onSaveSuccess || null);
    setShowQACardEditor(true);
  };

  const handleQACardSuccess = () => {
    // 如果有回調函數，執行它
    if (qaCardSaveCallback && qaCardData?._aiCardId) {
      qaCardSaveCallback(qaCardData._aiCardId);
    }
    handleRefresh();
    setShowQACardEditor(false);
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
            className="w-6 h-6 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
          <h1 className="text-xl font-normal text-white">
            {t('faqHeaderMessage')}
          </h1>
        </div>

        {/* 右側按鈕區 */}
        <div className="ml-auto flex items-center gap-3">
          {/* Help 按鈕 */}
          <button
            onClick={() => setShowHelp(true)}
            className="relative group w-8 h-8 rounded-full flex items-center justify-center border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-700 transition-all duration-200 shadow-sm hover:shadow"
          >
            <span className="text-base font-semibold">？</span>
            <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
              {tCommon('help')}
            </span>
          </button>
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
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'faq-list'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>{t('faqList')}</span>
            </button>
            <button
              onClick={() => setActiveTab('topics')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'topics'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>{t('topics')}</span>
            </button>
            <button
              onClick={() => setActiveTab('bulk-upload')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'bulk-upload'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>{t('bulkUploadTab')}</span>
            </button>
            <button
              onClick={() => setActiveTab('ai-cards')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'ai-cards'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>{t('aiCardsTab')}</span>
            </button>
            <button
              onClick={() => setActiveTab('sort')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'sort'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
              <span>排序管理</span>
            </button>
          </div>
        </div>

        {/* 內容區域：僅渲染當前 tab 以加快首次載入 */}
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
          {activeTab === 'ai-cards' && (
            <AIMultiCard
              isOpen={true}
              onClose={() => {}}
              chatbotId={chatbotId}
              onQnACardOpen={handleQnACardOpen}
              onRefresh={handleRefresh}
              inModal={false}
            />
          )}
          {activeTab === 'sort' && (
            <SortManager
              chatbotId={chatbotId}
              onRefresh={handleRefresh}
            />
          )}
        </div>
      </div>

      {/* QA Card Editor Modal */}
      {showQACardEditor && (
        <QACardEditor
          isOpen={showQACardEditor}
          onClose={() => setShowQACardEditor(false)}
          mode={qaCardMode}
          chatbotId={chatbotId}
          faqData={qaCardData}
          topics={topics}
          onSuccess={handleQACardSuccess}
        />
      )}

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        helpFile="knowledge"
      />
    </div>
  );
}
