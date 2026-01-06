import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合併 Tailwind 類別名稱
 * 使用 clsx + tailwind-merge 避免衝突
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

