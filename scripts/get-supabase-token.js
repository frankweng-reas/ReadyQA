// 在瀏覽器 Console 中執行此腳本來取得 Supabase token
// 複製整個腳本到瀏覽器 Console 執行

(async () => {
  try {
    // 方法 1: 如果前端已經載入 Supabase
    if (window.supabase) {
      const { data } = await window.supabase.auth.getSession();
      if (data.session) {
        console.log('✅ Token:', data.session.access_token);
        return data.session.access_token;
      }
    }
    
    // 方法 2: 從 localStorage 取得
    const supabaseAuth = localStorage.getItem('sb-' + window.location.hostname.split('.')[0] + '-auth-token');
    if (supabaseAuth) {
      const authData = JSON.parse(supabaseAuth);
      if (authData.access_token) {
        console.log('✅ Token (from localStorage):', authData.access_token);
        return authData.access_token;
      }
    }
    
    // 方法 3: 檢查所有 localStorage keys
    console.log('🔍 搜尋 localStorage...');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.includes('supabase') || key.includes('auth')) {
        try {
          const value = JSON.parse(localStorage.getItem(key));
          if (value.access_token) {
            console.log('✅ Token found in:', key);
            console.log('Token:', value.access_token);
            return value.access_token;
          }
        } catch (e) {
          // 不是 JSON，跳過
        }
      }
    }
    
    console.log('❌ 無法找到 token，請確認已登入');
    console.log('💡 提示：請先登入前端應用，然後重新執行此腳本');
  } catch (error) {
    console.error('❌ 錯誤:', error);
  }
})();
