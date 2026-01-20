'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
  headerVariant?: 'default' | 'gradient-blue'
  headerColor?: string
  headerHeight?: string
  closeButtonSize?: 'small' | 'default'
  showCloseButton?: boolean
  closeOnBackdropClick?: boolean
  className?: string
  headerActions?: ReactNode
  isFullScreen?: boolean
  zIndex?: number
  containerRelative?: boolean
  closeButtonTitle?: string
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-full'
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'xl',
  headerVariant = 'gradient-blue',
  headerColor,
  headerHeight,
  closeButtonSize = 'default',
  showCloseButton = true,
  closeOnBackdropClick = true,
  className = '',
  headerActions,
  isFullScreen = false,
  zIndex = 50,
  containerRelative = false,
  closeButtonTitle = '關閉'
}: ModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!closeOnBackdropClick) {
      return
    }
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const hasHeader = title || icon || showCloseButton
  const hasFooter = !!footer

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={containerRelative ? "absolute inset-0 bg-gradient-to-br from-gray-900/60 via-gray-800/50 to-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4" : "fixed inset-0 bg-gradient-to-br from-gray-900/60 via-gray-800/50 to-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4"}
            style={{ zIndex }}
            onClick={handleBackdropClick}
          >
            <motion.div
              initial={{ opacity: 1, scale: 1, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => {
                e.stopPropagation()
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
              }}
              onTouchStart={(e) => {
                e.stopPropagation()
              }}
              className={`relative bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden border border-white/20 ${
                isFullScreen 
                  ? 'w-screen h-screen rounded-none' 
                  : `rounded-xl w-full ${maxWidthClasses[maxWidth]} ${containerRelative ? 'max-h-[85%]' : 'max-h-[90vh]'}`
              } ${className}`}
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                zIndex: zIndex + 1
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 pointer-events-none" />
              
              {hasHeader && (
                <div 
                  className={`relative flex items-center justify-between px-8 flex-shrink-0 ${
                    headerHeight || 'py-3'
                  } ${
                    headerColor 
                      ? '' 
                      : headerVariant === 'gradient-blue'
                        ? 'bg-gradient-to-r from-blue-900 via-blue-700 to-blue-600'
                        : 'bg-gray-50 border-b border-gray-200'
                  }`}
                  style={headerColor ? { backgroundColor: headerColor } : undefined}
                >
                  {headerVariant === 'gradient-blue' && !headerColor && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/95 via-blue-700/95 to-blue-600/95" />
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDYwIDAgTCAwIDAgMCA2MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
                    </>
                  )}
                  
                  <div className="relative flex items-center space-x-4 z-10 flex-1">
                    {icon && (
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border ${
                        headerVariant === 'gradient-blue'
                          ? 'bg-white/20 backdrop-blur-sm border-white/30'
                          : 'bg-white border-gray-200'
                      }`}>
                        <div className={`${headerVariant === 'gradient-blue' ? 'text-white' : 'text-gray-700'} scale-90`}>
                          {icon}
                        </div>
                      </div>
                    )}
                    {(title || subtitle) && (
                      <div>
                        {title && (
                          <h2 className={`text-xl font-bold drop-shadow-lg ${
                            headerColor 
                              ? 'text-white' 
                              : headerVariant === 'gradient-blue' 
                                ? 'text-white' 
                                : 'text-gray-900'
                          }`}>
                            {title}
                          </h2>
                        )}
                        {subtitle && (
                          <p className={`text-xs mt-0.5 ${
                            headerColor 
                              ? 'text-white/80' 
                              : headerVariant === 'gradient-blue' 
                                ? 'text-white/80' 
                                : 'text-gray-600'
                          }`}>
                            {subtitle}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative flex items-center gap-4 z-10">
                    {headerActions && (
                      <div className="flex items-center gap-2">
                        {headerActions}
                      </div>
                    )}
                    
                    {showCloseButton && (
                      <button
                        onClick={onClose}
                        className={`${closeButtonSize === 'small' ? 'p-1.5' : 'p-2.5'} rounded-xl backdrop-blur-sm border transition-all duration-200 hover:scale-105 ${
                          headerColor || headerVariant === 'gradient-blue'
                            ? 'bg-white/10 hover:bg-red-500/80 border-white/20 hover:border-red-400/50'
                            : 'bg-white hover:bg-gray-200 border-gray-200'
                        }`}
                        title={closeButtonTitle}
                      >
                        <svg
                          className={`${closeButtonSize === 'small' ? 'w-4 h-4' : 'w-5 h-5'} transition-colors ${
                            headerColor || headerVariant === 'gradient-blue' ? 'text-white' : 'text-gray-600'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div 
                className={`relative flex-1 overflow-y-auto space-y-6 bg-gradient-to-b from-white via-gray-50/50 to-white ${
                  hasHeader && hasFooter ? 'px-8 pt-8 pb-6' :
                  hasHeader && !hasFooter ? 'px-8 pt-8 pb-8' :
                  !hasHeader && hasFooter ? 'px-8 pt-8 pb-6' :
                  'px-8 py-8'
                }`}
                onWheel={(e) => {
                  e.stopPropagation()
                }}
                onTouchMove={(e) => {
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.stopPropagation()
                }}
              >
                {children}
              </div>

              {hasFooter && (
                <div className="relative border-t border-gray-200/50 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/80 backdrop-blur-sm px-8 py-4 flex-shrink-0">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
                  {footer}
                </div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
