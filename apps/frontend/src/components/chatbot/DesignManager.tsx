'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import ChatbotWidget from './ChatbotWidget';
import { ChatbotTheme, defaultTheme } from '@/types/chat';
import { chatbotApi } from '@/lib/api/chatbot';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface DesignManagerProps {
  chatbotId: string;
}

type SettingCategory = 'container' | 'header' | 'input' | 'contact' | 'qaCard' | null;
type DeviceType = 'mobile' | 'tablet' | 'desktop';

export default function DesignManager({ chatbotId }: DesignManagerProps) {
  const t = useTranslations('design');
  const tCommon = useTranslations('common');

  const [theme, setTheme] = useState<ChatbotTheme>(defaultTheme);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SettingCategory>('container');
  const [deviceType, setDeviceType] = useState<DeviceType>('mobile');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
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
          console.log('🔵 [loadTheme] DB 中的 theme 欄位數量:', Object.keys(chatbot.theme).length);
          console.log('🔵 [loadTheme] DB theme 預覽:', JSON.stringify(chatbot.theme).substring(0, 300));
          
          // 直接使用 DB 的 theme（不合併 defaultTheme）
          setTheme(chatbot.theme as ChatbotTheme);
          console.log('✅ [loadTheme] Theme 已載入');
        } else {
          console.log('🟡 [loadTheme] 沒有 theme，使用預設值');
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
      alert('保存失敗：' + (error instanceof Error ? error.message : String(error)));
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
      alert(t('fileTooLarge'));
      return;
    }

    // 驗證檔案類型
    if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
      alert('只允許上傳圖片檔案（jpg, jpeg, png, gif, webp）');
      return;
    }

    setIsUploadingLogo(true);

    try {
      // 使用 FormData 上傳檔案
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`http://localhost:8000/api/chatbots/${chatbotId}/upload-logo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('uploadLogoFailed'));
      }

      const result = await response.json();
      
      // 更新 theme 並重新載入
      const logoPath = `http://localhost:8000${result.data.logoPath}`;
      updateTheme({ headerLogo: logoPath });
      setRefreshKey(prev => prev + 1);
      
      alert(t('uploadLogoSuccess'));
    } catch (error) {
      console.error('上傳 logo 時發生錯誤:', error);
      alert(error instanceof Error ? error.message : t('uploadLogoFailed'));
    } finally {
      setIsUploadingLogo(false);
      // 重置 input，允許重新選擇同一個檔案
      e.target.value = '';
    }
  };

  // 分類選項
  const categories = [
    { id: 'container', name: t('containerSettings'), icon: '📦' },
    { id: 'header', name: t('headerSettings'), icon: '📋' },
    { id: 'input', name: t('inputSettings'), icon: '📝' },
    { id: 'contact', name: t('contactSettings'), icon: '📞' },
    { id: 'qaCard', name: t('qaCardSettings'), icon: '📄' },
  ];

  // 裝置配置
  const devices = [
    { type: 'mobile', name: t('device_mobile'), width: '375px', height: '667px' },
    { type: 'tablet', name: t('device_tablet'), width: '768px', height: '1024px' },
    { type: 'desktop', name: t('device_desktop'), width: '100%', height: '100%' },
  ];

  const currentDevice = devices.find(d => d.type === deviceType)!;

  // 裝置圖標
  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'tablet':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'desktop':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* 頂部工具列 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左側：空白區域（用於平衡布局） */}
          <div className="flex-1"></div>
          
          {/* 中間：設備切換按鈕 */}
          <div className="flex items-center space-x-3">
            {devices.map((device) => (
              <button
                key={device.type}
                onClick={() => setDeviceType(device.type as DeviceType)}
                className={`px-6 py-3 rounded-3xl transition-all flex items-center space-x-2 text-base font-medium ${
                  deviceType === device.type
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getDeviceIcon(device.type)}
                <span>{device.name}</span>
              </button>
            ))}
          </div>
          
          {/* 右側：設定和 Help 按鈕 */}
          <div className="flex-1 flex items-center justify-end space-x-3">
            {/* Help 按鈕 */}
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 text-base font-medium ${
                showHelp
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={showHelp ? t('hideHelp') : t('showHelp')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t('help')}</span>
            </button>
            
            {/* 設定按鈕 */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 text-base font-medium ${
                showSettings
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={showSettings ? t('hideSettings') : t('showSettings')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{t('settings')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 主容器：預覽區域 + 設定面板 */}
      <div className="flex flex-1 min-h-0">
        {/* 預覽區域 */}
        <div className={`flex-1 bg-gradient-to-br from-gray-50 to-gray-100 ${deviceType === 'desktop' ? 'p-3' : 'p-6 overflow-auto'} min-h-0 transition-all duration-300`}>
          <div className={`h-full flex ${deviceType === 'desktop' ? 'min-h-0' : 'items-center justify-center'}`}>
            {/* 統一使用同一個容器結構，桌面只是呈現不同 */}
            <div className={deviceType === 'desktop' ? 'w-full h-full min-h-0' : 'relative'}>
              {/* 裝置外框：桌面模式隱藏，手機/平板顯示 */}
              <div
                className={deviceType === 'desktop' 
                  ? 'w-full h-full border border-gray-200 rounded-lg shadow-sm bg-white p-0 flex flex-col min-h-0'
                  : 'bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl'
                }
                style={deviceType === 'desktop' ? {} : {
                  width: deviceType === 'mobile' ? '395px' : '788px',
                }}
              >
                {/* 內層容器：桌面模式全寬，手機/平板固定尺寸 */}
                <div
                  className={deviceType === 'desktop' 
                    ? 'w-full h-full bg-white flex flex-col overflow-hidden min-h-0'
                    : 'bg-white rounded-[2rem] overflow-hidden flex flex-col'
                  }
                  style={deviceType === 'desktop' ? {} : {
                    width: currentDevice.width,
                    height: deviceType === 'mobile' ? '667px' : '600px',
                  }}
                >
                  <ChatbotWidget
                    key={`chatbot-preview-${chatbotId}`}
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
          </div>
        </div>
        
        {/* 設定面板 */}
        {showSettings && (
          <div className="w-[480px] flex-shrink-0 bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden z-20 flex flex-col border-l border-gray-200">
            {/* Header 區域 */}
            <div className="flex-shrink-0 px-4 py-2 bg-gray-50 border-b border-gray-200">
            </div>

            <div className="flex flex-1 min-h-0">
              {/* 左側分類選單 */}
              <div className="w-[140px] bg-gradient-to-b from-gray-50 to-gray-100 border-r border-gray-200 p-3 flex flex-col">
                <div className="space-y-1">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id as SettingCategory)}
                      className={`w-full px-3 py-3 rounded-lg text-center transition-all ${
                        activeCategory === category.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-white/80'
                      }`}
                    >
                      <span className="text-sm font-medium">{category.name}</span>
                    </button>
                  ))}
                </div>
                
                {/* 重置按鈕 - 放在最下方 */}
                <div className="mt-auto pt-2 border-t border-gray-300">
                  <button
                    onClick={handleReset}
                    className="w-full px-3 py-3 rounded-lg text-center transition-all text-gray-700 hover:bg-white/80"
                  >
                    <span className="text-sm font-medium">{t('reset')}</span>
                  </button>
                </div>
              </div>

              {/* 右側設定內容 */}
              <div className="flex-1 overflow-y-auto p-6">

            {/* 容器外型設定 */}
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
                    value={theme.containerStyle?.shadow || 'shadow-lg'}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('borderColor')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={theme.containerStyle?.borderColor || '#E5E7EB'}
                        onChange={(e) => updateTheme({ 
                          containerStyle: { 
                            ...theme.containerStyle, 
                            borderColor: e.target.value 
                          } 
                        })}
                        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.containerStyle?.borderColor || '#E5E7EB'}
                        onChange={(e) => updateTheme({ 
                          containerStyle: { 
                            ...theme.containerStyle, 
                            borderColor: e.target.value 
                          } 
                        })}
                        placeholder="#E5E7EB"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Header 設定 */}
            {activeCategory === 'header' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t('headerSettings')}</h3>
                  <p className="text-sm text-gray-600">{t('headerSettingsDesc')}</p>
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
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('gradientStartColor')}</label>
                              <div className="flex items-center space-x-3">
                                <input
                                  type="color"
                                  value={theme.headerGradientStartColor}
                                  onChange={(e) => updateTheme({ headerGradientStartColor: e.target.value })}
                                  className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={theme.headerGradientStartColor}
                                  onChange={(e) => updateTheme({ headerGradientStartColor: e.target.value })}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                />
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('gradientEndColor')}</label>
                              <div className="flex items-center space-x-3">
                                <input
                                  type="color"
                                  value={theme.headerGradientEndColor}
                                  onChange={(e) => updateTheme({ headerGradientEndColor: e.target.value })}
                                  className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={theme.headerGradientEndColor}
                                  onChange={(e) => updateTheme({ headerGradientEndColor: e.target.value })}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                />
                              </div>
                            </div>
                            
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
                            
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">{t('preview')}</label>
                              <div 
                                className="w-full h-12 rounded-lg border border-gray-300"
                                style={{
                                  background: `linear-gradient(${theme.headerGradientDirection}, ${theme.headerGradientStartColor}, ${theme.headerGradientEndColor})`
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center space-x-3">
                            <input
                              type="color"
                              value={theme.headerBackgroundColor}
                              onChange={(e) => updateTheme({ headerBackgroundColor: e.target.value })}
                              className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                            />
                            <input
                              type="text"
                              value={theme.headerBackgroundColor}
                              onChange={(e) => updateTheme({ headerBackgroundColor: e.target.value })}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('headerTextColor')}
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={theme.headerTextColor}
                          onChange={(e) => updateTheme({ headerTextColor: e.target.value })}
                          className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={theme.headerTextColor}
                          onChange={(e) => updateTheme({ headerTextColor: e.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('headerLogo')}
                      </label>
                      <div className="flex items-center space-x-3">
                        <div className="relative flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
                  </>
                )}
              </div>
            )}

            {/* 輸入框設定 */}
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inputAreaBackgroundColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.inputAreaBackgroundColor}
                      onChange={(e) => updateTheme({ inputAreaBackgroundColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.inputAreaBackgroundColor}
                      onChange={(e) => updateTheme({ inputAreaBackgroundColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inputBackgroundColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.inputBackgroundColor}
                      onChange={(e) => updateTheme({ inputBackgroundColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.inputBackgroundColor}
                      onChange={(e) => updateTheme({ inputBackgroundColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inputBorderColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.inputBorderColor}
                      onChange={(e) => updateTheme({ inputBorderColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.inputBorderColor}
                      onChange={(e) => updateTheme({ inputBorderColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inputTextColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.inputTextColor}
                      onChange={(e) => updateTheme({ inputTextColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.inputTextColor}
                      onChange={(e) => updateTheme({ inputTextColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('inputPlaceholderColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.inputPlaceholderColor}
                      onChange={(e) => updateTheme({ inputPlaceholderColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.inputPlaceholderColor}
                      onChange={(e) => updateTheme({ inputPlaceholderColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('sendButtonBackgroundColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.sendButtonBackgroundColor}
                      onChange={(e) => updateTheme({ sendButtonBackgroundColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.sendButtonBackgroundColor}
                      onChange={(e) => updateTheme({ sendButtonBackgroundColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('sendButtonTextColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.sendButtonTextColor}
                      onChange={(e) => updateTheme({ sendButtonTextColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.sendButtonTextColor}
                      onChange={(e) => updateTheme({ sendButtonTextColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('sendButtonHoverColor')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={theme.sendButtonHoverColor}
                      onChange={(e) => updateTheme({ sendButtonHoverColor: e.target.value })}
                      className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={theme.sendButtonHoverColor}
                      onChange={(e) => updateTheme({ sendButtonHoverColor: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

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


            {/* 聯絡人設定 */}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('contactInfoPlaceholder')}
                    </label>
                    <input
                      type="text"
                      value={theme.contactInfo?.contact || ''}
                      onChange={(e) => updateTheme({
                        contactInfo: {
                          ...theme.contactInfo,
                          contact: e.target.value
                        }
                      })}
                      placeholder="請輸入電話或 email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      可輸入聯絡電話或 email 地址
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* QACard 設定 */}
            {activeCategory === 'qaCard' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{t('qaCardSettings')}</h3>
                  <p className="text-sm text-gray-600">{t('qaCardSettingsDesc')}</p>
                </div>

                {/* 樣式設定 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">{t('styleSettings')}</h4>
                  
                  {/* 背景顏色 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('backgroundColor')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={theme.qaCardStyle?.backgroundColor || '#FFFFFF'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            backgroundColor: e.target.value 
                          } 
                        })}
                        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.qaCardStyle?.backgroundColor || '#FFFFFF'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            backgroundColor: e.target.value 
                          } 
                        })}
                        placeholder="#FFFFFF"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>

                  {/* 邊框顏色 */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('borderColor')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={theme.qaCardStyle?.borderColor || '#E5E7EB'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            borderColor: e.target.value 
                          } 
                        })}
                        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.qaCardStyle?.borderColor || '#E5E7EB'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            borderColor: e.target.value 
                          } 
                        })}
                        placeholder="#E5E7EB"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>

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
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('questionTextColor')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={theme.qaCardStyle?.questionColor || '#111827'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            questionColor: e.target.value 
                          } 
                        })}
                        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.qaCardStyle?.questionColor || '#111827'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            questionColor: e.target.value 
                          } 
                        })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>

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
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('answerTextColor')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={theme.qaCardStyle?.answerColor || '#374151'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            answerColor: e.target.value 
                          } 
                        })}
                        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.qaCardStyle?.answerColor || '#374151'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            answerColor: e.target.value 
                          } 
                        })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>

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
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('accentColor')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={theme.qaCardStyle?.accentColor || '#3B82F6'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            accentColor: e.target.value 
                          } 
                        })}
                        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.qaCardStyle?.accentColor || '#3B82F6'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            accentColor: e.target.value 
                          } 
                        })}
                        placeholder="#3B82F6"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>

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
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('separatorColor')}
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="color"
                        value={theme.qaCardStyle?.separatorColor || theme.qaCardStyle?.borderColor || '#E5E7EB'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            separatorColor: e.target.value 
                          } 
                        })}
                        className="w-14 h-10 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.qaCardStyle?.separatorColor || theme.qaCardStyle?.borderColor || '#E5E7EB'}
                        onChange={(e) => updateTheme({ 
                          qaCardStyle: { 
                            ...theme.qaCardStyle, 
                            separatorColor: e.target.value 
                          } 
                        })}
                        placeholder="#E5E7EB"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help 面板 */}
      {showHelp && (
        <div className={`fixed top-24 ${showSettings ? 'right-[520px]' : 'right-6'} w-[480px] h-[calc(100vh-7rem)] bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden z-20 flex flex-col transition-all duration-300`}>
          <div className="flex-shrink-0 px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{t('help')}</h2>
              <button
                onClick={() => setShowHelp(false)}
                className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('quickStart')}</h3>
                <p className="text-gray-600">{t('helpContentComingSoon')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

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
