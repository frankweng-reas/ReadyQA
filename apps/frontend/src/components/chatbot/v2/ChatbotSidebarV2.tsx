'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { chatbotApi } from '@/lib/api/chatbot';
import { layout } from '@/config/layout';
import { cn } from '@/lib/utils';

interface ChatbotSidebarV2Props {
  chatbotId: string;
  locale: string;
  currentView?: 'knowledge' | 'design' | 'publish' | 'insight' | 'test';
  onViewChange?: (view: 'knowledge' | 'design' | 'publish' | 'insight' | 'test') => void;
}

export default function ChatbotSidebarV2({
  chatbotId,
  locale,
  currentView: externalCurrentView,
  onViewChange: externalOnViewChange,
}: ChatbotSidebarV2Props) {
  const router = useRouter();
  const t = useTranslations('chatbotSidebar');
  const [chatbotName, setChatbotName] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const [internalCurrentView, setInternalCurrentView] = useState<
    'knowledge' | 'design' | 'publish' | 'insight' | 'test'
  >('knowledge');

  // 使用外部傳入的 currentView，如果沒有則使用內部狀態
  const currentView = externalCurrentView ?? internalCurrentView;

  // 載入 chatbot 資訊
  useEffect(() => {
    // 檢查 chatbotId 是否有效
    if (!chatbotId || chatbotId === '[id]' || chatbotId.startsWith('[')) {
      console.warn('[ChatbotSidebarV2] 無效的 chatbotId:', chatbotId);
      return;
    }

    const loadChatbotInfo = async () => {
      try {
        const chatbot = await chatbotApi.getOne(chatbotId);
        setChatbotName(chatbot.name || '');
      } catch (error) {
        console.error('[ChatbotSidebarV2] 載入 chatbot 資訊失敗:', error);
        setChatbotName('');
      }
    };

    loadChatbotInfo();
  }, [chatbotId]);

  const handleViewChange = (
    view: 'knowledge' | 'design' | 'publish' | 'insight' | 'test'
  ) => {
    // 如果有外部的 onViewChange，優先使用
    if (externalOnViewChange) {
      externalOnViewChange(view);
    } else {
      setInternalCurrentView(view);
    }
  };

  const handleHome = () => {
    router.push(`/${locale}/dashboard`);
  };

  // 生成按鈕樣式的 helper 函數（已改用 Tailwind，保留以備不時之需）
  const getButtonStyle = (isActive: boolean) => ({
    height: layout.sidebar.itemHeight,
    paddingLeft: layout.sidebar.padding.x,
    paddingRight: layout.sidebar.padding.x,
  });

  // 獲取 icon 大小
  const getIconSize = () =>
    isCollapsed ? layout.sidebar.iconSizeCollapsed : layout.sidebar.iconSize;

  // 處理 hover 並計算位置
  const handleItemHover = (itemKey: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isCollapsed) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    });
    setHoveredItem(itemKey);
  };

  const handleItemLeave = () => {
    setHoveredItem(null);
    setTooltipPosition(null);
  };

  // 生成 tooltip 的 helper 函數（使用 Portal）
  const renderTooltip = (itemKey: string, label: string) => {
    if (!isCollapsed || hoveredItem !== itemKey || !tooltipPosition) return null;
    
    if (typeof window === 'undefined') return null;
    
    return createPortal(
      <div
        className="fixed px-3 py-2 bg-gray-900 text-white rounded-lg shadow-lg whitespace-nowrap pointer-events-none"
        style={{
          fontSize: layout.sidebar.itemFontSize,
          zIndex: 99999,
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translateY(-50%)',
        }}
      >
        {label}
        <div
          className="absolute right-full top-1/2 transform -translate-y-1/2"
          style={{
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: '6px solid #111827',
            marginRight: '-1px',
          }}
        ></div>
      </div>,
      document.body
    );
  };

  return (
    <div
      className="shadow-lg border-r border-sidebar-border h-screen flex flex-col transition-all duration-300 bg-sidebar-bg"
      style={{
        width: isCollapsed ? layout.sidebar.collapsedWidth : layout.sidebar.width,
      }}
    >
      {/* 標題區域 */}
      <div
        className="border-b border-sidebar-border flex items-center justify-center relative bg-sidebar-header-bg"
        style={{
          height: layout.sidebar.headerHeight,
          paddingLeft: layout.sidebar.padding.x,
          paddingRight: layout.sidebar.padding.x,
        }}
      >
        {isCollapsed ? (
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors"
          >
            <svg
              viewBox="0 0 140 100"
              style={{
                width: layout.sidebar.headerLogoSizeCollapsed,
                height: layout.sidebar.headerLogoSizeCollapsed,
              }}
            >
              {/* QA 主體文字 */}
              <text
                x="50"
                y="70"
                fontFamily="Arial, sans-serif"
                fontSize="60"
                fontWeight="bold"
                fill="#5AAFB0"
                textAnchor="middle"
              >
                QA
              </text>
              {/* 右上角 + 符號 */}
              <text
                x="100"
                y="35"
                fontFamily="Arial, sans-serif"
                fontSize="40"
                fontWeight="bold"
                fill="#5AAFB0"
              >
                +
              </text>
            </svg>
          </button>
        ) : (
          <svg
            viewBox="0 0 140 100"
            style={{
              width: layout.sidebar.headerLogoSize,
              height: layout.sidebar.headerLogoSize,
              flexShrink: 0,
            }}
          >
            {/* QA 主體文字 */}
            <text
              x="50"
              y="70"
              fontFamily="Arial, sans-serif"
              fontSize="60"
              fontWeight="bold"
              fill="#5AAFB0"
              textAnchor="middle"
            >
              QA
            </text>
            {/* 右上角 + 符號 */}
            <text
              x="100"
              y="35"
              fontFamily="Arial, sans-serif"
              fontSize="40"
              fontWeight="bold"
              fill="#5AAFB0"
            >
              +
            </text>
          </svg>
        )}
        {/* 折疊按鈕 - 只在展開時顯示 */}
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute right-2 p-2 rounded-lg hover:bg-white hover:bg-opacity-20 transition-colors text-sidebar-text-active"
          >
            <svg
              className="w-5 h-5"
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
        )}
      </div>

      {/* 功能選單 */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-visible space-y-2"
        style={{
          padding: layout.sidebar.padding.y,
          position: 'relative',
        }}
      >
        <button
          onClick={handleHome}
          className={cn(
            'w-full flex items-center transition-colors relative rounded-lg text-sidebar-text hover:bg-sidebar-bg-hover',
            isCollapsed ? 'justify-center' : ''
          )}
          style={{
            height: layout.sidebar.itemHeight,
            paddingLeft: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
            paddingRight: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
          }}
          onMouseEnter={(e) => {
            handleItemHover('home', e);
          }}
          onMouseLeave={handleItemLeave}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className={cn(isCollapsed ? '' : 'mr-4')}
            style={{
              width: isCollapsed
                ? layout.sidebar.iconSizeCollapsed
                : layout.sidebar.iconSize,
              height: isCollapsed
                ? layout.sidebar.iconSizeCollapsed
                : layout.sidebar.iconSize,
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          {!isCollapsed && (
            <span
              className="font-medium"
              style={{ fontSize: layout.sidebar.itemFontSize }}
            >
              {t('home')}
            </span>
          )}
          {renderTooltip('home', t('home'))}
        </button>

        <button
          onClick={() => handleViewChange('knowledge')}
          className={cn(
            'w-full flex items-center transition-colors relative rounded-lg',
            isCollapsed ? 'justify-center' : '',
            currentView === 'knowledge'
              ? 'bg-sidebar-bg-active text-sidebar-text-active'
              : 'text-sidebar-text hover:bg-sidebar-bg-hover'
          )}
          style={{
            height: layout.sidebar.itemHeight,
            paddingLeft: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
            paddingRight: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
          }}
          onMouseEnter={(e) => {
            handleItemHover('knowledge', e);
          }}
          onMouseLeave={handleItemLeave}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className={cn(isCollapsed ? '' : 'mr-4')}
            style={{
              width: getIconSize(),
              height: getIconSize(),
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>
          {!isCollapsed && (
            <span
              className="font-medium"
              style={{ fontSize: layout.sidebar.itemFontSize }}
            >
              {t('knowledge')}
            </span>
          )}
          {renderTooltip('knowledge', t('knowledge'))}
        </button>

        <button
          onClick={() => handleViewChange('design')}
          className={cn(
            'w-full flex items-center transition-colors relative rounded-lg',
            isCollapsed ? 'justify-center' : '',
            currentView === 'design'
              ? 'bg-sidebar-bg-active text-sidebar-text-active'
              : 'text-sidebar-text hover:bg-sidebar-bg-hover'
          )}
          style={{
            height: layout.sidebar.itemHeight,
            paddingLeft: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
            paddingRight: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
          }}
          onMouseEnter={(e) => {
            handleItemHover('design', e);
          }}
          onMouseLeave={handleItemLeave}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className={cn(isCollapsed ? '' : 'mr-4')}
            style={{
              width: getIconSize(),
              height: getIconSize(),
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          {!isCollapsed && (
            <span
              className="font-medium"
              style={{ fontSize: layout.sidebar.itemFontSize }}
            >
              {t('design')}
            </span>
          )}
          {renderTooltip('design', t('design'))}
        </button>

        <button
          onClick={() => handleViewChange('publish')}
          className={cn(
            'w-full flex items-center transition-colors relative rounded-lg',
            isCollapsed ? 'justify-center' : '',
            currentView === 'publish'
              ? 'bg-sidebar-bg-active text-sidebar-text-active'
              : 'text-sidebar-text hover:bg-sidebar-bg-hover'
          )}
          style={getButtonStyle(currentView === 'publish')}
          onMouseEnter={(e) => {
            handleItemHover('publish', e);
          }}
          onMouseLeave={handleItemLeave}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className={cn(isCollapsed ? '' : 'mr-4')}
            style={{
              width: getIconSize(),
              height: getIconSize(),
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          {!isCollapsed && (
            <span
              className="font-medium"
              style={{ fontSize: layout.sidebar.itemFontSize }}
            >
              {t('publish')}
            </span>
          )}
          {renderTooltip('publish', t('publish'))}
        </button>

        <button
          onClick={() => handleViewChange('insight')}
          className={cn(
            'w-full flex items-center transition-colors relative rounded-lg',
            isCollapsed ? 'justify-center' : '',
            currentView === 'insight'
              ? 'bg-sidebar-bg-active text-sidebar-text-active'
              : 'text-sidebar-text hover:bg-sidebar-bg-hover'
          )}
          style={getButtonStyle(currentView === 'insight')}
          onMouseEnter={(e) => {
            handleItemHover('insight', e);
          }}
          onMouseLeave={handleItemLeave}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className={cn(isCollapsed ? '' : 'mr-4')}
            style={{
              width: getIconSize(),
              height: getIconSize(),
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {!isCollapsed && (
            <span
              className="font-medium"
              style={{ fontSize: layout.sidebar.itemFontSize }}
            >
              {t('insight')}
            </span>
          )}
          {renderTooltip('insight', t('insight'))}
        </button>
      </nav>

      {/* Chatbot 名稱顯示區域 - 底部 */}
      <div
        className="border-t border-sidebar-border bg-sidebar-bg"
        style={{
          paddingLeft: layout.sidebar.padding.x,
          paddingRight: layout.sidebar.padding.x,
          paddingTop: layout.sidebar.padding.y,
          paddingBottom: layout.sidebar.padding.y,
        }}
      >
        <button
          onClick={() => {
            // TODO: 實作點擊功能
            console.log('[ChatbotSidebarV2] Chatbot info clicked');
          }}
          className={cn(
            'w-full flex items-center transition-colors relative rounded-lg text-sidebar-text hover:bg-sidebar-bg-hover',
            isCollapsed ? 'justify-center' : ''
          )}
          style={{
            height: layout.sidebar.itemHeight,
            paddingLeft: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
            paddingRight: isCollapsed
              ? layout.sidebar.paddingCollapsed.x
              : layout.sidebar.padding.x,
          }}
          onMouseEnter={(e) => {
            handleItemHover('chatbot', e);
          }}
          onMouseLeave={handleItemLeave}
        >
          <svg
            className={cn('flex-shrink-0', isCollapsed ? '' : 'mr-4')}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{
              width: isCollapsed
                ? layout.sidebar.iconSizeCollapsed
                : layout.sidebar.iconSize,
              height: isCollapsed
                ? layout.sidebar.iconSizeCollapsed
                : layout.sidebar.iconSize,
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          {!isCollapsed && (
            <span
              className="font-medium truncate"
              style={{ fontSize: layout.sidebar.itemFontSize }}
            >
              {chatbotName || t('loading')}
            </span>
          )}
          {renderTooltip('chatbot', chatbotName || t('loading'))}
        </button>
      </div>
    </div>
  );
}
