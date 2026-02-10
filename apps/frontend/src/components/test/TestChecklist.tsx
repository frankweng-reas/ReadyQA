'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

interface TestItem {
  id: string
  label: string
  checked: boolean
}

const STORAGE_KEY = 'testChecklist'

const defaultTestItems: Omit<TestItem, 'checked'>[] = [
  { id: '1', label: '清除測試資料 → 新增 Starter 訂閱' },
  { id: '2', label: '清除測試資料 → 新增 Pro 訂閱' },
  { id: '3', label: '清除測試資料 → 新增 Enterprise 訂閱' },
  { id: '4', label: 'Starter → 升級到 Pro' },
  { id: '5', label: 'Starter → 升級到 Enterprise' },
  { id: '6', label: 'Pro → 升級到 Enterprise' },
  { id: '7', label: 'Enterprise → 降級到 Pro' },
  { id: '8', label: 'Enterprise → 降級到 Starter' },
  { id: '9', label: 'Pro → 降級到 Starter' },
  { id: '10', label: '任何方案 → 降級到 Free（取消訂閱）' },
]

export default function TestChecklist() {
  const t = useTranslations('test.checklist')
  const [testItems, setTestItems] = useState<TestItem[]>([])

  // 從 localStorage 載入
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const savedItems = JSON.parse(saved)
        setTestItems(savedItems)
      } catch (error) {
        console.error('[TestChecklist] Failed to load saved items:', error)
        // 如果載入失敗，使用預設值
        setTestItems(defaultTestItems.map(item => ({ ...item, checked: false })))
      }
    } else {
      // 沒有保存的資料，使用預設值
      setTestItems(defaultTestItems.map(item => ({ ...item, checked: false })))
    }
  }, [])

  // 保存到 localStorage
  const saveToStorage = (items: TestItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (error) {
      console.error('[TestChecklist] Failed to save items:', error)
    }
  }

  // 切換勾選狀態
  const toggleItem = (id: string) => {
    const updated = testItems.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    )
    setTestItems(updated)
    saveToStorage(updated)
  }

  // 重置清單
  const resetChecklist = () => {
    const reset = testItems.map(item => ({ ...item, checked: false }))
    setTestItems(reset)
    saveToStorage(reset)
  }

  const completedCount = testItems.filter(item => item.checked).length
  const totalCount = testItems.length

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('title')}
        </h1>
        <button
          onClick={resetChecklist}
          className="rounded-lg bg-gray-600 px-4 py-2 text-base font-medium text-white hover:bg-gray-700 transition-colors"
        >
          {t('reset')}
        </button>
      </div>

      <div className="mb-4 rounded-lg bg-blue-50 p-4">
        <p className="text-base text-blue-800">
          {t('progress', { completed: completedCount, total: totalCount })}
        </p>
      </div>

      <div className="rounded-lg bg-white border border-gray-200 p-6">
        <ul className="space-y-3">
          {testItems.map((item) => (
            <li key={item.id} className="flex items-start">
              <input
                type="checkbox"
                id={`test-${item.id}`}
                checked={item.checked}
                onChange={() => toggleItem(item.id)}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor={`test-${item.id}`}
                className={`ml-3 text-base cursor-pointer flex-1 ${
                  item.checked ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}
              >
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
