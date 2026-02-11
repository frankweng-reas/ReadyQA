# QAPlus 認證與授權說明

簡單扼要，無程式碼，僅描述作法。

---

## 概述

認證採用 **Supabase Auth**，支援 Email/密碼與 Google OAuth。授權分為兩類：使用者認證（登入後的 dashboard 操作）與 Session Token（嵌入式 Chatbot 的問答查詢）。資料庫使用 PostgreSQL，透過「用戶映射」將 Supabase UUID 對應到 PostgreSQL 的 user_id。

---

## 認證方式

**登入：** Email/密碼使用 signInWithPassword；Google 使用 signInWithOAuth，授權後 redirect 至 `/{locale}/auth/callback`。

**註冊：** Email 需填寫 Email、密碼、確認密碼（密碼至少 6 字元），送出後 Supabase 發送確認信，需至信箱完成確認。Google 第一次使用時會自動建立帳號。

**登出：** 呼叫 signOut，清除 Supabase session。

---

## 用戶映射

目的：Supabase 使用 UUID，後端資料庫使用數字 user_id，需要對應關係。

流程：登入成功後，AuthProvider 偵測到 session，呼叫後端 `POST /api/auth/get-or-create-user`，傳入 supabaseUserId、email、name。後端若不存在則建立 user 與 tenant（plan_code: free），回傳 user_id。前端將此 user_id 存於 AuthProvider 狀態，供後續 API 使用。

---

## 前端路由保護

Middleware 檢查 Supabase session（透過 cookie）。需要認證的路由：/dashboard、/settings、/profile。未登入存取這些路由 → 導向登入頁並帶 redirect 參數。已登入存取 /login、/signup → 導向 dashboard。/auth/callback 不做認證檢查，直接通過（OAuth 流程用）。

---

## 後端 API 授權

**Supabase Token 保護：** 部分 API 需要 `Authorization: Bearer <supabase_access_token>`。後端以 SupabaseAuthGuard 攔截請求，以 `supabase.auth.getUser(token)` 驗證 token，成功後將用戶資訊掛到 request。適用端點：GET /api/auth/profile、所有 /api/stripe/* 端點。前端呼叫這類 API 時，從 `supabase.auth.getSession()` 取得 access_token 並帶入 Header。

**Session Token 保護：** 嵌入式 Chatbot 的問答 API（如 POST /query/chat、POST /query/log-faq-browse）使用 Session Token，而非 Supabase Token。訪客先呼叫 POST /sessions/init 取得 Session Token，之後在 Authorization Header 帶上該 token 查詢。Session Token 綁定特定 chatbot，用於識別對話 session，非登入用戶身分。

**未強制驗證的 API：** Chatbots、FAQs 等管理 API 目前未使用 SupabaseAuthGuard，依賴呼叫端傳入 userId、chatbotId 等參數。實際使用時由前端從登入狀態取得這些值，僅在已通過 middleware 的頁面（dashboard）呼叫。

---

## Token 傳遞方式

前端呼叫需 Supabase Token 的 API 時：取得 `supabase.auth.getSession()` 的 access_token，在每個請求的 Header 加上 `Authorization: Bearer <token>`。

嵌入式 Chatbot 呼叫問答 API 時：先 init session 取得 token，之後每次問答皆帶 `Authorization: Bearer <session_token>`。

---

## 環境設定

需設定 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_ANON_KEY。後端需設定 SUPABASE_URL、SUPABASE_ANON_KEY。Google OAuth 需在 Supabase 後台啟用，並設定 Redirect URL 為 `https://your-domain.com/{locale}/auth/callback`。
