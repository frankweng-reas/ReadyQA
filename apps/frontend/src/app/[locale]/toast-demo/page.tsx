'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner'
import { useAnswerGoToast } from '@/hooks/useAnswerGoToast'
import { AnswerGoToastContainer } from '@/components/demo/AnswerGoToast'

export default function ToastDemoPage() {
  const t = useTranslations('toastDemo')
  const [customMessage, setCustomMessage] = useState('')
  
  // AnswerGO Toast
  const answerGoToast = useAnswerGoToast()

  // 模擬異步操作
  const mockAsyncOperation = () => {
    return new Promise((resolve) => {
      setTimeout(() => resolve({ data: 'success' }), 2000)
    })
  }

  const mockFailedOperation = () => {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('操作失敗')), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      {/* 標題 */}
      <div className="max-w-7xl mx-auto mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">{t('title')}</h1>
        <p className="text-lg text-gray-600">{t('subtitle')}</p>
      </div>

      {/* 三欄對比 */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 1. AnswerGO Toast */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">AnswerGO Toast</h2>
            <p className="text-sm text-gray-500">{t('answerGoDesc')}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => answerGoToast.showSuccess(t('successMessage'))}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ✓ {t('success')}
            </button>
            
            <button
              onClick={() => answerGoToast.showError(t('errorMessage'))}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              ✕ {t('error')}
            </button>
            
            <button
              onClick={() => answerGoToast.showWarning(t('warningMessage'))}
              className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              ⚠ {t('warning')}
            </button>
            
            <button
              onClick={() => answerGoToast.showInfo(t('infoMessage'))}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ℹ {t('info')}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-700 mb-3">{t('pros')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('answerGoPro1')}</li>
              <li>• {t('answerGoPro2')}</li>
            </ul>
            <h3 className="font-semibold text-gray-700 mt-4 mb-3">{t('cons')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('answerGoCon1')}</li>
              <li>• {t('answerGoCon2')}</li>
              <li>• {t('answerGoCon3')}</li>
              <li>• {t('answerGoCon4')}</li>
            </ul>
          </div>
        </div>

        {/* 2. react-hot-toast */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">react-hot-toast</h2>
            <p className="text-sm text-gray-500">{t('hotToastDesc')}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => toast.success(t('successMessage'))}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ✓ {t('success')}
            </button>
            
            <button
              onClick={() => toast.error(t('errorMessage'))}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              ✕ {t('error')}
            </button>
            
            <button
              onClick={() => toast(t('warningMessage'), { icon: '⚠️' })}
              className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              ⚠ {t('warning')}
            </button>
            
            <button
              onClick={() => toast(t('infoMessage'), { icon: 'ℹ️' })}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ℹ {t('info')}
            </button>

            <button
              onClick={() => {
                toast.promise(
                  mockAsyncOperation(),
                  {
                    loading: t('loading'),
                    success: t('loadingSuccess'),
                    error: t('loadingError'),
                  }
                )
              }}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              🔄 {t('promiseTest')}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-700 mb-3">{t('pros')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('hotToastPro1')}</li>
              <li>• {t('hotToastPro2')}</li>
              <li>• {t('hotToastPro3')}</li>
            </ul>
            <h3 className="font-semibold text-gray-700 mt-4 mb-3">{t('cons')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('hotToastCon1')}</li>
              <li>• {t('hotToastCon2')}</li>
            </ul>
          </div>
        </div>

        {/* 3. Sonner (推薦) */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-4 border-blue-500 relative">
          <div className="absolute -top-3 right-6 bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
            {t('recommended')}
          </div>
          
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sonner</h2>
            <p className="text-sm text-gray-500">{t('sonnerDesc')}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => sonnerToast.success(t('successMessage'))}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              ✓ {t('success')}
            </button>
            
            <button
              onClick={() => sonnerToast.error(t('errorMessage'))}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              ✕ {t('error')}
            </button>
            
            <button
              onClick={() => sonnerToast.warning(t('warningMessage'))}
              className="w-full px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
            >
              ⚠ {t('warning')}
            </button>
            
            <button
              onClick={() => sonnerToast.info(t('infoMessage'))}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              ℹ {t('info')}
            </button>

            <button
              onClick={() => {
                sonnerToast.promise(
                  mockAsyncOperation(),
                  {
                    loading: t('loading'),
                    success: t('loadingSuccess'),
                    error: t('loadingError'),
                  }
                )
              }}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              🔄 {t('promiseTest')}
            </button>

            <button
              onClick={() => {
                sonnerToast(t('actionMessage'), {
                  action: {
                    label: t('undo'),
                    onClick: () => sonnerToast.success(t('undoSuccess'))
                  }
                })
              }}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              🎯 {t('withAction')}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold text-gray-700 mb-3">{t('pros')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('sonnerPro1')}</li>
              <li>• {t('sonnerPro2')}</li>
              <li>• {t('sonnerPro3')}</li>
              <li>• {t('sonnerPro4')}</li>
              <li>• {t('sonnerPro5')}</li>
            </ul>
            <h3 className="font-semibold text-gray-700 mt-4 mb-3">{t('cons')}</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {t('sonnerCon1')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 自訂訊息測試區 */}
      <div className="max-w-7xl mx-auto mt-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('customTest')}</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder={t('customPlaceholder')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => {
                if (customMessage) {
                  answerGoToast.showInfo(customMessage)
                  toast(customMessage)
                  sonnerToast(customMessage)
                }
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
            >
              {t('testAll')}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Containers */}
      <AnswerGoToastContainer toasts={answerGoToast.toasts} onRemove={answerGoToast.removeToast} />
      <Toaster position="top-center" />
      <SonnerToaster position="bottom-right" richColors expand={true} />
    </div>
  )
}
