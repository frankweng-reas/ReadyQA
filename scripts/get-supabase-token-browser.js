// 在瀏覽器 Console 執行此腳本來取得 Supabase token
// 複製整個腳本到瀏覽器 Console 執行

(async () => {
  try {
    console.log('🔍 正在取得 Supabase token...');
    console.log('');
    
    // 方法 1: 使用動態 import（適用於 Next.js）
    try {
      // 取得 Supabase URL 和 Key
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://azuhmfahedazdxujsngd.supabase.co';
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6dWhtZmFoZWRhemR4dWpzbmdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjExNjMsImV4cCI6MjA4MTUzNzE2M30.VUN2pMwaaZWG4pKIWeTqmAkalM4ddNv3XW740wKJj3o';
      
      // 建立 Supabase client
      const { createBrowserClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/ssr@0.8.0/dist/browser/index.js');
      const supabase = createBrowserClient(supabaseUrl, supabaseKey);
      
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ 錯誤:', error.message);
        throw error;
      }
      
      if (data.session && data.session.access_token) {
        console.log('✅ Token:', data.session.access_token);
        console.log('');
        console.log('📋 複製上面的 token，然後告訴我');
        return data.session.access_token;
      } else {
        console.log('❌ 沒有找到 session');
        console.log('💡 請確認已登入前端應用');
      }
    } catch (importError) {
      console.log('⚠️  動態 import 失敗，嘗試其他方法...');
    }
    
    // 方法 2: 直接從 localStorage 搜尋
    console.log('');
    console.log('🔍 搜尋 localStorage...');
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('auth') || key.includes('sb-'))) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            // 嘗試解析 JSON
            try {
              const parsed = JSON.parse(value);
              if (parsed && parsed.access_token) {
                console.log('✅ Token found in:', key);
                console.log('Token:', parsed.access_token);
                console.log('');
                console.log('📋 複製上面的 token，然後告訴我');
                return parsed.access_token;
              }
            } catch (e) {
              // 不是 JSON，檢查是否直接是 token
              if (value.length > 100 && value.includes('.')) {
                console.log('✅ 可能的 Token found in:', key);
                console.log('Token:', value);
                console.log('');
                console.log('📋 複製上面的 token，然後告訴我');
                return value;
              }
            }
          }
        } catch (e) {
          // 跳過
        }
      }
    }
    
    // 方法 3: 檢查 window 物件
    if (window.__NEXT_DATA__) {
      console.log('');
      console.log('🔍 檢查 Next.js 資料...');
      const nextData = window.__NEXT_DATA__;
      // 這裡可以檢查是否有 session 資料
    }
    
    console.log('');
    console.log('❌ 無法找到 token');
    console.log('');
    console.log('💡 請確認：');
    console.log('  1. 已登入前端應用 (http://localhost:3000)');
    console.log('  2. 登入狀態有效');
    console.log('  3. 嘗試重新登入');
    
  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
})();
