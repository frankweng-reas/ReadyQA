/**
 * 預設 Chatbot 主題配置
 * 參考 AnswerGO 的預設主題設定
 */
export const getDefaultTheme = () => ({
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
  sendButtonHoverColor: '#2563EB',
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
    answerColor: '#374151',
    answerFontSize: '16px',
    questionPrefixColor: '#2563EB',
    accentColor: '#d4d6d8',
    separatorHeight: '1px',
    separatorColor: '#E5E7EB',
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
    contact: '',
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

