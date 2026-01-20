'use client';

import { useState } from 'react';
import { layout } from '@/config/layout';
import HelpModal from '@/components/ui/HelpModal';
import OverviewStats from '@/components/chatbot/v2/OverviewStats';
import QACardEditor from '@/components/chatbot/v2/QACardEditor';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface Topic {
  id: string;
  name: string;
  parentId: string | null;
}

interface InsightManagerProps {
  chatbotId: string;
  topics: Topic[];
}

export default function InsightManager({ chatbotId, topics }: InsightManagerProps) {
  const t = useTranslations('insight');
  const tCommon = useTranslations('common');
  const [activeTab, setActiveTab] = useState<'overview' | 'queries' | 'faqs' | 'sessions'>('overview');
  const [showHelp, setShowHelp] = useState(false);
  const [showQACardEditor, setShowQACardEditor] = useState(false);
  const [qaCardMode, setQaCardMode] = useState<'create' | 'edit'>('create');
  const [prefilledQuestion, setPrefilledQuestion] = useState<string>('');
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingFaqData, setEditingFaqData] = useState<any>(null);

  const handleCreateFaq = (question: string) => {
    console.log('[InsightManager] 創建 FAQ:', question);
    setQaCardMode('create');
    setPrefilledQuestion(question);
    setEditingFaqId(null);
    setEditingFaqData(null);
    setShowQACardEditor(true);
  };

  const handleEditFaq = async (faqId: string) => {
    console.log('[InsightManager] 編輯 FAQ:', faqId);
    try {
      // 載入 FAQ 詳細資料
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/faqs/${faqId}`
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setQaCardMode('edit');
          setEditingFaqId(faqId);
          setEditingFaqData({
            id: result.data.id,
            question: result.data.question,
            answer: result.data.answer,
            synonym: result.data.synonym || '',
            status: result.data.status,
            topicId: result.data.topicId,
          });
          setShowQACardEditor(true);
        }
      }
    } catch (error) {
      console.error('[InsightManager] 載入 FAQ 失敗:', error);
    }
  };

  const handleQACardSuccess = () => {
    setShowQACardEditor(false);
    setPrefilledQuestion('');
    setEditingFaqId(null);
    setEditingFaqData(null);
    // TODO: 可以觸發刷新統計數據
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
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
            />
          </svg>
          <h1 className="text-xl font-normal text-white">
            {t('title')}
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
              onClick={() => setActiveTab('overview')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'overview'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>{t('overview')}</span>
            </button>
            <button
              onClick={() => setActiveTab('queries')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'queries'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>{t('queries')}</span>
            </button>
            <button
              onClick={() => setActiveTab('faqs')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'faqs'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>{t('faqs')}</span>
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'sessions'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{t('sessions')}</span>
            </button>
          </div>
        </div>

        {/* 內容區域 */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            paddingLeft: layout.content.padding,
            paddingRight: layout.content.padding,
            paddingBottom: layout.content.padding,
          }}
        >
          {activeTab === 'overview' && (
            <OverviewStats 
              chatbotId={chatbotId} 
              onCreateFaq={handleCreateFaq}
              onEditFaq={handleEditFaq}
            />
          )}
          {activeTab === 'queries' && (
            <div className="space-y-6">
              {/* 待實作：查詢分析內容 */}
              <div className="text-center py-12">
                <p className="text-label">{t('queriesPlaceholder')}</p>
              </div>
            </div>
          )}
          {activeTab === 'faqs' && (
            <div className="space-y-6">
              {/* 待實作：問答分析內容 */}
              <div className="text-center py-12">
                <p className="text-label">{t('faqsPlaceholder')}</p>
              </div>
            </div>
          )}
          {activeTab === 'sessions' && (
            <div className="space-y-6">
              {/* 待實作：會話分析內容 */}
              <div className="text-center py-12">
                <p className="text-label">{t('sessionsPlaceholder')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        helpFile="insight"
      />

      {/* QA Card Editor Modal */}
      {showQACardEditor && (
        <QACardEditor
          isOpen={showQACardEditor}
          onClose={() => {
            setShowQACardEditor(false);
            setPrefilledQuestion('');
            setEditingFaqId(null);
            setEditingFaqData(null);
          }}
          mode={qaCardMode}
          chatbotId={chatbotId}
          faqData={qaCardMode === 'edit' && editingFaqData ? editingFaqData : {
            question: prefilledQuestion,
            answer: '',
            synonym: '',
            status: 'active',
            topicId: null,
          }}
          topics={topics}
          onSuccess={handleQACardSuccess}
        />
      )}
    </div>
  );
}
