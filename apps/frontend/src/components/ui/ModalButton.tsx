'use client'

import { ReactNode } from 'react'

interface ModalButtonProps {
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  isLoading?: boolean
  children: ReactNode
  className?: string
}

export function ModalButton({
  onClick,
  variant = 'primary',
  disabled = false,
  isLoading = false,
  children,
  className = ''
}: ModalButtonProps) {
  const baseClasses = 'px-5 py-1.5 rounded-full transition-all duration-200 font-medium text-sm flex items-center gap-2'
  
  const variantClasses = {
    primary: 'bg-primary text-white hover:bg-primary/90 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg',
    secondary: 'text-label bg-white border border-grey-250 hover:bg-grey hover:border-grey-250 shadow-sm hover:shadow-md',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  )
}
