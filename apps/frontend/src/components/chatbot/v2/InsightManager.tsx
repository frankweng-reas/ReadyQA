'use client';

import { useState } from 'react';
import { layout } from '@/config/layout';
import HelpModal from '@/components/ui/HelpModal';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface InsightManagerProps {
  chatbotId: string;
}

export default function InsightManager({ chatbotId }: InsightManagerProps) {
  const t = useTranslations('insight');
  const tCommon = useTranslations('common');
  const [activeTab, setActiveTab] = useState<'overview' | 'queries' | 'faqs' | 'sessions'>('overview');
  const [showHelp, setShowHelp] = useState(false);

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
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg',
                activeTab === 'overview'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              {t('overview')}
            </button>
            <button
              onClick={() => setActiveTab('queries')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg',
                activeTab === 'queries'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              {t('queries')}
            </button>
            <button
              onClick={() => setActiveTab('faqs')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg',
                activeTab === 'faqs'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              {t('faqs')}
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg',
                activeTab === 'sessions'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              {t('sessions')}
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
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 待實作：總覽內容 */}
              <div className="text-center py-12">
                <p className="text-label">{t('overviewPlaceholder')}</p>
              </div>
            </div>
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
    </div>
  );
}
