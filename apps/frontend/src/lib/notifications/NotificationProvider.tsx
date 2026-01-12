'use client'

import { Toaster } from 'sonner'

/**
 * NotificationProvider - 提供 Sonner Toast 通知系統
 * 
 * 使用方式：
 * 1. 在 layout.tsx 中包裹整個應用
 * 2. 在組件中使用 useNotification() hook
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        richColors
        expand={true}
        closeButton
        duration={4000}
        toastOptions={{
          style: {
            fontSize: '14px',
          },
          className: 'toast-item',
        }}
      />
    </>
  )
}
