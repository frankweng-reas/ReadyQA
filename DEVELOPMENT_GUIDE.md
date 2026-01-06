# QAPlus 開發指南

## 快速開始

### 啟動開發環境

```bash
# Backend (NestJS)
cd apps/backend
npm run dev  # http://localhost:8000

# Frontend (Next.js)
cd apps/frontend
npm run dev  # http://localhost:3000
```

### 測試帳號
- Email: `test01@test.com`
- Password: `123456`

---

## 重要開發規範

### 🌍 多語言支援（必讀！）

**所有顯示文字都必須使用翻譯：**

```typescript
// ✅ 正確
import { useTranslations } from 'next-intl'

export default function MyPage() {
  const t = useTranslations('myNamespace')
  return <h1>{t('title')}</h1>
}

// ❌ 錯誤
export default function MyPage() {
  return <h1>我的頁面</h1>  // 不要硬編碼！
}
```

**新增翻譯：**

編輯 `apps/frontend/messages/zh-TW.json`：

```json
{
  "myNamespace": {
    "title": "我的頁面",
    "button": "按鈕"
  }
}
```

---

## 架構說明

### 認證流程

```
用戶登入 Supabase
    ↓
Frontend AuthProvider 監聽登入事件
    ↓
呼叫 Backend API /auth/get-or-create-user
    ↓
創建/更新本地用戶 + 自動創建 Tenant
    ↓
返回 PostgreSQL user_id
    ↓
導向 Dashboard
```

### 資料庫關係

```
User (id, email, supabaseUserId)
  ↓ (tenantId)
Tenant (id = user_id, planCode)
  ↓
Plan (code: free/pro/business)
```

---

## 常見任務

### 新增頁面

1. 創建檔案：`apps/frontend/src/app/[locale]/my-page/page.tsx`
2. 使用翻譯：
```typescript
'use client'
import { useTranslations } from 'next-intl'

export default function MyPage() {
  const t = useTranslations('myPage')
  return <h1>{t('title')}</h1>
}
```
3. 新增翻譯：`messages/zh-TW.json`

### 新增 API

1. 創建 DTO：`apps/backend/src/my-module/dto/my.dto.ts`
2. 創建 Service：`apps/backend/src/my-module/my.service.ts`
3. 創建 Controller：`apps/backend/src/my-module/my.controller.ts`
4. 註冊 Module：`apps/backend/src/app.module.ts`

### 資料庫修改

1. 修改 `apps/backend/prisma/schema.prisma`
2. 創建 migration：
```bash
cd apps/backend
# 手動創建 migration SQL
psql postgresql://qaplus:password@localhost:5432/qaplus -f migration.sql
# 重新生成 Client
npx prisma generate
```

---

## 專案結構

```
qaplus/
├── apps/
│   ├── backend/          # NestJS API
│   │   ├── prisma/       # 資料庫 schema & migrations
│   │   └── src/
│   │       ├── auth/     # 認證 (Supabase)
│   │       ├── users/    # 用戶管理
│   │       ├── chatbots/ # Chatbot CRUD
│   │       └── ...
│   │
│   └── frontend/         # Next.js App
│       ├── messages/     # 翻譯檔案 📝
│       │   └── zh-TW.json
│       └── src/
│           ├── app/
│           │   └── [locale]/  # 語言路由
│           ├── components/    # UI 元件
│           └── lib/
│               └── auth/      # Auth Provider
│
├── packages/
│   └── shared/           # 共用程式碼
│
└── .cursorrules          # AI 開發規範 🤖
```

---

## 環境變數

### Root `.env.local`
```env
DATABASE_URL="postgresql://qaplus:password@localhost:5432/qaplus"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### Frontend `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

---

## 常用命令

```bash
# 安裝依賴
npm install

# 啟動開發
npm run dev

# Backend
cd apps/backend
npm run dev              # 啟動 API
npx prisma generate      # 生成 Prisma Client
npx prisma studio        # 資料庫 GUI

# Frontend
cd apps/frontend
npm run dev              # 啟動 Next.js
npm run build            # 建構生產版本
```

---

## 重要提醒

### ⚠️ 必須遵守的規則

1. **所有文字使用 t()** - 不要硬編碼任何顯示文字
2. **使用 TypeScript** - 所有變數和函數都要有型別
3. **錯誤處理** - 所有 async 函數都要 try-catch
4. **認證** - 使用 Supabase Auth，不要自己處理密碼
5. **資料庫** - 使用 Prisma，不要直接寫 SQL

### 💡 最佳實踐

- 使用更好的程式碼品質
- 組件要可重用
- API 要有統一的回應格式
- 錯誤訊息要對用戶友好（翻譯）

---

## 問題排查

### Frontend 無法連接 Backend
- 檢查 Backend 是否在運行：`http://localhost:8000/api`
- 檢查環境變數是否正確

### 登入失敗
- 檢查 Supabase 設定
- 確認用戶已在 Supabase 註冊
- 查看 Console 錯誤訊息

### 資料庫連接失敗
- 確認 PostgreSQL 運行中
- 檢查 `DATABASE_URL` 環境變數
- 確認資料庫已創建：`createdb qaplus`

---

## 參考資源

- [Next.js 14 文件](https://nextjs.org/docs)
- [NestJS 文件](https://docs.nestjs.com/)
- [Prisma 文件](https://www.prisma.io/docs)
- [next-intl 文件](https://next-intl-docs.vercel.app/)
- [Supabase 文件](https://supabase.com/docs)

---

**記住：開發時永遠使用 `t()` 來翻譯文字！這是最重要的規則！** 🌍

