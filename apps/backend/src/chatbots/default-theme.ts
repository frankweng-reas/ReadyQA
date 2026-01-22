/**
 * 預設 Chatbot 主題配置
 * 預設主題設定（基於 chatbot 1767688111182_dddqsliym，圖片參數除外）
 */
export const getDefaultTheme = () => ({
  chatBackgroundColor: '#fbfbfb',
  inputPosition: 'bottom',
  inputAreaBackgroundColor: '#002550',
  inputBackgroundColor: '#002550',
  inputBorderColor: '#868788',
  inputTextColor: '#f4f2f8',
  inputPlaceholderColor: '#9CA3AF',
  inputPlaceholderText: '請輸入你的問題...',
  enableVoice: true,
  sendButtonBackgroundColor: '#002550',
  sendButtonTextColor: '#ffffff',
  sendButtonIcon: 'paper-plane',
  sendButtonHoverColor: '#bd0a40',
  headerBackgroundColor: '#002550',
  headerTextColor: '#ffffff',
  headerTitle: 'FAQ 助手 Alice',
  headerSubtitle: '服務上線中...',
  showHeader: true,
  showHeaderLogo: true,
  showHeaderTitle: true,
  showHeaderSubtitle: true,
  headerLogo: null, // 圖片參數保留為 null
  headerAlign: 'left',
  headerSize: 'medium',
  headerUseGradient: false,
  headerGradientStartColor: '#021950',
  headerGradientEndColor: '#2f436a',
  headerGradientDirection: 'to right',
  showCloseButton: true,
  closeButtonColor: '#FFFFFF',
  closeButtonHoverColor: '#F3F4F6',
  faqSectionTextColor: '#080808',
  faqSectionSubtextColor: '#6B7280',
  qaCardStyle: {
    backgroundColor: '#f0f7ff',
    borderColor: '#b0b2b5',
    borderRadius: 'rounded-2xl',
    padding: 'p-4',
    shadow: 'shadow-sm hover:shadow-md',
    questionColor: '#ffffff',
    questionFontSize: '20px',
    questionBackgroundColor: '#3a6ba7',
    questionUseGradient: false,
    questionGradientStartColor: '#3a6ba7',
    questionGradientEndColor: '#5599ec',
    questionGradientDirection: 'to right',
    answerColor: '#1b1c1d',
    answerFontSize: '16px',
    questionPrefixColor: '#2563EB',
    iconColor: '#3B82F6',
    accentColor: '#0713b0',
    separatorColor: '#b5adab',
    separatorHeight: '2px',
  },
  containerStyle: {
    borderRadius: 'rounded-xl',
    shadow: 'shadow-xl',
    border: 'border',
    borderColor: '#dcdfe4',
    overflow: 'overflow-hidden',
  },
  userBubbleColor: '#eaedf6',
  botBubbleColor: '#F3F4F6',
  userTextColor: '#050505',
  botTextColor: '#1F2937',
  borderRadius: 12,
  fontSize: 16,
  fontFamily: 'Inter',
  bubbleStyle: 'rounded',
  bubbleMaxWidth: 85,
  shadow: true,
  animation: true,
  contactInfo: {
    enabled: true,
    name: '客服中心',
    phone: '02-1234-5678',
    email: 'service@qaplus.com',
    contact: '12345678',
  },
  enableAIChat: true,
  enableBrowseQA: true,
  topicCardColor: '#9333EA', // 預設紫色
  homePageConfig: {
    enabled: true,
    backgroundImage: null, // 圖片參數保留為 null
    faqMode: 'chat',
    ctaButton: {
      show: true,
      text: 'Visit Website',
      url: 'https://example.com',
      textColor: '#3a6ba7',
    },
    faqButton: {
      text: '',
      backgroundColor: '#3a6ba7',
      textColor: '#ffffff',
    },
    buttonAreaUseGradient: false,
    buttonAreaBackgroundColor: '#ffffff',
    buttonAreaGradientStartColor: '#f3f4f6',
    buttonAreaGradientEndColor: '#e5e7eb',
    buttonAreaGradientDirection: 'to right',
  },
});

/**
 * 預設網域白名單配置
 */
export const getDefaultDomainWhitelist = () => ({
  enabled: false,
  domains: [],
});

/**
 * 生成唯一的 Chatbot ID
 * 格式：timestamp_randomString
 */
export const generateChatbotId = (): string => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 11);
  return `${timestamp}_${randomStr}`;
};

