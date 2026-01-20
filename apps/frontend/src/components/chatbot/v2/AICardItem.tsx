'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import MarkdownRenderer from '@/components/ui/MarkdownRenderer'

export interface AICardDraft {
  id: string
  question: string
  answer: string
  isSaved: boolean
  savedFaqId?: string
}

interface AICardItemProps {
  card: AICardDraft
  onTitleChange: (cardId: string, newTitle: string) => void
  onDelete: (cardId: string) => void
  onEditAndSave: (card: AICardDraft) => void
  onRegenerate: (cardId: string, title: string) => void
  isRegenerating?: boolean
}

function CardPreview({ content }: { content: string }) {
  const t = useTranslations('aiCards')
  const previewRef = useRef<HTMLDivElement>(null)
  const [needsEllipsis, setNeedsEllipsis] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (previewRef.current) {
        const element = previewRef.current
        const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 24
        const maxHeight = lineHeight * 3
        const actualHeight = element.scrollHeight
        
        setNeedsEllipsis(actualHeight > maxHeight)
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [content, isExpanded])

  return (
    <div className="relative">
      <div 
        ref={previewRef}
        className="text-sm text-content-text overflow-hidden"
        style={{ 
          wordBreak: 'break-word',
          lineHeight: '1.6',
          maxHeight: isExpanded ? 'none' : '4.8em',
          position: 'relative'
        }}
      >
        <div className="prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4 [&_li]:mb-1">
          <MarkdownRenderer content={content} />
        </div>
      </div>
      {needsEllipsis && !isExpanded && (
        <div 
          className="absolute bottom-0 right-0 inline-flex items-center"
          style={{ 
            background: 'linear-gradient(to right, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.8) 40%, rgba(255, 255, 255, 1) 100%)',
            paddingLeft: '8px',
            paddingRight: '4px',
            paddingTop: '2px',
            paddingBottom: '2px'
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(true)
            }}
            className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 cursor-pointer"
            style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.9)' }}
          >
            <span>…</span>
            <span>（{t('expand')}）</span>
          </button>
        </div>
      )}
      {isExpanded && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(false)
            }}
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
            {t('collapse')}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AICardItem({ card, onTitleChange, onDelete, onEditAndSave, onRegenerate, isRegenerating }: AICardItemProps) {
  const t = useTranslations('aiCards')
  const tCommon = useTranslations('common')
  
  return (
    <div className="bg-white border-2 border-grey-250 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
      <div className="mb-3 flex items-center gap-2 pb-3 border-b-2 border-grey-200">
        <input
          type="text"
          value={card.question}
          onChange={(e) => onTitleChange(card.id, e.target.value)}
          className="flex-1 text-base font-semibold text-text border border-grey-250 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded px-3 py-2 bg-primary-50"
          placeholder={t('cardTitlePlaceholder')}
        />
        <button
          onClick={() => onRegenerate(card.id, card.question)}
          disabled={isRegenerating || !card.question.trim()}
          className="px-3 py-2 text-sm bg-primary text-white rounded-full hover:bg-primary/90 disabled:bg-disabled disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          title={t('regenerateTitle')}
        >
          {isRegenerating ? t('generating') : t('regenerate')}
        </button>
      </div>

      <div className="mb-4">
        <CardPreview content={card.answer} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {card.isSaved && (
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('saved')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(card.id)}
            className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-full transition-colors"
          >
            {tCommon('delete')}
          </button>
          <button
            onClick={() => onEditAndSave(card)}
            disabled={card.isSaved}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded-full hover:bg-primary/90 disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
          >
            {card.isSaved ? t('saved') : t('editAndSave')}
          </button>
        </div>
      </div>
    </div>
  )
}
