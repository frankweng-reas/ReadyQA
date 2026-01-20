require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const defaultTheme = {
  chatBackgroundColor: '#ffffff',
  inputPosition: 'bottom',
  inputAreaBackgroundColor: '#f5f5f5',
  inputBackgroundColor: '#ffffff',
  inputBorderColor: '#a3a8ae',
  inputTextColor: '#161717',
  inputPlaceholderColor: '#b1b2b4',
  inputPlaceholderText: '請輸入您的問題...',
  enableVoice: false,
  sendButtonBackgroundColor: '#4e4f50',
  sendButtonTextColor: '#FFFFFF',
  sendButtonIcon: 'chevron-right',
  headerBackgroundColor: '#370106',
  headerTextColor: '#FFFFFF',
  headerTitle: 'AI 知識助手',
  headerSubtitle: '不生成、不猜測、快速找到正確答案',
  showHeader: true,
  headerLogo: null,
  headerAlign: 'left',
  headerSize: 'large',
  headerUseGradient: true,
  headerGradientStartColor: '#640211',
  headerGradientEndColor: '#f2baba',
  headerGradientDirection: 'to right',
  showCloseButton: true,
  closeButtonColor: '#FFFFFF',
  closeButtonHoverColor: '#F3F4F6',
  faqSectionTextColor: '#252527',
  faqSectionSubtextColor: '#6B7280',
  qaCardStyle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#ebecef',
    borderRadius: 'rounded-xl',
    padding: 'p-3',
    shadow: 'shadow-md hover:shadow-lg',
    questionColor: '#111827',
    questionFontSize: '20px',
    questionBackgroundColor: 'transparent',
    questionUseGradient: false,
    questionGradientStartColor: '#3B82F6',
    questionGradientEndColor: '#8B5CF6',
    questionGradientDirection: 'to right',
    answerColor: '#374151',
    answerFontSize: '16px',
    questionPrefixColor: '#2563EB',
  },
  containerStyle: {
    borderRadius: 'rounded-3xl',
    shadow: 'shadow-lg',
    border: '',
    borderColor: '#670515',
    overflow: 'overflow-hidden',
  },
  userBubbleColor: '#2563EB',
  botBubbleColor: '#F3F4F6',
  userTextColor: '#FFFFFF',
  botTextColor: '#1F2937',
  borderRadius: 12,
  fontSize: 16,
  fontFamily: 'Inter',
  bubbleStyle: 'rounded',
  bubbleMaxWidth: 85,
  shadow: true,
  animation: true,
  contactInfo: {
    enabled: false,
    name: '',
    phone: '',
    email: '',
  },
  enableAIChat: true,
  enableBrowseQA: true,
  homePageConfig: {
    enabled: false,
    backgroundImage: null,
    faqMode: 'chat',
    ctaButton: {
      show: true,
      text: '造訪網站',
      url: ''
    },
    faqButton: {
      text: 'FAQ'
    }
  }
};

function compareObjects(obj1, obj2, path = '') {
  const differences = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    if (val1 === undefined) {
      differences.push({ path: currentPath, type: 'missing_in_default', value: val2 });
    } else if (val2 === undefined) {
      differences.push({ path: currentPath, type: 'missing_in_db', value: val1 });
    } else if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null && !Array.isArray(val1) && !Array.isArray(val2)) {
      differences.push(...compareObjects(val1, val2, currentPath));
    } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
      differences.push({ path: currentPath, type: 'different', default: val1, db: val2 });
    }
  }
  
  return differences;
}

async function compareTheme() {
  try {
    const chatbot = await prisma.chatbot.findUnique({
      where: { id: '1767688111182_dddqsliym' },
      select: { theme: true }
    });

    if (!chatbot) {
      console.log('❌ Chatbot 不存在');
      return;
    }

    const dbTheme = chatbot.theme || {};
    
    console.log('=== Theme 比較結果 ===\n');
    console.log('資料庫中的 theme:');
    console.log(JSON.stringify(dbTheme, null, 2));
    
    const differences = compareObjects(defaultTheme, dbTheme);
    
    console.log('\n=== 差異分析 ===');
    if (differences.length === 0) {
      console.log('✅ 沒有差異，與預設值完全相同');
    } else {
      console.log(`發現 ${differences.length} 個差異：\n`);
      
      differences.forEach((diff, index) => {
        if (diff.type === 'different') {
          console.log(`${index + 1}. 📝 ${diff.path}:`);
          console.log(`   預設值: ${JSON.stringify(diff.default)}`);
          console.log(`   資料庫: ${JSON.stringify(diff.db)}`);
          console.log('');
        } else if (diff.type === 'missing_in_db') {
          console.log(`${index + 1}. ⚠️  ${diff.path}: 資料庫中缺少此欄位`);
          console.log(`   預設值: ${JSON.stringify(diff.value)}`);
          console.log('');
        } else if (diff.type === 'missing_in_default') {
          console.log(`${index + 1}. ➕ ${diff.path}: 資料庫中有但預設值中沒有`);
          console.log(`   值: ${JSON.stringify(diff.value)}`);
          console.log('');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

compareTheme();
