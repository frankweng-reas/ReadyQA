'use client';

import { useState, useEffect, useRef } from 'react';
import { layout } from '@/config/layout';
import { useTranslations } from 'next-intl';
import ChatbotWidget from '@/components/chatbot/ChatbotWidget';
import { ChatbotTheme, defaultTheme } from '@/types/chat';
import { chatbotApi } from '@/lib/api/chatbot';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ColorInput from '@/components/ui/ColorInput';
import { useNotification } from '@/hooks/useNotification';

interface DesignManagerProps {
  chatbotId: string;
}

type SettingCategory = 'container' | 'header' | 'input' | 'contact' | 'qaCard' | null;

export default function DesignManager({ chatbotId }: DesignManagerProps) {
  const t = useTranslations('design');
  const tCommon = useTranslations('common');
  const notify = useNotification();

  const [theme, setTheme] = useState<ChatbotTheme>(defaultTheme);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingCategory>('header');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [previewBgColor, setPreviewBgColor] = useState<'white' | 'black'>('white');
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
      notify.error('只允許上傳圖片檔案（jpg, jpeg, png, gif, webp）');
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

  // 分類選項
  const categories = [
    { id: 'container', name: t('containerSettings') },
    { id: 'header', name: t('headerSettings') },
    { id: 'qaCard', name: t('qaSettings') },
    { id: 'input', name: t('inputSettings') },
    { id: 'contact', name: t('contactSettings') },
  ];

  // 手機裝置配置
  const mobileDevice = { width: '400px', height: '680px' };

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
              className="w-6 h-6 text-primary" 
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
            <h1 className="text-xl font-semibold text-header-text">
              {t('title')}
            </h1>
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
        className="flex-shrink-0 border-b border-header-border shadow-sm flex items-center bg-header-bg mb-4 rounded-lg"
        style={{
          height: layout.header.height,
          paddingLeft: layout.header.padding.x,
          paddingRight: layout.header.padding.x,
        }}
      >
        {/* 標題 */}
        <div className="flex items-center gap-3">
          <svg 
            className="w-6 h-6 text-primary" 
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
          <h1 className="text-xl font-semibold text-header-text">
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

          {/* 背景顏色切換按鈕 */}
          <button
            onClick={() => setPreviewBgColor(prev => prev === 'white' ? 'black' : 'white')}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-all"
            style={{ backgroundColor: 'white' }}
            title={previewBgColor === 'white' ? '切換為黑色背景' : '切換為白色背景'}
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
        </div>
      </header>

      {/* Content Area - 左右兩個容器 */}
      <div className="flex flex-1 overflow-hidden bg-grey-220 rounded-lg gap-4">
        {/* 左側容器 - 手機預覽 */}
        <div 
          className="flex-1 rounded-lg border border-header-border flex items-center justify-center" 
          style={{ 
            marginLeft: '12px', 
            marginTop: '12px', 
            marginBottom: '12px',
            backgroundColor: previewBgColor === 'white' ? '#ffffff' : '#000000'
          }}
        >
          <div 
            className="flex flex-col overflow-hidden" 
            style={{ width: mobileDevice.width, height: mobileDevice.height }}
          >
            <ChatbotWidget
              key={`chatbot-preview-${chatbotId}-${refreshKey}`}
              mode="interactive"
              chatbotId={chatbotId}
              theme={theme}
              isInputDisabled={false}
              showCloseButton={false}
              refreshKey={refreshKey}
            />
          </div>
        </div>

        {/* 右側容器 - 設定面板 */}
        <div 
          className="flex bg-white rounded-xl border border-header-border overflow-hidden flex-shrink-0" 
          style={{ marginTop: '12px', marginRight: '12px', marginBottom: '12px', width: '450px' }}
        >
          {/* 左側分類選單 */}
          <div className="w-[140px] bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 p-3 flex flex-col flex-shrink-0">
            <div className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id as SettingCategory)}
                  className={`w-full px-3 py-3 rounded-lg text-left transition-all ${
                    activeCategory === category.id
                      ? 'text-white shadow-md'
                      : 'text-gray-700 hover:bg-white/80'
                  }`}
                  style={activeCategory === category.id ? { backgroundColor: '#436470' } : undefined}
                >
                  <span className="text-lg font-medium">{category.name}</span>
                </button>
              ))}
            </div>
            
            {/* 重置按鈕 - 放在最下方 */}
            <div className="mt-auto pt-2 border-t border-gray-300">
              <button
                onClick={handleReset}
                className="w-full px-3 py-3 rounded-lg text-center transition-all text-gray-700 hover:bg-white/80"
              >
                <span className="text-lg font-medium">{t('reset')}</span>
              </button>
            </div>
          </div>

          {/* 右側設定內容 - 獨立滾動 */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 min-w-0">
            {activeCategory === 'container' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t('containerSettings')}</h3>
                  <p className="text-sm text-gray-600">{t('containerSettingsDesc')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="rounded-none">{t('no')}</option>
                    <option value="rounded">{t('small')}</option>
                    <option value="rounded-lg">{t('medium')}</option>
                    <option value="rounded-xl">{t('large')}</option>
                    <option value="rounded-2xl">{t('extraLarge')}</option>
                    <option value="rounded-3xl">{t('superLarge')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">{t('no')}</option>
                    <option value="shadow-sm">{t('small')}</option>
                    <option value="shadow-md">{t('medium')}</option>
                    <option value="shadow-lg">{t('large')}</option>
                    <option value="shadow-xl">{t('extraLarge')}</option>
                    <option value="shadow-2xl">{t('superLarge')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">{t('no')}</option>
                    <option value="border">{t('small')}</option>
                    <option value="border-2">{t('medium')}</option>
                    <option value="border-4">{t('large')}</option>
                  </select>
                </div>

                {(theme.containerStyle?.border && theme.containerStyle.border !== '') && (
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
                )}
              </div>
            )}

            {activeCategory === 'header' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{t('headerSettings')}</h3>
                </div>

                {/* 顯示 Header */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <label className="text-sm font-medium text-gray-700">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('headerLogo')}
                      </label>
                      <div className="flex items-center space-x-3">
                        <div className="relative flex-1 z-0">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                            id="header-logo-input"
                            disabled={isUploadingLogo}
                          />
                          <label
                            htmlFor="header-logo-input"
                            className={`block w-full px-4 py-2 text-sm font-medium rounded-lg text-center transition-colors ${
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
                              src={theme.headerLogo}
                              alt="Header Logo"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        {!theme.headerLogo && !isUploadingLogo && (
                          <div className="text-sm text-gray-500">{t('noLogoSet')}</div>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        支援 JPG, PNG, GIF, WEBP，最大 5MB
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('headerTitle')}
                      </label>
                      <input
                        type="text"
                        value={theme.headerTitle}
                        onChange={(e) => updateTheme({ headerTitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={t('headerTitlePlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('headerSubtitle')}
                      </label>
                      <input
                        type="text"
                        value={theme.headerSubtitle}
                        onChange={(e) => updateTheme({ headerSubtitle: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={t('headerSubtitlePlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('headerAlign')}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['left', 'center', 'right'].map((align) => (
                          <button
                            key={align}
                            onClick={() => updateTheme({ headerAlign: align as any })}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('headerSize')}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['small', 'medium', 'large'].map((size) => (
                          <button
                            key={size}
                            onClick={() => updateTheme({ headerSize: size as any })}
                            className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                          <span className="ml-2 text-sm text-gray-700">{t('useGradient')}</span>
                        </div>
                        
                        {theme.headerUseGradient ? (
                          <>
                            <ColorInput
                              label={t('gradientStartColor')}
                              value={theme.headerGradientStartColor}
                              onChange={(value) => updateTheme({ headerGradientStartColor: value })}
                            />
                            
                            <ColorInput
                              label={t('gradientEndColor')}
                              value={theme.headerGradientEndColor}
                              onChange={(value) => updateTheme({ headerGradientEndColor: value })}
                            />
                            
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('gradientDirection')}</label>
                              <select
                                value={theme.headerGradientDirection}
                                onChange={(e) => updateTheme({ headerGradientDirection: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              </div>
            )}

            {activeCategory === 'input' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t('inputSettings')}</h3>
                  <p className="text-sm text-gray-600">{t('inputSettingsDesc')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inputPosition')}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['top', 'bottom'].map((position) => (
                      <button
                        key={position}
                        onClick={() => updateTheme({ inputPosition: position as any })}
                        className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
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

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <label className="text-sm font-medium text-gray-700">
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

                <ColorInput
                  label={t('inputAreaBackgroundColor')}
                  value={theme.inputAreaBackgroundColor}
                  onChange={(value) => updateTheme({ inputAreaBackgroundColor: value })}
                />

                <ColorInput
                  label={t('inputBackgroundColor')}
                  value={theme.inputBackgroundColor}
                  onChange={(value) => updateTheme({ inputBackgroundColor: value })}
                />

                <ColorInput
                  label={t('inputBorderColor')}
                  value={theme.inputBorderColor}
                  onChange={(value) => updateTheme({ inputBorderColor: value })}
                />

                <ColorInput
                  label={t('inputTextColor')}
                  value={theme.inputTextColor}
                  onChange={(value) => updateTheme({ inputTextColor: value })}
                />

                <ColorInput
                  label={t('inputPlaceholderColor')}
                  value={theme.inputPlaceholderColor}
                  onChange={(value) => updateTheme({ inputPlaceholderColor: value })}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inputPlaceholder')}
                  </label>
                  <input
                    type="text"
                    value={theme.inputPlaceholderText}
                    onChange={(e) => updateTheme({ inputPlaceholderText: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t('inputPlaceholderExample')}
                  />
                </div>

                <ColorInput
                  label={t('sendButtonBackgroundColor')}
                  value={theme.sendButtonBackgroundColor}
                  onChange={(value) => updateTheme({ sendButtonBackgroundColor: value })}
                />

                <ColorInput
                  label={t('sendButtonTextColor')}
                  value={theme.sendButtonTextColor}
                  onChange={(value) => updateTheme({ sendButtonTextColor: value })}
                />


                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
              </div>
            )}

            {activeCategory === 'contact' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t('contactSettings')}</h3>
                  <p className="text-sm text-gray-600">{t('contactSettingsDesc')}</p>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <label className="text-sm font-medium text-gray-700">
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeCategory === 'qaCard' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{t('qaSettings')}</h3>
                </div>

                {/* 用戶訊息設定 */}
                <div>
                  <h4 className="text-base font-semibold text-gray-800 mb-3">{t('userMessageSettings')}</h4>
                  
                  {/* 泡泡顏色 */}
                  <ColorInput
                    label={t('userMessageBubbleColor')}
                    value={theme.userBubbleColor || '#2563EB'}
                    onChange={(value) => updateTheme({ userBubbleColor: value })}
                    className="mb-4"
                  />

                  {/* 文字顏色 */}
                  <ColorInput
                    label={t('userMessageTextColor')}
                    value={theme.userTextColor || '#FFFFFF'}
                    onChange={(value) => updateTheme({ userTextColor: value })}
                    className="mb-4"
                  />
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h4 className="text-base font-semibold text-gray-800 mb-3">{t('qaCardSettings')}</h4>
                </div>

                {/* 背景顏色 */}
                <div>
                  <ColorInput
                    label={t('cardBackgroundColor')}
                    value={theme.qaCardStyle?.backgroundColor || '#FFFFFF'}
                    onChange={(value) => updateTheme({ 
                      qaCardStyle: { 
                        ...theme.qaCardStyle, 
                        backgroundColor: value 
                      } 
                    })}
                    className="mb-4"
                  />

                  {/* 邊框顏色 */}
                  <ColorInput
                    label={t('borderColor')}
                    value={theme.qaCardStyle?.borderColor || '#E5E7EB'}
                    onChange={(value) => updateTheme({ 
                      qaCardStyle: { 
                        ...theme.qaCardStyle, 
                        borderColor: value 
                      } 
                    })}
                    className="mb-4"
                  />

                  {/* 圓角 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('borderRadius')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'rounded', label: t('small') },
                        { value: 'rounded-xl', label: t('medium') },
                        { value: 'rounded-2xl', label: t('large') }
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => updateTheme({ 
                            qaCardStyle: { 
                              ...theme.qaCardStyle, 
                              borderRadius: value 
                            } 
                          })}
                          className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                            (theme.qaCardStyle?.borderRadius || 'rounded-xl') === value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 內邊距 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('padding')}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'p-3', label: t('small') },
                        { value: 'p-4', label: t('medium') },
                        { value: 'p-5', label: t('large') }
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => updateTheme({ 
                            qaCardStyle: { 
                              ...theme.qaCardStyle, 
                              padding: value 
                            } 
                          })}
                          className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                            (theme.qaCardStyle?.padding || 'p-4') === value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 陰影效果 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('shadow')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'shadow-none', label: t('no') },
                        { value: 'shadow-sm hover:shadow-md', label: t('small') },
                        { value: 'shadow-md hover:shadow-lg', label: t('medium') },
                        { value: 'shadow-lg hover:shadow-xl', label: t('large') }
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => updateTheme({ 
                            qaCardStyle: { 
                              ...theme.qaCardStyle, 
                              shadow: value 
                            } 
                          })}
                          className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                            (theme.qaCardStyle?.shadow || 'shadow-md hover:shadow-lg') === value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 文字設定 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">{t('textSettings')}</h4>
                  
                  {/* 標題文字顏色 */}
                  <ColorInput
                    label={t('questionTextColor')}
                    value={theme.qaCardStyle?.questionColor || '#111827'}
                    onChange={(value) => updateTheme({ 
                      qaCardStyle: { 
                        ...theme.qaCardStyle, 
                        questionColor: value 
                      } 
                    })}
                    className="mb-4"
                  />

                  {/* 標題文字大小 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('questionTextSize')}
                    </label>
                    <select
                      value={theme.qaCardStyle?.questionFontSize || '1rem'}
                      onChange={(e) => updateTheme({ 
                        qaCardStyle: { 
                          ...theme.qaCardStyle, 
                          questionFontSize: e.target.value 
                        } 
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="18px">18px ({t('small')})</option>
                      <option value="20px">20px</option>
                      <option value="1rem">1rem ({t('medium')})</option>
                      <option value="24px">24px</option>
                      <option value="28px">28px</option>
                      <option value="32px">32px ({t('large')})</option>
                    </select>
                  </div>

                  {/* 內容文字顏色 */}
                  <ColorInput
                    label={t('answerTextColor')}
                    value={theme.qaCardStyle?.answerColor || '#374151'}
                    onChange={(value) => updateTheme({ 
                      qaCardStyle: { 
                        ...theme.qaCardStyle, 
                        answerColor: value 
                      } 
                    })}
                    className="mb-4"
                  />

                  {/* 內容文字大小 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('answerTextSize')}
                    </label>
                    <select
                      value={theme.qaCardStyle?.answerFontSize || '0.875rem'}
                      onChange={(e) => updateTheme({ 
                        qaCardStyle: { 
                          ...theme.qaCardStyle, 
                          answerFontSize: e.target.value 
                        } 
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="12px">12px ({t('extraSmall')})</option>
                      <option value="14px">14px ({t('small')})</option>
                      <option value="0.875rem">0.875rem</option>
                      <option value="16px">16px ({t('medium')})</option>
                      <option value="18px">18px ({t('large')})</option>
                      <option value="20px">20px</option>
                    </select>
                  </div>
                </div>

                {/* 邊框設定 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">{t('borderSettings')}</h4>
                  
                  {/* 左側邊框顏色 */}
                  <ColorInput
                    label={t('accentColor')}
                    value={theme.qaCardStyle?.accentColor || '#3B82F6'}
                    onChange={(value) => updateTheme({ 
                      qaCardStyle: { 
                        ...theme.qaCardStyle, 
                        accentColor: value 
                      } 
                    })}
                    className="mb-4"
                  />

                  {/* 分隔線高度 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('separatorHeight')}
                    </label>
                    <select
                      value={theme.qaCardStyle?.separatorHeight || '1px'}
                      onChange={(e) => updateTheme({ 
                        qaCardStyle: { 
                          ...theme.qaCardStyle, 
                          separatorHeight: e.target.value 
                        } 
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="0px">{t('no')}</option>
                      <option value="1px">1px ({t('small')})</option>
                      <option value="2px">2px ({t('medium')})</option>
                      <option value="3px">3px ({t('large')})</option>
                      <option value="4px">4px ({t('extraLarge')})</option>
                    </select>
                  </div>

                  {/* 分隔線顏色 */}
                  <ColorInput
                    label={t('separatorColor')}
                    value={theme.qaCardStyle?.separatorColor || theme.qaCardStyle?.borderColor || '#E5E7EB'}
                    onChange={(value) => updateTheme({ 
                      qaCardStyle: { 
                        ...theme.qaCardStyle, 
                        separatorColor: value 
                      } 
                    })}
                    className="mb-4"
                  />
                </div>
              </div>
            )}
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
    </div>
  );
}
