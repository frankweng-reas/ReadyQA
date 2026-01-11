'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { chatbotApi } from '@/lib/api/chatbot';
import ChatbotSidebar from '@/components/chatbot/ChatbotSidebar';
import KnowledgeManager from '@/components/chatbot/KnowledgeManager';
import DesignManager from '@/components/chatbot/DesignManager';
import PublishManager from '@/components/chatbot/PublishManager';

interface Chatbot {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isActive: string;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    faqs: number;
    topics: number;
  };
}

type ViewType = 'knowledge' | 'design' | 'publish' | 'insight' | 'test';

export default function ChatbotDetailPage() {
  const t = useTranslations('common');
  const params = useParams();
  const chatbotId = params.id as string;
  const locale = params.locale as string;

  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('knowledge');

  useEffect(() => {
    const loadChatbot = async () => {
      setIsLoading(true);
      try {
        const data = await chatbotApi.getOne(chatbotId);
        setChatbot(data);
      } catch (error) {
        console.error('Failed to load chatbot:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (chatbotId) {
      loadChatbot();
    }
  }, [chatbotId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>{t('error')}</p>
      </div>
    );
  }

  return (
    <div 
      className={`flex h-screen overflow-hidden bg-gray-50`}
      style={currentView === 'design' ? { minWidth: '1350px' } : {}}
    >
      {/* Sidebar */}
      <ChatbotSidebar
        chatbotId={chatbotId}
        locale={locale}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* Main Content */}
      <div 
        className={`flex-1 h-full ${currentView === 'design' ? 'overflow-hidden' : currentView === 'publish' ? 'overflow-hidden' : 'overflow-auto'}`}
      >
        {currentView === 'knowledge' && <KnowledgeManager chatbotId={chatbotId} />}
        {currentView === 'design' && <DesignView chatbotId={chatbotId} />}
        {currentView === 'publish' && <PublishManager chatbotId={chatbotId} />}
        {currentView === 'insight' && <InsightPlaceholder />}
      </div>
    </div>
  );
}

// 占位組件（後續實現）
function DesignPlaceholder() {
  return (
    <div className="p-8">
      <div className="rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">設計功能</h3>
          <p className="mt-2 text-gray-600">自訂聊天機器人的外觀與樣式</p>
          <p className="mt-4 text-sm text-gray-500">即將推出...</p>
        </div>
      </div>
    </div>
  );
}

function DesignView({ chatbotId }: { chatbotId: string }) {
  return <DesignManager chatbotId={chatbotId} />;
}

function InsightPlaceholder() {
  return (
    <div className="p-8">
      <div className="rounded-lg border bg-white p-8 shadow-sm">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-4 text-lg font-semibold text-gray-900">分析功能</h3>
          <p className="mt-2 text-gray-600">查看使用統計與數據分析</p>
          <p className="mt-4 text-sm text-gray-500">即將推出...</p>
        </div>
      </div>
    </div>
  );
}
