'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { topicApi } from '@/lib/api/topic'
import { Button } from '@/components/ui/button'
import { useNotification } from '@/hooks/useNotification'

interface BulkUploadViewProps {
  chatbotId: string
  onSuccess: () => void
}

// 欄位對照表（flexible schema mapping）
const FIELD_ALIASES = {
  question: ['question', '問題', '題目', '問', 'ques', 'q', 'q:', '問題：'],
  answer: ['answer', '答案', '回答', 'ans', 'a', 'a:', '答案：', '回答：'],
  synonym: ['synonym', '同義詞', '別名', '同義問法', 'synonyms', '別名：', '同義詞：', '標籤', 'tag', 'tags', '標籤：'],
  topic_name: ['topic', '分類', '類別', '主題', 'topic_name', 'category', '分類：', '類別：', '主題：'],
}

// 系統欄位定義（會在組件內動態翻譯）
const SYSTEM_FIELDS = [
  { key: 'question', labelKey: 'question', required: true },
  { key: 'answer', labelKey: 'answer', required: true },
  { key: 'synonym', labelKey: 'synonyms', required: false },
  { key: 'topic_name', labelKey: 'topic', required: false },
]

interface ParsedRow {
  [key: string]: string | number | null
}

interface FieldMapping {
  sourceField: string
  targetField: string | null
}

interface ValidationError {
  row: number
  field: string
  message: string
}

interface UploadResult {
  success: boolean
  question: string
  answer: string
  faq_id?: string
  error?: string
  skipped?: boolean
  skip_reason?: string
}

