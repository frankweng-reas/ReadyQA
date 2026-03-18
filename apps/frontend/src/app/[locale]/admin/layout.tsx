'use client'

import { useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { layout } from '@/config/layout'
import { cn } from '@/lib/utils'

/**
 * Admin 區塊 Layout - 參考 ChatbotSidebarV2 樣式
 * 全頁字體不小於 16px
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('admin')
  const params = useParams()
  const pathname = usePathname()
  const locale = params.locale as string

  const navItems = [
    { href: `/${locale}/admin/users`, label: t('nav.users') },
    { href: `/${locale}/admin/user-plan`, label: t('nav.userPlan') },
  ]

  return (
    <div className="admin-layout flex h-screen overflow-hidden bg-gray-50 text-base" style={{ fontSize: '16px' }}>
      {/* 左側 Sidebar - 參考 ChatbotSidebarV2 */}
      <aside
        className="flex h-screen flex-col border-r border-sidebar-border bg-sidebar-bg shadow-lg"
        style={{ width: layout.sidebar.width }}
      >
        {/* 標題區域 */}
        <div
          className="flex items-center justify-between border-b border-sidebar-border bg-sidebar-header-bg"
          style={{
            height: layout.sidebar.headerHeight,
            paddingLeft: layout.sidebar.padding.x,
            paddingRight: layout.sidebar.padding.x,
          }}
        >
          <h1
            className="font-bold text-sidebar-text-active"
            style={{ fontSize: layout.sidebar.headerFontSize }}
          >
            {t('title')}
          </h1>
        </div>

        {/* 功能選單 */}
        <nav
          className="flex-1 space-y-2 overflow-y-auto overflow-x-visible"
          style={{ padding: layout.sidebar.padding.y }}
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex w-full items-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-sidebar-bg-active text-sidebar-text-active'
                    : 'text-sidebar-text hover:bg-sidebar-bg-hover'
                )}
                style={{
                  height: layout.sidebar.itemHeight,
                  paddingLeft: layout.sidebar.padding.x,
                  paddingRight: layout.sidebar.padding.x,
                  fontSize: layout.sidebar.itemFontSize,
                }}
              >
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* 底部：返回 Dashboard */}
        <div
          className="border-t border-sidebar-border bg-sidebar-bg"
          style={{
            paddingLeft: layout.sidebar.padding.x,
            paddingRight: layout.sidebar.padding.x,
            paddingTop: layout.sidebar.padding.y,
            paddingBottom: layout.sidebar.padding.y,
          }}
        >
          <Link
            href={`/${locale}/dashboard`}
            className="flex w-full items-center rounded-lg text-sidebar-text transition-colors hover:bg-sidebar-bg-hover"
            style={{
              height: layout.sidebar.itemHeight,
              paddingLeft: layout.sidebar.padding.x,
              paddingRight: layout.sidebar.padding.x,
              fontSize: layout.sidebar.itemFontSize,
            }}
          >
            <span className="font-medium">{t('backToDashboard')}</span>
          </Link>
        </div>
      </aside>

      {/* 右側主內容 */}
      <main className="min-w-0 flex-1 overflow-auto p-6" style={{ fontSize: '16px' }}>
        {children}
      </main>
    </div>
  )
}
