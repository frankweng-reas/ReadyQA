import type { Metadata } from 'next'
import { headers } from 'next/headers'

interface LayoutProps {
  children: React.ReactNode
  params: { id: string; locale: string }
}

async function getChatbotName(chatbotId: string): Promise<string | null> {
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/chatbots/${chatbotId}/public-config`
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host') || ''
    const proto = headersList.get('x-forwarded-proto') || 'https'
    const referer = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_APP_URL || ''

    const response = await fetch(apiUrl, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(referer && { Referer: referer }),
      },
    })

    if (response.ok) {
      const result = await response.json()
      if (result.success && result.data?.name) {
        return result.data.name
      }
    }
  } catch {
    // 忽略錯誤，使用 fallback
  }
  return null
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const chatbotName = await getChatbotName(params.id)
  return {
    title: chatbotName || 'ReadyQA - Knowledge Base Management',
  }
}

export default function ChatbotLayout({ children }: LayoutProps) {
  return <>{children}</>
}
