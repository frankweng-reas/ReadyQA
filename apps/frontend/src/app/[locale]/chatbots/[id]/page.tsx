'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import ChatbotSidebarV2 from '@/components/chatbot/v2/ChatbotSidebarV2';
import QAManager from '@/components/chatbot/v2/QAManager';
import DesignManager from '@/components/chatbot/v2/DesignManager';
import PublishManager from '@/components/chatbot/v2/PublishManager';
import InsightManager from '@/components/chatbot/v2/InsightManager';
import { layout } from '@/config/layout';

type ViewType = 'knowledge' | 'design' | 'publish' | 'insight' | 'test';

export default function ChatbotDetailPage() {
  const params = useParams();
  const chatbotId = params.id as string;
  const locale = params.locale as string;
  const [currentView, setCurrentView] = useState<ViewType>('knowledge');

  // 檢查 chatbotId 是否有效
  if (!chatbotId || chatbotId === '[id]' || chatbotId.startsWith('[')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-500">無效的 Chatbot ID</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 左側 Sidebar */}
      <ChatbotSidebarV2 
        chatbotId={chatbotId} 
        locale={locale}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      {/* 右側區域 */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden bg-grey"
        style={{
          marginLeft: layout.rightArea.marginLeft,
          paddingTop: layout.rightArea.padding.top,
          paddingRight: layout.rightArea.padding.right,
          paddingBottom: layout.rightArea.padding.bottom,
          paddingLeft: layout.rightArea.padding.left,
        }}
      >
        {/* 主內容區（Header + Content） */}
        <div
          className="flex-1 min-h-0 overflow-hidden"
          style={{
            marginTop: layout.header.margin.top,
            marginRight: layout.header.margin.right,
            marginBottom: layout.content.margin.bottom,
            marginLeft: layout.header.margin.left,
            borderRadius: layout.header.borderRadius,
            overflow: 'hidden',
          }}
        >
          {currentView === 'knowledge' && <QAManager chatbotId={chatbotId} />}
          {currentView === 'design' && <DesignManager chatbotId={chatbotId} />}
          {currentView === 'publish' && <PublishManager chatbotId={chatbotId} />}
          {currentView === 'insight' && <InsightManager chatbotId={chatbotId} />}
        </div>
      </div>
    </div>
  );
}
