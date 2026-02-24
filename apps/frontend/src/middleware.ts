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

  // 0. 處理 chatbot-widget.js 重寫到 API route
  if (pathname === '/chatbot-widget.js') {
    const url = request.nextUrl.clone();
    url.pathname = '/api/chatbot-widget';
    return NextResponse.rewrite(url);
  }

  // 0.5. 排除 auth callback 路由，直接通過（不做任何認證檢查）
  if (pathname.includes('/auth/callback')) {
    return NextResponse.next();
  }

  // 0.6. 排除靜態資源（圖片等），讓 Next.js 直接從 public 提供
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // 1. 處理靜態 HTML 文件
  // 如果路徑包含 .html，移除語言前綴並重寫到實際的靜態文件路徑
  if (pathname.includes('.html')) {
    // 檢查是否是帶語言前綴的路徑，如 /zh-TW/faq-demo.html
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length === 2 && (locales as readonly string[]).includes(pathParts[0])) {
      // 移除語言前綴，重寫到 /faq-demo.html
      const htmlFile = pathParts[1];
      const url = request.nextUrl.clone();
      url.pathname = `/${htmlFile}`;
      return NextResponse.rewrite(url);
    }
    // 如果已經是 /faq-demo.html 格式，直接通過
    return NextResponse.next();
  }

  // 2. 先處理 i18n 路由
  const response = intlMiddleware(request);

  // 3. 僅在需要認證判斷的路徑才呼叫 Supabase（效能優化：跳過公開頁面）
  const protectedRoutes = ['/dashboard', '/settings', '/profile'];
  const authCheckRoutes = ['/login', '/signup'];
  const isProtectedRoute = protectedRoutes.some((r) => pathname.includes(r));
  const isAuthCheckRoute = authCheckRoutes.some((r) => pathname.includes(r));

  if (!isProtectedRoute && !isAuthCheckRoute) {
    // 公開頁面（chatbot 嵌入、plans 等）直接通過，不呼叫 getSession
    return response;
  }

  // 4. 建立 Supabase 客戶端並檢查 session（僅受保護/登入頁才執行）
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const locale = pathname.split('/')[1] || defaultLocale;

  // 5. 未登入訪問受保護路由 -> 導向登入頁
  if (isProtectedRoute && !session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. 已登入訪問登入頁或註冊頁 -> 導向 dashboard
  if ((pathname.includes('/login') || pathname.includes('/signup')) && session) {
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
