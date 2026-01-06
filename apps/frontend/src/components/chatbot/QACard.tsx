'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import Lightbox from 'yet-another-react-lightbox'
import 'yet-another-react-lightbox/styles.css'
import { ChatbotTheme } from '@/types/chat'
import { QACardProps, QACardSlots } from '@/types/qa-card'
import { useImageLightbox } from '@/hooks/useImageLightbox'

/**
 * 默認樣式配置
 */
const defaultQACardStyle = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E7EB',
  borderRadius: 'rounded-xl',
  padding: 'p-5',
  shadow: 'shadow-md hover:shadow-lg',
  questionColor: '#111827',
  questionFontSize: '16px',
  answerColor: '#374151',
  answerFontSize: '14px',
  questionPrefixColor: '#2563EB',
  accentColor: '#3B82F6',
  separatorHeight: '1px',
  separatorColor: '#E5E7EB',
}

/**
 * QACard - 知識卡片組件
 * 
 * 用於顯示問答內容的卡片組件，支持 Markdown 渲染、圖片 Lightbox、展開/收起等功能。
 * 
 * @example
 * ```tsx
 * <QACard 
 *   question="什麼是 React？"
 *   answer="React 是一個用於構建用戶界面的 JavaScript 庫..."
 *   theme={theme}
 * />
 * ```
 */
