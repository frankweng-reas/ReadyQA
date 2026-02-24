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
 * 默認樣式配置（與 types/chat.ts defaultTheme.qaCardStyle 對齊）
 */
const defaultQACardStyle = {
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E7EB',
  borderRadius: 'rounded-xl',
  padding: 'p-5',
  shadow: 'shadow-md hover:shadow-lg',
  questionColor: '#111827',
  questionFontSize: '16px',
  questionBackgroundColor: 'transparent' as string,
  questionUseGradient: false,
  questionGradientStartColor: '#3B82F6',
  questionGradientEndColor: '#8B5CF6',
  questionGradientDirection: 'to right' as const,
  answerColor: '#374151',
  answerFontSize: '14px',
  questionPrefixColor: '#2563EB',
}

/**
 * QACard - 問答卡片組件
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
  // 初始展開狀態：優先使用 initialExpanded，否則使用 alwaysExpanded
  const initialExpanded = config?.initialExpanded ?? alwaysExpanded
  // 默認收合：除非 alwaysExpanded 或 initialExpanded 為 true，否則默認不展開
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  const [hasRecordedViewed, setHasRecordedViewed] = useState(false)
  const [userAction, setUserAction] = useState<'like' | 'dislike' | null>(null) // 記錄用戶點擊的操作
  
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

  /**
   * 計算標題背景的負 margin 和 padding（用於讓背景貼邊）
   */
  const getQuestionBackgroundStyles = () => {
    const padding = cardStyle.padding || defaultQACardStyle.padding
    const paddingValueMap: Record<string, string> = {
      'p-3': '0.75rem',
      'p-4': '1rem',
      'p-5': '1.25rem',
      'p-6': '1.5rem',
    }
    const paddingValue = paddingValueMap[padding] || '1rem'
    
    return {
      marginLeft: `-${paddingValue}`,
      marginRight: `-${paddingValue}`,
      marginTop: `-${paddingValue}`,
      paddingLeft: paddingValue,
      paddingRight: paddingValue,
      paddingTop: paddingValue,
      paddingBottom: paddingValue,
      marginBottom: '0',
      // 不加邊框，讓卡片本身的邊框就是視覺邊界
    }
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
      blockquote: ({ children }: any) => (
        <blockquote className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-700">
          {children}
        </blockquote>
      ),
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
      /**
       * 自定義表格組件：支持響應式和樣式美化
       */
      table: ({ children }: any) => (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse border border-gray-300">
            {children}
          </table>
        </div>
      ),
      thead: ({ children }: any) => (
        <thead className="bg-gray-100">{children}</thead>
      ),
      tbody: ({ children }: any) => (
        <tbody>{children}</tbody>
      ),
      tr: ({ children }: any) => (
        <tr className="border-b border-gray-200 hover:bg-gray-50">
          {children}
        </tr>
      ),
      th: ({ children }: any) => (
        <th className="border border-gray-300 px-4 py-2 text-left font-semibold bg-gray-100">
          {children}
        </th>
      ),
      td: ({ children }: any) => (
        <td className="border border-gray-300 px-4 py-2">
          {children}
        </td>
      ),
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
        border: `1px solid ${borderColorValue}`,
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
            className={`font-semibold leading-relaxed ${
              // 如果有背景色或漸層，不需要 mb-2（已在 style 中設定）
              !(cardStyle.questionUseGradient || (cardStyle.questionBackgroundColor && cardStyle.questionBackgroundColor !== 'transparent')) ? 'mb-2' : ''
            } ${
              !alwaysExpanded ? 'cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-between' : ''
            }`}
            style={{ 
              color: cardStyle.questionColor || defaultQACardStyle.questionColor,
              fontSize: cardStyle.questionFontSize || defaultQACardStyle.questionFontSize,
              ...(cardStyle.questionUseGradient 
                ? {
                    background: `linear-gradient(${cardStyle.questionGradientDirection || 'to right'}, ${cardStyle.questionGradientStartColor || '#3B82F6'}, ${cardStyle.questionGradientEndColor || '#8B5CF6'})`,
                    ...getQuestionBackgroundStyles(),
                  }
                : cardStyle.questionBackgroundColor && cardStyle.questionBackgroundColor !== 'transparent'
                ? {
                    backgroundColor: cardStyle.questionBackgroundColor,
                    ...getQuestionBackgroundStyles(),
                  }
                : {}
              ),
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
      
      {/* 答案內容區域 - 根據展開狀態顯示/隱藏 */}
      {slots?.content !== undefined && slots?.content !== null && slots?.content !== false ? (
        slots.content
      ) : (
        isExpanded && (
          <div 
            className="relative transition-all duration-300 mt-3"
            style={{ 
              color: cardStyle.answerColor || defaultQACardStyle.answerColor,
              fontSize: cardStyle.answerFontSize || defaultQACardStyle.answerFontSize || '14px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              minWidth: 0,
            }}
          >
            {/* Markdown 渲染 */}
            <ReactMarkdown 
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={markdownComponents}
            >
              {/* 處理 HTML 標籤：將 <br> 轉換為換行 */}
              {answer
                .replace(/<br\s*\/?>/gi, '\n\n')
                .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
                .trim()
              }
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
        )
      )}
      
      {/* 媒體區域（可選） */}
      {slots?.media}
      
      {/* 回饋機制 - 只在展開時顯示 */}
      {isExpanded && (slots?.footer || (
        <div 
          className="mt-3 pt-2 border-t" 
          style={{ 
            borderColor: borderColorValue || '#E5E7EB',
          }}
        >
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  console.log('[QACard] 點擊了「有幫助」', { question, answer, log_id, faq_id })
                  logAction('like')
                }}
                className={`p-2 rounded-full transition-all ${
                  userAction === 'like' 
                    ? 'bg-green-100 text-green-600' 
                    : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
                }`}
                title={userAction === 'like' ? '已標記為有幫助' : '這則回答有幫助'}
                aria-label={userAction === 'like' ? '已標記為有幫助' : '這則回答有幫助'}
              >
                <svg 
                  className="w-5 h-5" 
                  fill={userAction === 'like' ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </button>
              <button
                onClick={() => {
                  console.log('[QACard] 點擊了「沒幫助」', { question, answer, log_id, faq_id })
                  logAction('dislike')
                }}
                className={`p-2 rounded-full transition-all ${
                  userAction === 'dislike' 
                    ? 'bg-red-100 text-red-600' 
                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                }`}
                title={userAction === 'dislike' ? '已標記為沒幫助' : '這則回答沒幫助'}
                aria-label={userAction === 'dislike' ? '已標記為沒幫助' : '這則回答沒幫助'}
              >
                <svg 
                  className="w-5 h-5" 
                  fill={userAction === 'dislike' ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 019.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// 導出類型
export type { QACardProps, QACardConfig } from '@/types/qa-card'
