'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

interface MarkdownRendererProps {
  content: string
  isUser?: boolean
}

export default function MarkdownRenderer({ 
  content, 
  isUser = false
}: MarkdownRendererProps) {
  const markdownComponents = React.useMemo(() => ({
    p: ({ children }: any) => (
      <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
    ),
    ul: ({ children }: any) => <ul className="mb-3 last:mb-0 pl-4 list-disc">{children}</ul>,
    ol: ({ children }: any) => <ol className="mb-3 last:mb-0 pl-4 list-decimal">{children}</ol>,
    li: ({ children }: any) => <li className="mb-1">{children}</li>,
    code: ({ inline, children }: any) => 
      inline ? (
        <code className={`px-1 py-0.5 rounded text-xs font-mono ${
          isUser ? 'bg-blue-500 bg-opacity-50' : 'bg-gray-200'
        }`}>{children}</code>
      ) : (
        <code className={`block px-3 py-2 rounded text-xs font-mono my-2 overflow-x-auto ${
          isUser ? 'bg-blue-500 bg-opacity-50' : 'bg-gray-200'
        }`}>{children}</code>
      ),
    pre: ({ children }: any) => <pre className="mb-3 last:mb-0">{children}</pre>,
    strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }: any) => <em className="italic">{children}</em>,
    a: ({ children, href }: any) => {
      if (!href) {
        return <span>{children}</span>
      }
      
      const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
          return
        } else if (href.startsWith('localhost:') || href.startsWith('127.0.0.1:')) {
          e.preventDefault()
          window.open(`http://${href}`, '_blank', 'noopener,noreferrer')
        } else if (href.startsWith('/')) {
          e.preventDefault()
          window.location.href = href
        } else {
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
          style={{
            wordBreak: 'break-all',
            overflowWrap: 'anywhere',
            maxWidth: '100%',
            cursor: 'pointer',
            color: '#2563eb',
            textDecoration: 'underline',
          }}
        >
          {children || href}
        </a>
      )
    },
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold mb-2 mt-3 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-bold mb-2 mt-3 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-bold mb-2 mt-3 first:mt-0">
        {children}
      </h3>
    ),
    hr: () => (
      <div className={`my-4 h-px ${isUser ? 'bg-blue-400' : 'bg-gray-300'}`} />
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 italic my-2">
        {children}
      </blockquote>
    ),
    img: ({ src, alt }: any) => {
      if (!src) return null
      
      return (
        <img
          src={src}
          alt={alt || '圖片'}
          className="my-3 rounded-lg max-w-full h-auto"
          style={{
            maxHeight: '400px',
            display: 'block',
            margin: '0.75rem auto',
          }}
          onError={(e) => {
            console.error('[MarkdownRenderer] 圖片載入失敗:', src)
            const target = e.currentTarget
            target.style.display = 'none'
          }}
        />
      )
    },
  }), [isUser])
  
  return (
    <div 
      className={`markdown-content prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}
      style={{
        userSelect: 'text',
        WebkitUserSelect: 'text',
        cursor: 'text',
      }}
    >
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
