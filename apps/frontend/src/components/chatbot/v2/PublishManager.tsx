'use client';

import { layout } from '@/config/layout';
import { useTranslations } from 'next-intl';

interface PublishManagerProps {
  chatbotId: string;
}

export default function PublishManager({ chatbotId }: PublishManagerProps) {
  const t = useTranslations('publish');

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
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
          <h1 className="text-xl font-semibold text-header-text">
            發布設定
          </h1>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden bg-content-bg rounded-lg">
        {/* 內容區域 */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: layout.content.padding,
          }}
        >
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg 
                className="w-16 h-16 mx-auto text-gray-400 mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                />
              </svg>
              <p className="text-lg font-medium text-gray-700 mb-2">發布設定</p>
              <p className="text-label">內容待實作</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
