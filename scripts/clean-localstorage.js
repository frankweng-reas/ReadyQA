// 清理 localStorage 中的舊資料
// 在瀏覽器 Console 執行此腳本

console.log('🧹 清理 localStorage 中的舊資料...');
console.log('');

// QAPlus 使用的正確 keys
const qaplusKeys = [
  'qaplus_session_token',
  'qaplus_session_token_chatbot',
  'qaplus_session_token_expires'
];

// AnswerGO 的舊 keys（需要清理）
const answergoKeys = [
  'cb_sess_X_FCWAKAqXG-WmjbW4Xj6hs_yRuMfOJCWuRjCQZV5-E',
  'answergo_session_token_chatbot',
  'answergo_session_token_e',
  'answergo_session_token'
];

// 列出所有 localStorage keys
console.log('📋 目前的 localStorage keys:');
const allKeys = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  allKeys.push(key);
  console.log(`  - ${key}`);
}

console.log('');
console.log('🔍 檢查 AnswerGO 相關的 keys...');

let cleaned = 0;
answergoKeys.forEach(key => {
  if (localStorage.getItem(key)) {
    console.log(`  ❌ 找到舊資料: ${key}`);
    localStorage.removeItem(key);
    cleaned++;
  }
});

// 也檢查所有包含 answergo 的 keys
allKeys.forEach(key => {
  if (key && key.toLowerCase().includes('answergo')) {
    console.log(`  ❌ 找到舊資料: ${key}`);
    localStorage.removeItem(key);
    cleaned++;
  }
});

console.log('');
if (cleaned > 0) {
  console.log(`✅ 已清理 ${cleaned} 個舊資料`);
} else {
  console.log('✅ 沒有找到需要清理的舊資料');
}

console.log('');
console.log('📋 QAPlus 使用的正確 keys:');
qaplusKeys.forEach(key => {
  const value = localStorage.getItem(key);
  if (value) {
    console.log(`  ✅ ${key}: ${value.substring(0, 20)}...`);
  } else {
    console.log(`  ⚪ ${key}: (無資料)`);
  }
});

console.log('');
console.log('💡 提示：這些 AnswerGO 的資料是舊專案遺留下來的，');
console.log('   不影響 QAPlus 的功能，但清理後可以讓 localStorage 更乾淨。');
