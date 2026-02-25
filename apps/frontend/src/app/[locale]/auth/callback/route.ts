import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** 取得正確的 base URL（nginx 反向代理時 request.url 可能為內部位址） */
function getBaseUrl(request: NextRequest): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) return appUrl
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : request.url
}

export async function GET(
  request: NextRequest,
  { params }: { params: { locale: string } }
) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  const locale = params.locale || 'zh-TW'
  const baseUrl = getBaseUrl(request)

  // 處理 Supabase 導向的錯誤（例如確認連結過期）
  if (error) {
    console.error('[Auth Callback] Supabase redirect error:', error, errorDescription)
    const loginUrl = new URL(`/${locale}/login`, baseUrl)
    loginUrl.searchParams.set('error', error)
    if (errorDescription) loginUrl.searchParams.set('message', errorDescription)
    return NextResponse.redirect(loginUrl)
  }

  if (code) {
    const response = NextResponse.redirect(new URL(`/${locale}/dashboard`, baseUrl))

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

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('[Auth Callback] exchangeCodeForSession failed:', exchangeError.message)
      const loginUrl = new URL(`/${locale}/login`, baseUrl)
      loginUrl.searchParams.set('error', exchangeError.message)
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  // 如果沒有 code，導向登入頁
  return NextResponse.redirect(new URL(`/${locale}/login`, baseUrl))
}