export default function BulkUploadView({
  chatbotId,
  onSuccess,
}: BulkUploadViewProps) {
  const t = useTranslations('knowledge')
  const tBulk = useTranslations('knowledge.bulkUpload')
  const notify = useNotification()
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [uploadStats, setUploadStats] = useState<{
    success: number
    skipped: number
    failed: number
    total: number
  } | null>(null)
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [showUploadDetails, setShowUploadDetails] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 自動偵測欄位對應
  const detectFieldMapping = (fieldName: string): string | null => {
    const normalizedField = fieldName.trim().toLowerCase()
    
    for (const [systemField, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.some(alias => normalizedField === alias.toLowerCase() || normalizedField.includes(alias.toLowerCase()))) {
        return systemField
      }
    }
    
    return null
  }

  // 解析 CSV
  const parseCSV = async (file: File): Promise<ParsedRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          let text = e.target?.result as string
          
          // 移除 BOM
          if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1)
          }
          
          const parseResult = Papa.parse<ParsedRow>(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            delimiter: ',',
            quoteChar: '"',
            escapeChar: '"',
          })

          if (parseResult.errors.length > 0) {
            const criticalErrors = parseResult.errors.filter(err => 
              err.type === 'Quotes' || err.type === 'Delimiter' || err.type === 'FieldMismatch'
            )
            if (criticalErrors.length > 0) {
              reject(new Error(tBulk('csvParseError', { message: criticalErrors.map(e => e.message).join(', ') })))
              return
            }
          }

          resolve(parseResult.data.filter(row => {
            return Object.values(row).some(val => val && String(val).trim().length > 0)
          }))
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error(tBulk('readFileFailed')))
      reader.readAsText(file, 'UTF-8')
    })
  }

  // 解析 XLSX
  const parseXLSX = async (file: File): Promise<ParsedRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          
          const firstSheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[firstSheetName]
          
          const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, {
            defval: null,
            raw: false,
          })

          resolve(jsonData.filter(row => {
            return Object.values(row).some(val => val && String(val).trim().length > 0)
          }))
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error(tBulk('readFileFailed')))
      reader.readAsBinaryString(file)
    })
  }

  // 解析檔案（CSV 或 XLSX）
  const parseFile = async (file: File): Promise<ParsedRow[]> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    if (fileExtension === 'csv') {
      return parseCSV(file)
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      return parseXLSX(file)
    } else {
      throw new Error(tBulk('unsupportedFormat'))
    }
  }

  // 處理檔案選擇
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
      notify.error(tBulk('selectCsvOrXlsx'))
      e.target.value = ''
      return
    }

    setSelectedFile(file)
    setShowPreview(false)
    setValidationErrors([])
    setUploadMessage(null)
    setUploadResults([])
    setUploadStats(null)

    try {
      const rows = await parseFile(file)
      
      if (rows.length === 0) {
        throw new Error(tBulk('noValidDataInFile'))
      }

      const fields = Object.keys(rows[0] || {})
      setSourceFields(fields)
      setParsedRows(rows)

      const mappings: FieldMapping[] = fields.map(field => ({
        sourceField: field,
        targetField: detectFieldMapping(field),
      }))
      setFieldMappings(mappings)

      setShowPreview(true)
    } catch (error) {
      setUploadMessage({
        type: 'error',
        text: tBulk('parseFileFailed', { message: error instanceof Error ? error.message : t('error') })
      })
      setSelectedFile(null)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 驗證資料
  const validateData = (): boolean => {
    const errors: ValidationError[] = []

    const questionMapping = fieldMappings.find(m => m.targetField === 'question')
    const answerMapping = fieldMappings.find(m => m.targetField === 'answer')

    if (!questionMapping || !questionMapping.targetField) {
      errors.push({
        row: 0,
        field: 'question',
        message: tBulk('missingQuestionMapping')
      })
    }

    if (!answerMapping || !answerMapping.targetField) {
      errors.push({
        row: 0,
        field: 'answer',
        message: tBulk('missingAnswerMapping')
      })
    }

    if (errors.length > 0) {
      setValidationErrors(errors)
      return false
    }

    parsedRows.forEach((row, index) => {
      const rowNumber = index + 2

      if (questionMapping) {
        const questionValue = row[questionMapping.sourceField]
        if (!questionValue || String(questionValue).trim().length === 0) {
          errors.push({
            row: rowNumber,
            field: 'question',
            message: tBulk('missingQuestion')
          })
        }
      }

      if (answerMapping) {
        const answerValue = row[answerMapping.sourceField]
        if (!answerValue || String(answerValue).trim().length === 0) {
          errors.push({
            row: rowNumber,
            field: 'answer',
            message: tBulk('missingAnswer')
          })
        }
      }
    })

    setValidationErrors(errors)
    return errors.length === 0
  }

  // 處理 Topics：將 topic_name 轉換為 topic_id
  const processTopics = async (): Promise<Map<string, string | null>> => {
    const topicMapping = fieldMappings.find(m => m.targetField === 'topic_name')
    
    if (!topicMapping) {
      return new Map()
    }

    const existingTopics = await topicApi.getAll(chatbotId)
    
    const topicMap = new Map<string, string | null>()
    existingTopics.forEach((topic) => {
      if (topic.name) {
        topicMap.set(topic.name.trim(), topic.id)
      }
    })

    const topicNamesInFile = new Set<string>()
    parsedRows.forEach((row) => {
      const topicName = topicMapping ? String(row[topicMapping.sourceField] || '').trim() : ''
      if (topicName) {
        topicNamesInFile.add(topicName)
      }
    })

    for (const topicName of Array.from(topicNamesInFile)) {
      if (topicMap.has(topicName)) {
        continue
      }

      try {
        const newTopic = await topicApi.create({
          chatbotId,
          name: topicName,
          sortOrder: 0,
        })
        topicMap.set(topicName, newTopic.id)
      } catch (error: any) {
        console.error(`創建 Topic "${topicName}" 時發生錯誤:`, error)
        // 如果創建失敗，可能是因為重複，重新查詢
        const retryTopics = await topicApi.getAll(chatbotId)
        const foundTopic = retryTopics.find(t => t.name === topicName)
        if (foundTopic) {
          topicMap.set(topicName, foundTopic.id)
        }
      }
    }

    return topicMap
  }

  const transformData = (topicMap: Map<string, string | null>) => {
    const faqList = parsedRows.map((row) => {
      const questionMapping = fieldMappings.find(m => m.targetField === 'question')
      const answerMapping = fieldMappings.find(m => m.targetField === 'answer')
      const synonymMapping = fieldMappings.find(m => m.targetField === 'synonym')
      const topicMapping = fieldMappings.find(m => m.targetField === 'topic_name')

      const topicName = topicMapping ? String(row[topicMapping.sourceField] || '').trim() : ''
      const topicId = topicName ? (topicMap.get(topicName) || null) : null

      const question = questionMapping ? String(row[questionMapping.sourceField] || '').trim() : ''
      const synonym = synonymMapping ? String(row[synonymMapping.sourceField] || '').trim() : ''

      return {
        question: question,
        answer: answerMapping ? String(row[answerMapping.sourceField] || '').trim() : '',
        synonym: synonym || '',
        topicId: topicId,
        status: 'active' as const
      }
    }).filter(item => item.question && item.answer)

    return faqList
  }

  // 批量上傳
  const handleBatchUpload = async () => {
    if (!selectedFile || !showPreview) {
      setUploadMessage({ type: 'error', text: tBulk('selectFileFirst') })
      return
    }

    if (!validateData()) {
      setUploadMessage({
        type: 'error',
        text: tBulk('validationFailed', { count: validationErrors.length })
      })
      return
    }

    setIsUploading(true)
    setUploadMessage(null)
    setUploadResults([])
    setUploadStats(null)

    try {
      const topicMap = await processTopics()
      const faqList = transformData(topicMap)

      if (faqList.length === 0) {
        throw new Error(tBulk('noValidData'))
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
      const response = await fetch(`${API_URL}/faqs/bulk-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatbotId,
          faqs: faqList
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      const convertedResults: UploadResult[] = (result.results || []).map((r: any) => ({
        success: r.success,
        question: r.question,
        answer: r.answer,
        faq_id: r.faq_id,
        error: r.error,
        skipped: r.skipped || false,
        skip_reason: r.skip_reason
      }))
      setUploadResults(convertedResults)

      const skippedCount = result.skipped_count || 0
      const successCount = result.success_count || 0
      const failedCount = result.failed_count || 0
      const totalCount = result.total_count || 0

      setUploadStats({
        success: successCount,
        skipped: skippedCount,
        failed: failedCount,
        total: totalCount,
      })

      if (result.success) {
        setUploadMessage({ 
          type: 'success', 
          text: tBulk('uploadComplete')
        })
        setSelectedFile(null)
        setShowPreview(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        if (onSuccess) {
          onSuccess()
        }
      } else {
        setUploadMessage({ 
          type: 'error', 
          text: tBulk('uploadPartialFailed')
        })
      }
    } catch (error) {
      console.error('批量上傳錯誤:', error)
      const errorMsg = error instanceof Error ? error.message : tBulk('uploadFailed')
      setErrorModalMessage(`❌ ${tBulk('uploadFailed')}\n\n${errorMsg}`)
      setShowErrorModal(true)
    } finally {
      setIsUploading(false)
    }
  }

  // 更新欄位對應
  const updateFieldMapping = (sourceField: string, targetField: string | null) => {
    setFieldMappings(prev => {
      const updated = prev.map(m => {
        if (m.sourceField === sourceField) {
          return { ...m, targetField }
        } else if (targetField && m.targetField === targetField) {
          return { ...m, targetField: null }
        }
        return m
      })
      return updated
    })
    setValidationErrors([])
  }

  // 處理拖放
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase()
      if (!['csv', 'xlsx', 'xls'].includes(fileExtension || '')) {
        notify.error(tBulk('selectCsvOrXlsx'))
        return
      }
      // 觸發檔案選擇
      const fakeEvent = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>
      await handleFileChange(fakeEvent)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  return (
    <div>
      <div className="space-y-6 relative">
        {/* 處理狀態訊息窗 */}
        <AnimatePresence>
          {isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center rounded-lg"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="bg-white rounded-2xl shadow-2xl px-6 py-5 flex items-center space-x-4 max-w-sm mx-4"
              >
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                <div className="flex-1">
                  <p className="text-base font-semibold text-text mb-1">{tBulk('processing')}</p>
                  <p className="text-sm text-label">{tBulk('pleaseWait')}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 檔案上傳區域 */}
        {!selectedFile ? (
          <div>

            {/* 拖放區域 */}
            <label className="block cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="relative border-2 border-dashed border-primary/30 rounded-lg p-12 bg-gradient-to-br from-primary/5 via-white to-primary/5 hover:border-primary/50 hover:bg-gradient-to-br hover:from-primary/10 hover:via-white hover:to-primary/10 transition-all duration-200"
              >
                <div className="flex flex-col items-center justify-center space-y-6">
                  {/* 雲朵圖標 */}
                  <div className="w-20 h-20 text-primary">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                    </svg>
                  </div>

                  {/* 拖放文字 */}
                  <div className="text-center">
                    <p className="text-lg font-medium text-text mb-2">
                      {tBulk('dragDropFile')}
                    </p>
                    
                    {/* OR 分隔符 */}
                    <div className="flex items-center justify-center my-4">
                      <div className="flex-1 border-t border-border"></div>
                      <span className="px-4 text-sm font-bold text-label">OR</span>
                      <div className="flex-1 border-t border-border"></div>
                    </div>

                    {/* Browse Files 按鈕 */}
                    <div className="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 inline-block">
                      {tBulk('browseFiles')}
                    </div>
                  </div>

                  {/* 支援格式提示 */}
                  <p className="text-sm text-label">
                    {tBulk('supportedFormats')}
                  </p>
                </div>
              </div>
            </label>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-text mb-3">
              {tBulk('fileSelected')}
            </label>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-label bg-grey px-4 py-2 rounded-lg border border-border">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium text-text">{selectedFile.name}</span>
                <span className="text-label">({(selectedFile.size / 1024).toFixed(2)} KB)</span>
                <button
                  onClick={() => {
                    setSelectedFile(null)
                    setShowPreview(false)
                    setParsedRows([])
                    setSourceFields([])
                    setFieldMappings([])
                    setValidationErrors([])
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                  className="ml-2 text-red-600 hover:text-red-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 欄位對應確認 */}
        {showPreview && sourceFields.length > 0 && (
          <div className="border border-primary/20 rounded-lg p-4 bg-gradient-to-br from-primary/5 to-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-primary/10 rounded flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-text">{tBulk('fieldMapping')}</h3>
            </div>
            <div className="space-y-2">
              {sourceFields.map((sourceField) => {
                const mapping = fieldMappings.find(m => m.sourceField === sourceField)
                return (
                  <div key={sourceField} className="flex items-center space-x-3 bg-white px-3 py-2 rounded-lg border border-primary/20 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex-1 text-base font-medium text-text">
                      {sourceField}
                    </div>
                    <div className="text-base text-primary font-bold">→</div>
                    <div className="w-48">
                      <select
                        value={mapping?.targetField || ''}
                        onChange={(e) => updateFieldMapping(sourceField, e.target.value || null)}
                        className="w-full px-2.5 py-1.5 text-base border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                      >
                        <option value="">{tBulk('ignoreField')}</option>
                        {SYSTEM_FIELDS.map(field => {
                          const isUsed = fieldMappings.some(
                            m => m.sourceField !== sourceField && m.targetField === field.key
                          )
                          const isCurrent = mapping?.targetField === field.key
                          return (
                            <option 
                              key={field.key} 
                              value={field.key}
                              disabled={isUsed && !isCurrent}
                            >
                              {t(field.labelKey)} {field.required && <span className="text-red-500">*</span>}
                              {isUsed && !isCurrent && ` (${tBulk('fieldUsed')})`}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 資料預覽 */}
        {showPreview && parsedRows.length > 0 && (
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text">
                {tBulk('dataPreview')} ({parsedRows.length} {tBulk('rows')})
              </h3>
                  {validationErrors.length > 0 && (
                <span className="text-sm text-red-600">
                  {validationErrors.length} {tBulk('errors')}
                </span>
              )}
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full text-xs border-collapse">
                <thead className="bg-grey sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left border border-border font-semibold text-text">{tBulk('rowNumber')}</th>
                    {sourceFields.map(field => (
                      <th key={field} className="px-2 py-2 text-left border border-border font-semibold text-text">
                        {field}
                        {fieldMappings.find(m => m.sourceField === field)?.targetField && (
                          <span className="ml-1 text-primary">
                            ({SYSTEM_FIELDS.find(f => f.key === fieldMappings.find(m => m.sourceField === field)?.targetField) && t(SYSTEM_FIELDS.find(f => f.key === fieldMappings.find(m => m.sourceField === field)?.targetField)!.labelKey)})
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 10).map((row, index) => {
                    const rowNumber = index + 2
                    const rowErrors = validationErrors.filter(e => e.row === rowNumber)
                    return (
                      <tr 
                        key={index}
                        className={rowErrors.length > 0 ? 'bg-red-50' : ''}
                      >
                        <td className="px-2 py-2 border border-border font-medium text-label">
                          {rowNumber}
                          {rowErrors.length > 0 && (
                            <span className="ml-1 text-red-600" title={rowErrors.map(e => e.message).join(', ')}>
                              ⚠️
                            </span>
                          )}
                        </td>
                        {sourceFields.map(field => (
                          <td key={field} className="px-2 py-2 border border-border text-text max-w-xs truncate">
                            {row[field] !== null && row[field] !== undefined ? String(row[field]) : ''}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {parsedRows.length > 10 && (
                    <tr>
                      <td colSpan={sourceFields.length + 1} className="px-2 py-2 text-center text-label text-xs">
                        ... {tBulk('moreRows', { count: parsedRows.length - 10 })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 驗證錯誤列表 */}
        {validationErrors.length > 0 && (
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <h3 className="text-sm font-semibold text-red-900 mb-2">{tBulk('validationErrors')}</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {validationErrors.map((error, index) => (
                <div key={index} className="text-sm text-red-700">
                  {tBulk('rowError', { row: error.row, message: error.message })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload 按鈕 */}
        <div className="flex justify-end pt-6 border-t border-border">
          <Button
            onClick={handleBatchUpload}
            disabled={!selectedFile || !showPreview || validationErrors.length > 0}
            isLoading={isUploading}
            variant="primary"
            size="lg"
          >
            {isUploading ? tBulk('uploading') : tBulk('upload')}
          </Button>
        </div>

        {/* 上傳結果 */}
        {(uploadResults.length > 0 || uploadStats) && (
          <div className="mt-6 border-t border-border pt-6">
            {uploadMessage && uploadStats && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`mb-6 p-6 rounded-xl shadow-sm border-2 ${
                  uploadMessage.type === 'success' 
                    ? 'bg-gradient-to-r from-primary/5 to-primary/10 border-primary/30' 
                    : 'bg-gradient-to-r from-red-50 to-red-100/50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <h3 className={`text-xl font-bold mb-5 ${
                      uploadMessage.type === 'success' 
                        ? 'text-primary' 
                        : 'text-red-700'
                    }`}>
                      {uploadMessage.text}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/80 rounded-lg p-4 border border-primary/20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                          <span className="text-base font-medium text-label">{tBulk('added')}:</span>
                          <span className="text-2xl font-bold text-text ml-auto">{uploadStats.success}</span>
                          <span className="text-base text-label"> {tBulk('rows')}</span>
                        </div>
                      </div>
                      <div className="bg-white/80 rounded-lg p-4 border border-primary/20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                          <span className="text-base font-medium text-label">{tBulk('skipped')}:</span>
                          <span className="text-2xl font-bold text-text ml-auto">{uploadStats.skipped}</span>
                          <span className="text-base text-label"> {tBulk('rows')}</span>
                        </div>
                      </div>
                      <div className="bg-white/80 rounded-lg p-4 border border-primary/20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                          <span className="text-base font-medium text-label">{tBulk('failed')}:</span>
                          <span className="text-2xl font-bold text-text ml-auto">{uploadStats.failed}</span>
                          <span className="text-base text-label"> {tBulk('rows')}</span>
                        </div>
                      </div>
                      <div className="bg-white/80 rounded-lg p-4 border border-primary/20 shadow-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                          <span className="text-base font-medium text-label">{tBulk('total')}:</span>
                          <span className="text-2xl font-bold text-text ml-auto">{uploadStats.total}</span>
                          <span className="text-base text-label"> {tBulk('rows')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text">{tBulk('uploadDetails')}</h3>
              <button
                onClick={() => setShowUploadDetails(!showUploadDetails)}
                className="text-sm text-primary hover:text-primary/80 flex items-center space-x-1"
              >
                <span>{showUploadDetails ? tBulk('hideDetails') : tBulk('showDetails')}</span>
                <svg 
                  className={`w-4 h-4 transition-transform ${showUploadDetails ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {showUploadDetails && (() => {
              const failedResults = uploadResults.filter(r => !r.success && !r.skipped)
              const skippedResults = uploadResults.filter(r => r.skipped)
              const successResults = uploadResults.filter(r => r.success)
              
              const MAX_DISPLAY = 50
              const displayFailed = failedResults.slice(0, MAX_DISPLAY)
              const displaySkipped = skippedResults.slice(0, MAX_DISPLAY)
              
              return (
                <div className="space-y-4">
                  {failedResults.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-red-700">
                          {tBulk('failedItems')} ({failedResults.length})
                        </h4>
                        {failedResults.length > MAX_DISPLAY && (
                          <span className="text-xs text-label">
                            {tBulk('showingFirst', { display: MAX_DISPLAY, total: failedResults.length })}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {displayFailed.map((result, index) => (
                          <div 
                            key={`failed-${index}`}
                            className="p-3 rounded-lg text-sm bg-red-50 border border-red-200"
                          >
                            <div className="flex items-start space-x-2">
                              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              <div className="flex-1">
                                <p className="font-medium text-red-800">
                                  {tBulk('question')}: {result.question}
                                </p>
                                {result.error && (
                                  <p className="text-red-700 text-xs mt-1">{tBulk('error')}: {result.error}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {skippedResults.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-yellow-700">
                          {tBulk('skippedItems')} ({skippedResults.length})
                        </h4>
                        {skippedResults.length > MAX_DISPLAY && (
                          <span className="text-xs text-label">
                            {tBulk('showingFirst', { display: MAX_DISPLAY, total: skippedResults.length })}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {displaySkipped.map((result, index) => (
                          <div 
                            key={`skipped-${index}`}
                            className="p-3 rounded-lg text-sm bg-yellow-50 border border-yellow-200"
                          >
                            <div className="flex items-start space-x-2">
                              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div className="flex-1">
                                <p className="font-medium text-yellow-800">
                                  {tBulk('question')}: {result.question}
                                </p>
                                {result.skip_reason && (
                                  <p className="text-yellow-700 text-xs mt-1">⚠️ {result.skip_reason}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {successResults.length > 20 && (
                    <div className="text-center py-2 text-sm text-label">
                      {tBulk('successItemsHidden', { count: successResults.length })}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* 錯誤 Modal */}
        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-white">上傳失敗</h3>
                  </div>
                  <button
                    onClick={() => setShowErrorModal(false)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-700 whitespace-pre-line">{errorModalMessage}</p>
              </div>

              <div className="bg-grey px-6 py-4 flex items-center justify-end">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                >
                  確定
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
