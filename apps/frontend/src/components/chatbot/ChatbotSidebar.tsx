'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { chatbotApi } from '@/lib/api/chatbot';

interface ChatbotSidebarProps {
  chatbotId: string;
  locale: string;
  currentView?: 'knowledge' | 'design' | 'publish' | 'insight' | 'test';
  onViewChange?: (view: 'knowledge' | 'design' | 'publish' | 'insight' | 'test') => void;
}

export default function ChatbotSidebar({
  chatbotId,
  locale,
  currentView = 'knowledge',
  onViewChange,
}: ChatbotSidebarProps) {
  const router = useRouter();
  const t = useTranslations('chatbotSidebar');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [chatbotName, setChatbotName] = useState<string>('QAPlus');

  // 載入 chatbot 資訊
  useEffect(() => {
    const loadChatbotInfo = async () => {
      try {
        const chatbot = await chatbotApi.getOne(chatbotId);
        setChatbotName(chatbot.name || 'QAPlus');
      } catch (error) {
        console.error('載入 chatbot 資訊失敗:', error);
      }
    };

    loadChatbotInfo();
  }, [chatbotId]);

  const handleViewChange = (view: 'knowledge' | 'design' | 'publish' | 'insight' | 'test') => {
    if (onViewChange) {
      onViewChange(view);
    }
  };

  const handleHome = () => {
    router.push(`/${locale}/dashboard`);
  };

  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white shadow-lg border-r border-gray-200 h-screen flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-48'
      }`}
    >
      {/* 標題區域 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  {chatbotName}
                </h2>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  ID: {chatbotId.substring(0, 8)}...
                </p>
              </div>
            </motion.div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 flex-shrink-0"
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 功能選單 */}
      <nav className="flex-1 p-4 space-y-2">
        {/* Home */}
        <div className="relative group">
          <button
            onClick={handleHome}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 hover:bg-gray-50 hover:text-gray-700 ${
              isCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-gray-600 group-hover:text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="font-medium">
                {t('home')}
              </span>
            )}
          </button>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              {t('backToHome')}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-300 my-2"></div>

        {/* Knowledge */}
        <div className="relative group">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleViewChange('knowledge')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
              isCollapsed ? 'justify-center' : ''
            } ${
              currentView === 'knowledge'
                ? 'bg-cyan-100 text-cyan-700 border border-cyan-200'
                : 'hover:bg-cyan-50 hover:text-cyan-700'
            }`}
          >
            <div className="flex-shrink-0">
              <svg
                className={`w-6 h-6 ${
                  currentView === 'knowledge'
                    ? 'text-cyan-600'
                    : 'text-gray-600 group-hover:text-cyan-600'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="font-medium"
              >
                {t('knowledge')}
              </motion.span>
            )}
          </motion.button>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              {t('knowledge')}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
            </div>
          )}
        </div>

        {/* Design */}
        <div className="relative group">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleViewChange('design')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
              isCollapsed ? 'justify-center' : ''
            } ${
              currentView === 'design'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            <div className="flex-shrink-0">
              <svg
                className={`w-6 h-6 ${
                  currentView === 'design'
                    ? 'text-blue-600'
                    : 'text-gray-600 group-hover:text-blue-600'
                }`}
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
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="font-medium"
              >
                {t('design')}
              </motion.span>
            )}
          </motion.button>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              {t('design')}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
            </div>
          )}
        </div>

        {/* Publish */}
        <div className="relative group">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleViewChange('publish')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
              isCollapsed ? 'justify-center' : ''
            } ${
              currentView === 'publish'
                ? 'bg-orange-100 text-orange-700 border border-orange-200'
                : 'hover:bg-orange-50 hover:text-orange-700'
            }`}
          >
            <div className="flex-shrink-0">
              <svg
                className={`w-6 h-6 ${
                  currentView === 'publish'
                    ? 'text-orange-600'
                    : 'text-gray-600 group-hover:text-orange-600'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="font-medium"
              >
                {t('publish')}
              </motion.span>
            )}
          </motion.button>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              {t('publish')}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-300 my-2"></div>

        {/* Insight */}
        <div className="relative group">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleViewChange('insight')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors duration-200 ${
              isCollapsed ? 'justify-center' : ''
            } ${
              currentView === 'insight'
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            <div className="flex-shrink-0">
              <svg
                className={`w-6 h-6 ${
                  currentView === 'insight'
                    ? 'text-purple-600'
                    : 'text-gray-600 group-hover:text-purple-600'
                }`}
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
            </div>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="font-medium"
              >
                {t('insight')}
              </motion.span>
            )}
          </motion.button>
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
              {t('insight')}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
            </div>
          )}
        </div>
      </nav>

      {/* 底部區域 */}
      <div className="p-4 border-t border-gray-200">
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs text-gray-500 text-center"
          >
            v1.0.0
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

