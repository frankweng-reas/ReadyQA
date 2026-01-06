# Supabase Auth 整合說明

## ✅ 已完成

### 檔案結構
```
apps/backend/src/auth/
├── auth.module.ts               # Auth 模組
├── auth.controller.ts           # 測試端點
├── supabase.service.ts          # Supabase 客戶端服務
├── supabase-auth.guard.ts       # Token 驗證 Guard
└── current-user.decorator.ts    # 取得當前用戶裝飾器
```

## 📝 使用方式

### 1. 環境變數設定

在 `apps/backend/.env.local` 加入：

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 2. 保護路由

使用 `@UseGuards(SupabaseAuthGuard)` 保護需要認證的路由：

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('protected')
export class ProtectedController {
  @Get()
  @UseGuards(SupabaseAuthGuard)
  getProtectedData(@CurrentUser() user: any) {
    return { message: 'Protected data', userId: user.id };
  }
}
```

### 3. 測試端點

**測試端點**: `GET /auth/profile`

需要在 Header 帶入 Supabase token：
```
Authorization: Bearer YOUR_SUPABASE_TOKEN
```

## 🧪 測試方式

1. 啟動 Backend：
```bash
cd apps/backend
npm run start:dev
```

2. 訪問 Swagger UI：
```
http://localhost:8000/api/docs
```

3. 測試步驟：
   - 從前端 Supabase 登入取得 token
   - 在 Swagger UI 點擊 "Authorize" 按鈕
   - 輸入 token (格式: `Bearer YOUR_TOKEN`)
   - 測試 `/auth/profile` 端點

## 🔧 技術細節

### Token 驗證流程

1. 前端使用 Supabase SDK 登入，取得 access token
2. 前端在 API 請求的 Header 帶上 `Authorization: Bearer TOKEN`
3. Backend 的 `SupabaseAuthGuard` 攔截請求
4. 呼叫 `supabase.auth.getUser(token)` 驗證 token
5. 驗證成功後將用戶資訊附加到 `request.user`
6. Controller 可透過 `@CurrentUser()` 裝飾器取得用戶資訊

### 優勢

- ✅ 與 AnswerGO 架構一致
- ✅ 不需自己管理 JWT 簽發
- ✅ Supabase 處理 token 過期、刷新等邏輯
- ✅ 前端可直接使用 Supabase SDK

## 📦 已安裝套件

- `@supabase/supabase-js` - Supabase JavaScript 客戶端

## 🚀 下一步

現在可以在任何 Controller 使用 `@UseGuards(SupabaseAuthGuard)` 來保護路由。

