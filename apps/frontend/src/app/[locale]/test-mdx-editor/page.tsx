'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

// Toast UI Editor 類型
import type { Editor } from '@toast-ui/editor'

// 導入樣式
import '@toast-ui/editor/dist/toastui-editor.css'

export default function TestToastUIEditorPage() {
  const t = useTranslations('common')
  const [markdown, setMarkdown] = useState(`這是文字

[這是連結](https://example.com)

這是圖片
![](https://picsum.photos/400/200)`)

  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  const editorDivRef = useRef<HTMLDivElement>(null)

  // 圖片上傳處理函數
  const handleImageUpload = async (file: File): Promise<string> => {
    console.log('[ToastUI] 開始上傳圖片:', { name: file.name, size: file.size, type: file.type })
    setIsUploadingImage(true)
    try {
      // 驗證檔案類型
      if (!file.type.match(/^image\/(jpg|jpeg|png|gif|webp)$/)) {
        const errorMsg = '只允許上傳圖片檔案（jpg, jpeg, png, gif, webp）'
        console.error('[ToastUI]', errorMsg)
        alert(errorMsg)
        throw new Error(errorMsg)
      }

      // 驗證檔案大小（5MB）
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        const errorMsg = '檔案大小不能超過 5MB'
        console.error('[ToastUI]', errorMsg)
        alert(errorMsg)
        throw new Error(errorMsg)
      }

      // 使用 FormData 上傳檔案
      const formData = new FormData()
      formData.append('file', file)

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`
      const uploadUrl = `${apiBase}/faqs/upload-image`
      console.log('[ToastUI] 上傳到:', uploadUrl)
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      })

      console.log('[ToastUI] 上傳回應狀態:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMsg = errorData.message || `圖片上傳失敗: ${response.status} ${response.statusText}`
        console.error('[ToastUI]', errorMsg, errorData)
        alert(errorMsg)
        throw new Error(errorMsg)
      }

      const result = await response.json()
      console.log('[ToastUI] 上傳回應:', result)
      
      if (result.success && result.data?.imageUrl) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const imageBaseUrl = baseUrl.endsWith('/api') ? baseUrl.replace(/\/api$/, '') : baseUrl
        const imageUrl = `${imageBaseUrl}${result.data.imageUrl}`
        console.log('[ToastUI] ✅ 圖片上傳成功:', imageUrl)
        alert(`圖片上傳成功！\nURL: ${imageUrl}`)
        return imageUrl
      } else {
        const errorMsg = result.message || '圖片上傳失敗：回應格式錯誤'
        console.error('[ToastUI]', errorMsg, result)
        alert(errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error) {
      console.error('[ToastUI] ❌ 圖片上傳失敗:', error)
      if (error instanceof Error && !error.message.includes('只允許') && !error.message.includes('檔案大小')) {
        alert(`圖片上傳失敗: ${error.message}`)
      }
      throw error
    } finally {
      setIsUploadingImage(false)
    }
  }

  // 初始化 Toast UI Editor
  useEffect(() => {
    // 動態導入 Toast UI Editor（避免 SSR 問題）
    const initEditor = async () => {
      if (!editorDivRef.current || editorRef.current) return

      const { default: Editor } = await import('@toast-ui/editor')

      const editor = new Editor({
        el: editorDivRef.current,
        height: '400px',
        initialEditType: 'wysiwyg', // 預設為 WYSIWYG 模式
        previewStyle: 'vertical', // 垂直分屏預覽
        initialValue: markdown,
        language: 'zh-TW',
        toolbarItems: [
          ['heading', 'bold', 'italic'],
          ['hr', 'quote'],
          ['ul', 'ol'],
          ['table', 'link', 'image'],
        ],
        hooks: {
          // 圖片上傳 hook
          addImageBlobHook: async (blob: File | Blob, callback: (url: string, altText: string) => void) => {
            console.log('[ToastUI] addImageBlobHook 觸發')
            try {
              const file = blob instanceof File ? blob : new File([blob], 'image.png', { type: blob.type })
              const url = await handleImageUpload(file)
              callback(url, '圖片')
            } catch (error) {
              console.error('[ToastUI] 圖片上傳 hook 失敗:', error)
            }
          },
        },
      })

      // 監聽內容變化
      editor.on('change', () => {
        const newMarkdown = editor.getMarkdown()
        setMarkdown(newMarkdown)
      })

      editorRef.current = editor
    }

    initEditor()

    // 清理函數
    return () => {
      if (editorRef.current) {
        editorRef.current.destroy()
        editorRef.current = null
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Toast UI Editor 測試頁面
          </h1>
          <p className="text-gray-600">
            測試 Toast UI Editor - 真正的 WYSIWYG Markdown 編輯器
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 編輯器區域 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              編輯器（WYSIWYG + Markdown 雙模式）
            </h2>
            <div ref={editorDivRef} className="border border-gray-300 rounded-lg overflow-hidden" />
          </div>

          {/* Markdown 輸出 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">
              Markdown 輸出
            </h2>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-[400px]">
                {markdown}
              </pre>
            </div>
          </div>
        </div>

        {/* 預覽渲染區域 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            渲染預覽（使用 ReactMarkdown，模擬 QACard 顯示效果）
          </h2>
          <div className="border border-gray-300 rounded-lg p-6 bg-gray-50">
            <div className="markdown-preview">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  // 圖片組件
                  img: ({ src, alt }) => {
                    if (!src) {
                      console.warn('[ToastUI Preview] 圖片 src 為空')
                      return null
                    }
                    
                    if (src.startsWith('data:image')) {
                      console.warn('[ToastUI Preview] 不支援 base64 圖片，請使用 URL')
                      return (
                        <div className="my-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                          ⚠️ 不支援 base64 圖片格式，請使用圖片上傳功能或提供圖片 URL
                        </div>
                      )
                    }
                    
                    console.log('[ToastUI Preview] 渲染圖片:', { src, alt })
                    
                    let imageSrc = src
                    if (src.startsWith('http')) {
                      imageSrc = src
                    } else if (src.startsWith('/uploads/')) {
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
                      const imageBaseUrl = baseUrl.endsWith('/api') ? baseUrl.replace(/\/api$/, '') : baseUrl
                      imageSrc = `${imageBaseUrl}${src}`
                      console.log('[ToastUI Preview] 轉換圖片路徑:', { src, imageSrc })
                    } else if (src.startsWith('/')) {
                      imageSrc = `${window.location.origin}${src}`
                    }
                    
                    return (
                      <div className="my-4 flex justify-center">
                        <img
                          src={imageSrc}
                          alt={alt || '圖片'}
                          className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity border border-gray-200 shadow-sm"
                          style={{
                            maxHeight: '400px',
                            display: 'block',
                            width: 'auto',
                            height: 'auto',
                          }}
                          onError={(e) => {
                            console.error('[ToastUI Preview] 圖片載入失敗:', imageSrc)
                            const target = e.currentTarget
                            const parent = target.parentElement
                            if (parent && !parent.querySelector('.image-error')) {
                              target.style.display = 'none'
                              const errorDiv = document.createElement('div')
                              errorDiv.className = 'image-error text-red-500 text-sm p-2 bg-red-50 rounded border border-red-200'
                              errorDiv.innerHTML = `
                                <div>圖片載入失敗</div>
                                <div class="text-xs mt-1 break-all">${imageSrc}</div>
                                <div class="text-xs mt-1 text-gray-500">請檢查：1. 後端服務是否運行 2. 圖片路徑是否正確 3. CORS 設置</div>
                              `
                              parent.appendChild(errorDiv)
                            }
                          }}
                          onLoad={() => {
                            console.log('[ToastUI Preview] ✅ 圖片載入成功:', imageSrc)
                          }}
                        />
                      </div>
                    )
                  },
                  p: ({ children }) => (
                    <p className="mb-3 last:mb-0">{children}</p>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-3xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-2xl font-bold mb-3 mt-5 first:mt-0">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h3>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full border-collapse border border-gray-300">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-gray-100">{children}</thead>
                  ),
                  tbody: ({ children }) => (
                    <tbody>{children}</tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      {children}
                    </tr>
                  ),
                  th: ({ children }) => (
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold bg-gray-100">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-gray-300 px-4 py-2">
                      {children}
                    </td>
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className="mt-6 flex gap-4 flex-wrap">
          <button
            onClick={() => {
              navigator.clipboard.writeText(markdown)
              alert('Markdown 內容已複製到剪貼簿')
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            複製 Markdown
          </button>
          <button
            onClick={() => {
              const newContent = `這是文字

[這是連結](https://example.com)

這是圖片
![](https://picsum.photos/400/200)`
              if (editorRef.current) {
                editorRef.current.setMarkdown(newContent)
                setMarkdown(newContent)
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            重置內容
          </button>
          <button
            onClick={() => {
              if (editorRef.current) {
                const currentType = editorRef.current.getCurrentPreviewStyle()
                alert(`當前編輯模式：${editorRef.current.isWysiwygMode() ? 'WYSIWYG' : 'Markdown'}\n預覽模式：${currentType}`)
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            查看模式
          </button>
          {isUploadingImage && (
            <div className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 018 12c0-3.042-1.135-5.824-3-7.938L3 4.062A7.962 7.962 0 000 12h4zm2 5.291z"
                />
              </svg>
              上傳圖片中...
            </div>
          )}
        </div>

        {/* 說明區域 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📝 測試說明
          </h3>
          <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
            <li>✨ <strong>Toast UI Editor</strong> - 真正的 WYSIWYG Markdown 編輯器</li>
            <li>🔄 支援 <strong>WYSIWYG</strong> 和 <strong>Markdown</strong> 雙模式切換（點工具列右上角按鈕）</li>
            <li>📷 圖片上傳：點擊工具列的「圖片」按鈕 → 選擇檔案 → 自動上傳</li>
            <li>🔗 插入連結：選取文字 → 點擊「連結」按鈕 → 輸入網址</li>
            <li>📊 表格：點擊「表格」按鈕 → 選擇大小 → 編輯內容</li>
            <li>✅ 不會有順序錯亂問題</li>
            <li>📱 預覽區域使用 ReactMarkdown 渲染，模擬 QACard 顯示效果</li>
          </ul>
        </div>

        {/* 調試資訊 */}
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            🔍 調試資訊
          </h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>當前 Markdown 長度: {markdown.length} 字元</div>
            <div>是否正在上傳圖片: {isUploadingImage ? '是' : '否'}</div>
            <div>API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}</div>
            <div>編輯器狀態: {editorRef.current ? '已初始化' : '未初始化'}</div>
            <div className="mt-2">
              <details>
                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                  查看當前 Markdown 內容
                </summary>
                <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-40">
                  {markdown}
                </pre>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
