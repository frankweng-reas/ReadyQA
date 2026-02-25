import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { AuthProvider } from '@/lib/auth/auth-provider'
import { NotificationProvider } from '@/lib/notifications/NotificationProvider'
import '../globals.css'

export const metadata: Metadata = {
  title: 'ReadyQA',
  description: 'Q&A Management System Powered by AI',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%238739F9"/><text x="50" y="70" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">Q</text></svg>',
  },
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  // 載入翻譯訊息
  const messages = await getMessages({ locale: params.locale })

  return (
    <NextIntlClientProvider locale={params.locale} messages={messages}>
      <AuthProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </AuthProvider>
    </NextIntlClientProvider>
  )
}

