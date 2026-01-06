export interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: string
  isTyping?: boolean
}

export interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
}

export interface ChatbotTheme {
  // 背景和整體顏色
  chatBackgroundColor: string
  
  // 輸入框設定
  inputPosition: 'top' | 'bottom' // 輸入框位置
  inputAreaBackgroundColor: string // 輸入框區域背景顏色
  inputBackgroundColor: string // 輸入框本身背景顏色
  inputBorderColor: string
  inputTextColor: string
  inputPlaceholderColor: string
  inputPlaceholderText: string
  
  // 語音設定
  enableVoice: boolean
  
  // 發送按鈕設定
  sendButtonBackgroundColor: string
  sendButtonTextColor: string
  sendButtonHoverColor: string
  sendButtonIcon: 'arrow-right' | 'paper-plane' | 'arrow-up' | 'send' | 'chevron-right'
  
  // Header 設定
  headerBackgroundColor: string
  headerTextColor: string
  headerTitle: string
  headerSubtitle: string
  showHeader: boolean
  headerLogo: string | null
  headerAlign: 'left' | 'center' | 'right'
  headerSize: 'small' | 'medium' | 'large'
  headerUseGradient: boolean
  headerGradientStartColor: string
  headerGradientEndColor: string
  headerGradientDirection: 'to right' | 'to bottom' | 'to left' | 'to top' | 'to bottom right' | 'to bottom left' | 'to top right' | 'to top left'
  
  // 關閉按鈕設定
  showCloseButton: boolean
  closeButtonColor: string
  closeButtonHoverColor: string
  
  // FAQ 區域文字顏色設定
  faqSectionTextColor: string // 提示文字顏色（標題和提示文字共用）
  faqSectionSubtextColor?: string // FAQ 區域副文字顏色（可選，向後兼容）
  
  // 知識卡片樣式設定（原 Q&A 卡片）
  qaCardStyle?: {
    backgroundColor?: string // 背景顏色（CSS 顏色值，如 #FFFFFF）
    borderColor?: string // 邊框顏色（CSS 顏色值，如 #E5E7EB）
    borderRadius?: string // 圓角（Tailwind 類名，如 rounded-xl）
    padding?: string // 內邊距（Tailwind 類名，如 p-4）
    shadow?: string // 陰影效果（Tailwind 類名，如 shadow-md hover:shadow-lg）
    questionColor?: string // 問題文字顏色（CSS 顏色值）
    questionFontSize?: string // 標題文字大小（CSS 字體大小值，如 16px、1rem、1.25rem）
    answerColor?: string // 答案文字顏色（CSS 顏色值）
    answerFontSize?: string // 內容文字大小（CSS 字體大小值，如 14px、1rem）
    questionPrefixColor?: string // Q: 前綴顏色（CSS 顏色值，保留向後兼容）
    accentColor?: string // 左側邊框顏色（CSS 顏色值，如 #3B82F6）
    iconColor?: string // 知識圖標顏色（CSS 顏色值，如 #3B82F6）
    separatorHeight?: string // 標題與內容之間分隔線高度（CSS 高度值，如 1px、2px、3px）
    separatorColor?: string // 標題與內容之間分隔線顏色（CSS 顏色值，如 #E5E7EB）
  }
  
  // 容器外型設定（Chatbot 整體外框樣式）
  containerStyle?: {
    borderRadius?: string // 圓角（Tailwind 類名，如 rounded-lg、rounded-xl、rounded-2xl）
    shadow?: string // 陰影效果（Tailwind 類名，如 shadow-md、shadow-lg、shadow-xl）
    border?: string // 邊框寬度（Tailwind 類名，如 border、border-2，可選）
    borderColor?: string // 邊框顏色（CSS 顏色值，如 #E5E7EB）
    overflow?: string // 溢出處理（Tailwind 類名，如 overflow-hidden，預設為 overflow-hidden）
  }
  
  // 對話氣泡樣式設定（可選，向後兼容舊版 JSON）
  userBubbleColor?: string // 用戶訊息氣泡顏色
  botBubbleColor?: string // Bot 訊息氣泡顏色
  userTextColor?: string // 用戶訊息文字顏色
  botTextColor?: string // Bot 訊息文字顏色
  borderRadius?: number // 氣泡圓角（數字，單位為 px）
  fontSize?: number // 字體大小（數字，單位為 px）
  fontFamily?: string // 字體家族
  bubbleStyle?: 'rounded' | 'square' | 'minimal' // 氣泡樣式
  bubbleMaxWidth?: number // 氣泡最大寬度（百分比）
  shadow?: boolean // 是否顯示陰影
  animation?: boolean // 是否啟用動畫
  
  // 聯絡人設定
  contactInfo?: {
    enabled?: boolean // 是否啟用聯絡人設定（預設 false）
    contact?: string // 聯絡資訊（電話或 email）
  }
}

// 預設主題
export const defaultTheme: ChatbotTheme = {
  chatBackgroundColor: '#FFFFFF',
  inputPosition: 'bottom',
  inputAreaBackgroundColor: '#F9FAFB',
  inputBackgroundColor: '#FFFFFF',
  inputBorderColor: '#D1D5DB',
  inputTextColor: '#1F2937',
  inputPlaceholderColor: '#9CA3AF',
  inputPlaceholderText: '請輸入你的問題...',
  enableVoice: true,
  sendButtonBackgroundColor: '#3B82F6',
  sendButtonTextColor: '#FFFFFF',
  sendButtonHoverColor: '#2563EB',
  sendButtonIcon: 'arrow-right',
  headerBackgroundColor: '#3B82F6',
  headerTextColor: '#FFFFFF',
  headerTitle: 'AI 助手',
  headerSubtitle: '我可以回答您的問題',
  showHeader: true,
  headerLogo: null,
  headerAlign: 'left',
  headerSize: 'medium',
  headerUseGradient: false,
  headerGradientStartColor: '#3B82F6',
  headerGradientEndColor: '#2563EB',
  headerGradientDirection: 'to right',
  showCloseButton: true,
  closeButtonColor: '#FFFFFF',
  closeButtonHoverColor: '#F3F4F6',
  faqSectionTextColor: '#1F2937',
  qaCardStyle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    borderRadius: 'rounded-xl',
    padding: 'p-4',
    shadow: 'shadow-md hover:shadow-lg',
    questionColor: '#1F2937',
    questionFontSize: '1rem',
    answerColor: '#4B5563',
    answerFontSize: '0.875rem',
    accentColor: '#3B82F6',
    iconColor: '#3B82F6',
    separatorHeight: '1px',
    separatorColor: '#E5E7EB',
  },
  containerStyle: {
    borderRadius: 'rounded-lg',
    shadow: 'shadow-lg',
    border: '',
    borderColor: '#E5E7EB',
    overflow: 'overflow-hidden',
  },
  contactInfo: {
    enabled: false,
    contact: '',
  },
}