export default function QACard({
  faq_id,
  question,
  answer,
  theme,
  config,
  slots: externalSlots,
}: QACardProps) {
  // ========== 狀態管理 ==========
  const alwaysExpanded = config?.alwaysExpanded || false
  // 默認收合：除非 alwaysExpanded 為 true，否則默認不展開
  const [isExpanded, setIsExpanded] = useState(alwaysExpanded)
  const [needsExpand, setNeedsExpand] = useState(false)
  const [hasRecordedViewed, setHasRecordedViewed] = useState(false)
  const [userAction, setUserAction] = useState<'like' | 'dislike' | null>(null) // 記錄用戶點擊的操作
  const answerRef = useRef<HTMLDivElement>(null)
  
  // ========== Insight 記錄 ==========
  const log_id = config?.log_id
  
  // 調試：檢查 log_id 和 faq_id
  useEffect(() => {
    if (log_id && faq_id) {
      console.log(`[QACard] 🔍 初始化: log_id=${log_id}, faq_id=${faq_id}`)
    } else {
      console.warn(`[QACard] ⚠️ 缺少必要參數: log_id=${log_id}, faq_id=${faq_id}`)
    }
  }, [log_id, faq_id])
  
  /**
   * 記錄 FAQ 操作到後端
   */
  const logAction = async (action: 'viewed' | 'not-viewed' | 'like' | 'dislike') => {
    if (!log_id || !faq_id) {
      console.warn(`[QACard] ⚠️ 無法記錄操作 ${action}: log_id=${log_id}, faq_id=${faq_id}`)
      return // 沒有 log_id 或 faq_id 時不記錄
    }
    
    // 如果是 like/dislike，更新視覺狀態
    if (action === 'like' || action === 'dislike') {
      setUserAction(action)
    }
    
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/query/log-faq-action`
    console.log(`[QACard] 📤 發送操作請求: ${action}`, { 
      log_id, 
      faq_id,
      apiUrl
    })
    
    try {
      console.log(`[QACard] 🌐 請求 URL: ${apiUrl}`)
      
      const requestBody = {
        log_id,
        faq_id,
        action
      }
      console.log(`[QACard] 📦 請求內容:`, requestBody)
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })
      
      console.log(`[QACard] 📥 回應狀態: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`[QACard] ✅ 已記錄操作: ${action}`, { log_id, faq_id, response: data })
      } else {
        const errorText = await response.text()
        console.error(`[QACard] ❌ 記錄操作失敗: ${action}`, { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        })
        // 如果失敗，恢復狀態
        if (action === 'like' || action === 'dislike') {
          setUserAction(null)
        }
      }
    } catch (error) {
      console.error(`[QACard] ❌ 記錄操作錯誤: ${action}`, error)
      // 如果錯誤，恢復狀態
      if (action === 'like' || action === 'dislike') {
        setUserAction(null)
      }
    }
  }
  
  // ========== 樣式配置 ==========
  const cardStyle = theme?.qaCardStyle || defaultQACardStyle
  
  // ========== 展開/收起檢測 ==========
  /**
   * 檢測答案內容是否需要展開按鈕（超過 2 行時顯示）
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (answerRef.current) {
        const element = answerRef.current
        const hasLineClamp = element.classList.contains('line-clamp-2')
        
        // 暫時移除 line-clamp 以測量實際高度
        if (hasLineClamp) {
          element.classList.remove('line-clamp-2')
        }
        
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24
        const maxHeight = lineHeight * 2
        const actualHeight = element.scrollHeight
        
        // 如果未展開且原本有 line-clamp，則恢復
        if (hasLineClamp && !isExpanded) {
          element.classList.add('line-clamp-2')
        }
        
        // 判斷是否需要展開按鈕
        const newNeedsExpand = actualHeight > maxHeight
        setNeedsExpand(newNeedsExpand)
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [answer, isExpanded])
  
  // ========== 樣式處理函數 ==========
  /**
   * 判斷是否為 CSS 顏色值（hex、rgb、rgba）
   */
  const isColorValue = (value: string): boolean => {
    return value.startsWith('#') || value.startsWith('rgb') || value.startsWith('rgba')
  }
  
  /**
   * 處理背景顏色：如果是顏色值則使用 style，否則使用 className
   */
  const backgroundColorValue = cardStyle.backgroundColor || defaultQACardStyle.backgroundColor
  const backgroundColorStyle = isColorValue(backgroundColorValue)
    ? { backgroundColor: backgroundColorValue }
    : {}
  const backgroundColorClass = !isColorValue(backgroundColorValue) ? backgroundColorValue : ''
  
  /**
   * 處理邊框顏色：如果是顏色值則使用 style，否則使用 className
   */
  const borderColorValue = cardStyle.borderColor || defaultQACardStyle.borderColor
  const borderColorClass = !isColorValue(borderColorValue) ? borderColorValue : 'border-gray-200'
  
  /**
   * 獲取左側強調邊框顏色
   */
  const accentColorValue = cardStyle.accentColor || defaultQACardStyle.accentColor
  
  /**
   * 判斷背景色是否為深色
   */
  const isDarkBackground = (): boolean => {
    if (!isColorValue(backgroundColorValue)) {
      // 如果是 className，檢查常見的深色類名
      const darkClasses = ['bg-gray-800', 'bg-gray-900', 'bg-black', 'bg-slate-800', 'bg-slate-900', 'bg-zinc-800', 'bg-zinc-900']
      return darkClasses.some(cls => backgroundColorValue.includes(cls))
    }
    
    // 如果是顏色值，計算亮度
    try {
      let r = 0, g = 0, b = 0
      
      if (backgroundColorValue.startsWith('#')) {
        // hex 顏色
        const hex = backgroundColorValue.slice(1)
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16)
          g = parseInt(hex[1] + hex[1], 16)
          b = parseInt(hex[2] + hex[2], 16)
        } else if (hex.length === 6) {
          r = parseInt(hex.slice(0, 2), 16)
          g = parseInt(hex.slice(2, 4), 16)
          b = parseInt(hex.slice(4, 6), 16)
        }
      } else if (backgroundColorValue.startsWith('rgb')) {
        // rgb/rgba 顏色
        const matches = backgroundColorValue.match(/\d+/g)
        if (matches && matches.length >= 3) {
          r = parseInt(matches[0])
          g = parseInt(matches[1])
          b = parseInt(matches[2])
        }
      }
      
      // 計算相對亮度 (0-255)
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b)
      // 如果亮度小於 128，視為深色背景
      return luminance < 128
    } catch {
      return false
    }
  }
  
  /**
   * 獲取展開/收起按鈕的文字顏色類名
   */
  const getExpandButtonColorClass = (): string => {
    return isDarkBackground() 
      ? 'text-blue-300 hover:text-blue-200' 
      : 'text-blue-600 hover:text-blue-700'
  }
  
  /**
   * 計算回饋區域的負 margin（用於抵消 padding）
   */
  const getNegativeMargin = (): string => {
    const padding = cardStyle.padding || defaultQACardStyle.padding
    const paddingMap: Record<string, string> = {
      'p-3': '-mb-3 -mx-3',
      'p-4': '-mb-4 -mx-4',
      'p-5': '-mb-5 -mx-5',
      'p-6': '-mb-6 -mx-6',
    }
    return paddingMap[padding] || '-mb-4 -mx-4'
  }

  // ========== 圖片 Lightbox ==========
  const { lightboxOpen, lightboxIndex, allImages, openLightbox, closeLightbox } = useImageLightbox()
  
  /**
   * 從答案文本中提取所有圖片 URL（Markdown 格式：![alt](url)）
   */
  const collectAllImages = useCallback((): string[] => {
    const images: string[] = []
    if (!answer) return images
    
    const imgRegex = /!\[.*?\]\((.*?)\)/g
    let match: RegExpExecArray | null
    while ((match = imgRegex.exec(answer)) !== null) {
      const imgSrc = match[1]
      if (imgSrc && !images.includes(imgSrc)) {
        images.push(imgSrc)
      }
    }
    
    return images
  }, [answer])
  
  // ========== Markdown 渲染配置 ==========
  /**
   * 計算標題字體大小（基於 answerFontSize）
   */
  const getHeadingFontSize = (level: 1 | 2 | 3): string => {
    const baseFontSize = cardStyle.answerFontSize || defaultQACardStyle.answerFontSize || '14px'
    // 解析字體大小（支援 px, rem, em 等單位）
    const match = baseFontSize.match(/^(\d+\.?\d*)(px|rem|em)$/)
    if (!match) return baseFontSize // 如果無法解析，返回原始值
    
    const [, value, unit] = match
    const numValue = parseFloat(value)
    
    // 根據標題級別計算相對大小
    // h1: 2.0倍, h2: 1.6倍, h3: 1.3倍（調整後更明顯的層次差異）
    const multipliers: Record<1 | 2 | 3, number> = {
      1: 2.0,
      2: 1.6,
      3: 1.3
    }
    
    const newValue = numValue * multipliers[level]
    return `${newValue}${unit}`
  }

  /**
   * Markdown 組件自定義配置
   * 使用 useMemo 避免每次渲染都重新創建
   */
  const markdownComponents = useMemo(() => {
    return {
      p: ({ children }: any) => (
        <p className="mb-2 last:mb-0 leading-relaxed break-words">{children}</p>
      ),
      ul: ({ children }: any) => (
        <ul className="mb-3 last:mb-0 pl-4 list-disc break-words">{children}</ul>
      ),
      ol: ({ children }: any) => (
        <ol className="mb-3 last:mb-0 pl-4 list-decimal break-words">{children}</ol>
      ),
      li: ({ children }: any) => <li className="mb-1">{children}</li>,
      code: ({ inline, children }: any) => 
        inline ? (
          <code className="px-1 py-0.5 rounded text-xs font-mono bg-gray-200">
            {children}
          </code>
        ) : (
          <code className="block px-3 py-2 rounded text-xs font-mono my-2 overflow-x-auto bg-gray-200">
            {children}
          </code>
        ),
      pre: ({ children }: any) => (
        <pre className="mb-3 last:mb-0">{children}</pre>
      ),
      strong: ({ children }: any) => (
        <strong className="font-semibold">{children}</strong>
      ),
      em: ({ children }: any) => <em className="italic">{children}</em>,
      a: ({ children, href }: any) => {
        if (!href) return <span>{children}</span>
        
        // 處理連結點擊（支援 localhost）
        const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
          // 允許 localhost 和所有協議的連結
          if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
            // 標準 URL，讓瀏覽器正常處理
            return
          } else if (href.startsWith('localhost:') || href.startsWith('127.0.0.1:')) {
            // localhost 連結，添加 http:// 前綴
            e.preventDefault()
            window.open(`http://${href}`, '_blank', 'noopener,noreferrer')
          } else if (href.startsWith('/')) {
            // 相對路徑，在同窗口打開
            e.preventDefault()
            window.location.href = href
          } else {
            // 其他情況，嘗試添加 https://
            e.preventDefault()
            window.open(`https://${href}`, '_blank', 'noopener,noreferrer')
          }
        }
        
        return (
          <a 
            href={href} 
            onClick={handleLinkClick}
            className="underline hover:opacity-80 transition-opacity break-all text-blue-600 hover:text-blue-800" 
            target={href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//') ? '_blank' : undefined}
            rel={href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//') ? 'noopener noreferrer' : undefined}
          >
            {children || href}
          </a>
        )
      },
      h1: ({ children }: any) => (
        <h1 
          className="font-bold mb-2 mt-3 first:mt-0"
          style={{ fontSize: getHeadingFontSize(1) }}
        >
          {children}
        </h1>
      ),
      h2: ({ children }: any) => (
        <h2 
          className="font-bold mb-2 mt-3 first:mt-0"
          style={{ fontSize: getHeadingFontSize(2) }}
        >
          {children}
        </h2>
      ),
      h3: ({ children }: any) => (
        <h3 
          className="font-bold mb-2 mt-3 first:mt-0"
          style={{ fontSize: getHeadingFontSize(3) }}
        >
          {children}
        </h3>
      ),
      hr: () => <div className="my-4 h-px bg-gray-300" />,
      /**
       * 自定義圖片組件：支持點擊放大（Lightbox）
       */
      img: ({ src, alt }: any) => {
        if (!src) return null
        
        const handleImageClick = () => {
          const currentImages = collectAllImages()
          const currentIndex = currentImages.indexOf(src)
          openLightbox(currentIndex >= 0 ? currentIndex : 0, currentImages)
        }
        
        return (
          <img
            src={src}
            alt={alt || '圖片'}
            className="my-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity max-w-full h-auto"
            style={{
              maxHeight: '400px',
              display: 'block',
              margin: '0.75rem auto',
            }}
            onClick={handleImageClick}
            onError={(e) => {
              console.error('[QACard] 圖片載入失敗:', src)
              e.currentTarget.style.display = 'none'
            }}
          />
        )
      },
    }
  }, [collectAllImages, openLightbox, cardStyle.answerFontSize])

  // ========== Slots 處理 ==========
  const slots = externalSlots || undefined

  // ========== 渲染 ==========
  return (
    <div
      className={`qa-card knowledge-card relative ${backgroundColorClass} ${cardStyle.borderRadius} ${cardStyle.padding} mb-4 ${cardStyle.shadow} transition-all duration-300 w-full ${config?.className || ''}`}
      style={{
        userSelect: 'text',
        WebkitUserSelect: 'text',
        cursor: 'text',
        maxWidth: '100%',
        overflow: 'hidden', // 防止內容溢出卡片外
        ...backgroundColorStyle,
        borderLeft: `4px solid ${accentColorValue}`,
        borderTop: `1px solid ${borderColorValue}`,
        borderRight: `1px solid ${borderColorValue}`,
        borderBottom: `1px solid ${borderColorValue}`,
      }}
    >
      {/* 問題標題區域 - 可點擊展開/收合 */}
      {slots?.header !== null && slots?.header !== undefined ? (
        slots.header
      ) : (
        question && (
          <h3 
            onClick={() => {
              // 如果沒有 alwaysExpanded，允許點擊標題展開/收合
              if (!alwaysExpanded) {
                const newExpanded = !isExpanded
                setIsExpanded(newExpanded)
                
                // 記錄 viewed 操作（只在第一次展開時記錄）
                if (newExpanded && !hasRecordedViewed && log_id && faq_id) {
                  setHasRecordedViewed(true)
                  logAction('viewed')
                }
              }
            }}
            className={`font-semibold leading-relaxed mb-2 ${
              !alwaysExpanded ? 'cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-between' : ''
            }`}
            style={{ 
              color: cardStyle.questionColor || defaultQACardStyle.questionColor,
              fontSize: cardStyle.questionFontSize || defaultQACardStyle.questionFontSize
            }}
          >
            <span>{question}</span>
            {!alwaysExpanded && (
              <svg 
                className={`w-5 h-5 ml-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </h3>
        )
      )}
      
      {/* 標題與內容之間的分隔線 - 只在有內容時顯示 */}
      {(() => {
        // 如果內容被完全隱藏（不需要展開且已收起），不顯示分隔線
        if (!isExpanded && !alwaysExpanded && !needsExpand) {
          return null
        }
        
        const separatorHeight = cardStyle.separatorHeight || '1px'
        const separatorColor = cardStyle.separatorColor || borderColorValue || defaultQACardStyle.borderColor
        
        // 如果高度為 0px 或 '0px'，不顯示分隔線
        if (separatorHeight === '0px' || separatorHeight === '0') {
          return null
        }
        
        return (
          <div 
            className="my-2"
            style={{ 
              height: separatorHeight,
              backgroundColor: separatorColor,
              width: '100%'
            }}
          />
        )
      })()}
      
      {/* 答案內容區域 - 根據展開狀態顯示/隱藏 */}
      {slots?.content !== undefined && slots?.content !== null && slots?.content !== false ? (
        slots.content
      ) : (
        <>
          <div 
            ref={answerRef}
            className={`relative transition-all duration-300 ${
              // 如果需要展開且已收起，顯示前2行
              !isExpanded && needsExpand ? 'line-clamp-2' : ''
            }`}
            style={{ 
              color: cardStyle.answerColor || defaultQACardStyle.answerColor,
              fontSize: cardStyle.answerFontSize || defaultQACardStyle.answerFontSize || '14px',
              wordBreak: 'break-word', // 確保長文字正確換行
              overflowWrap: 'break-word', // 確保長單詞正確換行
              minWidth: 0, // 確保 flex 子元素可以縮小
              // 收起時使用 hidden 以配合 line-clamp，展開時或不需要展開時使用 visible
              overflow: (!isExpanded && needsExpand) ? 'hidden' : 'visible',
            }}
          >
            {/* Markdown 渲染 */}
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={markdownComponents}
            >
              {answer}
            </ReactMarkdown>
            
            {/* 圖片 Lightbox */}
            <Lightbox
              open={lightboxOpen}
              close={closeLightbox}
              index={lightboxIndex}
              slides={allImages.map((imgSrc) => ({ src: imgSrc }))}
              controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}
            />
          </div>
          
          {/* 展開/收起按鈕 - 移到外部以避免被 line-clamp 隱藏 */}
          {needsExpand && (
            <>
              {!isExpanded && (
                <div className="mt-2 flex items-center justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(true)
                    }}
                    className={`inline-flex items-center text-sm font-medium transition-colors ${getExpandButtonColorClass()}`}
                    aria-label="展開全文"
                  >
                    <span>展開</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}
              {isExpanded && (
                <div className="mt-3 flex items-center justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setIsExpanded(false)
                    }}
                    className={`inline-flex items-center text-sm font-medium transition-colors ${getExpandButtonColorClass()}`}
                    aria-label="收起"
                  >
                    <span>收起</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      
      {/* 媒體區域（可選） */}
      {slots?.media}
      
      {/* 回饋機制 */}
      {slots?.footer || (
        <div 
          className={`mt-4 py-2 border-t ${getNegativeMargin()}`} 
          style={{ 
            borderColor: borderColorValue || '#E5E7EB',
            backgroundColor: '#F9FAFB'
          }}
        >
          <div className="flex items-center justify-end">
            <span className="text-base text-gray-600 font-medium mr-3">這則知識有幫助嗎？</span>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => {
                  console.log('[QACard] 點擊了「有幫助」', { question, answer, log_id, faq_id })
                  logAction('like')
                }}
                className={`p-2 rounded-md transition-all ${
                  userAction === 'like' 
                    ? 'bg-green-100 scale-110' 
                    : 'hover:bg-green-50'
                }`}
                style={{ 
                  color: userAction === 'like' ? '#059669' : '#10B981',
                  transform: userAction === 'like' ? 'scale(1.1)' : 'scale(1)'
                }}
                title={userAction === 'like' ? '已標記為有幫助' : '這則回答有幫助'}
                aria-label={userAction === 'like' ? '已標記為有幫助' : '這則回答有幫助'}
              >
                <svg 
                  className="w-5 h-5" 
                  fill={userAction === 'like' ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </button>
              <button
                onClick={() => {
                  console.log('[QACard] 點擊了「沒幫助」', { question, answer, log_id, faq_id })
                  logAction('dislike')
                }}
                className={`p-2 rounded-md transition-all ${
                  userAction === 'dislike' 
                    ? 'bg-red-100 scale-110' 
                    : 'hover:bg-red-50'
                }`}
                style={{ 
                  color: userAction === 'dislike' ? '#DC2626' : '#EF4444',
                  transform: userAction === 'dislike' ? 'scale(1.1)' : 'scale(1)'
                }}
                title={userAction === 'dislike' ? '已標記為沒幫助' : '這則回答沒幫助'}
                aria-label={userAction === 'dislike' ? '已標記為沒幫助' : '這則回答沒幫助'}
              >
                <svg 
                  className="w-5 h-5" 
                  fill={userAction === 'dislike' ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 019.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 導出類型
export type { QACardProps, QACardConfig } from '@/types/qa-card'
