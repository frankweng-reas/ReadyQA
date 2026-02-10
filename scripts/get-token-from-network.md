# 從 Network 標籤取得 Supabase Token

## 方法：從瀏覽器 Network 請求中取得

### 步驟：

1. **打開前端應用**
   - 訪問：http://localhost:3000
   - 確保已登入

2. **打開開發者工具**
   - 按 F12 或右鍵 → 檢查
   - 切換到 **Network** 標籤

3. **觸發一個 API 請求**
   - 訪問任何需要認證的頁面（例如：dashboard）
   - 或執行任何會呼叫後端 API 的操作

4. **找到後端 API 請求**
   - 在 Network 標籤中找到對 `http://localhost:8000/api/` 的請求
   - 例如：`/api/auth/profile` 或 `/api/users` 等

5. **查看 Request Headers**
   - 點擊該請求
   - 切換到 **Headers** 標籤
   - 找到 **Request Headers** 區塊
   - 尋找 `Authorization: Bearer ...`
   - 複製 `Bearer` 後面的完整 token

### 範例：

```
Request Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY1OTYxMTYzLCJzdWIiOiIxMjM0NTY3OC05MGFiLWNkZWYtMTIzNC01Njc4OTBhYmNkZWYifQ.xxxxx
```

複製整個 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` 部分（不包含 `Bearer`）

### 或者使用 Console：

在 Console 執行：

```javascript
// 監聽所有 fetch 請求
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const request = args[0];
  if (typeof request === 'string' && request.includes('localhost:8000')) {
    console.log('API Request:', request);
    const headers = args[1]?.headers;
    if (headers?.Authorization) {
      console.log('✅ Token:', headers.Authorization.replace('Bearer ', ''));
    }
  }
  return originalFetch.apply(this, args);
};

// 然後觸發一個 API 請求（例如訪問 dashboard）
// token 會自動顯示在 console
```
