import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { locales, defaultLocale } from './i18n';

// 建立 i18n middleware
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // URL 總是包含語言前綴：/zh-TW/dashboard
});

/**
 * 整合 i18n 和 Auth 的 Middleware
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 先處理 i18n 路由
  const response = intlMiddleware(request);

  // 2. 建立 Supabase 客戶端進行認證檢查
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // 3. 檢查用戶認證狀態
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // 4. 提取當前語言（從 pathname 中）
  const locale = pathname.split('/')[1] || defaultLocale;

  // 5. 需要認證的路由
  const protectedRoutes = ['/dashboard', '/settings', '/profile'];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.includes(route)
  );

  // 6. 未登入訪問受保護路由 -> 導向登入頁
  if (isProtectedRoute && !session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 7. 已登入訪問登入頁 -> 導向 dashboard
  if (pathname.includes('/login') && session) {
    const redirectUrl = request.nextUrl.searchParams.get('redirect');
    return NextResponse.redirect(
      new URL(redirectUrl || `/${locale}/dashboard`, request.url)
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
