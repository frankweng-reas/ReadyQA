# 登入與註冊規格書

## 概述

使用 **Supabase Auth** 作為認證服務，整合 Email/Password 與 Google OAuth。

## 登入方式

- **Email / 密碼**：使用 `signInWithPassword`
- **Google OAuth**：使用 `signInWithOAuth`，redirectTo 設為 `/{locale}/auth/callback`

## 註冊方式

- **Email / 密碼**：欄位為 Email、密碼、確認密碼。密碼至少 6 字元。需完成 Email 確認
- **Google OAuth**：與登入流程相同，第一次使用時會自動建立帳號

## 路由與檔案

- `/{locale}/login` 對應 `apps/frontend/src/app/[locale]/login/page.tsx`（登入頁）
- `/{locale}/signup` 對應 `apps/frontend/src/app/[locale]/signup/page.tsx`（註冊頁）
- `/{locale}/auth/callback` 對應 `apps/frontend/src/app/[locale]/auth/callback/route.ts`（OAuth callback）
- `apps/frontend/src/lib/auth/auth-provider.tsx`：Auth Context（signIn、signUp、signInWithGoogle、signOut）
- `apps/frontend/src/lib/auth/user-mapping.ts`：呼叫後端 `get-or-create-user`

## 主要流程

### Email 登入

1. 輸入 email、password → `signIn()`
2. Supabase 驗證 → 成功後 `onAuthStateChange` 觸發
3. `handleUserMapping` 呼叫 `/api/auth/get-or-create-user` 取得 PostgreSQL user_id
4. 導向 dashboard

### Email 註冊

1. 輸入 email、密碼、確認密碼 → 前端驗證（必填、長度 ≥6、兩次密碼一致）
2. 呼叫 `signUp()` → Supabase 發送確認信
3. 顯示成功 Modal，提示需至信箱確認
4. 點「登入」導向登入頁

### Google 登入 / 註冊

1. 點「使用 Google 登入」
2. 跳轉 Google 授權 → 授權後 redirect 到 `/{locale}/auth/callback`
3. Callback 以 `exchangeCodeForSession` 建立 session，導向 dashboard
4. AuthProvider 偵測 session → `handleUserMapping` 建立/取得 PostgreSQL user

## 用戶映射

- **目的**：Supabase UUID → PostgreSQL `user_id`
- **API**：`POST /api/auth/get-or-create-user`
- **Payload**：`{ supabaseUserId, email, name }`
- **後端行為**：若 user 不存在則建立 user + tenant（plan_code: free）

## 路由保護（middleware）

- 未登入存取 `/dashboard`、`/settings`、`/profile` → 導向登入
- 已登入存取 `/login`、`/signup` → 導向 dashboard
- `/auth/callback` 不做認證檢查，直接通過

## 環境變數

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

## Supabase 設定

- **Google Provider**：Authentication > Providers > Google 啟用並填 Client ID / Secret
- **Redirect URLs**：新增 `https://your-domain.com/{locale}/auth/callback`
