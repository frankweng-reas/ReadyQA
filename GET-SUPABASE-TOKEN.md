# 取得 Supabase Token - 完整指南

## 🎯 最簡單的方法

### 在瀏覽器 Console 執行：

```javascript
(async () => {
  const { createClient } = await import('/src/lib/supabase/client');
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    console.log('✅ Token:', data.session.access_token);
  } else {
    console.log('❌ 沒有 session，請先登入');
  }
})();
```

**注意**：如果這個方法失敗（路徑問題），請使用下面的方法。

## 🔧 替代方法

### 方法 1: 使用 Network 標籤（最可靠）

1. **打開前端應用**：http://localhost:3000
2. **確保已登入**
3. **打開開發者工具** (F12) → **Network** 標籤
4. **訪問 dashboard** 或任何需要認證的頁面
5. **找到對 `localhost:8000/api/` 的請求**
   - 例如：`/api/auth/profile` 或 `/api/users`
6. **點擊該請求** → **Headers** 標籤
7. **在 Request Headers 中找到**：
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
8. **複製 `Bearer` 後面的完整 token**

### 方法 2: 使用 Console 監聽

在 Console 執行：

```javascript
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const request = args[0];
  if (typeof request === 'string' && request.includes('localhost:8000')) {
    const headers = args[1]?.headers;
    if (headers?.Authorization) {
      console.log('✅ Token:', headers.Authorization.replace('Bearer ', ''));
    }
  }
  return originalFetch.apply(this, args);
};
```

然後訪問 dashboard，token 會自動顯示。

### 方法 3: 檢查是否已登入

在 Console 執行：

```javascript
// 檢查登入狀態
const checkAuth = async () => {
  try {
    const { createClient } = await import('/src/lib/supabase/client');
    const supabase = createClient();
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('❌ 錯誤:', error.message);
      return;
    }
    
    if (data.session) {
      console.log('✅ 已登入');
      console.log('Email:', data.session.user.email);
      console.log('Token:', data.session.access_token);
    } else {
      console.log('❌ 未登入');
      console.log('💡 請先登入：http://localhost:3000/zh-TW/login');
    }
  } catch (e) {
    console.error('❌ 無法載入 Supabase client:', e);
  }
};

checkAuth();
```

## ❓ 常見問題

### Q: 找不到 token？

**可能原因：**
1. 未登入 - 請先登入前端應用
2. Session 過期 - 請重新登入
3. Supabase 設定問題 - 檢查環境變數

**解決方法：**
1. 訪問登入頁面：http://localhost:3000/zh-TW/login
2. 登入後再執行上述腳本
3. 檢查瀏覽器 Console 是否有錯誤訊息

### Q: Token 格式不對？

**Supabase token 特徵：**
- 很長（通常 200+ 字元）
- 以 `eyJ` 開頭（JWT 格式）
- 包含三個部分，用 `.` 分隔
- 例如：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY1OTYxMTYzLCJzdWIiOiIxMjM0NTY3OC05MGFiLWNkZWYtMTIzNC01Njc4OTBhYmNkZWYifQ.xxxxx`

## 🎯 快速檢查清單

- [ ] 前端應用正在運行 (http://localhost:3000)
- [ ] 已登入（不是只打開登入頁面）
- [ ] 瀏覽器 Console 沒有錯誤
- [ ] 嘗試訪問 dashboard 頁面
- [ ] 檢查 Network 標籤是否有 API 請求
