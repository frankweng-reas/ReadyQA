/**
 * Session Token 管理工具
 * 參考 AnswerGO 的 sessionToken.ts
 * 用於管理後端簽發的 Session Token
 */

const SESSION_TOKEN_KEY = 'qaplus_session_token';
const SESSION_TOKEN_CHATBOT_KEY = 'qaplus_session_token_chatbot';
const SESSION_TOKEN_EXPIRES_KEY = 'qaplus_session_token_expires';

interface SessionTokenData {
  token: string;
  chatbotId: string;
  expiresAt: string;
  maxQueries: number;
}

/**
 * 初始化 Session Token
 * 從後端獲取新的 token
 * 
 * @param chatbotId - Chatbot ID
 * @returns Session token 資料
 */
export async function initSessionToken(chatbotId: string): Promise<SessionTokenData> {
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/sessions/init`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chatbot_id: chatbotId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `初始化 session 失敗: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 儲存到 localStorage
    try {
      localStorage.setItem(SESSION_TOKEN_KEY, data.token);
      localStorage.setItem(SESSION_TOKEN_CHATBOT_KEY, chatbotId);
      localStorage.setItem(SESSION_TOKEN_EXPIRES_KEY, data.expires_at);
    } catch (storageError) {
      console.warn('[SessionToken] localStorage 不可用:', storageError);
    }
    
    return {
      token: data.token,
      chatbotId,
      expiresAt: data.expires_at,
      maxQueries: data.max_queries,
    };
  } catch (error) {
    console.error('[SessionToken] 初始化失敗:', error);
    throw error;
  }
}

/**
 * 獲取當前的 Session Token
 * 如果不存在或已過期，返回 null
 * 
 * @param chatbotId - Chatbot ID（用於驗證 token 是否屬於該 chatbot）
 * @returns Session token 或 null
 */
export function getSessionToken(chatbotId: string): string | null {
  try {
    // 檢查 token 是否存在
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    const storedChatbotId = localStorage.getItem(SESSION_TOKEN_CHATBOT_KEY);
    
    if (!token || storedChatbotId !== chatbotId) {
      return null;
    }
    
    // 檢查是否過期
    const expiresAt = localStorage.getItem(SESSION_TOKEN_EXPIRES_KEY);
    if (expiresAt) {
      const expiresTime = new Date(expiresAt).getTime();
      const now = Date.now();
      
      // 提前 1 分鐘視為過期（避免邊界情況）
      if (now >= expiresTime - 60000) {
        return null;
      }
    }
    
    return token;
  } catch (error) {
    console.warn('[SessionToken] 讀取 token 失敗:', error);
    return null;
  }
}

/**
 * 清除 Session Token
 */
export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_TOKEN_CHATBOT_KEY);
    localStorage.removeItem(SESSION_TOKEN_EXPIRES_KEY);
  } catch (error) {
    console.warn('[SessionToken] 清除 token 失敗:', error);
  }
}

/**
 * 獲取或初始化 Session Token
 * 如果 token 不存在或已過期，自動初始化新的
 * 
 * @param chatbotId - Chatbot ID
 * @returns Session token
 */
export async function getOrInitSessionToken(chatbotId: string): Promise<string> {
  // 先嘗試獲取現有的 token
  const existingToken = getSessionToken(chatbotId);
  if (existingToken) {
    return existingToken;
  }
  
  // 如果不存在或已過期，初始化新的
  const sessionData = await initSessionToken(chatbotId);
  return sessionData.token;
}

