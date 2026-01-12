'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ChatbotTheme, defaultTheme } from '@/types/chat';
import { faqApi } from '@/lib/api/faq';
import { topicApi } from '@/lib/api/topic';
import { chatbotApi } from '@/lib/api/chatbot';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import QACard from './QACard';
import { useNotification } from '@/hooks/useNotification';

interface ChatbotWidgetProps {
  theme?: Partial<ChatbotTheme>
  mode: 'interactive' | 'embedded'
  chatbotId?: string
  onClose?: () => void
  showCloseButton?: boolean
  isInputDisabled?: boolean
  refreshKey?: number
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  topicId: string | null;
}

interface Topic {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  _count?: {
    faqs: number;
    children: number;
  };
}

interface QABlock {
  faq_id: string;
  question: string;
  answer: string;
  layout?: string;
  images?: string;
}

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  qa_blocks?: QABlock[];
  intro?: string;
  log_id?: string; // 搜尋日誌 ID，用於記錄用戶反饋
}

export default function ChatbotWidget({
  theme: customTheme,
  mode,
  chatbotId,
  onClose,
  showCloseButton = true,
  isInputDisabled = false,
  refreshKey = 0
}: ChatbotWidgetProps) {
  // 翻譯
  const tCommon = useTranslations('common');
  const notify = useNotification();
  
  // 直接使用傳入的 theme（資料庫中已有完整資料）
  const theme: ChatbotTheme = (customTheme as ChatbotTheme) || defaultTheme;

  // 模式切換
  const [activeTab, setActiveTab] = useState<'chat' | 'browse'>('chat');
  
  // Chatbot 狀態檢查（僅 embedded mode）
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isCheckingActive, setIsCheckingActive] = useState<boolean>(false);
  
  // 狀態管理
  const [inputValue, setInputValue] = useState('');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isLoadingFaqs, setIsLoadingFaqs] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [selectedFaqLogId, setSelectedFaqLogId] = useState<string | null>(null); // 儲存 Browse mode 的 log_id
  const [showContactModal, setShowContactModal] = useState(false);
  
  // 查詢狀態
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  // 對話記錄限制
  const MAX_MESSAGES = 50; // 最多保留 50 條對話（25 組問答）
  
  // 訊息容器 ref - 用於自動滾動
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 語音錄音
  const {
    isRecording,
    recordingTime,
    isTranscribing,
    voiceError,
    formatRecordingTime,
    handleVoiceButtonClick
  } = useVoiceRecording({
    chatbotId,
    enabled: !isInputDisabled && (theme.enableVoice ?? false),
    onTranscriptionComplete: (text) => {
      console.log('[ChatbotWidget] 收到語音轉錄結果:', text);
      setInputValue(text);
    }
  });

  // Embedded mode: 檢查 chatbot 的 isActive 狀態
  useEffect(() => {
    // 非 embedded mode，直接視為啟用
    if (mode !== 'embedded') {
      setIsActive(true);
      return;
    }
    
    // embedded mode 但沒有 chatbotId，等待載入
    if (!chatbotId) {
      return;
    }

    // 檢查 chatbot 是否啟用
    const checkChatbotActive = async () => {
      setIsCheckingActive(true);
      setIsActive(false); // 先設置為 false，等待檢查結果
      
      try {
        // 使用公開 API（不需要認證）
        const response = await chatbotApi.getPublicStatus(chatbotId);
        const isActiveValue = response.data?.isActive;
        
        // 驗證 isActive：必須是 'active' 或 'inactive'
        if (isActiveValue === undefined || isActiveValue === null) {
          console.error(`[ChatbotWidget] ❌ Chatbot ${chatbotId} 的 isActive 為 ${isActiveValue}`);
          setIsActive(false);
          setIsCheckingActive(false);
          return;
        }
        if (isActiveValue !== 'active' && isActiveValue !== 'inactive') {
          console.error(`[ChatbotWidget] ❌ Chatbot ${chatbotId} 的 isActive 值為 "${isActiveValue}"`);
          setIsActive(false);
          setIsCheckingActive(false);
          return;
        }
        
        const chatbotIsActive = isActiveValue === 'active';
        setIsActive(chatbotIsActive);
        console.log(`[ChatbotWidget] Chatbot ${chatbotId} 狀態: ${chatbotIsActive ? '啟用' : '停用'}`);
      } catch (error) {
        console.error('[ChatbotWidget] 檢查 chatbot 狀態失敗:', error);
        setIsActive(false);
      } finally {
        setIsCheckingActive(false);
      }
    };

    checkChatbotActive();
  }, [mode, chatbotId]);

  // 自動滾動到最新訊息
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // 當訊息更新或正在輸入時，自動滾動
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.menu-container')) {
          setShowMenu(false);
        }
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // 載入 FAQs 和 Topics
  useEffect(() => {
    const loadData = async () => {
      if (!chatbotId) return;

      setIsLoadingFaqs(true);
      try {
        const [faqsData, topicsData] = await Promise.all([
          faqApi.getAll(chatbotId, undefined, undefined, 'active'), // 只載入 active 狀態的 FAQs
          topicApi.getAll(chatbotId),
        ]);
        setFaqs(faqsData);
        setTopics(topicsData);
      } catch (error) {
        console.error('載入資料失敗:', error);
      } finally {
        setIsLoadingFaqs(false);
      }
    };

    loadData();
  }, [chatbotId, refreshKey]);

  // 處理 FAQ 點擊（Browse mode）
  const handleFaqClick = async (faq: FAQ) => {
    // ========== 先檢查 Quota 再顯示 FAQ ==========
    if (!chatbotId) return;

    try {
      // 獲取 Session Token
      const { getOrInitSessionToken } = await import('@/utils/sessionToken');
      const sessionToken = await getOrInitSessionToken(chatbotId);

      // 調用 log-faq-browse API（包含 Quota 檢查）
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/query/log-faq-browse`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          chatbot_id: chatbotId,
          faq_id: faq.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[ChatbotWidget] ✅ 已記錄 FAQ 瀏覽:', {
          faq_id: faq.id,
          question: faq.question,
          log_id: data.log_id,
        });
        
        // Quota 檢查通過，顯示 FAQ
        setSelectedFaq(faq);
        
        // 儲存 log_id 以便傳給 QACard
        if (data.log_id) {
          setSelectedFaqLogId(data.log_id);
        } else {
          setSelectedFaqLogId(null);
        }
      } else {
        // API 返回錯誤（可能是 Quota 超限）
        const errorData = await response.json().catch(() => ({ message: '查詢失敗' }));
        console.warn('[ChatbotWidget] ⚠️ FAQ 瀏覽被阻擋:', response.status, errorData);
        
        // 顯示錯誤訊息給用戶
        notify.warning(errorData.message || '查詢失敗');
      }
    } catch (error) {
      console.error('[ChatbotWidget] ❌ 記錄 FAQ 瀏覽錯誤:', error);
      notify.error('系統發生錯誤');
    }
  };

  // 處理發送訊息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping || !chatbotId) {
      console.log('[ChatbotWidget] 無法發送訊息:', {
        hasInput: !!inputValue.trim(),
        isTyping,
        hasChatbotId: !!chatbotId,
      });
      return;
    }

    const userQuery = inputValue.trim();
    console.log('[ChatbotWidget] 發送訊息:', userQuery);
    console.log('[ChatbotWidget] API URL:', process.env.NEXT_PUBLIC_API_URL);
    console.log('[ChatbotWidget] Chatbot ID:', chatbotId);

    // 清空輸入框並添加用戶訊息
    setInputValue('');
    setMessages(prev => {
      const newMessages: ChatMessage[] = [...prev, { type: 'user' as const, content: userQuery }];
      // 限制對話數量，避免記憶體累積
      if (newMessages.length > MAX_MESSAGES) {
        return newMessages.slice(-MAX_MESSAGES); // 保留最新的 N 條
      }
      return newMessages;
    });
    setIsTyping(true);

    try {
      // ========== 步驟 1: 獲取 Session Token ==========
      const { getOrInitSessionToken } = await import('@/utils/sessionToken');
      let sessionToken: string;
      
      try {
        sessionToken = await getOrInitSessionToken(chatbotId);
        console.log('[ChatbotWidget] Session token 獲取成功，token 長度:', sessionToken?.length || 0);
      } catch (tokenError) {
        console.error('[ChatbotWidget] 獲取 session token 失敗:', tokenError);
        throw new Error('無法初始化會話，請重新載入頁面');
      }

      // ========== 步驟 2: 調用查詢 API ==========
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/query/chat`;
      console.log('[ChatbotWidget] 完整 API URL:', apiUrl);

      // 如果是 interactive mode（design preview / chat mode），傳入 mode: 'preview' 以跳過 isActive 檢查
      const requestBody = {
        query: userQuery,
        chatbot_id: chatbotId,
        mode: mode === 'interactive' ? 'preview' : 'production',
      };
      console.log('[ChatbotWidget] 請求內容:', requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`, // ← 帶上 Session Token
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[ChatbotWidget] 回應狀態:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ChatbotWidget] API 錯誤回應:', errorData);
        
        // 如果是 TOKEN_EXPIRED，清除 token 並提示重新載入
        if (errorData.message === 'TOKEN_EXPIRED' || response.status === 401) {
          const { clearSessionToken } = await import('@/utils/sessionToken');
          clearSessionToken();
          throw new Error('會話已過期，請重新載入頁面');
        }
        
        throw new Error(errorData.message || `查詢失敗 (${response.status})`);
      }

      const data = await response.json();
      console.log('[ChatbotWidget] 收到回應:', data);

      // 添加助手訊息
      setMessages(prev => {
        const newMessages: ChatMessage[] = [
          ...prev,
          {
            type: 'assistant' as const,
            content: '', // intro 已經在 intro 字段中，不需要重複
            qa_blocks: data.qa_blocks || [],
            intro: data.intro,
            log_id: data.log_id, // 保存 log_id 用於記錄用戶反饋
          },
        ];
        // 限制對話數量
        if (newMessages.length > MAX_MESSAGES) {
          return newMessages.slice(-MAX_MESSAGES);
        }
        return newMessages;
      });
    } catch (error) {
      console.error('[ChatbotWidget] 查詢失敗:', error);
      console.error('[ChatbotWidget] 錯誤詳情:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // 添加錯誤訊息
      const errorMessage = error instanceof Error ? error.message : '查詢失敗';
      setMessages(prev => {
        const newMessages: ChatMessage[] = [
          ...prev,
          {
            type: 'assistant' as const,
            content: `抱歉，${errorMessage}。請稍後再試。`,
            qa_blocks: [],
          },
        ];
        // 限制對話數量
        if (newMessages.length > MAX_MESSAGES) {
          return newMessages.slice(-MAX_MESSAGES);
        }
        return newMessages;
      });
    } finally {
      setIsTyping(false);
    }
  };

  // 處理鍵盤事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 檢查是否正在使用輸入法（中文、日文等）
    // isComposing 為 true 時，Enter 是用來確認輸入，不應該發送訊息
    if (e.key === 'Enter' && !e.shiftKey && !isInputDisabled) {
      // @ts-ignore - nativeEvent.isComposing 可能不存在於類型定義中
      if (e.nativeEvent.isComposing) {
        // 正在使用輸入法，不觸發發送
        return;
      }
      
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 渲染發送按鈕圖標
  const renderSendIcon = () => {
    switch (theme.sendButtonIcon) {
      case 'arrow-right':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        );
      case 'paper-plane':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        );
      case 'arrow-up':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        );
      case 'send':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        );
      case 'chevron-right':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        );
    }
  };

  // 獲取所有子分類的 ID（遞歸）
  const getAllChildrenIds = (parentId: string): string[] => {
    const children = topics.filter(t => t.parentId === parentId);
    const allIds: string[] = [];
    
    children.forEach(child => {
      allIds.push(child.id);
      // 遞歸獲取子分類的子分類
      const grandChildren = getAllChildrenIds(child.id);
      allIds.push(...grandChildren);
    });
    
    return allIds;
  };

  // 獲取指定 Topic 的 FAQs（包含子分類）
  const getFaqsByTopic = (topicId: string | null) => {
    if (topicId === null) {
      return faqs.filter(faq => !faq.topicId);
    }
    
    // 獲取所有子分類的 ID
    const allTopicIds = [topicId, ...getAllChildrenIds(topicId)];
    
    // 返回該分類及其所有子分類的 FAQs
    return faqs.filter(faq => faq.topicId && allTopicIds.includes(faq.topicId));
  };

  // 獲取 Topic 的完整路徑（用於顯示）
  const getTopicPath = (topicId: string): string => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return '';
    
    if (topic.parentId) {
      const parentPath = getTopicPath(topic.parentId);
      return parentPath ? `${parentPath} > ${topic.name}` : topic.name;
    }
    
    return topic.name;
  };

  // 獲取未分類的 FAQs
  const getUncategorizedFaqs = () => {
    return faqs.filter(faq => !faq.topicId);
  };

  // 容器樣式設定
  const containerStyle = theme.containerStyle || {};
  const shadowClass = containerStyle?.shadow !== undefined 
    ? containerStyle.shadow 
    : 'shadow-lg';
  
  const containerClasses = [
    'h-full',
    'flex',
    'flex-col',
    'min-h-0',
    'relative',
    containerStyle?.borderRadius || 'rounded-lg',
    shadowClass,
    containerStyle?.border || '',
    containerStyle?.overflow || 'overflow-hidden'
  ].filter(Boolean).join(' ');
  
  const containerBorderStyle = containerStyle?.border && containerStyle?.borderColor
    ? { borderColor: containerStyle.borderColor }
    : {};

  // 如果是 embedded mode，需要檢查 chatbot 狀態
  if (mode === 'embedded') {
    // 如果正在檢查狀態，顯示載入中
    if (isCheckingActive) {
      return (
        <div className="relative w-full h-full">
          <div 
            className="h-full flex flex-col min-h-0 relative rounded-lg shadow-lg overflow-hidden"
            style={{ backgroundColor: theme.chatBackgroundColor || '#FFFFFF' }}
          >
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600">正在檢查 Chatbot 狀態...</p>
            </div>
          </div>
        </div>
      );
    }
    
    // 如果 chatbot 未啟用，顯示錯誤訊息
    if (!isActive) {
      return (
        <div className="relative w-full h-full">
          <div 
            className="h-full flex flex-col min-h-0 relative rounded-lg shadow-lg overflow-hidden"
            style={{ backgroundColor: theme.chatBackgroundColor || '#FFFFFF' }}
          >
            <div className="flex flex-col items-center justify-center h-full p-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Chatbot 已暫停使用
              </h3>
              <p className="text-gray-600 text-center">
                此 Chatbot 目前暫停服務中，請稍後再試或聯繫管理員。
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="relative w-full h-full">
      <div 
        className={containerClasses}
        style={{ 
          backgroundColor: theme.chatBackgroundColor,
          ...containerBorderStyle
        }}
      >
        {/* Header 區域 */}
        {theme.showHeader && (() => {
          const sizeConfig = {
            small: {
              padding: '8px 12px',
              minHeight: '60px',
              logoSize: '32px',
              iconSize: '16px',
              titleSize: '16px',
              subtitleSize: '12px',
              space: '8px',
              closeButtonSize: '24px',
              closeIconSize: '14px',
              closeTop: '8px',
              closeRight: '8px'
            },
            medium: {
              padding: '16px',
              minHeight: '80px',
              logoSize: '40px',
              iconSize: '24px',
              titleSize: '18px',
              subtitleSize: '14px',
              space: '12px',
              closeButtonSize: '32px',
              closeIconSize: '20px',
              closeTop: '16px',
              closeRight: '16px'
            },
            large: {
              padding: '24px',
              minHeight: '100px',
              logoSize: '48px',
              iconSize: '28px',
              titleSize: '20px',
              subtitleSize: '16px',
              space: '16px',
              closeButtonSize: '36px',
              closeIconSize: '22px',
              closeTop: '24px',
              closeRight: '24px'
            }
          };
          
          const config = sizeConfig[theme.headerSize || 'medium'];
          
          const backgroundStyle = theme.headerUseGradient
            ? {
                background: `linear-gradient(${theme.headerGradientDirection || 'to right'}, ${theme.headerGradientStartColor}, ${theme.headerGradientEndColor})`,
              }
            : {
                backgroundColor: theme.headerBackgroundColor,
              };
          
          return (
            <div 
              className="border-b border-gray-200 flex-shrink-0 relative"
              style={{ 
                ...backgroundStyle,
                color: theme.headerTextColor,
                padding: config.padding,
                minHeight: config.minHeight
              }}
            >
              <div className={`flex items-center ${theme.headerAlign === 'center' ? 'justify-center' : ''}`} style={{ gap: config.space }}>
                {theme.headerAlign !== 'center' && (
                  <div 
                    onClick={() => {
                      const hasContactInfo = theme.contactInfo?.enabled && 
                        (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email);
                      if (hasContactInfo) {
                        setShowContactModal(true);
                      }
                    }}
                    className={`bg-white rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
                      theme.contactInfo?.enabled && (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email) ? 'cursor-pointer hover:shadow-lg hover:scale-105 transition-all' : ''
                    }`}
                    style={{
                      width: config.logoSize,
                      height: config.logoSize
                    }}
                    title={theme.contactInfo?.enabled && (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email) ? '點擊查看聯絡資訊' : ''}
                  >
                    {theme.headerLogo ? (
                      <img
                        src={theme.headerLogo}
                        alt="Header Logo"
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <svg 
                        style={{ width: config.iconSize, height: config.iconSize }}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    )}
                  </div>
                )}
                
                {theme.headerAlign === 'center' && (
                  <div 
                    onClick={() => {
                      const hasContactInfo = theme.contactInfo?.enabled && 
                        (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email);
                      if (hasContactInfo) {
                        setShowContactModal(true);
                      }
                    }}
                    className={`bg-white rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
                      theme.contactInfo?.enabled && (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email) ? 'cursor-pointer hover:shadow-lg hover:scale-105 transition-all' : ''
                    }`}
                    style={{
                      width: config.logoSize,
                      height: config.logoSize
                    }}
                    title={theme.contactInfo?.enabled && (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email) ? '點擊查看聯絡資訊' : ''}
                  >
                    {theme.headerLogo ? (
                      <img
                        src={theme.headerLogo}
                        alt="Header Logo"
                        className="w-full h-full object-cover rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <svg 
                        style={{ width: config.iconSize, height: config.iconSize }}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    )}
                  </div>
                )}
                
                <div className={`${
                  theme.headerAlign === 'center' ? '' :
                  theme.headerAlign === 'right' ? 'flex-1 text-right' :
                  'flex-1 text-left'
                } ${
                  theme.headerAlign === 'center' ? 'text-center' : ''
                }`}>
                  <h4 
                    className="font-semibold" 
                    style={{ fontSize: config.titleSize }}
                  >
                    {theme.headerTitle || 'AI 助手'}
                  </h4>
                  {theme.headerSubtitle && (
                    <p 
                      className="opacity-90" 
                      style={{ fontSize: config.subtitleSize }}
                    >
                      {theme.headerSubtitle}
                    </p>
                  )}
                </div>
              </div>
              
              {(showCloseButton || theme.showCloseButton) && onClose && (
                <button
                  onClick={onClose}
                  className="absolute rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                  style={{
                    top: config.closeTop,
                    right: config.closeRight,
                    width: config.closeButtonSize,
                    height: config.closeButtonSize,
                    backgroundColor: theme.closeButtonColor,
                    color: theme.headerBackgroundColor,
                    opacity: 0.8
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.closeButtonHoverColor;
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.closeButtonColor;
                    e.currentTarget.style.opacity = '0.8';
                  }}
                  title="關閉聊天視窗"
                >
                  <svg 
                    style={{ width: config.closeIconSize, height: config.closeIconSize }}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          );
        })()}

        {/* Tab 切換區域 */}
        <div 
          className="flex items-center border-b relative"
          style={{ 
            borderColor: theme.qaCardStyle?.borderColor || '#E5E7EB',
          }}
        >
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 px-4 py-2 font-medium transition-all ${
              activeTab === 'chat'
                ? 'border-b-2'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              color: '#374151',
              borderColor: activeTab === 'chat' ? (theme.qaCardStyle?.accentColor || '#3B82F6') : 'transparent',
            }}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>智能問答</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex-1 px-4 py-2 font-medium transition-all ${
              activeTab === 'browse'
                ? 'border-b-2'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{
              color: '#374151',
              borderColor: activeTab === 'browse' ? (theme.qaCardStyle?.accentColor || '#3B82F6') : 'transparent',
            }}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>問答瀏覽</span>
            </div>
          </button>
          
          {/* 三點選單按鈕 */}
          <div className="px-3 menu-container">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors flex items-center justify-center"
              style={{
                color: '#6B7280',
              }}
              title="選單"
            >
              <svg 
                className="w-5 h-5"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {/* 下拉選單 */}
            {showMenu && (
              <div 
                className="absolute right-2 top-full mt-1 w-40 rounded-lg shadow-lg overflow-hidden z-50"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                }}
              >
                <button
                  onClick={() => {
                    setMessages([]);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                  style={{ color: '#374151' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  清除對話
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 內容區域 */}
        <div 
          className="flex-1 p-4 overflow-y-auto min-h-0 relative"
          style={{ order: theme.inputPosition === 'top' ? 2 : 1 }}
        >
          {/* === 智能問答模式 === */}
          {activeTab === 'chat' && (
            <div className="space-y-4">
              {messages.length === 0 ? (
                /* 歡迎畫面 */
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <div className="w-16 h-16 mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: theme.headerTextColor || '#1F2937' }}>
                    有什麼可以幫助您的？
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md">
                    請在下方輸入您的問題，AI 助手會從問答庫中為您找到最相關的答案
                  </p>
                </div>
              ) : (
                /* 聊天訊息列表 */
                <div className="space-y-4">
                  {messages.map((message, index) => (
                <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  {message.type === 'user' ? (
                    /* 用戶訊息 */
                    <div 
                      className="max-w-[80%] px-4 py-2 rounded-lg"
                      style={{
                        backgroundColor: theme.userBubbleColor || '#3B82F6',
                        color: theme.userTextColor || '#FFFFFF',
                      }}
                    >
                      {message.content}
                    </div>
                  ) : (
                    /* 助手訊息 */
                    <div className="w-full space-y-3">
                      {/* Intro 文字 */}
                      {message.intro && (
                        <div
                          className="w-full px-4 py-2 rounded-lg"
                          style={{
                            backgroundColor: theme.botBubbleColor || '#F3F4F6',
                            color: theme.botTextColor || '#1F2937',
                          }}
                        >
                          {message.intro}
                        </div>
                      )}

                      {/* QA 區塊列表 - 充滿整個寬度 */}
                      {message.qa_blocks && message.qa_blocks.length > 0 && (
                        <div className="w-full space-y-3">
                          {message.qa_blocks.map((qaBlock, qaIndex) => (
                            <QACard
                              key={qaIndex}
                              faq_id={qaBlock.faq_id}
                              question={qaBlock.question}
                              answer={qaBlock.answer}
                              theme={theme}
                              config={{
                                log_id: message.log_id,
                                alwaysExpanded: false, // Chat mode: 預設收起
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* 如果沒有結果，顯示內容 */}
                      {(!message.qa_blocks || message.qa_blocks.length === 0) && message.content && (
                        <div
                          className="max-w-[90%] px-4 py-2 rounded-lg"
                          style={{
                            backgroundColor: theme.botBubbleColor || '#F3F4F6',
                            color: theme.botTextColor || '#1F2937',
                          }}
                        >
                          {message.content}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

                  {/* 正在輸入指示器 */}
                  {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                      <div 
                        className="px-4 py-3 rounded-lg shadow-sm"
                        style={{
                          backgroundColor: theme.botBubbleColor || '#F3F4F6',
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-gray-600">AI 正在思考中...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 滾動錨點 */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          )}

          {/* === 問答瀏覽模式 === */}
          {activeTab === 'browse' && (
            isLoadingFaqs ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-600">載入問答列表中...</p>
              </div>
            ) : selectedFaq ? (
              /* 顯示 QACard */
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setSelectedFaq(null);
                    setSelectedFaqLogId(null);
                  }}
                  className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm font-medium">返回問答列表</span>
                </button>
                <QACard
                  faq_id={selectedFaq.id}
                  question={selectedFaq.question}
                  answer={selectedFaq.answer}
                  theme={theme}
                  config={{
                    log_id: selectedFaqLogId || undefined,
                    alwaysExpanded: true,
                  }}
                />
              </div>
            ) : (
            <div className="space-y-3">
              {/* Topics 和 FAQs 列表 */}
              {(() => {
                // 遞歸渲染 Topic 樹
                const renderTopicTree = (parentId: string | null = null, level: number = 0): React.ReactNode => {
                  const children = topics
                    .filter(topic => topic.parentId === parentId)
                    .sort((a, b) => a.sortOrder - b.sortOrder);
                  
                  if (children.length === 0) return null;
                  
                  return children.map(topic => {
                    const topicFaqs = getFaqsByTopic(topic.id);
                    const isExpanded = selectedTopicId === topic.id;
                    const hasChildren = topics.some(t => t.parentId === topic.id);
                    const marginLeft = level * 16;

                    return (
                      <div key={topic.id}>
                        <div className={`border rounded-lg overflow-hidden transition-all ${
                          isExpanded ? 'border-blue-300 shadow-md' : 'border-gray-200'
                        }`} style={{ marginLeft: `${marginLeft}px` }}>
                          <button
                            onClick={() => setSelectedTopicId(isExpanded ? null : topic.id)}
                            className={`w-full px-4 py-3 transition-colors flex items-center justify-between ${
                              isExpanded 
                                ? 'bg-gradient-to-r from-blue-100 to-blue-200' 
                                : 'bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                              <span className="font-medium text-gray-800">{topic.name}</span>
                              {hasChildren && (
                                <span className="text-xs text-gray-500">({topics.filter(t => t.parentId === topic.id).length} 子分類)</span>
                              )}
                              <span className="text-xs text-gray-500">({topicFaqs.length} 問題)</span>
                            </div>
                            <svg 
                              className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {isExpanded && topicFaqs.length > 0 && (
                            <div className="bg-white divide-y divide-gray-100 border-t border-gray-200">
                              {topicFaqs.map(faq => (
                                <button
                                  key={faq.id}
                                  onClick={() => handleFaqClick(faq)}
                                  className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start space-x-2 group"
                                >
                                  <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">{faq.question}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* 遞歸渲染子分類 */}
                        {renderTopicTree(topic.id, level + 1)}
                      </div>
                    );
                  });
                };
                
                return renderTopicTree(null, 0);
              })()}

              {/* 未分類的 FAQs */}
              {getUncategorizedFaqs().length > 0 && (
                <div className={`border rounded-lg overflow-hidden transition-all ${
                  selectedTopicId === 'uncategorized' ? 'border-blue-300 shadow-md' : 'border-gray-200'
                }`}>
                  <button
                    onClick={() => setSelectedTopicId(selectedTopicId === 'uncategorized' ? null : 'uncategorized')}
                    className={`w-full px-4 py-3 transition-colors flex items-center justify-between ${
                      selectedTopicId === 'uncategorized' 
                        ? 'bg-gray-100' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium text-gray-700">其他問題</span>
                      <span className="text-xs text-gray-500">({getUncategorizedFaqs().length})</span>
                    </div>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform ${selectedTopicId === 'uncategorized' ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {selectedTopicId === 'uncategorized' && (
                    <div className="bg-white divide-y divide-gray-100">
                      {getUncategorizedFaqs().map(faq => (
                        <button
                          key={faq.id}
                          onClick={() => handleFaqClick(faq)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-start space-x-2 group"
                        >
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">{faq.question}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {topics.length === 0 && faqs.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">目前沒有常見問答</h3>
                  <p className="text-gray-600">切換到智能問答輸入問題</p>
                </div>
              )}
            </div>
            )
          )}
        </div>

        {/* 輸入框區域 - 僅在智能問答模式顯示 */}
        {activeTab === 'chat' && (
        <div 
          className={`flex-shrink-0 ${
            theme.inputPosition === 'top' ? 'border-b' : 'border-t'
          } border-gray-200`}
          style={{ 
            order: theme.inputPosition === 'top' ? 1 : 2,
            backgroundColor: theme.inputAreaBackgroundColor
          }}
        >
          <div className="p-4">
            <div className="flex items-start space-x-3">
              {/* 語音輸入按鈕 */}
              {theme.enableVoice && (
                <button
                  onClick={handleVoiceButtonClick}
                  disabled={isInputDisabled || isTranscribing}
                  className="flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed shadow-sm relative"
                  style={{
                    backgroundColor: isRecording ? '#EF4444' : theme.sendButtonBackgroundColor,
                    color: theme.sendButtonTextColor,
                    width: '48px',
                    height: '48px',
                    minWidth: '48px',
                    minHeight: '48px'
                  }}
                  title={isRecording ? '停止錄音' : '開始語音輸入'}
                >
                  {isTranscribing ? (
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : isRecording ? (
                    <>
                      <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="9" y="9" width="6" height="6" rx="1" />
                      </svg>
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-mono">
                        {formatRecordingTime(recordingTime)}
                      </span>
                    </>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              )}

              <div className="flex-1">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={theme.inputPlaceholderText}
                  disabled={isInputDisabled || isRecording || isTranscribing}
                  className="w-full px-4 py-3 border rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed shadow-sm transition-all duration-300"
                  style={{
                    fontSize: '16px',
                    backgroundColor: theme.inputBackgroundColor,
                    borderColor: theme.inputBorderColor,
                    color: theme.inputTextColor,
                    minHeight: '48px',
                    maxHeight: '120px'
                  }}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
                {voiceError && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    {voiceError}
                  </div>
                )}
              </div>

              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isInputDisabled || isRecording || isTranscribing}
                className="px-6 py-3 rounded-full transition-all duration-300 hover:opacity-90 flex-shrink-0 disabled:cursor-not-allowed shadow-sm"
                style={{
                  backgroundColor: theme.sendButtonBackgroundColor,
                  color: theme.sendButtonTextColor,
                  height: '48px',
                  minHeight: '48px',
                  maxHeight: '48px'
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = theme.sendButtonHoverColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = theme.sendButtonBackgroundColor;
                  }
                }}
              >
                {renderSendIcon()}
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* 聯絡資訊彈窗 */}
      {showContactModal && theme.contactInfo?.enabled && (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email) && (
        <div className="absolute inset-0 z-50 overflow-y-auto" onClick={() => setShowContactModal(false)}>
          <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="relative bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-800 to-green-900">
                <h3 className="text-lg font-semibold text-white">聯絡資訊</h3>
                <button
                  onClick={() => setShowContactModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                {theme.contactInfo?.name && (
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-lg font-semibold text-green-800">{theme.contactInfo.name}</p>
                  </div>
                )}
                
                {theme.contactInfo?.phone && (
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <a
                      href={`tel:${theme.contactInfo.phone}`}
                      className="text-lg font-semibold text-green-800 hover:text-green-900 transition-colors break-all"
                    >
                      {theme.contactInfo.phone}
                    </a>
                  </div>
                )}
                
                {theme.contactInfo?.email && (
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <a
                      href={`mailto:${theme.contactInfo.email}`}
                      className="text-lg font-semibold text-green-800 hover:text-green-900 transition-colors break-all"
                    >
                      {theme.contactInfo.email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 錯誤訊息對話框 */}
    </div>
  );
}

