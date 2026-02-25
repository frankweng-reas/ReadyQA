import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ReadyQA',
  description: 'AI 驅動的問答庫管理系統',
}

/**
 * Root layout：必須有 html/body，AuthProvider 僅在 [locale]/layout 保留一層
 * suppressHydrationWarning：避免 body class 與 browser 擴充套件造成的 hydration 警告
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

