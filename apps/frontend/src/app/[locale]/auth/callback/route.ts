import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** 取得正確的 base URL（nginx 反向代理時 request.url 可能為內部位址） */
function getBaseUrl(request: NextRequest): string {
  // 優先使用 request 的 host，確保 redirect 留在用戶當前網域（dev 用 localhost 存取時不會被導到 production URL）
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  if (host) return `${proto}://${host}`
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) return appUrl
  return request.url
}

export async function GET(
  request: NextRequest,
  { params }: { params: { locale: string } }
) {
  const locale = params.locale || 'zh-TW'

  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')
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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('[Auth Callback] 缺少 Supabase 環境變數')
        const loginUrl = new URL(`/${locale}/login`, baseUrl)
        loginUrl.searchParams.set('error', 'auth_config_error')
        return NextResponse.redirect(loginUrl)
      }

      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
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
  } catch (err) {
    console.error('[Auth Callback] 未預期錯誤:', err)
    const baseUrl = getBaseUrl(request)
    const loginUrl = new URL(`/${locale}/login`, baseUrl)
    loginUrl.searchParams.set('message', '登入驗證失敗，請稍後再試')
    return NextResponse.redirect(loginUrl)
  }
}
