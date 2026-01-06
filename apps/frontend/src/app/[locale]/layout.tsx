import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { AuthProvider } from '@/lib/auth/auth-provider'
import '../globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'QAPlus - Knowledge Base Management',
  description: 'Enterprise Knowledge Base Management System',
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
    <html lang={params.locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={params.locale} messages={messages}>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

