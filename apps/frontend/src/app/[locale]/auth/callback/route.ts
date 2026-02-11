import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { locale: string } }
) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const locale = params.locale || 'zh-TW'

  if (code) {
    const response = NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set(name, '', options)
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)
    
    return response
  }

  // 如果沒有 code，導向登入頁
  return NextResponse.redirect(new URL(`/${locale}/login`, request.url))
}
