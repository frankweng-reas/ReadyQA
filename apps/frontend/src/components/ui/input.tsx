import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

/**
 * 可重用的輸入框組件
 * 
 * 改進點：
 * 1. 內建 label 支援
 * 2. 錯誤訊息顯示
 * 3. 完整的 a11y 支援
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    // 從 className 中分離寬度相關的 class
    const widthClasses = className?.match(/\b(w-\S+|min-w-\S+|max-w-\S+)\b/g)?.join(' ') || ''
    const otherClasses = className?.replace(/\b(w-\S+|min-w-\S+|max-w-\S+)\b/g, '').trim() || ''

    return (
      <div className={cn('w-full', widthClasses)}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium text-label"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-full border border-disabled bg-content-bg text-text px-4 py-2.5 text-base transition-all',
            'placeholder:text-header-text-secondary',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            'disabled:cursor-not-allowed disabled:bg-grey disabled:text-disabled',
            otherClasses
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-sm text-red-600"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

