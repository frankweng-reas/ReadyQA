'use client'

import { useTranslations } from 'next-intl'
import { useNotification } from '@/hooks/useNotification'

export default function NotificationTestPage() {
  const t = useTranslations('common')
  const notify = useNotification()

  const testSuccess = () => {
    notify.success('操作成功！', '這是一個成功的通知')
  }

  const testError = () => {
    notify.error('操作失敗', '這是一個錯誤訊息')
  }

  const testWarning = () => {
    notify.warning('警告訊息', '請注意此操作')
  }

  const testInfo = () => {
    notify.info('資訊提示', '這是一則資訊')
  }

  const testConfirm = async () => {
    const confirmed = await notify.confirm({
      title: '確認刪除',
      message: '確定要刪除此項目嗎？此操作無法復原。',
      type: 'danger'
    })
    
    if (confirmed) {
      notify.success('已刪除')
    } else {
      notify.info('已取消')
    }
  }

  const testPromise = async () => {
    const mockOperation = () => new Promise((resolve) => {
      setTimeout(() => resolve({ count: 10 }), 2000)
    })

    await notify.promise(
      mockOperation(),
      {
        loading: '處理中...',
        success: (data: any) => `完成！處理了 ${data.count} 個項目`,
        error: (err) => `失敗：${err.message}`
      }
    )
  }

  const testWithUndo = () => {
    notify.withUndo('項目已刪除', () => {
      notify.success('已撤銷刪除')
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">通知系統測試頁面</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">基本通知</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={testSuccess}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              ✓ 測試成功通知
            </button>
            
            <button
              onClick={testError}
              className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              ✕ 測試錯誤通知
            </button>
            
            <button
              onClick={testWarning}
              className="px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              ⚠ 測試警告通知
            </button>
            
            <button
              onClick={testInfo}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              ℹ 測試資訊通知
            </button>
          </div>

          <hr className="my-6" />

          <h2 className="text-xl font-semibold mb-4">進階功能</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={testConfirm}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              🔔 測試確認對話框
            </button>
            
            <button
              onClick={testPromise}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              🔄 測試 Promise 通知
            </button>
            
            <button
              onClick={testWithUndo}
              className="px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
            >
              ↩️ 測試撤銷功能
            </button>
          </div>

          <hr className="my-6" />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">測試說明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 基本通知會在右上角顯示，4 秒後自動消失</li>
              <li>• 確認對話框會在畫面中央顯示，需要用戶操作</li>
              <li>• Promise 通知會顯示 loading 狀態，完成後自動轉換</li>
              <li>• 撤銷功能會顯示一個帶操作按鈕的通知</li>
              <li>• 所有通知都支援翻譯系統</li>
            </ul>
          </div>
        </div>

        {/* 渲染 ConfirmDialog */}
        {notify.ConfirmDialog}
      </div>
    </div>
  )
}
