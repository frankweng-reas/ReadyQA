/**
 * 錯誤代碼定義
 */

export enum ErrorCode {
  // 通用錯誤 (1000-1999)
  UNKNOWN_ERROR = 'ERR_1000',
  VALIDATION_ERROR = 'ERR_1001',
  NOT_FOUND = 'ERR_1002',
  ALREADY_EXISTS = 'ERR_1003',
  UNAUTHORIZED = 'ERR_1004',
  FORBIDDEN = 'ERR_1005',

  // Chatbot 相關 (2000-2099)
  CHATBOT_NOT_FOUND = 'ERR_2000',
  CHATBOT_LIMIT_EXCEEDED = 'ERR_2001',
  CHATBOT_INACTIVE = 'ERR_2002',

  // FAQ 相關 (2100-2199)
  FAQ_NOT_FOUND = 'ERR_2100',
  FAQ_LIMIT_EXCEEDED = 'ERR_2101',
  FAQ_DUPLICATE_QUESTION = 'ERR_2102',

  // Session 相關 (2200-2299)
  SESSION_NOT_FOUND = 'ERR_2200',
  SESSION_EXPIRED = 'ERR_2201',
  SESSION_QUOTA_EXCEEDED = 'ERR_2202',
  SESSION_INVALID = 'ERR_2203',

  // Tenant 相關 (2300-2399)
  TENANT_NOT_FOUND = 'ERR_2300',
  TENANT_SUSPENDED = 'ERR_2301',
  TENANT_QUOTA_EXCEEDED = 'ERR_2302',

  // 搜尋相關 (2400-2499)
  SEARCH_FAILED = 'ERR_2400',
  ELASTICSEARCH_ERROR = 'ERR_2401',

  // LLM 相關 (2500-2599)
  LLM_ERROR = 'ERR_2500',
  LLM_QUOTA_EXCEEDED = 'ERR_2501',
  LLM_TIMEOUT = 'ERR_2502',

  // 資料庫相關 (2600-2699)
  DATABASE_ERROR = 'ERR_2600',
  TRANSACTION_FAILED = 'ERR_2601',
}

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.UNKNOWN_ERROR]: '未知錯誤',
  [ErrorCode.VALIDATION_ERROR]: '資料驗證失敗',
  [ErrorCode.NOT_FOUND]: '資源不存在',
  [ErrorCode.ALREADY_EXISTS]: '資源已存在',
  [ErrorCode.UNAUTHORIZED]: '未授權',
  [ErrorCode.FORBIDDEN]: '無權限',

  [ErrorCode.CHATBOT_NOT_FOUND]: 'Chatbot 不存在',
  [ErrorCode.CHATBOT_LIMIT_EXCEEDED]: 'Chatbot 數量超過限制',
  [ErrorCode.CHATBOT_INACTIVE]: 'Chatbot 未啟用',

  [ErrorCode.FAQ_NOT_FOUND]: 'FAQ 不存在',
  [ErrorCode.FAQ_LIMIT_EXCEEDED]: 'FAQ 數量超過限制',
  [ErrorCode.FAQ_DUPLICATE_QUESTION]: '問題已存在',

  [ErrorCode.SESSION_NOT_FOUND]: 'Session 不存在',
  [ErrorCode.SESSION_EXPIRED]: 'Session 已過期',
  [ErrorCode.SESSION_QUOTA_EXCEEDED]: 'Session 查詢次數已用完',
  [ErrorCode.SESSION_INVALID]: 'Session 無效',

  [ErrorCode.TENANT_NOT_FOUND]: '租戶不存在',
  [ErrorCode.TENANT_SUSPENDED]: '租戶已暫停',
  [ErrorCode.TENANT_QUOTA_EXCEEDED]: '租戶配額已用完',

  [ErrorCode.SEARCH_FAILED]: '搜尋失敗',
  [ErrorCode.ELASTICSEARCH_ERROR]: 'Elasticsearch 錯誤',

  [ErrorCode.LLM_ERROR]: 'LLM 調用失敗',
  [ErrorCode.LLM_QUOTA_EXCEEDED]: 'LLM 配額已用完',
  [ErrorCode.LLM_TIMEOUT]: 'LLM 調用超時',

  [ErrorCode.DATABASE_ERROR]: '資料庫錯誤',
  [ErrorCode.TRANSACTION_FAILED]: '交易失敗',
};

export const ErrorStatusCodes: Record<ErrorCode, number> = {
  [ErrorCode.UNKNOWN_ERROR]: 500,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,

  [ErrorCode.CHATBOT_NOT_FOUND]: 404,
  [ErrorCode.CHATBOT_LIMIT_EXCEEDED]: 403,
  [ErrorCode.CHATBOT_INACTIVE]: 403,

  [ErrorCode.FAQ_NOT_FOUND]: 404,
  [ErrorCode.FAQ_LIMIT_EXCEEDED]: 403,
  [ErrorCode.FAQ_DUPLICATE_QUESTION]: 409,

  [ErrorCode.SESSION_NOT_FOUND]: 404,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.SESSION_QUOTA_EXCEEDED]: 429,
  [ErrorCode.SESSION_INVALID]: 401,

  [ErrorCode.TENANT_NOT_FOUND]: 404,
  [ErrorCode.TENANT_SUSPENDED]: 403,
  [ErrorCode.TENANT_QUOTA_EXCEEDED]: 429,

  [ErrorCode.SEARCH_FAILED]: 500,
  [ErrorCode.ELASTICSEARCH_ERROR]: 500,

  [ErrorCode.LLM_ERROR]: 500,
  [ErrorCode.LLM_QUOTA_EXCEEDED]: 429,
  [ErrorCode.LLM_TIMEOUT]: 504,

  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.TRANSACTION_FAILED]: 500,
};

