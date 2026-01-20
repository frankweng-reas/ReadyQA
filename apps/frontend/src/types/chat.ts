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
  sendButtonIcon: 'arrow-right' | 'paper-plane' | 'arrow-up' | 'send' | 'chevron-right'
  
  // Header 設定
  headerBackgroundColor: string
  headerTextColor: string
  headerTitle: string
  headerSubtitle: string
  showHeader: boolean
  showHeaderLogo: boolean
  showHeaderTitle: boolean
  showHeaderSubtitle: boolean
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
  
  // 問答卡片樣式設定（原 Q&A 卡片）
  qaCardStyle?: {
    backgroundColor?: string // 背景顏色（CSS 顏色值，如 #FFFFFF）
    borderColor?: string // 邊框顏色（CSS 顏色值，如 #E5E7EB）
    borderRadius?: string // 圓角（Tailwind 類名，如 rounded-xl）
    padding?: string // 內邊距（Tailwind 類名，如 p-4）
    shadow?: string // 陰影效果（Tailwind 類名，如 shadow-md hover:shadow-lg）
    questionColor?: string // 問題文字顏色（CSS 顏色值）
    questionFontSize?: string // 標題文字大小（CSS 字體大小值，如 16px、1rem、1.25rem）
    questionBackgroundColor?: string // 標題背景顏色（CSS 顏色值，如 #F3F4F6）
    questionUseGradient?: boolean // 是否使用漸層背景（預設 false）
    questionGradientStartColor?: string // 標題漸層起始顏色（CSS 顏色值）
    questionGradientEndColor?: string // 標題漸層結束顏色（CSS 顏色值）
    questionGradientDirection?: 'to right' | 'to bottom' | 'to left' | 'to top' | 'to bottom right' | 'to bottom left' | 'to top right' | 'to top left' // 漸層方向
    answerColor?: string // 答案文字顏色（CSS 顏色值）
    answerFontSize?: string // 內容文字大小（CSS 字體大小值，如 14px、1rem）
    questionPrefixColor?: string // Q: 前綴顏色（CSS 顏色值，保留向後兼容）
    iconColor?: string // 問答圖標顏色（CSS 顏色值，如 #3B82F6）
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
    name?: string // 名稱
    phone?: string // 電話
    email?: string // Email
  }
  
  // Tab 功能設定
  enableAIChat?: boolean      // 是否啟用智能問答 Tab（預設 true）
  enableBrowseQA?: boolean    // 是否啟用問答瀏覽 Tab（預設 true）
  
  // Chatbot Home Page 設定
  homePageConfig?: {
    enabled?: boolean           // 是否啟用首頁
    backgroundImage?: string    // 首頁背景圖片 URL
    faqMode?: 'chat' | 'browse' // FAQ 導向頁面模式：問答模式或瀏覽模式
    ctaButton?: {
      show?: boolean           // 是否顯示 CTA 按鈕
      text?: string            // 按鈕文字
      url?: string             // 按鈕連結
      textColor?: string       // 按鈕文字顏色
    }
    faqButton?: {
      text?: string            // 按鈕文字
    }
    buttonAreaUseGradient?: boolean  // 按鈕區域是否使用漸層
    buttonAreaBackgroundColor?: string  // 按鈕區域背景顏色
    buttonAreaGradientStartColor?: string  // 按鈕區域漸層起始顏色
    buttonAreaGradientEndColor?: string  // 按鈕區域漸層結束顏色
    buttonAreaGradientDirection?: 'to right' | 'to bottom' | 'to left' | 'to top' | 'to bottom right' | 'to bottom left' | 'to top right' | 'to top left'  // 按鈕區域漸層方向
  }
}

// 預設主題（與後端 getDefaultTheme() 保持一致）
export const defaultTheme: ChatbotTheme = {
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
  headerTitle: 'AI 問答助手',
  headerSubtitle: '不生成、不猜測、快速找到正確答案',
  showHeader: true,
  showHeaderLogo: true,
  showHeaderTitle: true,
  showHeaderSubtitle: true,
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
    faqMode: 'chat', // 預設為問答模式
    ctaButton: {
      show: true,
      text: '造訪網站',
      url: '',
      textColor: '#3a6ba7'
    },
    faqButton: {
      text: 'FAQ'
    },
    buttonAreaUseGradient: false,
    buttonAreaBackgroundColor: '#ffffff',
    buttonAreaGradientStartColor: '#f3f4f6',
    buttonAreaGradientEndColor: '#e5e7eb',
    buttonAreaGradientDirection: 'to right'
  }
}

