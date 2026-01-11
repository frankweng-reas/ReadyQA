import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options?: Array<{ value: string; label: string }>
}

/**
 * 可重用的下拉選單組件
 * 
 * 功能：
 * 1. 內建 label 支援
 * 2. 錯誤訊息顯示
 * 3. 自訂下拉箭頭圖標
 * 4. 完整的 a11y 支援
 * 5. 使用設計系統顏色
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className={className || 'w-full'}>
        {label && (
          <label
            htmlFor={selectId}
            className="mb-2 block text-sm font-medium text-label"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full rounded-full border border-disabled bg-content-bg text-text text-base',
              'px-4 py-2.5 pr-10 appearance-none cursor-pointer',
              'transition-all',
              'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              'disabled:cursor-not-allowed disabled:bg-grey disabled:text-disabled'
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${selectId}-error` : undefined}
            {...props}
          >
            {options
              ? options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))
              : children}
          </select>
          {/* 下拉箭頭圖標 */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg
              className="w-5 h-5 text-label"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {error && (
          <p
            id={`${selectId}-error`}
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

Select.displayName = 'Select'
