# 認證系統規格文件

## 📋 概述

QAPlus 使用 **Supabase Auth** 作為認證服務，整合前端 Next.js 和後端 NestJS。

### 核心架構

```
Supabase Auth (認證服務)
    ↓
Frontend (Next.js) - 用戶登入/註冊
    ↓
Backend (NestJS) - API 保護與用戶映射
    ↓
PostgreSQL (用戶資料)
```

---

## 🔐 登入流程

### 1. 前端登入

**檔案**: `apps/frontend/src/app/[locale]/login/page.tsx`

**流程**:
1. 用戶輸入 email/password
2. 呼叫 `signIn(email, password)` → Supabase Auth
3. 登入成功後自動建立/映射 PostgreSQL 用戶
4. 導向 `/dashboard`

**關鍵程式碼**:
```typescript
const { signIn } = useAuth()
const { error } = await signIn(email, password)
if (!error) {
  router.push(`/${locale}/dashboard`)
}
```

### 2. 用戶映射機制

**檔案**: `apps/frontend/src/lib/auth/user-mapping.ts`

**目的**: 將 Supabase UUID 映射到 PostgreSQL `user_id`

**流程**:
1. 前端呼叫 `/api/auth/get-or-create-user`
2. Backend 檢查 `supabase_user_id` 是否存在
3. 不存在則建立新用戶 + tenant
4. 返回 `user_id`

**API**: `POST /api/auth/get-or-create-user`
```json
{
  "supabaseUserId": "uuid",
  "email": "user@example.com",
  "name": "User Name"
}
```

---

## 📝 註冊流程

### 目前狀態

**註冊頁面**: ❌ 尚未實作（登入頁有註冊連結但未實作）

**註冊方式**: 
- 可透過 Supabase Dashboard 手動建立用戶
- 或使用 Supabase Auth API 註冊

### 建議實作

**檔案**: `apps/frontend/src/app/[locale]/signup/page.tsx`

**流程**:
1. 用戶輸入 email/password/name
2. 呼叫 `supabase.auth.signUp({ email, password })`
3. 確認 email（Supabase 自動發送）
4. 登入後自動建立 PostgreSQL 用戶

---

## 🛡️ 路由保護

### Frontend Middleware

**檔案**: `apps/frontend/src/middleware.ts`

**保護的路由**:
- `/dashboard`
- `/settings`
- `/profile`

**邏輯**:
- 未登入訪問受保護路由 → 導向 `/login`
- 已登入訪問 `/login` → 導向 `/dashboard`

### Backend Guard

**檔案**: `apps/backend/src/auth/supabase-auth.guard.ts`

**使用方式**:
```typescript
@UseGuards(SupabaseAuthGuard)
@Get('protected')
getProtectedData(@CurrentUser() user: any) {
  return { userId: user.id }
}
```

**驗證流程**:
1. 從 `Authorization: Bearer TOKEN` 取得 token
2. 呼叫 `supabase.auth.getUser(token)` 驗證
3. 將用戶資訊附加到 `request.user`

---

## 🔌 API 端點

### Backend API

| 端點 | 方法 | 說明 | 認證 |
|------|------|------|------|
| `/api/auth/profile` | GET | 取得當前用戶資訊 | ✅ 需要 |
| `/api/auth/get-or-create-user` | POST | 建立/取得用戶映射 | ❌ 公開 |

### Frontend API

| 方法 | 說明 |
|------|------|
| `signIn(email, password)` | 登入 |
| `signOut()` | 登出 |
| `useAuth()` | 取得認證狀態 |

---

## 📁 檔案結構

### Frontend

```
apps/frontend/src/
├── app/
│   └── [locale]/
│       └── login/
│           └── page.tsx              # 登入頁面
├── lib/
│   ├── auth/
│   │   ├── auth-provider.tsx         # Auth Context Provider
│   │   └── user-mapping.ts           # 用戶映射邏輯
│   └── supabase/
│       ├── client.ts                  # Supabase 客戶端
│       └── server.ts                  # Supabase 伺服器端
└── middleware.ts                      # 路由保護
```

### Backend

```
apps/backend/src/auth/
├── auth.module.ts                     # Auth 模組
├── auth.controller.ts                 # Auth API 端點
├── auth.service.ts                    # 用戶建立/映射邏輯
├── supabase.service.ts                # Supabase 客戶端服務
├── supabase-auth.guard.ts            # Token 驗證 Guard
├── current-user.decorator.ts         # 取得當前用戶裝飾器
└── dto/
    └── get-or-create-user.dto.ts      # DTO
```

---

## ⚙️ 環境變數

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Backend (`.env.local`)

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
DATABASE_URL=postgresql://user:pass@host:5432/db
```

---

## 🔄 認證狀態管理

### AuthProvider

**檔案**: `apps/frontend/src/lib/auth/auth-provider.tsx`

**狀態**:
- `user`: Supabase User 物件
- `postgresUserId`: PostgreSQL user_id
- `loading`: 載入狀態

**方法**:
- `signIn(email, password)`: 登入
- `signOut()`: 登出

**自動處理**:
- 監聽 Supabase 認證狀態變化
- 自動建立/映射 PostgreSQL 用戶
- 自動建立 tenant（tenant_id = user_id）

---

## 🗄️ 資料庫結構

### Users 表

```sql
id              INT PRIMARY KEY
email           VARCHAR UNIQUE
username        VARCHAR
supabase_user_id VARCHAR UNIQUE  -- Supabase UUID
tenant_id       VARCHAR           -- tenant_id = user_id (字串)
is_active       BOOLEAN
```

### Tenants 表

```sql
id              VARCHAR PRIMARY KEY  -- tenant_id = user_id
name            VARCHAR
plan_code       VARCHAR             -- 預設 'free'
status          VARCHAR             -- 預設 'active'
```

**關係**: `user.tenant_id = tenant.id` (1:1)

---

## 🔧 維護重點

### 1. 用戶建立邏輯

**檔案**: `apps/backend/src/auth/auth.service.ts`

**流程**:
1. 檢查 `supabase_user_id` 是否存在
2. 檢查 `email` 是否存在（智能合併）
3. 建立新用戶 + tenant（事務處理）
4. `tenant_id = String(user_id)`

### 2. Token 驗證

**檔案**: `apps/backend/src/auth/supabase-auth.guard.ts`

**流程**:
1. 從 Header 取得 `Authorization: Bearer TOKEN`
2. 呼叫 Supabase 驗證 token
3. 驗證成功附加到 `request.user`

### 3. 路由保護

**檔案**: `apps/frontend/src/middleware.ts`

**邏輯**:
- 檢查 Supabase session
- 保護路由自動導向
- 已登入訪問登入頁自動導向

---

## 🐛 常見問題

### Q: 用戶登入後找不到 PostgreSQL 記錄？

**A**: 檢查 `user-mapping.ts` 是否正確呼叫 `/api/auth/get-or-create-user`

### Q: Token 驗證失敗？

**A**: 檢查 Backend 環境變數 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 是否正確

### Q: 路由保護不生效？

**A**: 檢查 `middleware.ts` 的 `matcher` 配置是否正確

---

## 📚 相關文件

- [Supabase Auth 整合說明](./SUPABASE-AUTH.md)
- [登入流程完整文件](./LOGIN-FLOW-COMPLETE.md)

---

**最後更新**: 2026-01-06  
**維護者**: QAPlus Team

