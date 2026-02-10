'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { layout } from '@/config/layout'
import { cn } from '@/lib/utils'

interface TestSidebarProps {
  currentView: 'subscription' | 'other'
  onViewChange: (view: 'subscription' | 'other') => void
  locale: string
}

export default function TestSidebar({
  currentView,
  onViewChange,
  locale,
}: TestSidebarProps) {
  const t = useTranslations('test')
  const router = useRouter()

  const handleBackToDashboard = () => {
    router.push(`/${locale}/dashboard`)
  }

  return (
    <div
      className="shadow-lg border-r border-gray-200 h-screen flex flex-col bg-white"
      style={{
        width: layout.sidebar.width,
      }}
    >
      {/* 標題區域 */}
      <div
        className="border-b border-gray-200 flex items-center justify-center bg-gray-50"
        style={{
          height: layout.sidebar.headerHeight,
          paddingLeft: layout.sidebar.padding.x,
          paddingRight: layout.sidebar.padding.x,
        }}
      >
        <div className="text-gray-900 flex items-center justify-center w-full font-bold" style={{
          fontSize: '1.5rem',
          letterSpacing: '-1px',
          fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        }}>
          {t('sidebar.title')}
        </div>
      </div>

      {/* 功能選單 */}
      <nav
        className="flex-1 overflow-y-auto space-y-2"
        style={{
          padding: layout.sidebar.padding.y,
        }}
      >
        {/* 返回 Dashboard */}
        <button
          onClick={handleBackToDashboard}
          className={cn(
            'w-full flex items-center transition-colors rounded-lg text-gray-700 hover:bg-gray-100'
          )}
          style={{
            height: layout.sidebar.itemHeight,
            paddingLeft: layout.sidebar.padding.x,
            paddingRight: layout.sidebar.padding.x,
          }}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="mr-4"
            style={{
              width: layout.sidebar.iconSize,
              height: layout.sidebar.iconSize,
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span
            className="font-medium"
            style={{ fontSize: layout.sidebar.itemFontSize }}
          >
            {t('sidebar.backToDashboard')}
          </span>
        </button>

        {/* 訂閱測試 */}
        <button
          onClick={() => onViewChange('subscription')}
          className={cn(
            'w-full flex items-center transition-colors rounded-lg',
            currentView === 'subscription'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          )}
          style={{
            height: layout.sidebar.itemHeight,
            paddingLeft: layout.sidebar.padding.x,
            paddingRight: layout.sidebar.padding.x,
          }}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="mr-4"
            style={{
              width: layout.sidebar.iconSize,
              height: layout.sidebar.iconSize,
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span
            className="font-medium"
            style={{ fontSize: layout.sidebar.itemFontSize }}
          >
            {t('sidebar.subscriptionTest')}
          </span>
        </button>

        {/* 其他 */}
        <button
          onClick={() => onViewChange('other')}
          className={cn(
            'w-full flex items-center transition-colors rounded-lg',
            currentView === 'other'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          )}
          style={{
            height: layout.sidebar.itemHeight,
            paddingLeft: layout.sidebar.padding.x,
            paddingRight: layout.sidebar.padding.x,
          }}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="mr-4"
            style={{
              width: layout.sidebar.iconSize,
              height: layout.sidebar.iconSize,
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span
            className="font-medium"
            style={{ fontSize: layout.sidebar.itemFontSize }}
          >
            {t('sidebar.other')}
          </span>
        </button>
      </nav>
    </div>
  )
}
