'use client'

import { useTranslations } from 'next-intl'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmButtonClass?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'danger' | 'warning' | 'info'
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  confirmButtonClass,
  onConfirm,
  onCancel,
  type = 'danger'
}: ConfirmDialogProps) {
  const tCommon = useTranslations('common')

  if (!isOpen) return null

  const defaultConfirmText = confirmText || tCommon('confirm')
  const defaultCancelText = cancelText || tCommon('cancel')

  // 根據類型設置圖標和顏色
  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-red-100',
          iconColor: 'text-red-600',
          confirmButton: confirmButtonClass || 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
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
          confirmButton: confirmButtonClass || 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
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
          confirmButton: confirmButtonClass || 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
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

