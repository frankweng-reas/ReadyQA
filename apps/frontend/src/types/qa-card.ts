import { ChatbotTheme } from './chat'

/**
 * QACard 配置
 */
export interface QACardConfig {
  /** 自定義類名 */
  className?: string
  /** 是否始終展開（不顯示收起按鈕） */
  alwaysExpanded?: boolean
  /** 搜尋日誌 ID（用於記錄操作） */
  log_id?: string
  /** FAQ 在搜尋結果中的位置（從 0 開始） */
  position?: number
  /** API URL（用於記錄操作） */
  apiUrl?: string
}

/**
 * QACard Props（統一接口）
 */
export interface QACardProps {
  /** FAQ ID（可選，用於顯示來源） */
  faq_id?: string
  /** 問題 */
  question: string
  /** 答案 */
  answer: string
  /** 主題配置 */
  theme?: ChatbotTheme
  /** 配置選項 */
  config?: QACardConfig
  /** 自定義插槽（可選，會與 renderer 返回的 slots 合併） */
  slots?: QACardSlots
}

/**
 * QACard 內部狀態
 */
export interface QACardState {
  isExpanded: boolean
  needsExpand: boolean
}

/**
 * QACard 渲染插槽
 */
export interface QACardSlots {
  /** 問題標題區域 */
  header?: React.ReactNode
  /** 答案內容區域 */
  content?: React.ReactNode
  /** 媒體區域（圖片/視頻等） */
  media?: React.ReactNode
  /** 回饋區域 */
  footer?: React.ReactNode
}

