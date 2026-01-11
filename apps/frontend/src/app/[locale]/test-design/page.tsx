'use client';

import { useState, useEffect } from 'react';

/**
 * Design Manager 容器結構測試頁面
 * 
 * 目標：響應式設計 - 小視窗時自動隱藏設定面板
 * - 大視窗（≥ 1100px）：兩欄並排（預覽 + 設定）
 * - 小視窗（< 1100px）：設定面板自動隱藏
 */
export default function TestDesignPage() {
  const [showSettings, setShowSettings] = useState(true);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const small = width < 1100;
      setIsSmallScreen(small);
      // 小視窗時自動隱藏設定面板
      if (small) {
        setShowSettings(false);
      } else {
        setShowSettings(true);
      }
    };

    // 初始檢查
    handleResize();

    // 監聽視窗大小變化
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* 頂部工具列 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Design Manager 測試</h1>
          <div className="flex items-center space-x-4">
            {isSmallScreen && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {showSettings ? '隱藏設定' : '顯示設定'}
              </button>
            )}
            <div className="text-sm text-gray-500">
              {isSmallScreen ? '小視窗模式（設定面板已自動隱藏）' : '大視窗模式（兩欄並排）'}
            </div>
          </div>
        </div>
      </div>

      {/* 主容器：預覽區 + 設定面板 */}
      <div className="flex flex-1 min-h-0">
        {/* 左側：預覽區容器 */}
        <div className="flex-1 min-h-0 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 p-6">
          <div className="flex items-center justify-center py-6">
            <div 
              className="bg-white border border-gray-200 rounded-lg shadow-lg p-8"
              style={{ 
                width: '100%', 
                maxWidth: '900px', 
                minWidth: isSmallScreen ? '400px' : '600px',
                aspectRatio: '4/3',
                height: 'auto'
              }}
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">平板預覽區</h2>
                <p className="text-gray-600 mb-2">寬度：100%（最小 {isSmallScreen ? '400px' : '600px'}，最大 900px）</p>
                <p className="text-gray-600 mb-2">長寬比：4:3（橫向，寬度:高度 = 4:3）</p>
                <p className="text-xs text-gray-400 mt-2">
                  實際比例：寬度應該是高度的 1.33 倍
                </p>
                <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-900">這是模擬的 Chatbot Widget</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右側：設定面板 */}
        {showSettings && (
          <div className={`${isSmallScreen ? 'fixed right-0 top-16 bottom-0 z-50' : 'w-[420px] flex-shrink-0'} bg-white shadow-xl border-l border-gray-200 flex flex-col transition-all`} style={isSmallScreen ? { width: '420px' } : {}}>
          {/* 設定面板 Header */}
          <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">設定面板</h3>
            {isSmallScreen && (
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded hover:bg-gray-200 transition-colors"
                title="關閉"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* 設定內容 */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">容器設定</h4>
                <p className="text-sm text-gray-600">寬度：420px（固定）</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Header 設定</h4>
                <p className="text-sm text-gray-600">這裡會有各種設定選項</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Input 設定</h4>
                <p className="text-sm text-gray-600">這裡會有各種設定選項</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Contact 設定</h4>
                <p className="text-sm text-gray-600">這裡會有各種設定選項</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">QA Card 設定</h4>
                <p className="text-sm text-gray-600">這裡會有各種設定選項</p>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* 小視窗時的遮罩層 */}
      {isSmallScreen && showSettings && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* 底部說明 */}
      <div className="flex-shrink-0 bg-yellow-50 border-t border-yellow-200 px-6 py-3">
        <p className="text-sm text-yellow-800">
          <strong>測試說明：</strong>
          視窗寬度 &lt; 1100px 時，設定面板會自動隱藏。
          點擊「顯示設定」按鈕可以打開設定面板（以抽屜方式顯示）。
        </p>
      </div>
    </div>
  );
}
