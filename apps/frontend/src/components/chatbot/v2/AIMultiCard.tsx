'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Modal from '@/components/ui/Modal'
import { ModalButton } from '@/components/ui/ModalButton'
import AICardItem, { AICardDraft } from '@/components/chatbot/v2/AICardItem'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface AIMultiCardProps {
  isOpen: boolean
  onClose: () => void
  chatbotId: string
  onQnACardOpen?: (mode: 'create' | 'edit', faqData?: any, onSaveSuccess?: (cardId: string) => void) => void
  onRefresh?: () => void
  inModal?: boolean
  initialContent?: string
}

export default function AIMultiCard({ 
  isOpen, 
  onClose, 
  chatbotId, 
  onQnACardOpen, 
  onRefresh, 
  inModal = true, 
  initialContent 
}: AIMultiCardProps) {
  const t = useTranslations('aiCards')
  const tCommon = useTranslations('common')
  
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [cards, setCards] = useState<AICardDraft[]>([])
  const [currentEditingCard, setCurrentEditingCard] = useState<AICardDraft | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [showUrlModal, setShowUrlModal] = useState(false)
  const [tokenUsage, setTokenUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null)
  const [costInfo, setCostInfo] = useState<{ input_cost: number; output_cost: number; total_cost: number; input_price_per_million: number; output_price_per_million: number } | null>(null)
  const [cardCount, setCardCount] = useState<number>(1)
  const [regeneratingCardId, setRegeneratingCardId] = useState<string | null>(null)
  
  useEffect(() => {
    if (isOpen && initialContent) {
      setInputText(initialContent)
    }
    // 不在關閉時清空資料，保留用戶的輸入
  }, [isOpen, initialContent])

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      alert(t('enterContent'))
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch(`${API_URL}/ai/generate-cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbot_id: chatbotId,
          content: inputText,
          card_count: cardCount
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.cards) {
          const timestamp = Date.now()
          const newCards: AICardDraft[] = result.cards.map((card: any, index: number) => ({
            id: `draft_${timestamp}_${index}_${Math.random().toString(36).substr(2, 9)}`,
            question: (card.question || '').trim(),
            answer: (card.answer || '').trim(),
            isSaved: false
          }))
          setCards(newCards)
          
          if (result.usage) {
            setTokenUsage({
              prompt_tokens: result.usage.prompt_tokens || 0,
              completion_tokens: result.usage.completion_tokens || 0,
              total_tokens: result.usage.total_tokens || 0
            })
          } else {
            setTokenUsage(null)
          }
          
          if (result.cost) {
            setCostInfo({
              input_cost: result.cost.input_cost || 0,
              output_cost: result.cost.output_cost || 0,
              total_cost: result.cost.total_cost || 0,
              input_price_per_million: result.cost.input_price_per_million || 0,
              output_price_per_million: result.cost.output_price_per_million || 0
            })
          } else {
            setCostInfo(null)
          }
        } else {
          generateMockCards()
        }
      } else {
        generateMockCards()
      }
    } catch (error) {
      console.error('[AIMultiCard] 生成卡片失敗:', error)
      generateMockCards()
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerateCard = async (cardId: string, title: string) => {
    if (!title.trim()) {
      alert(t('enterCardTitle'))
      return
    }

    if (!inputText.trim()) {
      alert(t('enterContentFirst'))
      return
    }

    setRegeneratingCardId(cardId)
    try {
      const response = await fetch(`${API_URL}/ai/generate-card-from-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbot_id: chatbotId,
          title: title.trim(),
          content: inputText
        })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.answer) {
          setCards(cards.map(card =>
            card.id === cardId
              ? { ...card, answer: result.answer, question: title.trim() }
              : card
          ))
          
          if (result.usage) {
            setTokenUsage({
              prompt_tokens: (tokenUsage?.prompt_tokens || 0) + (result.usage.prompt_tokens || 0),
              completion_tokens: (tokenUsage?.completion_tokens || 0) + (result.usage.completion_tokens || 0),
              total_tokens: (tokenUsage?.total_tokens || 0) + (result.usage.total_tokens || 0)
            })
          }
          
          if (result.cost) {
            const currentTotalCost = costInfo?.total_cost || 0
            setCostInfo({
              input_cost: (costInfo?.input_cost || 0) + (result.cost.input_cost || 0),
              output_cost: (costInfo?.output_cost || 0) + (result.cost.output_cost || 0),
              total_cost: currentTotalCost + (result.cost.total_cost || 0),
              input_price_per_million: result.cost.input_price_per_million || costInfo?.input_price_per_million || 0,
              output_price_per_million: result.cost.output_price_per_million || costInfo?.output_price_per_million || 0
            })
          }
        } else {
          alert(result.message || t('generateFailed'))
        }
      } else {
        alert(t('generateFailed'))
      }
    } catch (error) {
      console.error('[AIMultiCard] 重新生成內容失敗:', error)
      alert(t('generateFailed'))
    } finally {
      setRegeneratingCardId(null)
    }
  }

  const generateMockCards = () => {
    const paragraphs = inputText.split('\n\n').filter(p => p.trim().length > 50)
    const timestamp = Date.now()
    const mockCards: AICardDraft[] = paragraphs.slice(0, cardCount).map((para, index) => {
      const lines = para.split('\n').filter(l => l.trim())
      const question = lines[0]?.substring(0, 100) || `${t('question')} ${index + 1}`
      const answer = para.substring(0, 500)
      
      return {
        id: `draft_${timestamp}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        question,
        answer,
        isSaved: false
      }
    })
    setCards(mockCards)
  }

  const handleTitleChange = (cardId: string, newTitle: string) => {
    setCards(cards.map(card => 
      card.id === cardId ? { ...card, question: newTitle } : card
    ))
  }

  const handleDeleteCard = (cardId: string) => {
    if (confirm(t('confirmDelete'))) {
      setCards(cards.filter(card => card.id !== cardId))
    }
  }

  const handleEditAndSave = (card: AICardDraft) => {
    console.log('[AIMultiCard] 編輯卡片:', card)
    if (onQnACardOpen) {
      // 定義儲存成功的回調函數
      const onSaveSuccess = (cardId: string) => {
        console.log('[AIMultiCard] 卡片儲存成功:', cardId)
        // 只有在真正儲存成功後，才標記為已儲存
        setCards(cards.map(c =>
          c.id === cardId ? { ...c, isSaved: true } : c
        ))
        
        // 通知父組件刷新
        if (onRefresh) {
          setTimeout(() => onRefresh(), 500)
        }
      }
      
      // 打開編輯器，並傳入回調函數
      onQnACardOpen('create', {
        question: card.question || '',
        answer: card.answer || '',
        status: 'active',
        _aiCardId: card.id  // 傳遞卡片 ID，用於識別
      }, onSaveSuccess)
    }
  }

  const handleLoadFromUrl = async () => {
    if (!urlInput.trim()) {
      setUrlError(t('enterUrl'))
      return
    }

    try {
      new URL(urlInput.trim())
    } catch {
      setUrlError(t('invalidUrl'))
      return
    }

    setIsLoadingUrl(true)
    setUrlError(null)

    try {
      const response = await fetch(`${API_URL}/ai/fetch-web-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput.trim()
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.success && result.content) {
          const content = result.content
          if (content.length > 10000) {
            const truncated = content.substring(0, 10000)
            setInputText(truncated)
            alert(t('contentTruncated', { length: content.length }))
          } else {
            setInputText(content)
          }
          setUrlInput('')
          setUrlError(null)
          setShowUrlModal(false)
        } else {
          setUrlError(result.message || t('loadFailed'))
        }
      } else {
        let errorMessage = `HTTP ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch {
          const text = await response.text().catch(() => '')
          if (text) {
            errorMessage = text.substring(0, 200)
          }
        }
        setUrlError(errorMessage)
      }
    } catch (error) {
      console.error('[AIMultiCard] 載入 URL 失敗:', error)
      setUrlError(t('loadFailed'))
    } finally {
      setIsLoadingUrl(false)
    }
  }

  const handleClose = () => {
    // 不清空資料，保留用戶的輸入和生成的卡片
    onClose()
  }

  const content = (
    <div className="flex flex-col gap-4 h-full overflow-y-auto">
      <div className="flex flex-col bg-white rounded-lg shadow-md border border-grey-200 overflow-hidden">
          <div className="px-6 py-4 bg-primary-50 border-b border-primary-200 flex items-center justify-between flex-shrink-0 h-16">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-text">{t('originalContent')}</h3>
            <button
              onClick={() => setShowUrlModal(true)}
              className="p-1.5 text-label hover:text-primary hover:bg-primary-100 rounded transition-colors"
              title={t('loadFromUrl')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
              disabled={isGenerating}
              className="px-4 py-2 text-sm border border-grey-250 rounded-full focus:ring-2 focus:ring-primary focus:border-transparent bg-white h-[34px]"
            >
              <option value={1}>1 {t('cards')}</option>
              <option value={2}>2 {t('cards')}</option>
              <option value={3}>3 {t('cards')}</option>
              <option value={5}>5 {t('cards')}</option>
              <option value={10}>10 {t('cards')}</option>
            </select>
            <ModalButton
              onClick={handleGenerate}
              disabled={!inputText.trim() || isGenerating}
              isLoading={isGenerating}
              className="!px-4 !py-2 !text-sm !h-[34px]"
            >
              {isGenerating ? t('generating') : t('generateCards')}
            </ModalButton>
            <button
              onClick={() => {
                setCards([])
                setInputText('')
                setTokenUsage(null)
                setCostInfo(null)
              }}
              className="p-1.5 text-label hover:text-primary hover:bg-primary-100 rounded transition-colors"
              title={tCommon('clear')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => {
            const newValue = e.target.value
            if (newValue.length > 10000) {
              setInputText(newValue.substring(0, 10000))
              alert(t('contentLimitExceeded'))
            } else {
              setInputText(newValue)
            }
          }}
          placeholder={t('contentPlaceholder')}
          className="m-6 px-4 py-3 border border-grey-250 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-y text-sm text-content-text whitespace-pre-wrap"
          style={{ height: '200px', minHeight: '100px' }}
        />
        {inputText.length > 0 && (
          <div className="px-6 pb-4 text-xs text-label/60">
            {t('contentLength')}: {inputText.length.toLocaleString()} {t('characters')}
            {inputText.length > 10000 && (
              <span className="text-amber-600 ml-2">{t('contentWillBeTruncated')}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-md border border-grey-200 overflow-hidden">
              <div className="px-6 py-4 bg-primary-50 border-b border-primary-200 flex items-center justify-between flex-shrink-0 h-16">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-text whitespace-nowrap">
                    {t('aiSuggestions')}
                  </h3>
            {tokenUsage && (
              <div className="text-xs text-label/60 flex items-center gap-2 whitespace-nowrap overflow-hidden">
                <span className="text-label">
                  Input: {tokenUsage.prompt_tokens.toLocaleString()}
                </span>
                <span className="text-label/40">|</span>
                <span className="text-label">
                  Output: {tokenUsage.completion_tokens.toLocaleString()}
                </span>
                {costInfo && (
                  <>
                    <span className="text-label/40">|</span>
                    <span className="px-2 py-0.5 bg-primary-100 text-primary rounded font-medium">
                      ${costInfo.total_cost.toFixed(6)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {cards.length > 0 ? (
            cards.map((card) => (
              <AICardItem
                key={card.id}
                card={card}
                onTitleChange={handleTitleChange}
                onDelete={handleDeleteCard}
                onEditAndSave={handleEditAndSave}
                onRegenerate={handleRegenerateCard}
                isRegenerating={regeneratingCardId === card.id}
              />
            ))
          ) : (
            <div className="text-sm text-label/40 text-center py-8">
              {t('emptyState')}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {inModal ? (
        <Modal
          isOpen={isOpen}
          onClose={handleClose}
          title={t('title')}
          subtitle={t('subtitle')}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
          maxWidth="full"
          className="h-[90vh] flex flex-col"
          closeOnBackdropClick={false}
          closeButtonTitle={tCommon('cancel')}
        >
          <div className="overflow-hidden -mx-8 -my-8 p-4 h-full">
            {content}
          </div>
        </Modal>
      ) : (
        isOpen && content
      )}

      <Modal
        isOpen={showUrlModal}
        onClose={() => {
          setShowUrlModal(false)
          setUrlInput('')
          setUrlError(null)
        }}
        title={t('loadFromUrlTitle')}
        subtitle={t('loadFromUrlSubtitle')}
        icon={
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        }
        maxWidth="md"
        closeButtonTitle={tCommon('cancel')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-label mb-2">
              {t('urlLabel')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  setUrlError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoadingUrl) {
                    handleLoadFromUrl()
                  }
                }}
                placeholder="https://example.com/article"
                className="flex-1 px-3 py-2 text-sm border border-grey-250 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                disabled={isLoadingUrl}
                autoFocus
              />
              {urlInput && (
                <button
                  onClick={() => {
                    setUrlInput('')
                    setUrlError(null)
                  }}
                  className="px-2 py-2 text-sm text-label/60 hover:text-label"
                  title={tCommon('clear')}
                  disabled={isLoadingUrl}
                >
                  ✕
                </button>
              )}
            </div>
            {urlError && (
              <div className="mt-2 text-xs text-red-600">
                {urlError}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowUrlModal(false)
                setUrlInput('')
                setUrlError(null)
              }}
              className="px-4 py-2 text-sm text-label bg-grey rounded-lg hover:bg-grey-200 transition-colors"
              disabled={isLoadingUrl}
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleLoadFromUrl}
              disabled={!urlInput.trim() || isLoadingUrl}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:bg-disabled disabled:cursor-not-allowed transition-colors"
            >
              {isLoadingUrl ? t('loading') : t('load')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
