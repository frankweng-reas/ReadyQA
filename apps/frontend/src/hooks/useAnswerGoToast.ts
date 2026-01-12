'use client'

import { useState, useCallback } from 'react'
import { ToastType } from '@/components/demo/AnswerGoToast'

interface Toast {
  id: string
  message: string
  type: ToastType
}

export function useAnswerGoToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const newToast: Toast = { id, message, type }
    
    setToasts((prev) => [...prev, newToast])
    
    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showSuccess = useCallback((message: string) => {
    return addToast(message, 'success')
  }, [addToast])

  const showError = useCallback((message: string) => {
    return addToast(message, 'error')
  }, [addToast])

  const showInfo = useCallback((message: string) => {
    return addToast(message, 'info')
  }, [addToast])

  const showWarning = useCallback((message: string) => {
    return addToast(message, 'warning')
  }, [addToast])

  const clearAll = useCallback(() => {
    setToasts([])
  }, [])

  return {
    toasts,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    removeToast,
    clearAll
  }
}
