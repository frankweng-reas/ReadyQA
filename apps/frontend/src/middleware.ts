import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { locales, defaultLocale } from './i18n';

// i18n middleware：不偵測 Accept-Language，由 URL 前綴決定語系；未帶前綴時導向 defaultLocale
const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
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
  if (pathname.includes('/auth/callback') || pathname.includes('/auth/reset-callback')) {
    return NextResponse.next();
  }

  // 0.6. 排除靜態資源（圖片等），讓 Next.js 直接從 public 提供
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // 0.7. 排除 help 靜態 MD 檔案（online help 說明）
  if (pathname.startsWith('/help/') && pathname.endsWith('.md')) {
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

  // 2. i18n 路由（/zh-TW、/en）
  const response = intlMiddleware(request);

  // 3. 僅在需要認證判斷的路徑才呼叫 Supabase（效能優化：跳過公開頁面）
  const protectedRoutes = ['/dashboard', '/settings', '/profile', '/admin'];
  const authCheckRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const isProtectedRoute = protectedRoutes.some((r) => pathname.includes(r));
  const isAuthCheckRoute = authCheckRoutes.some((r) => pathname.includes(r));

  if (!isProtectedRoute && !isAuthCheckRoute) {
    // 公開頁面（chatbot 嵌入、plans 等）直接通過，不呼叫 getSession
    return response;
  }

  // 4. 建立 Supabase 客戶端並檢查 session（僅受保護/登入頁才執行）
  // DNS/網路異常時 getSession 會拋錯；若不捕捉會導致 middleware 失敗、頁面近乎無樣式
  let session: Awaited<
    ReturnType<ReturnType<typeof createServerClient>['auth']['getSession']>
  >['data']['session'] = null;

  try {
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
      data: { session: s },
    } = await supabase.auth.getSession();
    session = s;
  } catch (err) {
    console.error(
      '[middleware] Supabase getSession 失敗（請檢查網路、DNS 或 NEXT_PUBLIC_SUPABASE_URL）:',
      err
    );
    session = null;
  }

  const locale = pathname.split('/')[1] || defaultLocale;

  // 5. 未登入訪問受保護路由 -> 導向登入頁
  if (isProtectedRoute && !session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 6. 已登入訪問登入頁、註冊頁、忘記密碼頁 -> 導向 dashboard（reset-password 除外，需讓用戶設定新密碼）
  if (
    (pathname.includes('/login') || pathname.includes('/signup') || pathname.includes('/forgot-password')) &&
    session
  ) {
    const redirectUrl = request.nextUrl.searchParams.get('redirect');
    return NextResponse.redirect(
      new URL(redirectUrl || `/${locale}/dashboard`, request.url)
    );
  }

  // 7. 未登入訪問 reset-password -> 導向登入頁
  if (pathname.includes('/reset-password') && !session) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  // 8. Admin 頁面：僅允許 ADMIN_EMAILS 中的用戶訪問
  if (pathname.includes('/admin') && session) {
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = session.user?.email?.toLowerCase();
    if (!userEmail || !adminEmails.includes(userEmail)) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 略過整個 /_next/（含 dev 的 webpack-hmr、RSC 等），避免 next-intl 碰內部路徑導致 JS/CSS 異常、畫面像「沒套 Tailwind」。
     * 勿用 .*\\..* 略過所有副檔名——會連 /chatbot-widget.js 都略過，widget 重寫會失效。
     * _vercel：部署平台內建腳本；help／favicon：見上方 early return。
     */
    '/((?!api|_next/|_vercel|favicon\\.ico|help).*)',
  ],
};
