'use client';

import { useState, useEffect, useRef } from 'react';
import { layout } from '@/config/layout';
import { useTranslations } from 'next-intl';
import QACard from '@/components/chatbot/QACard';
import ChatbotWidget from '@/components/chatbot/ChatbotWidget';
import { ChatbotTheme, defaultTheme } from '@/types/chat';
import { chatbotApi } from '@/lib/api/chatbot';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ColorInput from '@/components/ui/ColorInput';
import HelpModal from '@/components/ui/HelpModal';
import { useNotification } from '@/hooks/useNotification';
import ImageCropModal from '@/components/ui/ImageCropModal';

interface DesignManagerProps {
  chatbotId: string;
}

export default function DesignManager({ chatbotId }: DesignManagerProps) {
  const t = useTranslations('design');
  const tCommon = useTranslations('common');
  const notify = useNotification();

  // 版本标记 - 用于确认代码是否更新
  useEffect(() => {
    console.log('🟢🟢🟢 DesignManager 版本: 2.0 - 已加载新代码 🟢🟢🟢');
  }, []);

  const [theme, setTheme] = useState<ChatbotTheme>(defaultTheme);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [previewBgColor, setPreviewBgColor] = useState<'white' | 'black'>('white');
  const [selectedSection, setSelectedSection] = useState<'header' | 'chat' | 'input' | 'home' | 'settings'>('header');
  const [hoveredSection, setHoveredSection] = useState<'header' | 'chat' | 'input' | 'home' | 'settings' | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'chat' | 'browse' | 'home'>('chat');
  const [showHelp, setShowHelp] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 載入當前 chatbot 的 theme
  useEffect(() => {
    const loadTheme = async () => {
      console.log('🔵 [loadTheme] 開始載入 chatbot:', chatbotId);
      setIsLoading(true);
      try {
        const chatbot = await chatbotApi.getOne(chatbotId);
        console.log('🔵 [loadTheme] 載入成功，chatbot:', chatbot);
        
        if (chatbot.theme) {
          // 直接使用 DB 的 theme（不合併 defaultTheme）
          setTheme(chatbot.theme as ChatbotTheme);
        } else {
          setTheme(defaultTheme);
        }
      } catch (error) {
        console.error('❌ [loadTheme] 載入 theme 失敗:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (chatbotId) {
      loadTheme();
    }
  }, [chatbotId]);

  // 保存 theme 到資料庫
  const saveTheme = async (themeToSave: ChatbotTheme) => {
    console.log('🔵 [saveTheme] 開始保存 theme，欄位數量:', Object.keys(themeToSave).length);
    console.log('🔵 [saveTheme] chatbotId:', chatbotId);
    
    setIsSaving(true);
    try {
      await chatbotApi.update(chatbotId, { theme: themeToSave });
      console.log('✅ Theme 已保存');
    } catch (error) {
      console.error('❌ 保存 theme 失敗:', error);
      notify.error(
        t('saveFailed'),
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsSaving(false);
    }
  };

  // 更新主題（會自動保存，debounce 1秒）
  const updateTheme = (updates: Partial<ChatbotTheme>) => {
    const newTheme = { ...theme, ...updates };
    setTheme(newTheme);
    setRefreshKey(prev => prev + 1);
    
    // 清除之前的 timer
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // 設置新的 timer（1秒後自動保存）
    saveTimeoutRef.current = setTimeout(() => {
      saveTheme(newTheme);
    }, 1000);
  };

  // 重置主題
  const handleReset = () => {
    setShowResetConfirm(true);
  };

  // 確認重置
  const confirmReset = async () => {
    setTheme(defaultTheme);
    setRefreshKey(prev => prev + 1);
    
    // 清除 debounce timer 並立即保存
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await saveTheme(defaultTheme);
    setShowResetConfirm(false);
  };

  // Logo 上傳處理
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 驗證檔案大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notify.error(t('fileTooLarge'));
      return;
    }

    // 驗證檔案類型
    if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
      notify.error(t('invalidImageFormat'));
      return;
    }

    setIsUploadingLogo(true);

    try {
      // 使用 FormData 上傳檔案
      const formData = new FormData();
      formData.append('file', file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${API_BASE}/chatbots/${chatbotId}/upload-logo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('uploadLogoFailed'));
      }

      const result = await response.json();

      // 更新 theme 並重新載入（只存相對路徑）
      updateTheme({ headerLogo: result.data.logoPath });
      setRefreshKey(prev => prev + 1);
      notify.success(t('uploadLogoSuccess'));
    } catch (error) {
      console.error('上傳 logo 時發生錯誤:', error);
      notify.error(
        t('uploadLogoFailed'),
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setIsUploadingLogo(false);
      // 重置 input，允許重新選擇同一個檔案
      e.target.value = '';
    }
  };

  // 首頁背景圖上傳處理
  const handleHomeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('🔵 [handleHomeImageUpload] chatbotId:', chatbotId);
    console.log('🔵 [handleHomeImageUpload] file:', file.name, file.type, file.size);

    // 驗證檔案大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      notify.error(t('fileTooLarge'));
      e.target.value = '';
      return;
    }

    // 驗證檔案類型
    if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
      notify.error(t('invalidImageFormat'));
      e.target.value = '';
      return;
    }

    // 讀取圖片並顯示裁切 Modal
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setShowCropModal(true);
    };
    reader.readAsDataURL(file);

    // 重置 input
    e.target.value = '';
  };

  // 處理裁切完成
  const handleCropComplete = async (croppedBlob: Blob) => {
    setShowCropModal(false);
    setImageToCrop(null);
    setIsUploadingLogo(true);

    try {
      // 使用 FormData 上傳裁切後的檔案
      const formData = new FormData();
      formData.append('file', croppedBlob, 'cropped-image.jpg');

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const uploadUrl = `${API_BASE}/chatbots/${chatbotId}/upload-homeimage`;
      console.log('🔵 [handleCropComplete] uploadUrl:', uploadUrl);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      console.log('🔵 [handleCropComplete] response.status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ [handleCropComplete] errorData:', errorData);
        throw new Error(errorData.message || '上傳失敗');
      }

      const result = await response.json();
      console.log('✅ [handleCropComplete] result:', result);
      
      // 更新 theme 並重新載入（只存相對路徑）
      updateTheme({ 
        homePageConfig: {
          ...(theme.homePageConfig || {}),
          backgroundImage: result.data.imagePath
        }
      });
      setRefreshKey(prev => prev + 1);
      notify.success('上傳成功', '首頁背景圖已更新');
    } catch (error) {
      console.error('上傳首頁背景圖時發生錯誤:', error);
      notify.error(
        '上傳失敗',
        error instanceof Error ? error.message : undefined
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // 取消裁切
  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
  };

  // 手機裝置配置
  const mobileDevice = { width: '400px', height: '680px' };

  // 靜態範例數據
  const sampleMessages = [
    {
      type: 'user' as const,
      content: '你們的營業時間是？'
    },
    {
      type: 'assistant' as const,
      intro: '以下是相關的問答資訊：',
      qa_blocks: [
        {
          faq_id: 'sample-1',
          question: '營業時間',
          answer: '我們的營業時間為：\n\n- 週一至週五：09:00 - 18:00\n- 週六：10:00 - 17:00\n- 週日及國定假日：公休'
        }
      ]
    }
  ];

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

  // 查詢模式設定檢查（與 ChatbotWidget 相同邏輯）
  const enableAIChat = theme.enableAIChat !== false; // 預設 true
  const enableBrowseQA = theme.enableBrowseQA !== false; // 預設 true
  
  // 確保至少有一個模式啟用
  const safeEnableAIChat = enableAIChat || !enableBrowseQA;
  const safeEnableBrowseQA = enableBrowseQA || !enableAIChat;
  
  const showTabArea = safeEnableAIChat && safeEnableBrowseQA; // 兩個都啟用才顯示 Tab 區域
  
  // 預覽區域的預設 Tab（用於顯示）- 根據啟用的模式自動設定初始值
  useEffect(() => {
    if (!safeEnableAIChat && safeEnableBrowseQA && previewTab === 'chat') {
      setPreviewTab('browse');
    } else if (safeEnableAIChat && previewTab === 'browse' && !safeEnableBrowseQA) {
      setPreviewTab('chat');
    }
  }, [safeEnableAIChat, safeEnableBrowseQA, previewTab]);

  // 當預覽 Tab 改變時，自動切換右側設定面板
  useEffect(() => {
    if (previewTab === 'chat') {
      setSelectedSection('header');
    } else if (previewTab === 'browse') {
      setSelectedSection('settings');
    } else if (previewTab === 'home') {
      setSelectedSection('home');
    }
  }, [previewTab]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header
          className="flex-shrink-0 border-b border-header-border shadow-sm flex items-center bg-header-bg mb-4 rounded-lg"
          style={{
            height: layout.header.height,
            paddingLeft: layout.header.padding.x,
            paddingRight: layout.header.padding.x,
          }}
        >
          <div className="flex items-center gap-3">
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
              />
            </svg>
            <h1 className="text-xl font-semibold text-white">
              {t('title')}
            </h1>
          </div>

          {/* 右側按鈕區 */}
          <div className="ml-auto flex items-center gap-3">
            {/* Help 按鈕 */}
            <button
              onClick={() => setShowHelp(true)}
              className="relative group w-8 h-8 rounded-full flex items-center justify-center border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-700 transition-all duration-200 shadow-sm hover:shadow"
            >
              <span className="text-base font-semibold">？</span>
              <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
                {tCommon('help')}
              </span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden bg-grey-220 rounded-lg items-center justify-center">
          <p className="text-label">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header
        className="flex-shrink-0 border-b border-header-border shadow-sm flex items-center bg-header-bg rounded-lg"
        style={{
          height: layout.header.height,
          paddingLeft: layout.header.padding.x,
          paddingRight: layout.header.padding.x,
          marginBottom: '1rem',
        }}
      >
        {/* 標題 */}
        <div className="flex items-center gap-3">
          <svg 
            className="w-6 h-6 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
            />
          </svg>
          <h1 className="text-xl font-normal text-white">
            {t('title')}
          </h1>
        </div>

        {/* 右側按鈕區 */}
        <div className="ml-auto flex items-center gap-3">
          {/* 儲存狀態指示 */}
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t('saving')}</span>
            </div>
          )}

          {/* Help 按鈕 */}
          <button
            onClick={() => setShowHelp(true)}
            className="relative group w-8 h-8 rounded-full flex items-center justify-center border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-700 transition-all duration-200 shadow-sm hover:shadow"
          >
            <span className="text-base font-semibold">？</span>
            <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
              {tCommon('help')}
            </span>
          </button>
        </div>
      </header>

      {/* Content Area - 左右兩個容器 */}
      <div 
        className="flex flex-1 overflow-hidden bg-grey-220 rounded-lg gap-4"
        style={{
          padding: '12px'
        }}
      >
        {/* 左側容器 - Chatbot 預覽 */}
        <div 
          className={`flex-1 ${containerStyle?.borderRadius || 'rounded-lg'} border border-header-border overflow-visible flex items-center justify-center relative`}
          style={{
            background: previewBgColor === 'white' ? '#ffffff' : 'linear-gradient(to top, #000000, #1a1a1a, #333333)',
            zIndex: 1
          }}
        >
          {/* 右上角按鈕組 */}
          <div className="absolute top-2 right-2 flex flex-col gap-2 z-50">
            {/* 預覽 Tab 切換 - 智能問答 */}
            {safeEnableAIChat && (
              <button
                onClick={() => setPreviewTab('chat')}
                className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all ${
                  previewTab === 'chat' ? 'bg-blue-50 border-blue-400' : ''
                }`}
                style={{ backgroundColor: previewTab === 'chat' ? '#EFF6FF' : 'white' }}
                title={t('aiChatPreview')}
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </button>
            )}
            
            {/* 預覽 Tab 切換 - 瀏覽問答 */}
            {safeEnableBrowseQA && (
              <button
                onClick={() => setPreviewTab('browse')}
                className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all ${
                  previewTab === 'browse' ? 'bg-blue-50 border-blue-400' : ''
                }`}
                style={{ backgroundColor: previewTab === 'browse' ? '#EFF6FF' : 'white' }}
                title={t('browseQAPreview')}
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </button>
            )}
            
            {/* 預覽 Tab 切換 - 首頁 */}
            {theme.homePageConfig?.enabled && (
              <button
                onClick={() => setPreviewTab('home')}
                className={`p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all ${
                  previewTab === 'home' ? 'bg-blue-50 border-blue-400' : ''
                }`}
                style={{ backgroundColor: previewTab === 'home' ? '#EFF6FF' : 'white' }}
                title={tCommon('home')}
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </button>
            )}
            
            {/* 背景顏色切換按鈕 */}
            <button
              onClick={() => setPreviewBgColor(prev => prev === 'white' ? 'black' : 'white')}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all"
              style={{ backgroundColor: 'white' }}
              title={previewBgColor === 'white' ? t('switchToBlackBg') : t('switchToWhiteBg')}
            >
              {previewBgColor === 'white' ? (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              )}
            </button>
            
            {/* 開啟預覽窗按鈕 */}
            <button
              onClick={() => setShowPreviewModal(true)}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all"
              style={{ backgroundColor: 'white' }}
              title={t('openPreview')}
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </button>
          </div>
          
          <div style={{ width: mobileDevice.width, height: mobileDevice.height }} className="relative">
            {/* 左側箭頭指示器 - 放在 chatbot 容器外部 */}
            {(() => {
              // 計算各區域的位置
              const headerSizeConfig = {
                small: { minHeight: '60px' },
                medium: { minHeight: '80px' },
                large: { minHeight: '100px' }
              };
              const headerConfig = headerSizeConfig[theme.headerSize || 'medium'];
              const headerHeight = headerConfig.minHeight;
              
              // Header 箭頭位置
              const headerCenterTop = `calc(${headerHeight} / 2)`;
              
              // Chat 區域位置：在 header 下方，垂直置中於剩餘空間
              // 簡化計算：假設 chat 區域在 header 下方，高度約為容器高度的一半
              const chatCenterTop = `calc(${headerHeight} + 50%)`;
              
              // Input 區域位置：在底部
              const inputHeight = '60px'; // 輸入區域大約高度
              const inputCenterTop = `calc(100% - ${inputHeight} / 2)`;
              
              return (
                <>
                  {/* Header 箭頭 */}
                  {theme.showHeader && selectedSection === 'header' && (
                    <div 
                      className="absolute pointer-events-none z-[9999] flex items-center"
                      style={{ 
                        left: '-40px',
                        top: headerCenterTop,
                        transform: 'translateY(-50%)',
                        opacity: 1 
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <div 
                          style={{ 
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            borderTop: '22px solid transparent',
                            borderBottom: '22px solid transparent',
                            borderLeft: '32px solid black',
                            left: 0,
                            top: '-22px'
                          }}
                        />
                        <div 
                          style={{ 
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            borderTop: '18px solid transparent',
                            borderBottom: '18px solid transparent',
                            borderLeft: '28px solid #20B2AA',
                            left: '2px',
                            top: '-18px'
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Chat 箭頭 */}
                  {selectedSection === 'chat' && (
                    <div 
                      className="absolute pointer-events-none z-[9999] flex items-center"
                      style={{ 
                        left: '-40px',
                        top: chatCenterTop,
                        transform: 'translateY(-50%)',
                        opacity: 1 
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <div 
                          style={{ 
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            borderTop: '22px solid transparent',
                            borderBottom: '22px solid transparent',
                            borderLeft: '32px solid black',
                            left: 0,
                            top: '-22px'
                          }}
                        />
                        <div 
                          style={{ 
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            borderTop: '18px solid transparent',
                            borderBottom: '18px solid transparent',
                            borderLeft: '28px solid #20B2AA',
                            left: '2px',
                            top: '-18px'
                          }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Input 箭頭 */}
                  {selectedSection === 'input' && (
                    <div 
                      className="absolute pointer-events-none z-[9999] flex items-center"
                      style={{ 
                        left: '-40px',
                        top: inputCenterTop,
                        transform: 'translateY(-50%)',
                        opacity: 1 
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        <div 
                          style={{ 
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            borderTop: '22px solid transparent',
                            borderBottom: '22px solid transparent',
                            borderLeft: '32px solid black',
                            left: 0,
                            top: '-22px'
                          }}
                        />
                        <div 
                          style={{ 
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            borderTop: '18px solid transparent',
                            borderBottom: '18px solid transparent',
                            borderLeft: '28px solid #20B2AA',
                            left: '2px',
                            top: '-18px'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            
            {/* 使用 ChatbotWidget 顯示完整預覽 */}
            {(previewTab === 'browse' || previewTab === 'home') ? (
              <div className="w-full h-full">
                <ChatbotWidget
                  key={`preview-${previewTab}-${refreshKey}`}
                  mode="interactive"
                  chatbotId={chatbotId}
                  theme={theme}
                  initialTab={previewTab}
                  isInputDisabled={true}
                  showCloseButton={false}
                  refreshKey={refreshKey}
                  isPreviewMode={true}
                />
              </div>
            ) : (
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
                    space: '8px'
                  },
                  medium: {
                    padding: '16px',
                    minHeight: '80px',
                    logoSize: '40px',
                    iconSize: '24px',
                    titleSize: '18px',
                    subtitleSize: '14px',
                    space: '12px'
                  },
                  large: {
                    padding: '24px',
                    minHeight: '100px',
                    logoSize: '48px',
                    iconSize: '28px',
                    titleSize: '20px',
                    subtitleSize: '16px',
                    space: '16px'
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
                      className="flex-shrink-0 relative transition-all duration-200 border-b border-transparent cursor-pointer flex items-center"
                      style={{ 
                        ...backgroundStyle,
                        color: theme.headerTextColor,
                        padding: config.padding,
                        minHeight: config.minHeight
                      }}
                      onMouseEnter={() => setHoveredSection('header')}
                      onMouseLeave={() => setHoveredSection(null)}
                      onClick={() => setSelectedSection('header')}
                    >
                    <div className={`flex items-center flex-1 ${
                      theme.headerAlign === 'center' ? 'justify-center' : 
                      theme.headerAlign === 'right' ? 'justify-end' : 
                      'justify-start'
                    }`} style={{ gap: config.space }}>
                      {/* Left/Right 對齊時，文字在前 */}
                      {theme.headerAlign === 'right' && (theme.showHeaderTitle || theme.showHeaderSubtitle) && (
                        <div className="text-right min-w-0">
                          {theme.showHeaderTitle && (
                            <h3 
                              className="font-semibold truncate"
                              style={{ fontSize: config.titleSize }}
                            >
                              {theme.headerTitle}
                            </h3>
                          )}
                          {theme.showHeaderSubtitle && theme.headerSubtitle && (
                            <p 
                              className="mt-1 opacity-90 truncate"
                              style={{ fontSize: config.subtitleSize }}
                            >
                              {theme.headerSubtitle}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Logo: Left 對齊在前，Center 對齊在前，Right 對齊在後 */}
                      {theme.showHeaderLogo && (
                        <div 
                          className="bg-white rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                          style={{
                            width: config.logoSize,
                            height: config.logoSize
                          }}
                        >
                          {theme.headerLogo ? (
                            <img
                              src={
                                theme.headerLogo.startsWith('http')
                                  ? theme.headerLogo
                                  : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'}${theme.headerLogo}`
                              }
                              alt="Header Logo"
                              className="w-full h-full object-cover rounded-full"
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

                      {/* Left/Center 對齊時，文字在後 */}
                      {theme.headerAlign !== 'right' && (theme.showHeaderTitle || theme.showHeaderSubtitle) && (
                        <div className={`${
                          theme.headerAlign === 'center' ? 'text-center' : 'text-left'
                        } min-w-0`}>
                          {theme.showHeaderTitle && (
                            <h3 
                              className="font-semibold truncate"
                              style={{ fontSize: config.titleSize }}
                            >
                              {theme.headerTitle}
                            </h3>
                          )}
                          {theme.showHeaderSubtitle && theme.headerSubtitle && (
                            <p 
                              className="mt-1 opacity-90 truncate"
                              style={{ fontSize: config.subtitleSize }}
                            >
                              {theme.headerSubtitle}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 智能問答內容區域 */}
              {previewTab === 'chat' && safeEnableAIChat && (
                <div 
                  className="flex-1 p-4 overflow-y-auto min-h-0 relative transition-all duration-200 cursor-pointer"
                  style={{ 
                    order: theme.inputPosition === 'top' ? 2 : 1
                  }}
                  onMouseEnter={() => setHoveredSection('chat')}
                  onMouseLeave={() => setHoveredSection(null)}
                  onClick={() => setSelectedSection('chat')}
                >
                  <div className="space-y-6 pt-4">
                    {sampleMessages.map((message, index) => (
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
                            {/* QA 區塊列表 */}
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
                                      alwaysExpanded: true,
                                    }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 問答瀏覽內容區域 - 已改用 ChatbotWidget，此處保留作為備用 */}
              {false && safeEnableBrowseQA && previewTab === 'browse' && (
                <div 
                  className="flex-1 p-4 overflow-y-auto min-h-0 relative transition-all duration-200 cursor-pointer"
                  style={{ 
                    order: theme.inputPosition === 'top' ? 2 : 1
                  }}
                  onMouseEnter={() => setHoveredSection('chat')}
                  onMouseLeave={() => setHoveredSection(null)}
                  onClick={() => setSelectedSection('chat')}
                >
                  {/* 問答瀏覽預覽內容 */}
                  <div className="space-y-3">
                    {/* 範例分類 */}
                    <div className="border rounded-lg overflow-hidden border-gray-200">
                      <button className="w-full px-4 py-3 transition-colors flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="font-medium text-gray-800">常見問題</span>
                          <span className="text-xs text-gray-500">(5 問題)</span>
                        </div>
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden border-gray-200">
                      <button className="w-full px-4 py-3 transition-colors flex items-center justify-between bg-gray-50 hover:bg-gray-100">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="font-medium text-gray-700">使用說明</span>
                          <span className="text-xs text-gray-500">(3 問題)</span>
                        </div>
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden border-gray-200">
                      <button className="w-full px-4 py-3 transition-colors flex items-center justify-between bg-gray-50 hover:bg-gray-100">
                        <div className="flex items-center space-x-2">
                          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium text-gray-700">其他問題</span>
                          <span className="text-xs text-gray-500">(2 問題)</span>
                        </div>
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 快速按鈕區域 - 兩個模式都顯示 */}
              {previewTab === 'chat' && (
              <div
                className="flex-shrink-0 border-t border-transparent"
                style={{
                  order: 2,
                  backgroundColor: theme.chatBackgroundColor
                }}
              >
                <div className="px-3 pt-1.5 pb-1.5">
                  <div className={`grid gap-2 grid-cols-4`}>
                    {/* 切換模式卡片 */}
                    {safeEnableBrowseQA && (
                      <div 
                        onClick={() => setPreviewTab('browse')}
                        className="p-2 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center"
                      >
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Home 卡片 */}
                    {theme.homePageConfig?.enabled && (
                      <div 
                        onClick={() => setPreviewTab('home')}
                        className="p-2 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center"
                      >
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                    )}

                    {/* 聯絡資訊卡片 - 只在有聯絡資訊時顯示 */}
                    {theme.contactInfo?.enabled && (theme.contactInfo?.name || theme.contactInfo?.phone || theme.contactInfo?.email) && (
                      <div className="p-2 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* 清除對話卡片 */}
                    <div className="p-2 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* 輸入框區域 - 僅在智能問答模式顯示 */}
              {previewTab === 'chat' && safeEnableAIChat && (
              <div 
                className={`flex-shrink-0 relative transition-all duration-200 cursor-pointer ${
                  theme.inputPosition === 'top' ? 'border-b' : 'border-t'
                } border-transparent`}
                style={{ 
                  order: theme.inputPosition === 'top' ? 1 : 3,
                  backgroundColor: theme.inputAreaBackgroundColor
                }}
                onMouseEnter={() => setHoveredSection('input')}
                onMouseLeave={() => setHoveredSection(null)}
                onClick={() => setSelectedSection('input')}
              >
                <div className="pt-4 px-4 pb-3">
                  <div className="flex items-center space-x-2">
                    {/* 語音輸入按鈕 */}
                    {theme.enableVoice && (
                      <button
                        className="flex-shrink-0 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm border border-gray-300 -mt-1"
                        style={{
                          backgroundColor: theme.sendButtonBackgroundColor,
                          color: theme.sendButtonTextColor,
                          width: '40px',
                          height: '40px',
                          minWidth: '40px',
                          minHeight: '40px'
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>
                    )}

                    <div className="flex-1 relative">
                      <textarea
                        value=""
                        placeholder={theme.inputPlaceholderText}
                        className="chatbot-input-textarea w-full px-4 py-2 border rounded-3xl resize-none shadow-sm transition-all duration-300"
                        style={{
                          fontSize: '16px',
                          backgroundColor: theme.inputBackgroundColor,
                          borderColor: theme.inputBorderColor,
                          color: theme.inputTextColor,
                          minHeight: '40px',
                          maxHeight: '120px',
                          paddingRight: '52px', // 給發送按鈕留空間
                          '--placeholder-color': theme.inputPlaceholderColor || '#9CA3AF',
                        } as React.CSSProperties & { '--placeholder-color': string }}
                        rows={1}
                        readOnly
                      />
                      
                      {/* 發送按鈕 - 放在輸入框內部右側 */}
                      <button
                        className="absolute rounded-full transition-all duration-300 flex items-center justify-center"
                        style={{
                          backgroundColor: theme.sendButtonBackgroundColor,
                          color: theme.sendButtonTextColor,
                          width: '36px',
                          height: '36px',
                          right: '2px',
                          top: '2px'
                        }}
                      >
                        {renderSendIcon()}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>
            )}
          </div>
        </div>

        {/* 右側容器 - 設定面板 */}
        <div 
          className="w-[450px] bg-white rounded-xl border border-gray-200 shadow-lg flex-shrink-0 flex relative"
          style={{ overflow: 'visible' }}
        >
          {/* 左側 Tab 導航 */}
          <div className="w-20 bg-gradient-to-b from-slate-800 to-slate-900 flex flex-col py-6 gap-3 relative flex-shrink-0 rounded-l-xl" style={{ overflow: 'visible', zIndex: 100 }}>
            {/* 滑動指示線 */}
            <div 
              className="absolute left-0 w-1 h-12 bg-gradient-to-b transition-all duration-300 ease-out rounded-r-full pointer-events-none"
              style={{
                top: selectedSection === 'header' ? '24px' : 
                     selectedSection === 'chat' ? '84px' : 
                     selectedSection === 'input' ? '144px' :
                     selectedSection === 'home' ? '249px' :
                     selectedSection === 'settings' ? '309px' : '24px',
                background: selectedSection === 'header' ? 'linear-gradient(to bottom, #3B82F6, #2563EB)' :
                           selectedSection === 'chat' ? 'linear-gradient(to bottom, #10B981, #059669)' :
                           selectedSection === 'input' ? 'linear-gradient(to bottom, #A855F7, #9333EA)' :
                           selectedSection === 'home' ? 'linear-gradient(to bottom, #F97316, #EA580C)' :
                           selectedSection === 'settings' ? 'linear-gradient(to bottom, #06B6D4, #0891B2)' : ''
              }}
            />

            {/* Header Tab */}
            <button
              onMouseEnter={() => setHoveredSection('header')}
              onMouseLeave={() => setHoveredSection(null)}
              onClick={() => setSelectedSection('header')}
              className={`relative group transition-all duration-300 z-10 ${
                selectedSection === 'header' ? 'scale-110' : 'scale-100 hover:scale-105'
              }`}
              style={{ pointerEvents: 'auto', width: '100%', height: 'auto' }}
            >
              <div 
                className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-all duration-300 ${
                  selectedSection === 'header'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/50'
                    : 'bg-slate-700 group-hover:bg-slate-600 group-hover:shadow-md'
                }`}
                style={{ pointerEvents: 'none' }}
              >
                <svg className={`w-6 h-6 transition-all duration-300 ${
                  selectedSection === 'header' ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </div>
              <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-base font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
                {t('headerSettingsTitle')}
              </span>
            </button>

            {/* 問答區 Tab */}
            <button
              onMouseEnter={() => setHoveredSection('chat')}
              onMouseLeave={() => setHoveredSection(null)}
              onClick={() => setSelectedSection('chat')}
              className={`relative group transition-all duration-300 ${
                selectedSection === 'chat' ? 'scale-110' : 'scale-100 hover:scale-105'
              }`}
            >
              <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-all duration-300 ${
                selectedSection === 'chat'
                  ? 'bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/50'
                  : 'bg-slate-700 group-hover:bg-slate-600 group-hover:shadow-md'
              }`}>
                <svg className={`w-6 h-6 transition-all duration-300 ${
                  selectedSection === 'chat' ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-base font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
                {t('chatSettingsTitle')}
              </span>
            </button>

            {/* 輸入區 Tab */}
            <button
              onMouseEnter={() => setHoveredSection('input')}
              onMouseLeave={() => setHoveredSection(null)}
              onClick={() => setSelectedSection('input')}
              className={`relative group transition-all duration-300 ${
                selectedSection === 'input' ? 'scale-110' : 'scale-100 hover:scale-105'
              }`}
            >
              <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-all duration-300 ${
                selectedSection === 'input'
                  ? 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/50'
                  : 'bg-slate-700 group-hover:bg-slate-600 group-hover:shadow-md'
              }`}>
                <svg className={`w-6 h-6 transition-all duration-300 ${
                  selectedSection === 'input' ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-base font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
                {t('inputSettingsTitle')}
              </span>
            </button>

            {/* 分隔線 */}
            <div className="w-full h-px bg-slate-600 my-4"></div>

            {/* Home Page Tab */}
            <button
              onMouseEnter={() => setHoveredSection('home')}
              onMouseLeave={() => setHoveredSection(null)}
              onClick={() => setSelectedSection('home')}
              className={`relative group transition-all duration-300 ${
                selectedSection === 'home' ? 'scale-110' : 'scale-100 hover:scale-105'
              }`}
            >
              <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-all duration-300 ${
                selectedSection === 'home'
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/50'
                  : 'bg-slate-700 group-hover:bg-slate-600 group-hover:shadow-md'
              }`}>
                <svg className={`w-6 h-6 transition-all duration-300 ${
                  selectedSection === 'home' ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-base font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
                首頁設定
              </span>
            </button>

            {/* 設定 Tab */}
            <button
              onMouseEnter={() => setHoveredSection('settings')}
              onMouseLeave={() => setHoveredSection(null)}
              onClick={() => setSelectedSection('settings')}
              className={`relative group transition-all duration-300 ${
                selectedSection === 'settings' ? 'scale-110' : 'scale-100 hover:scale-105'
              }`}
            >
              <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-all duration-300 ${
                selectedSection === 'settings'
                  ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/50'
                  : 'bg-slate-700 group-hover:bg-slate-600 group-hover:shadow-md'
              }`}>
                <svg className={`w-6 h-6 transition-all duration-300 ${
                  selectedSection === 'settings' ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-base font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-75 pointer-events-none whitespace-nowrap z-[100]">
                {t('advancedSettingsTitle')}
              </span>
            </button>
          </div>

          {/* 右側內容區域 */}
          <div className="flex-1 flex flex-col relative z-0 overflow-hidden rounded-r-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedSection === 'header' ? t('headerSettingsTitle') :
                 selectedSection === 'chat' ? t('chatSettingsTitle') :
                 selectedSection === 'input' ? t('inputSettingsTitle') :
                 selectedSection === 'home' ? '首頁設定' :
                 selectedSection === 'settings' ? t('advancedSettingsTitle') : ''}
              </h3>
            </div>

            {/* 內容區域 - 可滾動 */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {selectedSection === 'header' && (
                  <>
                    {/* 顯示 Header */}
                    <div className="flex items-center justify-between">
                      <label className="text-base font-medium text-gray-700">
                        {t('showHeader')}
                      </label>
                      <button
                        onClick={() => updateTheme({ showHeader: !theme.showHeader })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          theme.showHeader ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            theme.showHeader ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {theme.showHeader && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={theme.showHeaderLogo}
                                onChange={(e) => updateTheme({ showHeaderLogo: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-base font-medium text-gray-700">{t('showHeaderLogo')}</span>
                            </label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="relative flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                id="header-logo-input-design"
                                disabled={isUploadingLogo}
                              />
                              <label
                                htmlFor="header-logo-input-design"
                                className={`block w-full px-4 py-2 text-base font-medium rounded-lg text-center transition-colors ${
                                  isUploadingLogo
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border border-gray-300 cursor-pointer hover:bg-gray-50'
                                }`}
                              >
                                {isUploadingLogo ? t('uploadingLogo') : t('selectFile')}
                              </label>
                            </div>
                            {theme.headerLogo && (
                              <div className="w-16 h-16 border border-gray-300 rounded-lg overflow-hidden flex-shrink-0 bg-gray-50">
                                <img
                                  src={
                                    theme.headerLogo.startsWith('http')
                                      ? theme.headerLogo
                                      : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'}${theme.headerLogo}`
                                  }
                                  alt="Header Logo"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            {!theme.headerLogo && !isUploadingLogo && (
                              <div className="text-base text-gray-500">{t('noLogoSet')}</div>
                            )}
                          </div>
                          <p className="mt-1 text-base text-gray-500">
                            {t('supportedImageFormats')}
                          </p>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              id="show-header-title"
                              checked={theme.showHeaderTitle}
                              onChange={(e) => updateTheme({ showHeaderTitle: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="show-header-title" className="text-base font-medium text-gray-700 cursor-pointer">
                              {t('headerTitle')}
                            </label>
                          </div>
                          <input
                            type="text"
                            value={theme.headerTitle}
                            onChange={(e) => updateTheme({ headerTitle: e.target.value })}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={t('headerTitlePlaceholder')}
                          />
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              id="show-header-subtitle"
                              checked={theme.showHeaderSubtitle}
                              onChange={(e) => updateTheme({ showHeaderSubtitle: e.target.checked })}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="show-header-subtitle" className="text-base font-medium text-gray-700 cursor-pointer">
                              {t('headerSubtitle')}
                            </label>
                          </div>
                          <input
                            type="text"
                            value={theme.headerSubtitle}
                            onChange={(e) => updateTheme({ headerSubtitle: e.target.value })}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={t('headerSubtitlePlaceholder')}
                          />
                        </div>

                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('headerAlign')}
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {['left', 'center', 'right'].map((align) => (
                              <button
                                key={align}
                                onClick={() => updateTheme({ headerAlign: align as any })}
                                className={`px-3 py-2 text-base font-medium rounded-lg border-2 transition-all ${
                                  theme.headerAlign === align
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                {t(`align_${align}`)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('headerSize')}
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {['small', 'medium', 'large'].map((size) => (
                              <button
                                key={size}
                                onClick={() => updateTheme({ headerSize: size as any })}
                                className={`px-3 py-2 text-base font-medium rounded-lg border-2 transition-all ${
                                  theme.headerSize === size
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                {t(`size_${size}`)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('headerBackgroundColor')}
                          </label>
                          <div className="space-y-3">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={theme.headerUseGradient}
                                onChange={(e) => updateTheme({ headerUseGradient: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="ml-2 text-base text-gray-700">{t('useGradient')}</span>
                            </div>
                            
                            {theme.headerUseGradient ? (
                              <>
                                {/* 漸層起始顏色和結束顏色 */}
                                <div className="flex gap-2 mb-4 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <ColorInput
                                      label={t('gradientStartColor')}
                                      value={theme.headerGradientStartColor}
                                      onChange={(value) => updateTheme({ headerGradientStartColor: value })}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <ColorInput
                                      label={t('gradientEndColor')}
                                      value={theme.headerGradientEndColor}
                                      onChange={(value) => updateTheme({ headerGradientEndColor: value })}
                                    />
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-base text-gray-600 mb-1">{t('gradientDirection')}</label>
                                  <select
                                    value={theme.headerGradientDirection}
                                    onChange={(e) => updateTheme({ headerGradientDirection: e.target.value as any })}
                                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  >
                                    <option value="to right">{t('toRight')}</option>
                                    <option value="to bottom">{t('toBottom')}</option>
                                    <option value="to left">{t('toLeft')}</option>
                                    <option value="to top">{t('toTop')}</option>
                                    <option value="to bottom right">{t('toBottomRight')}</option>
                                    <option value="to bottom left">{t('toBottomLeft')}</option>
                                    <option value="to top right">{t('toTopRight')}</option>
                                    <option value="to top left">{t('toTopLeft')}</option>
                                  </select>
                                </div>
                              </>
                            ) : (
                              <ColorInput
                                value={theme.headerBackgroundColor}
                                onChange={(value) => updateTheme({ headerBackgroundColor: value })}
                              />
                            )}
                          </div>
                        </div>

                        <ColorInput
                          label={t('headerTextColor')}
                          value={theme.headerTextColor}
                          onChange={(value) => updateTheme({ headerTextColor: value })}
                        />
                      </>
                    )}
                  </>
                )}

                {selectedSection === 'chat' && (
                  <>
                    {/* 問答區底色設定 */}
                    <div>
                      <div className="flex gap-2 mb-4 min-w-0">
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            label={t('chatBackgroundColor')}
                            value={theme.chatBackgroundColor || '#FFFFFF'}
                            onChange={(value) => updateTheme({ chatBackgroundColor: value })}
                          />
                        </div>
                        <div className="flex-1 min-w-0"></div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-800 mb-3">{t('userMessageSettings')}</h4>
                    </div>

                    {/* 用戶訊息設定 */}
                    <div>
                      <div className="flex gap-2 mb-4 min-w-0">
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            label={t('userMessageBubbleColor')}
                            value={theme.userBubbleColor || '#2563EB'}
                            onChange={(value) => updateTheme({ userBubbleColor: value })}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            label={t('userMessageTextColor')}
                            value={theme.userTextColor || '#FFFFFF'}
                            onChange={(value) => updateTheme({ userTextColor: value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-800 mb-3">{t('qaCardSettings')}</h4>
                    </div>

                    {/* QA Card 設定 - 背景和邊框 */}
                    <div>
                      <div className="flex gap-2 mb-4 min-w-0">
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            label={t('cardBackgroundColor')}
                            value={theme.qaCardStyle?.backgroundColor || '#FFFFFF'}
                            onChange={(value) => updateTheme({ 
                              qaCardStyle: { 
                                ...theme.qaCardStyle, 
                                backgroundColor: value 
                              } 
                            })}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            label={t('borderColor')}
                            value={theme.qaCardStyle?.borderColor || '#E5E7EB'}
                            onChange={(value) => updateTheme({ 
                              qaCardStyle: { 
                                ...theme.qaCardStyle, 
                                borderColor: value 
                              } 
                            })}
                          />
                        </div>
                      </div>

                      {/* 圓角 */}
                      <div className="mb-4">
                        <div className="flex items-center gap-3">
                          <label className="text-base font-medium text-gray-700 whitespace-nowrap">
                            {t('borderRadius')}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="3"
                            value={(() => {
                              const current = theme.qaCardStyle?.borderRadius || 'rounded-xl';
                              const options = ['rounded', 'rounded-xl', 'rounded-2xl', 'rounded-3xl'];
                              const index = options.indexOf(current);
                              return index >= 0 ? index : 1;
                            })()}
                            onChange={(e) => {
                              const options = ['rounded', 'rounded-xl', 'rounded-2xl', 'rounded-3xl'];
                              const value = options[parseInt(e.target.value)];
                              updateTheme({ 
                                qaCardStyle: { 
                                  ...theme.qaCardStyle, 
                                  borderRadius: value 
                                } 
                              });
                            }}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <span className="text-base text-gray-600 whitespace-nowrap min-w-[40px] text-right">
                            {(() => {
                              const current = theme.qaCardStyle?.borderRadius || 'rounded-xl';
                              const options = [
                                { value: 'rounded', label: t('small') },
                                { value: 'rounded-xl', label: t('medium') },
                                { value: 'rounded-2xl', label: t('large') },
                                { value: 'rounded-3xl', label: t('superLarge') }
                              ];
                              return options.find(opt => opt.value === current)?.label || t('medium');
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* 內邊距 */}
                      <div className="mb-4">
                        <div className="flex items-center gap-3">
                          <label className="text-base font-medium text-gray-700 whitespace-nowrap">
                            {t('padding')}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            value={(() => {
                              const current = theme.qaCardStyle?.padding || 'p-4';
                              const options = ['p-3', 'p-4', 'p-5'];
                              const index = options.indexOf(current);
                              return index >= 0 ? index : 1;
                            })()}
                            onChange={(e) => {
                              const options = ['p-3', 'p-4', 'p-5'];
                              const value = options[parseInt(e.target.value)];
                              updateTheme({ 
                                qaCardStyle: { 
                                  ...theme.qaCardStyle, 
                                  padding: value 
                                } 
                              });
                            }}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <span className="text-base text-gray-600 whitespace-nowrap min-w-[40px] text-right">
                            {(() => {
                              const current = theme.qaCardStyle?.padding || 'p-4';
                              const options = [
                                { value: 'p-3', label: t('small') },
                                { value: 'p-4', label: t('medium') },
                                { value: 'p-5', label: t('large') }
                              ];
                              return options.find(opt => opt.value === current)?.label || t('medium');
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* 陰影效果 */}
                      <div className="mb-4">
                        <div className="flex items-center gap-3">
                          <label className="text-base font-medium text-gray-700 whitespace-nowrap">
                            {t('shadow')}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="3"
                            value={(() => {
                              const current = theme.qaCardStyle?.shadow || 'shadow-md hover:shadow-lg';
                              const options = ['shadow-none', 'shadow-sm hover:shadow-md', 'shadow-md hover:shadow-lg', 'shadow-lg hover:shadow-xl'];
                              const index = options.indexOf(current);
                              return index >= 0 ? index : 2;
                            })()}
                            onChange={(e) => {
                              const options = ['shadow-none', 'shadow-sm hover:shadow-md', 'shadow-md hover:shadow-lg', 'shadow-lg hover:shadow-xl'];
                              const value = options[parseInt(e.target.value)];
                              updateTheme({ 
                                qaCardStyle: { 
                                  ...theme.qaCardStyle, 
                                  shadow: value 
                                } 
                              });
                            }}
                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <span className="text-base text-gray-600 whitespace-nowrap min-w-[40px] text-right">
                            {(() => {
                              const current = theme.qaCardStyle?.shadow || 'shadow-md hover:shadow-lg';
                              const options = [
                                { value: 'shadow-none', label: t('no') },
                                { value: 'shadow-sm hover:shadow-md', label: t('small') },
                                { value: 'shadow-md hover:shadow-lg', label: t('medium') },
                                { value: 'shadow-lg hover:shadow-xl', label: t('large') }
                              ];
                              return options.find(opt => opt.value === current)?.label || t('medium');
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 分隔線 */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* 標題背景設定 */}
                    <div>
                      <h4 className="text-base font-semibold text-gray-800 mb-3">{t('questionBackgroundSettings')}</h4>
                      
                      {/* 是否使用漸層 */}
                      <div className="mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={theme.qaCardStyle?.questionUseGradient || false}
                            onChange={(e) => updateTheme({
                              qaCardStyle: {
                                ...theme.qaCardStyle,
                                questionUseGradient: e.target.checked
                              }
                            })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-base font-medium text-gray-700">{t('useGradientBackground')}</span>
                        </label>
                      </div>

                      {/* 根據是否使用漸層顯示不同的選項 */}
                      {theme.qaCardStyle?.questionUseGradient ? (
                        <>
                          {/* 漸層起始顏色和結束顏色 */}
                          <div className="flex gap-2 mb-4 min-w-0">
                            <div className="flex-1 min-w-0">
                              <ColorInput
                                label={t('gradientStartColor')}
                                value={theme.qaCardStyle?.questionGradientStartColor || '#3B82F6'}
                                onChange={(value) => updateTheme({
                                  qaCardStyle: {
                                    ...theme.qaCardStyle,
                                    questionGradientStartColor: value
                                  }
                                })}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <ColorInput
                                label={t('gradientEndColor')}
                                value={theme.qaCardStyle?.questionGradientEndColor || '#8B5CF6'}
                                onChange={(value) => updateTheme({
                                  qaCardStyle: {
                                    ...theme.qaCardStyle,
                                    questionGradientEndColor: value
                                  }
                                })}
                              />
                            </div>
                          </div>

                          {/* 漸層方向 */}
                          <div className="mb-4">
                            <label className="block text-base font-medium text-gray-700 mb-2">
                              {t('gradientDirection')}
                            </label>
                            <select
                              value={theme.qaCardStyle?.questionGradientDirection || 'to right'}
                              onChange={(e) => updateTheme({
                                qaCardStyle: {
                                  ...theme.qaCardStyle,
                                  questionGradientDirection: e.target.value as any
                                }
                              })}
                              className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                            >
                              <option value="to right">{t('toRight')}</option>
                              <option value="to left">{t('toLeft')}</option>
                              <option value="to bottom">{t('toBottom')}</option>
                              <option value="to top">{t('toTop')}</option>
                              <option value="to bottom right">{t('toBottomRight')}</option>
                              <option value="to bottom left">{t('toBottomLeft')}</option>
                              <option value="to top right">{t('toTopRight')}</option>
                              <option value="to top left">{t('toTopLeft')}</option>
                            </select>
                          </div>

                          {/* 標題文字顏色和大小 */}
                          <div className="flex gap-2 mb-4 min-w-0">
                            <div className="flex-1 min-w-0">
                              <ColorInput
                                label={t('questionTextColor')}
                                value={theme.qaCardStyle?.questionColor || '#111827'}
                                onChange={(value) => updateTheme({ 
                                  qaCardStyle: { 
                                    ...theme.qaCardStyle, 
                                    questionColor: value 
                                  } 
                                })}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-base font-medium text-gray-700 mb-2">
                                {t('questionTextSize')}
                              </label>
                              <select
                                value={theme.qaCardStyle?.questionFontSize || '16px'}
                                onChange={(e) => updateTheme({
                                  qaCardStyle: {
                                    ...theme.qaCardStyle,
                                    questionFontSize: e.target.value
                                  }
                                })}
                                className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              >
                                <option value="16px">16px ({t('small')})</option>
                                <option value="18px">18px</option>
                                <option value="20px">20px ({t('medium')})</option>
                                <option value="24px">24px</option>
                                <option value="28px">28px</option>
                                <option value="32px">32px ({t('large')})</option>
                              </select>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 純色背景 */}
                          <div className="mb-4">
                            <ColorInput
                              label={t('questionBackgroundColor')}
                              value={theme.qaCardStyle?.questionBackgroundColor || 'transparent'}
                              onChange={(value) => updateTheme({
                                qaCardStyle: {
                                  ...theme.qaCardStyle,
                                  questionBackgroundColor: value
                                }
                              })}
                            />
                          </div>

                          {/* 標題文字顏色和大小 */}
                          <div className="flex gap-2 mb-4 min-w-0">
                            <div className="flex-1 min-w-0">
                              <ColorInput
                                label={t('questionTextColor')}
                                value={theme.qaCardStyle?.questionColor || '#111827'}
                                onChange={(value) => updateTheme({ 
                                  qaCardStyle: { 
                                    ...theme.qaCardStyle, 
                                    questionColor: value 
                                  } 
                                })}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <label className="block text-base font-medium text-gray-700 mb-2">
                                {t('questionTextSize')}
                              </label>
                              <select
                                value={theme.qaCardStyle?.questionFontSize || '16px'}
                                onChange={(e) => updateTheme({
                                  qaCardStyle: {
                                    ...theme.qaCardStyle,
                                    questionFontSize: e.target.value
                                  }
                                })}
                                className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              >
                                <option value="16px">16px ({t('small')})</option>
                                <option value="18px">18px</option>
                                <option value="20px">20px ({t('medium')})</option>
                                <option value="24px">24px</option>
                                <option value="28px">28px</option>
                                <option value="32px">32px ({t('large')})</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="border-t border-gray-200 my-4"></div>

                    <div>

                      <div className="flex gap-2 mb-4 min-w-0">
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            label={t('answerTextColor')}
                            value={theme.qaCardStyle?.answerColor || '#374151'}
                            onChange={(value) => updateTheme({ 
                              qaCardStyle: { 
                                ...theme.qaCardStyle, 
                                answerColor: value 
                              } 
                            })}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('answerTextSize')}
                          </label>
                          <select
                            value={theme.qaCardStyle?.answerFontSize || '14px'}
                            onChange={(e) => updateTheme({ 
                              qaCardStyle: { 
                                ...theme.qaCardStyle, 
                                answerFontSize: e.target.value 
                              } 
                            })}
                            className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          >
                          <option value="12px">12px ({t('extraSmall')})</option>
                          <option value="14px">14px ({t('small')})</option>
                          <option value="16px">16px ({t('medium')})</option>
                          <option value="18px">18px ({t('large')})</option>
                          <option value="20px">20px</option>
                        </select>
                        </div>
                      </div>
                    </div>

                  </>
                )}

                {selectedSection === 'input' && (
                  <>
                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-2">
                        {t('inputPosition')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['top', 'bottom'].map((position) => (
                          <button
                            key={position}
                            onClick={() => updateTheme({ inputPosition: position as any })}
                            className={`px-3 py-2 text-base font-medium rounded-lg border-2 transition-all ${
                              theme.inputPosition === position
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {t(`position_${position}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 my-4"></div>

                    <div className="flex items-center gap-3">
                      <label className="text-base font-medium text-gray-700">
                        {t('enableVoice')}
                      </label>
                      <button
                        onClick={() => updateTheme({ enableVoice: !theme.enableVoice })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          theme.enableVoice ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            theme.enableVoice ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="border-t border-gray-200 my-4"></div>

                    <div className="flex gap-2 mb-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <ColorInput
                          label={t('inputAreaBackgroundColor')}
                          value={theme.inputAreaBackgroundColor}
                          onChange={(value) => updateTheme({ inputAreaBackgroundColor: value })}
                        />
                      </div>
                      <div className="flex-1 min-w-0"></div>
                    </div>

                    <div className="flex gap-2 mb-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <ColorInput
                          label={t('inputBackgroundColor')}
                          value={theme.inputBackgroundColor}
                          onChange={(value) => updateTheme({ inputBackgroundColor: value })}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <ColorInput
                          label={t('inputBorderColor')}
                          value={theme.inputBorderColor}
                          onChange={(value) => updateTheme({ inputBorderColor: value })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mb-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <ColorInput
                          label={t('inputTextColor')}
                          value={theme.inputTextColor}
                          onChange={(value) => updateTheme({ inputTextColor: value })}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <ColorInput
                          label={t('inputPlaceholderColor')}
                          value={theme.inputPlaceholderColor}
                          onChange={(value) => updateTheme({ inputPlaceholderColor: value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-2">
                        {t('inputPlaceholder')}
                      </label>
                      <input
                        type="text"
                        value={theme.inputPlaceholderText}
                        onChange={(e) => updateTheme({ inputPlaceholderText: e.target.value })}
                        className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={t('inputPlaceholderExample')}
                      />
                    </div>

                    <div className="flex gap-2 mb-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <ColorInput
                          label={t('sendButtonBackgroundColor')}
                          value={theme.sendButtonBackgroundColor}
                          onChange={(value) => updateTheme({ sendButtonBackgroundColor: value })}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <ColorInput
                          label={t('sendButtonTextColor')}
                          value={theme.sendButtonTextColor}
                          onChange={(value) => updateTheme({ sendButtonTextColor: value })}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-base font-medium text-gray-700 mb-2">
                        {t('sendButtonIcon')}
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { 
                            value: 'arrow-right', 
                            icon: (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            )
                          },
                          { 
                            value: 'paper-plane', 
                            icon: (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                              </svg>
                            )
                          },
                          { 
                            value: 'arrow-up', 
                            icon: (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              </svg>
                            )
                          },
                          { 
                            value: 'send', 
                            icon: (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            )
                          },
                          { 
                            value: 'chevron-right', 
                            icon: (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            )
                          },
                        ].map((item) => (
                          <button
                            key={item.value}
                            onClick={() => updateTheme({ sendButtonIcon: item.value as any })}
                            className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center ${
                              theme.sendButtonIcon === item.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            {item.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedSection === 'settings' && (
                  <>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 mb-1">{t('containerSettings')}</h3>
                    </div>

                    {/* 圓角和陰影 */}
                    <div className="flex gap-2 mb-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('borderRadius')}
                        </label>
                        <select
                          value={theme.containerStyle?.borderRadius || 'rounded-lg'}
                          onChange={(e) => updateTheme({ 
                            containerStyle: { 
                              ...theme.containerStyle, 
                              borderRadius: e.target.value 
                            } 
                          })}
                          className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="rounded-none">{t('no')}</option>
                          <option value="rounded">{t('small')}</option>
                          <option value="rounded-lg">{t('medium')}</option>
                          <option value="rounded-xl">{t('large')}</option>
                          <option value="rounded-2xl">{t('extraLarge')}</option>
                          <option value="rounded-3xl">{t('superLarge')}</option>
                        </select>
                      </div>

                      <div className="flex-1 min-w-0">
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('shadow')}
                        </label>
                        <select
                          value={theme.containerStyle?.shadow ?? ''}
                          onChange={(e) => updateTheme({ 
                            containerStyle: { 
                              ...theme.containerStyle, 
                              shadow: e.target.value 
                            } 
                          })}
                          className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">{t('no')}</option>
                          <option value="shadow-sm">{t('small')}</option>
                          <option value="shadow-md">{t('medium')}</option>
                          <option value="shadow-lg">{t('large')}</option>
                          <option value="shadow-xl">{t('extraLarge')}</option>
                          <option value="shadow-2xl">{t('superLarge')}</option>
                        </select>
                      </div>
                    </div>

                    {/* 邊框和邊框顏色 */}
                    <div className="flex gap-2 mb-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <label className="block text-base font-medium text-gray-700 mb-2">
                          {t('border')}
                        </label>
                        <select
                          value={theme.containerStyle?.border || ''}
                          onChange={(e) => updateTheme({ 
                            containerStyle: { 
                              ...theme.containerStyle, 
                              border: e.target.value 
                            } 
                          })}
                          className="w-full px-4 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        >
                          <option value="">{t('no')}</option>
                          <option value="border">{t('small')}</option>
                          <option value="border-2">{t('medium')}</option>
                          <option value="border-4">{t('large')}</option>
                        </select>
                      </div>

                      {(theme.containerStyle?.border && theme.containerStyle.border !== '') && (
                        <div className="flex-1 min-w-0">
                          <ColorInput
                            label={t('borderColor')}
                            value={theme.containerStyle?.borderColor || '#E5E7EB'}
                            onChange={(value) => updateTheme({ 
                              containerStyle: { 
                                ...theme.containerStyle, 
                                borderColor: value 
                              } 
                            })}
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-6 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-800 mb-3">{t('queryTypeSetting')}</h4>
                    </div>

                    <div className="space-y-2">
                      <label 
                        className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50"
                        style={{
                          borderColor: (theme.enableAIChat !== false && theme.enableBrowseQA !== false) 
                            ? '#3B82F6' 
                            : '#E5E7EB',
                          backgroundColor: (theme.enableAIChat !== false && theme.enableBrowseQA !== false) 
                            ? '#EFF6FF' 
                            : 'transparent'
                        }}
                      >
                        <input
                          type="radio"
                          name="queryType"
                          checked={theme.enableAIChat !== false && theme.enableBrowseQA !== false}
                          onChange={() => updateTheme({ enableAIChat: true, enableBrowseQA: true })}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-base font-medium text-gray-700">{t('bothModes')}</span>
                      </label>

                      <label 
                        className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50"
                        style={{
                          borderColor: (theme.enableAIChat !== false && theme.enableBrowseQA === false) 
                            ? '#3B82F6' 
                            : '#E5E7EB',
                          backgroundColor: (theme.enableAIChat !== false && theme.enableBrowseQA === false) 
                            ? '#EFF6FF' 
                            : 'transparent'
                        }}
                      >
                        <input
                          type="radio"
                          name="queryType"
                          checked={theme.enableAIChat !== false && theme.enableBrowseQA === false}
                          onChange={() => updateTheme({ enableAIChat: true, enableBrowseQA: false })}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-base font-medium text-gray-700">{t('enableAIChat')}</span>
                      </label>

                      <label 
                        className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all hover:bg-gray-50"
                        style={{
                          borderColor: (theme.enableAIChat === false && theme.enableBrowseQA !== false) 
                            ? '#3B82F6' 
                            : '#E5E7EB',
                          backgroundColor: (theme.enableAIChat === false && theme.enableBrowseQA !== false) 
                            ? '#EFF6FF' 
                            : 'transparent'
                        }}
                      >
                        <input
                          type="radio"
                          name="queryType"
                          checked={theme.enableAIChat === false && theme.enableBrowseQA !== false}
                          onChange={() => updateTheme({ enableAIChat: false, enableBrowseQA: true })}
                          className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-base font-medium text-gray-700">{t('enableBrowseQA')}</span>
                      </label>
                    </div>

                    {/* Topic 卡片顏色設定 */}
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-800 mb-3">{t('browseQASettings')}</h4>
                      <ColorInput
                        label={t('topicCardColor')}
                        value={theme.topicCardColor || '#9333EA'}
                        onChange={(value) => updateTheme({ topicCardColor: value })}
                      />
                    </div>

                    <div className="pt-6 border-t border-gray-200">
                      <h4 className="text-base font-semibold text-gray-800 mb-3">{t('contactSettings')}</h4>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-base font-medium text-gray-700">
                        {t('contactInfoEnabled')}
                      </label>
                      <button
                        onClick={() => updateTheme({
                          contactInfo: {
                            ...theme.contactInfo,
                            enabled: !theme.contactInfo?.enabled
                          }
                        })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          theme.contactInfo?.enabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            theme.contactInfo?.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {theme.contactInfo?.enabled && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('contactName')}
                          </label>
                          <input
                            type="text"
                            value={theme.contactInfo?.name || ''}
                            onChange={(e) => updateTheme({
                              contactInfo: {
                                ...theme.contactInfo,
                                name: e.target.value
                              }
                            })}
                            placeholder={t('contactNamePlaceholder')}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('contactPhone')}
                          </label>
                          <input
                            type="tel"
                            value={theme.contactInfo?.phone || ''}
                            onChange={(e) => updateTheme({
                              contactInfo: {
                                ...theme.contactInfo,
                                phone: e.target.value
                              }
                            })}
                            placeholder={t('contactPhonePlaceholder')}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('contactEmail')}
                          </label>
                          <input
                            type="email"
                            value={theme.contactInfo?.email || ''}
                            onChange={(e) => updateTheme({
                              contactInfo: {
                                ...theme.contactInfo,
                                email: e.target.value
                              }
                            })}
                            placeholder={t('contactEmailPlaceholder')}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Home Page 設定 */}
                {selectedSection === 'home' && (
                  <>
                    {/* 啟用首頁 */}
                    <div className="flex items-center justify-between">
                      <label className="text-base font-medium text-gray-700">
                        啟用首頁
                      </label>
                      <button
                            onClick={() => updateTheme({
                              homePageConfig: {
                                ...(theme.homePageConfig || {}),
                                enabled: !theme.homePageConfig?.enabled
                              }
                            })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          theme.homePageConfig?.enabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            theme.homePageConfig?.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="border-t border-gray-200 my-4"></div>

                    {theme.homePageConfig?.enabled && (
                      <div className="space-y-4">
                        {/* 背景圖片上傳 */}
                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            背景圖片（建議3:4比例的豎向圖片）
                          </label>
                          {theme.homePageConfig?.backgroundImage ? (
                            <div className="flex items-center space-x-3">
                              <img
                                src={
                                  theme.homePageConfig.backgroundImage.startsWith('http')
                                    ? theme.homePageConfig.backgroundImage
                                    : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'}${theme.homePageConfig.backgroundImage}`
                                }
                                alt="Background"
                                className="w-24 h-24 object-cover rounded-lg border border-gray-300"
                              />
                              <button
                                onClick={() => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    backgroundImage: undefined
                                  }
                                })}
                                className="px-3 py-2 text-base text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                移除圖片
                              </button>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleHomeImageUpload}
                                disabled={isUploadingLogo}
                                className="block w-full text-base text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-base file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                              />
                              {isUploadingLogo && (
                                <p className="mt-2 text-base text-gray-500">上傳中...</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* CTA 按鈕設定 */}
                        <div className="pt-4 border-t border-gray-200">
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-base font-medium text-gray-700">
                            顯示 CTA 按鈕
                          </label>
                          <button
                            onClick={() => updateTheme({
                              homePageConfig: {
                                ...(theme.homePageConfig || {}),
                                ctaButton: {
                                  ...(theme.homePageConfig?.ctaButton || {}),
                                  show: !theme.homePageConfig?.ctaButton?.show
                                }
                              }
                            })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              theme.homePageConfig?.ctaButton?.show !== false ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                theme.homePageConfig?.ctaButton?.show !== false ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {theme.homePageConfig?.ctaButton?.show !== false && (
                          <>
                            <div>
                              <label className="block text-base font-medium text-gray-700 mb-2">
                                CTA 按鈕文字
                              </label>
                              <input
                                type="text"
                                value={theme.homePageConfig?.ctaButton?.text ?? ''}
                                onChange={(e) => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    ctaButton: {
                                      ...(theme.homePageConfig?.ctaButton || {}),
                                      text: e.target.value
                                    }
                                  }
                                })}
                                placeholder="造訪網站"
                                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <label className="block text-base font-medium text-gray-700 mb-2">
                                CTA 按鈕連結
                              </label>
                              <input
                                type="url"
                                value={theme.homePageConfig?.ctaButton?.url || ''}
                                onChange={(e) => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    ctaButton: {
                                      ...(theme.homePageConfig?.ctaButton || {}),
                                      url: e.target.value
                                    }
                                  }
                                })}
                                placeholder="https://example.com"
                                className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            </div>

                            <div>
                              <ColorInput
                                label="CTA 按鈕文字顏色"
                                value={theme.homePageConfig?.ctaButton?.textColor || '#3a6ba7'}
                                onChange={(value) => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    ctaButton: {
                                      ...(theme.homePageConfig?.ctaButton || {}),
                                      textColor: value
                                    }
                                  }
                                })}
                              />
                            </div>
                          </>
                        )}

                        {/* FAQ 按鈕設定 */}
                        <div className="pt-4 border-t border-gray-200">
                        </div>

                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            {t('faqButtonText')}
                          </label>
                          <input
                            type="text"
                            value={theme.homePageConfig?.faqButton?.text ?? ''}
                            onChange={(e) => updateTheme({
                              homePageConfig: {
                                ...(theme.homePageConfig || {}),
                                faqButton: {
                                  ...(theme.homePageConfig?.faqButton || {}),
                                  text: e.target.value
                                }
                              }
                            })}
                            placeholder="FAQ"
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        {/* FAQ 按鈕顏色和文字顏色 */}
                        <div className="flex gap-2 mb-4 min-w-0">
                          <div className="flex-1 min-w-0">
                            <ColorInput
                              label={t('faqButtonColor')}
                              value={theme.homePageConfig?.faqButton?.backgroundColor || '#3a6ba7'}
                              onChange={(value) => updateTheme({
                                homePageConfig: {
                                  ...(theme.homePageConfig || {}),
                                  faqButton: {
                                    ...(theme.homePageConfig?.faqButton || {}),
                                    backgroundColor: value
                                  }
                                }
                              })}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <ColorInput
                              label={t('faqTextColor')}
                              value={theme.homePageConfig?.faqButton?.textColor || '#ffffff'}
                              onChange={(value) => updateTheme({
                                homePageConfig: {
                                  ...(theme.homePageConfig || {}),
                                  faqButton: {
                                    ...(theme.homePageConfig?.faqButton || {}),
                                    textColor: value
                                  }
                                }
                              })}
                            />
                          </div>
                        </div>

                        {/* FAQ 導向頁面模式選擇 */}
                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-3">
                            FAQ 導向頁面模式
                          </label>
                          <div className="flex gap-2">
                            <label
                              className="flex-1 flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all"
                              style={{
                                borderColor: theme.homePageConfig?.faqMode === 'chat' 
                                  ? '#3B82F6' 
                                  : '#E5E7EB',
                                backgroundColor: theme.homePageConfig?.faqMode === 'chat' 
                                  ? '#EFF6FF' 
                                  : 'transparent'
                              }}
                            >
                              <input
                                type="radio"
                                name="faqMode"
                                checked={theme.homePageConfig?.faqMode === 'chat'}
                                onChange={() => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    faqMode: 'chat'
                                  }
                                })}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="ml-3 text-base font-medium text-gray-700">問答模式</span>
                            </label>
                            <label
                              className="flex-1 flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all"
                              style={{
                                borderColor: theme.homePageConfig?.faqMode === 'browse' 
                                  ? '#3B82F6' 
                                  : '#E5E7EB',
                                backgroundColor: theme.homePageConfig?.faqMode === 'browse' 
                                  ? '#EFF6FF' 
                                  : 'transparent'
                              }}
                            >
                              <input
                                type="radio"
                                name="faqMode"
                                checked={theme.homePageConfig?.faqMode === 'browse'}
                                onChange={() => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    faqMode: 'browse'
                                  }
                                })}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              />
                              <span className="ml-3 text-base font-medium text-gray-700">瀏覽模式</span>
                            </label>
                          </div>
                        </div>

                        {/* 按鈕區域背景設定 */}
                        <div className="pt-4 border-t border-gray-200">
                        </div>

                        <div>
                          <label className="block text-base font-medium text-gray-700 mb-2">
                            按鈕區域背景
                          </label>
                          <div className="space-y-3">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={theme.homePageConfig?.buttonAreaUseGradient || false}
                                onChange={(e) => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    buttonAreaUseGradient: e.target.checked
                                  }
                                })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="ml-2 text-base text-gray-700">使用漸層</span>
                            </div>
                            
                            {theme.homePageConfig?.buttonAreaUseGradient ? (
                              <>
                                {/* 漸層起始顏色和結束顏色 */}
                                <div className="flex gap-2 mb-4 min-w-0">
                                  <div className="flex-1 min-w-0">
                                    <ColorInput
                                      label="漸層起始顏色"
                                      value={theme.homePageConfig?.buttonAreaGradientStartColor || '#f3f4f6'}
                                      onChange={(value) => updateTheme({
                                        homePageConfig: {
                                          ...(theme.homePageConfig || {}),
                                          buttonAreaGradientStartColor: value
                                        }
                                      })}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <ColorInput
                                      label="漸層結束顏色"
                                      value={theme.homePageConfig?.buttonAreaGradientEndColor || '#e5e7eb'}
                                      onChange={(value) => updateTheme({
                                        homePageConfig: {
                                          ...(theme.homePageConfig || {}),
                                          buttonAreaGradientEndColor: value
                                        }
                                      })}
                                    />
                                  </div>
                                </div>
                                
                                <div>
                                  <label className="block text-base text-gray-600 mb-1">漸層方向</label>
                                  <select
                                    value={theme.homePageConfig?.buttonAreaGradientDirection || 'to right'}
                                    onChange={(e) => updateTheme({
                                      homePageConfig: {
                                        ...(theme.homePageConfig || {}),
                                        buttonAreaGradientDirection: e.target.value as any
                                      }
                                    })}
                                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  >
                                    <option value="to right">向右</option>
                                    <option value="to bottom">向下</option>
                                    <option value="to left">向左</option>
                                    <option value="to top">向上</option>
                                    <option value="to bottom right">向右下</option>
                                    <option value="to bottom left">向左下</option>
                                    <option value="to top right">向右上</option>
                                    <option value="to top left">向左上</option>
                                  </select>
                                </div>
                              </>
                            ) : (
                              <ColorInput
                                value={theme.homePageConfig?.buttonAreaBackgroundColor || '#ffffff'}
                                onChange={(value) => updateTheme({
                                  homePageConfig: {
                                    ...(theme.homePageConfig || {}),
                                    buttonAreaBackgroundColor: value
                                  }
                                })}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 重置確認對話框 */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        title={t('reset')}
        message={t('resetConfirm')}
        confirmText={t('reset')}
        cancelText={tCommon('cancel')}
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
        type="warning"
      />

      {/* 預覽彈窗 */}
      {showPreviewModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
          onClick={() => setShowPreviewModal(false)}
        >
          {/* 關閉按鈕 - 浮動在右上角 */}
          <button
            onClick={() => setShowPreviewModal(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-[10000] shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* 彈窗內容 - 高度充滿，寬度依比例 */}
          <div 
            className="relative overflow-hidden h-full w-full"
            style={{ 
              height: '100vh',
              width: `${(400 / 680) * 100}vh`, // 根據 chatbot 寬高比計算寬度 (400:680)
              maxWidth: '100vw'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full w-full">
              <ChatbotWidget
                key={`chatbot-modal-${chatbotId}-${refreshKey}`}
                mode="interactive"
                chatbotId={chatbotId}
                theme={theme}
                isInputDisabled={false}
                showCloseButton={false}
                refreshKey={refreshKey}
              />
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        helpFile="design"
      />

      {/* Image Crop Modal */}
      {showCropModal && imageToCrop && (
        <ImageCropModal
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
