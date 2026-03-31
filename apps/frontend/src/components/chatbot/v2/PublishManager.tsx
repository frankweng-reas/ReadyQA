'use client';

import { useState, useEffect } from 'react';
import { layout } from '@/config/layout';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { chatbotApi } from '@/lib/api/chatbot';
import HelpModal from '@/components/ui/HelpModal';

interface PublishManagerProps {
  chatbotId: string;
}

interface DomainWhitelist {
  enabled: boolean;
  domains: string[];
}

export default function PublishManager({ chatbotId }: PublishManagerProps) {
  const locale = useLocale();
  const t = useTranslations('chatbotSidebar');
  const tPublish = useTranslations('publish');
  const tCommon = useTranslations('common');

  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'publish-assistant' | 'access-control'>('publish-assistant');
  const [urlCopied, setUrlCopied] = useState(false);
  const [iframeCode, setIframeCode] = useState('');
  const [iframeCopied, setIframeCopied] = useState(false);
  const [widgetCode, setWidgetCode] = useState('');
  const [widgetCopied, setWidgetCopied] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(null);

  // 網域白名單相關狀態
  const [domainWhitelist, setDomainWhitelist] = useState<DomainWhitelist>({
    enabled: false,
    domains: []
  });
  const [newDomain, setNewDomain] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // 生成 PWA URL
  const getPwaUrl = () => {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${base}/${locale}/chatbot/${chatbotId}`;
  };

  // 載入 chatbot 配置
  useEffect(() => {
    const loadChatbotConfig = async () => {
      try {
        const chatbotData = await chatbotApi.getOne(chatbotId);
        
        // 載入白名單設定（如果有）
        if (chatbotData.domainWhitelist) {
          setDomainWhitelist(chatbotData.domainWhitelist);
        }
        
        // 載入 logo 路徑（如果有）
        if (chatbotData.theme?.headerLogo) {
          setLogoPath(chatbotData.theme.headerLogo);
        }
      } catch (error) {
        console.error('[PublishManager] 載入 chatbot 配置失敗:', error);
      }
    };

    loadChatbotConfig();
  }, [chatbotId]);

  // 生成 iframe 代碼
  useEffect(() => {
    const origin = typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    
    const iframe = `<iframe
  src="${origin}/${locale}/chatbot/${chatbotId}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none;">
</iframe>`;
    setIframeCode(iframe);

    // JavaScript Widget 代碼（data-locale 供 /api/chatbot-widget 組出正確 chatbot URL；省略時預設 zh-TW）
    const bubbleImageAttr = logoPath ? `\n  data-bubble-image="${origin}${logoPath}"` : '';
    const widget = `<script 
  src="${origin}/chatbot-widget.js" 
  data-chatbot-id="${chatbotId}"
  data-locale="${locale}"
  data-position="bottom-right"
  data-bubble-color="#ffffff"
  data-width="400px"
  data-height="600px"${bubbleImageAttr}
  data-bubble-animation="bounce">
</script>`;
    setWidgetCode(widget);
  }, [chatbotId, logoPath, locale]);

  // 複製 URL 到剪貼板
  const copyUrlToClipboard = async () => {
    const url = getPwaUrl();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      }
    } catch (error) {
      console.error('[PublishManager] 複製 URL 失敗:', error);
    }
  };

  // 複製代碼到剪貼板
  const copyCodeToClipboard = async (text: string, type: 'iframe' | 'widget') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        if (type === 'iframe') {
          setIframeCopied(true);
          setTimeout(() => setIframeCopied(false), 2000);
        } else {
          setWidgetCopied(true);
          setTimeout(() => setWidgetCopied(false), 2000);
        }
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        if (type === 'iframe') {
          setIframeCopied(true);
          setTimeout(() => setIframeCopied(false), 2000);
        } else {
          setWidgetCopied(true);
          setTimeout(() => setWidgetCopied(false), 2000);
        }
      }
    } catch (error) {
      console.error('[PublishManager] 複製代碼失敗:', error);
    }
  };

  // 新增網域
  const addDomain = async () => {
    const trimmedDomain = newDomain.trim();
    if (!trimmedDomain) return;
    
    if (domainWhitelist.domains.includes(trimmedDomain)) {
      setSaveMessage({ type: 'error', text: tPublish('domainExists') });
      setTimeout(() => setSaveMessage(null), 2000);
      return;
    }
    
    const updatedWhitelist = {
      ...domainWhitelist,
      domains: [...domainWhitelist.domains, trimmedDomain]
    };
    setDomainWhitelist(updatedWhitelist);
    setNewDomain('');
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // 只傳送 domainWhitelist 欄位
      await chatbotApi.update(chatbotId, {
        domainWhitelist: updatedWhitelist
      });
      
      setSaveMessage({ type: 'success', text: tPublish('domainAdded') });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('[PublishManager] 保存白名單失敗:', error);
      setSaveMessage({ type: 'error', text: tPublish('saveFailed') });
      setDomainWhitelist(domainWhitelist);
    } finally {
      setIsSaving(false);
    }
  };

  // 刪除網域
  const removeDomain = async (domain: string) => {
    const updatedWhitelist = {
      ...domainWhitelist,
      domains: domainWhitelist.domains.filter(d => d !== domain)
    };
    setDomainWhitelist(updatedWhitelist);
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // 只傳送 domainWhitelist 欄位
      await chatbotApi.update(chatbotId, {
        domainWhitelist: updatedWhitelist
      });
      
      setSaveMessage({ type: 'success', text: tPublish('domainRemoved') });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('[PublishManager] 保存白名單失敗:', error);
      setSaveMessage({ type: 'error', text: tPublish('saveFailed') });
      setDomainWhitelist(domainWhitelist);
    } finally {
      setIsSaving(false);
    }
  };

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
            className="w-6 h-6 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
            />
          </svg>
          <h1 className="text-xl font-normal text-white">
            {tPublish('title')}
          </h1>
        </div>

        {/* 右側按鈕區 */}
        <div className="ml-auto flex items-center gap-3">
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
      <div className="flex flex-col flex-1 overflow-hidden bg-content-bg rounded-lg">
        {/* Tab 導航 */}
        <div className="flex-shrink-0 border-b border-header-border">
          <div
            className="flex space-x-1"
            style={{
              paddingLeft: layout.content.padding,
              paddingRight: layout.content.padding,
            }}
          >
            <button
              onClick={() => setActiveTab('publish-assistant')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'publish-assistant'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>{tPublish('publishAssistant')}</span>
            </button>
            <button
              onClick={() => setActiveTab('access-control')}
              className={cn(
                'px-4 py-3 text-lg font-medium border-b-2 transition-colors rounded-t-lg flex items-center gap-2',
                activeTab === 'access-control'
                  ? 'text-primary border-primary bg-grey'
                  : 'text-label border-transparent hover:text-text hover:bg-grey/50'
              )}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>{tPublish('accessControl')}</span>
            </button>
          </div>
        </div>

        {/* 內容區域 */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: layout.content.padding,
          }}
        >
          {activeTab === 'publish-assistant' && (
            <div className="flex flex-col h-full gap-4">
              {/* 第一個容器 - PWA */}
              <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 min-h-0 p-6 flex flex-row gap-6 overflow-hidden">
                {/* 左側內容 */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* 複製按鈕和標題 */}
                  <div className="flex items-center gap-3 mb-4">
                    <Button
                      onClick={copyUrlToClipboard}
                      variant={urlCopied ? 'secondary' : 'primary'}
                      size="sm"
                    >
                      {urlCopied ? tPublish('urlCopied') : tPublish('copyUrl')}
                    </Button>
                    <h2 className="text-xl font-bold text-gray-900">{tPublish('pwaUrl')}</h2>
                  </div>

                  {/* URL 輸入框 */}
                  <div className="mb-6">
                    <input
                      type="text"
                      value={getPwaUrl()}
                      readOnly
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-700 font-mono text-sm"
                    />
                  </div>

                  {/* 說明文字 */}
                  <div className="mt-auto p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-sm text-blue-800 font-medium">
                      💡 <strong>{tPublish('noteLabel')}</strong>{tPublish('pwaDescription')}
                    </p>
                  </div>
                </div>

                {/* 右側 QR Code */}
                <div className="flex-shrink-0 w-[150px] flex items-center justify-center">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getPwaUrl())}`}
                    alt="PWA QR Code"
                    className="w-[150px] h-[150px]"
                  />
                </div>
              </div>

              {/* 第二個容器 - iframe */}
              <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 min-h-0 p-6 flex flex-col overflow-hidden">
                {/* 複製按鈕和標題 */}
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                  <Button
                    onClick={() => copyCodeToClipboard(iframeCode, 'iframe')}
                    variant={iframeCopied ? 'secondary' : 'primary'}
                    size="sm"
                  >
                    {iframeCopied ? tPublish('codeCopied') : tPublish('copyCode')}
                  </Button>
                  <h2 className="text-xl font-bold text-gray-900">{tPublish('iframeEmbed')}</h2>
                </div>

                {/* iframe 代碼 */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <pre className="h-full bg-white text-gray-800 p-4 rounded-lg overflow-auto border border-gray-300">
                    <code className="text-sm">{iframeCode}</code>
                  </pre>
                </div>
              </div>

              {/* 第三個容器 - Widget */}
              <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 min-h-0 p-6 flex flex-col overflow-hidden">
                {/* 複製按鈕和標題 */}
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                  <Button
                    onClick={() => copyCodeToClipboard(widgetCode, 'widget')}
                    variant={widgetCopied ? 'secondary' : 'primary'}
                    size="sm"
                  >
                    {widgetCopied ? tPublish('codeCopied') : tPublish('copyCode')}
                  </Button>
                  <h2 className="text-xl font-bold text-gray-900">{tPublish('widgetEmbed')}</h2>
                </div>

                {/* Widget 代碼 */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <pre className="h-full bg-white text-gray-800 p-4 rounded-lg overflow-auto border border-gray-300">
                    <code className="text-sm">{widgetCode}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'access-control' && (
            <div className="h-full p-6 overflow-y-auto">
              {/* 說明訊息 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-base font-bold text-blue-900 mb-2">{tPublish('domainWhitelist')}</p>
                <p className="text-sm text-blue-800">{tPublish('domainWhitelistDesc')}</p>
              </div>

              {/* 白名單設定 */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                {/* 開關 */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">{tPublish('enableWhitelist')}</h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={domainWhitelist.enabled}
                      onChange={async (e) => {
                        const newEnabled = e.target.checked;
                        const updatedWhitelist = {
                          ...domainWhitelist,
                          enabled: newEnabled
                        };
                        setDomainWhitelist(updatedWhitelist);
                        
                        setIsSaving(true);
                        setSaveMessage(null);
                        
                        try {
                          // 只傳送 domainWhitelist 欄位
                          await chatbotApi.update(chatbotId, {
                            domainWhitelist: updatedWhitelist
                          });
                          
                          setSaveMessage({ 
                            type: 'success', 
                            text: newEnabled ? tPublish('whitelistEnabled') : tPublish('whitelistDisabled')
                          });
                          setTimeout(() => setSaveMessage(null), 3000);
                        } catch (error) {
                          console.error('[PublishManager] 保存白名單失敗:', error);
                          setSaveMessage({ type: 'error', text: tPublish('saveFailed') });
                          setDomainWhitelist(domainWhitelist);
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* 網域列表 */}
                {domainWhitelist.enabled && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{tPublish('allowedDomains')}</h3>
                    
                    {/* 新增網域輸入 */}
                    <div className="flex gap-2 mb-4">
                      <input
                        type="text"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addDomain();
                          }
                        }}
                        placeholder={tPublish('domainPlaceholder')}
                        disabled={isSaving}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <Button
                        onClick={addDomain}
                        disabled={!newDomain.trim() || isSaving}
                        variant="primary"
                        size="sm"
                      >
                        {isSaving ? tPublish('processing') : tPublish('add')}
                      </Button>
                    </div>

                    {/* 說明文字 */}
                    <div className="text-xs text-gray-500 space-y-1 mb-4">
                      <p>{tPublish('domainExampleFull')}<code className="bg-gray-100 px-1 py-0.5 rounded">example.com</code></p>
                      <p>{tPublish('domainExampleSub')}<code className="bg-gray-100 px-1 py-0.5 rounded">*.subdomain.com</code></p>
                      <p>{tPublish('domainExampleLocal')}<code className="bg-gray-100 px-1 py-0.5 rounded">localhost:3000</code></p>
                    </div>

                    {/* 網域列表顯示 */}
                    {domainWhitelist.domains.length > 0 ? (
                      <div className="space-y-2">
                        {domainWhitelist.domains.map((domain, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                          >
                            <span className="text-sm font-mono text-gray-700">{domain}</span>
                            <button
                              onClick={() => removeDomain(domain)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded p-1.5 transition-colors"
                              title={tPublish('deleteDomain')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-6 text-center text-sm text-gray-500">
                        {tPublish('noDomains')}
                      </div>
                    )}
                  </div>
                )}

                {/* 狀態訊息 */}
                {saveMessage && (
                  <div className={`mt-4 p-3 rounded-lg text-sm ${
                    saveMessage.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {saveMessage.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        helpFile="publish"
      />
    </div>
  );
}
