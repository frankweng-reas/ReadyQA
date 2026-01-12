'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

/**
 * ConfirmDialog 選項
 */
interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

/**
 * 內部 ConfirmDialog 組件
 */
function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  type = 'danger',
  onConfirm,
  onCancel,
}: ConfirmOptions & {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const tCommon = useTranslations('common')

  if (!isOpen) return null

  const defaultConfirmText = confirmText || tCommon('confirm')
  const defaultCancelText = cancelText || tCommon('cancel')

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )
        }
      case 'warning':
        return {
          iconBg: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )
        }
      case 'info':
        return {
          iconBg: 'bg-blue-100',
          iconColor: 'text-blue-600',
          confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
          icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )
        }
    }
  }

  const typeStyles = getTypeStyles()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200">
        {/* 圖標 */}
        <div className="pt-8 pb-4 px-6">
          <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full ${typeStyles.iconBg}`}>
            <div className={typeStyles.iconColor}>
              {typeStyles.icon}
            </div>
          </div>
        </div>

        {/* 內容 */}
        <div className="px-6 pb-6 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-3">
            {title}
          </h3>
          <p className="text-base text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* 按鈕 */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-6 py-3 text-base font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
          >
            {defaultCancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-6 py-3 text-base font-medium text-white rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${typeStyles.confirmButton}`}
          >
            {defaultConfirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * useNotification Hook
 * 
 * 提供統一的通知 API：
 * - Sonner Toast：用於成功/錯誤/警告/資訊通知
 * - ConfirmDialog：用於破壞性操作確認
 * 
 * 使用範例：
 * ```tsx
 * const notify = useNotification()
 * 
 * // 基本通知
 * notify.success(t('saveSuccess'))
 * notify.error(t('saveFailed'))
 * 
 * // 帶描述的通知
 * notify.error(t('uploadFailed'), error.message)
 * 
 * // 確認對話框
 * const ok = await notify.confirm({
 *   title: t('deleteConfirm'),
 *   message: t('deleteWarning'),
 *   type: 'danger'
 * })
 * if (ok) {
 *   await deleteFaq()
 * }
 * 
 * // 帶撤銷的通知
 * notify.withUndo(t('faqDeleted'), () => restoreFaq())
 * 
 * // Promise 操作
 * await notify.promise(
 *   uploadBatch(),
 *   {
 *     loading: t('uploading'),
 *     success: (data) => `${t('uploadSuccess')} ${data.count}`,
 *     error: (err) => `${t('uploadFailed')} ${err.message}`
 *   }
 * )
 * ```
 */
export function useNotification() {
  const tCommon = useTranslations('common')
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  /**
   * 基本通知 - 成功
   */
  const success = useCallback((message: string, description?: string) => {
    toast.success(message, { description })
  }, [])

  /**
   * 基本通知 - 錯誤
   */
  const error = useCallback((message: string, description?: string) => {
    toast.error(message, { description })
  }, [])

  /**
   * 基本通知 - 警告
   */
  const warning = useCallback((message: string, description?: string) => {
    toast.warning(message, { description })
  }, [])

  /**
   * 基本通知 - 資訊
   */
  const info = useCallback((message: string, description?: string) => {
    toast.info(message, { description })
  }, [])

  /**
   * Promise 操作（用於批量上傳等異步操作）
   */
  const promise = useCallback(<T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: (data: T) => string
      error: (error: any) => string
    }
  ) => {
    return toast.promise(promise, messages)
  }, [])

  /**
   * 帶撤銷按鈕的通知
   */
  const withUndo = useCallback((message: string, onUndo: () => void) => {
    toast.success(message, {
      action: {
        label: tCommon('cancel'),
        onClick: onUndo
      },
      duration: 5000
    })
  }, [tCommon])

  /**
   * 確認對話框（用於破壞性操作）
   */
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(true)
      setConfirmState(null)
    }
  }, [confirmState])

  const handleCancel = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(false)
      setConfirmState(null)
    }
  }, [confirmState])

  return {
    // 基本通知
    success,
    error,
    warning,
    info,

    // 進階功能
    promise,
    withUndo,
    confirm,

    // ConfirmDialog 組件（需要在 JSX 中渲染）
    ConfirmDialog: confirmState ? (
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        {...confirmState.options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ) : null
  }
}
