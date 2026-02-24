import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ReadyQA',
  description: 'AI 驅動的問答庫管理系統',
}

/**
 * Root layout：必須有 html/body，AuthProvider 僅在 [locale]/layout 保留一層
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}

