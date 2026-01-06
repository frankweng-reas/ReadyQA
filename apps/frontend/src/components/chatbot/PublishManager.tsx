'use client'

import { useState, useEffect } from 'react'
import { chatbotApi } from '@/lib/api/chatbot'

interface PublishManagerProps {
  chatbotId: string
}

interface DomainWhitelist {
  enabled: boolean
  domains: string[]
}

export default function PublishManager({ chatbotId }: PublishManagerProps) {
  const [activeTab, setActiveTab] = useState<'iframe' | 'javascript' | 'pwa' | 'access-control'>('iframe')
  const [iframeCode, setIframeCode] = useState('')
  const [javascriptCode, setJavascriptCode] = useState('')
  const [iframeCopied, setIframeCopied] = useState(false)
  const [widgetCopied, setWidgetCopied] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  
  // 網域白名單相關狀態
  const [domainWhitelist, setDomainWhitelist] = useState<DomainWhitelist>({
    enabled: false,
    domains: []
  })
  const [newDomain, setNewDomain] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 載入 chatbot 配置
  useEffect(() => {
    const loadChatbotConfig = async () => {
      try {
        const chatbotData = await chatbotApi.getOne(chatbotId)
        
        // 載入 logo（如果有）
        if (chatbotData.theme?.headerLogo) {
          const origin = typeof window !== 'undefined' 
            ? window.location.origin 
            : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
          setLogoPath(`${origin}${chatbotData.theme.headerLogo}`)
        }
        
        // 載入白名單設定（如果有）
        if (chatbotData.domainWhitelist) {
          setDomainWhitelist(chatbotData.domainWhitelist)
        }
      } catch (error) {
        console.error('載入 chatbot 配置失敗:', error)
      }
    }

    loadChatbotConfig()
  }, [chatbotId])

  // 生成嵌入代碼
  useEffect(() => {
    const origin = typeof window !== 'undefined' 
      ? window.location.origin 
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
    
    // iframe 代碼
    const iframe = `<iframe
  src="${origin}/zh-TW/chatbot/${chatbotId}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none;">
</iframe>`
    setIframeCode(iframe)

    // JavaScript Widget 代碼
    const bubbleImageAttr = logoPath ? `\n  data-bubble-image="${logoPath}"` : ''
    const js = `<script 
  src="${origin}/chatbot-widget.js" 
  data-chatbot-id="${chatbotId}"
  data-position="bottom-right"
  data-bubble-color="#2563eb"${bubbleImageAttr}
  data-bubble-animation="bounce">
</script>`
    setJavascriptCode(js)
  }, [chatbotId, logoPath])

  const copyToClipboard = (text: string, setCopied: (value: boolean) => void) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
        .catch(() => {
          fallbackCopy(text, setCopied)
        })
    } else {
      fallbackCopy(text, setCopied)
    }
  }

  const fallbackCopy = (text: string, setCopied: (value: boolean) => void) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyUrlToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setUrlCopied(true)
          setTimeout(() => setUrlCopied(false), 2000)
        })
        .catch(() => {
          fallbackCopy(text, setUrlCopied)
        })
    } else {
      fallbackCopy(text, setUrlCopied)
    }
  }

  // 新增網域
  const addDomain = async () => {
    const trimmedDomain = newDomain.trim()
    if (!trimmedDomain) return
    
    if (domainWhitelist.domains.includes(trimmedDomain)) {
      setSaveMessage({ type: 'error', text: '此網域已存在' })
      setTimeout(() => setSaveMessage(null), 2000)
      return
    }
    
    const updatedWhitelist = {
      ...domainWhitelist,
      domains: [...domainWhitelist.domains, trimmedDomain]
    }
    setDomainWhitelist(updatedWhitelist)
    setNewDomain('')
    
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      const chatbotData = await chatbotApi.getOne(chatbotId)
      chatbotData.domainWhitelist = updatedWhitelist
      await chatbotApi.update(chatbotId, chatbotData)
      
      setSaveMessage({ type: 'success', text: '網域已新增並儲存' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('保存白名單失敗:', error)
      setSaveMessage({ type: 'error', text: '保存失敗，請稍後再試' })
      setDomainWhitelist(domainWhitelist)
    } finally {
      setIsSaving(false)
    }
  }

  // 刪除網域
  const removeDomain = async (domain: string) => {
    const updatedWhitelist = {
      ...domainWhitelist,
      domains: domainWhitelist.domains.filter(d => d !== domain)
    }
    setDomainWhitelist(updatedWhitelist)
    
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      const chatbotData = await chatbotApi.getOne(chatbotId)
      chatbotData.domainWhitelist = updatedWhitelist
      await chatbotApi.update(chatbotId, chatbotData)
      
      setSaveMessage({ type: 'success', text: '網域已刪除並儲存' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error('保存白名單失敗:', error)
      setSaveMessage({ type: 'error', text: '保存失敗，請稍後再試' })
      setDomainWhitelist(domainWhitelist)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 min-h-0">
      {/* Tab 導航 */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex-shrink-0">
        <nav className="flex space-x-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('iframe')}
            className={`px-5 py-2.5 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'iframe'
                ? 'border-cyan-500 text-cyan-600 bg-cyan-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            iframe 頁面嵌入
          </button>
          <button
            onClick={() => setActiveTab('javascript')}
            className={`px-5 py-2.5 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'javascript'
                ? 'border-cyan-500 text-cyan-600 bg-cyan-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Widget (浮動氣泡)
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`px-5 py-2.5 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'pwa'
                ? 'border-cyan-500 text-cyan-600 bg-cyan-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            PWA
          </button>
          <button
            onClick={() => setActiveTab('access-control')}
            className={`px-5 py-2.5 text-base font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'access-control'
                ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            訪問控制
          </button>
        </nav>
      </div>

      {/* 內容區域 */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'iframe' && (
            <div className="space-y-4">
              {/* 說明訊息 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="space-y-2">
                  <p className="text-lg font-bold text-blue-900">適用：知識查詢 chatbot 本身就是該頁面的主要內容</p>
                  <p className="text-lg font-bold text-blue-900">情境：客服中心、幫助中心、知識庫專頁</p>
                  <p className="text-lg font-bold text-blue-900">特點：進入頁面即顯示完整知識查詢介面，無需額外點擊</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">iframe 頁面嵌入</h2>
                  <button
                    onClick={() => copyToClipboard(iframeCode, setIframeCopied)}
                    className={`px-6 py-2.5 rounded-full transition-all duration-200 shadow-md hover:shadow-lg font-medium ${
                      iframeCopied 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {iframeCopied ? '✓ 已複製' : '複製代碼'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  將以下代碼添加到您的 HTML 頁面中（例如客服中心、幫助中心、知識庫專頁）：
                </p>
                <pre className="bg-gray-900 text-gray-100 p-5 rounded-xl overflow-x-auto border border-gray-700 shadow-inner">
                  <code className="text-sm">{iframeCode}</code>
                </pre>
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800 font-medium">
                    💡 <strong>效果：</strong>chatbot 會直接顯示在頁面中，作為頁面的主要內容
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'javascript' && (
            <div className="space-y-6">
              {/* 說明訊息 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="space-y-2">
                  <p className="text-lg font-bold text-blue-900">適用：將知識查詢功能「加裝」到現有網站/系統</p>
                  <p className="text-lg font-bold text-blue-900">情境：用戶在瀏覽網站時，隨時可點擊泡泡查詢知識</p>
                  <p className="text-lg font-bold text-blue-900">特點：不干擾原有頁面內容，需要時才啟動</p>
                </div>
              </div>

              {/* 基礎使用 */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Widget (浮動氣泡)</h2>
                  <button
                    onClick={() => copyToClipboard(javascriptCode, setWidgetCopied)}
                    className={`px-6 py-2.5 rounded-full transition-all duration-200 shadow-md hover:shadow-lg font-medium ${
                      widgetCopied 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {widgetCopied ? '✓ 已複製' : '複製代碼'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  添加到您的 HTML 頁面的 <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;body&gt;</code> 結束標籤前：
                </p>
                <pre className="bg-gray-900 text-gray-100 p-5 rounded-xl overflow-x-auto border border-gray-700 shadow-inner">
                  <code className="text-sm">{javascriptCode}</code>
                </pre>
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800 mb-2 font-medium">
                    💡 <strong>效果：</strong>頁面右下角會出現浮動氣泡，點擊後展開聊天窗口
                  </p>
                  <p className="text-sm text-blue-700 font-medium">
                    📝 <strong>注意：</strong>如果不需要圖片，可以移除 <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 font-mono">data-bubble-image</code> 屬性
                  </p>
                </div>
              </div>

              {/* 進階選項 */}
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
                <h3 className="text-md font-semibold text-gray-900 mb-3">進階選項</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 mb-1">自訂位置</p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto text-xs">
{`<script src="..." data-chatbot-id="..." data-position="bottom-left"></script>
<!-- 選項：bottom-right (預設), bottom-left -->`}</pre>
                  </div>
                  
                  <div>
                    <p className="font-medium text-gray-900 mb-1">自訂泡泡顏色</p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto text-xs">
{`<script src="..." data-chatbot-id="..." data-bubble-color="#ff6b6b"></script>
<!-- 使用任何有效的 CSS 顏色值 -->`}</pre>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 mb-1">動畫效果</p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto text-xs">
{`<script src="..." data-chatbot-id="..." data-bubble-animation="bounce"></script>
<!-- 選項：bounce (跳動，預設), none (無動畫) -->`}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-6">
              {/* 說明訊息 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                <div className="space-y-2">
                  <p className="text-lg font-bold text-blue-900">適用：將知識查詢功能打包為 PWA 應用</p>
                  <p className="text-lg font-bold text-blue-900">情境：用戶可以將 chatbot 安裝到手機桌面，像原生 App 一樣使用</p>
                  <p className="text-lg font-bold text-blue-900">特點：離線可用、快速啟動、原生體驗</p>
                </div>
              </div>

              {/* URL 顯示 */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">PWA 網址</h2>
                <div className="flex items-center gap-3 mb-6">
                  <input
                    type="text"
                    value={typeof window !== 'undefined' 
                      ? `${window.location.origin}/zh-TW/chatbot/${chatbotId}` 
                      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/zh-TW/chatbot/${chatbotId}`}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-700 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyUrlToClipboard(typeof window !== 'undefined' 
                      ? `${window.location.origin}/zh-TW/chatbot/${chatbotId}` 
                      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/zh-TW/chatbot/${chatbotId}`)}
                    className={`px-6 py-3 rounded-full transition-all duration-200 shadow-md hover:shadow-lg font-medium flex-shrink-0 ${
                      urlCopied 
                        ? 'bg-green-600 text-white' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {urlCopied ? '✓ 已複製' : '複製網址'}
                  </button>
                </div>

                {/* QR Code */}
                <h3 className="text-lg font-bold text-gray-900 mb-4 mt-6">掃描 QR Code</h3>
                <div className="flex justify-center items-center">
                  <div className="bg-white p-6 rounded-xl border-2 border-gray-300 shadow-lg">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(typeof window !== 'undefined' 
                        ? window.location.origin + '/zh-TW/chatbot/' + chatbotId 
                        : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/zh-TW/chatbot/' + chatbotId)}`}
                      alt="PWA QR Code"
                      className="w-64 h-64 mx-auto"
                    />
                  </div>
                </div>
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800 font-medium">
                    💡 <strong>說明：</strong>使用手機掃描 QR Code，即可在瀏覽器中打開 chatbot，並可選擇「加入主畫面」安裝為 PWA 應用
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'access-control' && (
            <div className="space-y-6">
              {/* 說明訊息 */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 shadow-sm">
                <div className="space-y-2">
                  <p className="text-lg font-bold text-orange-900">網域白名單功能</p>
                  <p className="text-sm text-orange-800">
                    啟用後，只有白名單中的網域可以通過 iframe 或 Widget 嵌入此 chatbot。
                  </p>
                </div>
              </div>

              {/* 白名單設定 */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                <div className="space-y-6">
                  {/* 開關 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-2">啟用網域白名單</h2>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={domainWhitelist.enabled}
                        onChange={async (e) => {
                          const newEnabled = e.target.checked
                          const updatedWhitelist = {
                            ...domainWhitelist,
                            enabled: newEnabled
                          }
                          setDomainWhitelist(updatedWhitelist)
                          
                          setIsSaving(true)
                          setSaveMessage(null)
                          
                          try {
                            const chatbotData = await chatbotApi.getOne(chatbotId)
                            chatbotData.domainWhitelist = updatedWhitelist
                            await chatbotApi.update(chatbotId, chatbotData)
                            
                            setSaveMessage({ 
                              type: 'success', 
                              text: newEnabled ? '白名單已啟用' : '白名單已停用' 
                            })
                            setTimeout(() => setSaveMessage(null), 3000)
                          } catch (error) {
                            console.error('保存白名單失敗:', error)
                            setSaveMessage({ type: 'error', text: '保存失敗，請稍後再試' })
                            setDomainWhitelist(domainWhitelist)
                          } finally {
                            setIsSaving(false)
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                  </div>

                  {/* 網域列表 */}
                  {domainWhitelist.enabled && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">允許的網域</h3>
                        
                        {domainWhitelist.domains.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {domainWhitelist.domains.map((domain, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                              >
                                <span className="text-sm font-mono text-gray-700">{domain}</span>
                                <button
                                  onClick={() => removeDomain(domain)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded p-1.5 transition-colors"
                                  title="刪除此網域"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-6 text-center text-sm text-gray-500 mb-4">
                            尚未添加任何網域
                          </div>
                        )}

                        {/* 新增網域輸入 */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addDomain()
                              }
                            }}
                            placeholder="例如：example.com 或 *.subdomain.com"
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                          <button
                            onClick={addDomain}
                            disabled={!newDomain.trim() || isSaving}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                          >
                            {isSaving ? '處理中...' : '新增'}
                          </button>
                        </div>

                        {/* 說明文字 */}
                        <div className="mt-3 text-xs text-gray-500 space-y-1">
                          <p>• 支援完整網域：<code className="bg-gray-100 px-1 py-0.5 rounded">example.com</code></p>
                          <p>• 支援子網域：<code className="bg-gray-100 px-1 py-0.5 rounded">*.subdomain.com</code></p>
                          <p>• 支援本地測試：<code className="bg-gray-100 px-1 py-0.5 rounded">localhost:3000</code></p>
                        </div>
                      </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

