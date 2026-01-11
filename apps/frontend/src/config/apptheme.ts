/**
 * App Theme Configuration
 * 統一管理 new page 的主題設定
 * 注意：此為應用程式 UI 主題，與 chatbot theme 不同
 */

export const appTheme = {
  // 顏色定義
  colors: {
    // 主色調
    primary: '#35577D',      // 深綠色
    accent: '#0B3037',        // 藍色
    grey: '#F2F5F5',          // 淺灰色
    text: '#0B3037',          // 文字色
    label: '#0B3037',         // 標籤色
    disabled: '#35577D',      // 禁用色

    // Sidebar 顏色
    sidebar: {
      bg: '#1F2937',          // 深灰色背景
      bgHover: '#374151',     // Hover 背景
      bgActive: '#4B5563',    // Active 背景
      text: '#D1D5DB',        // 文字色
      textActive: '#FFFFFF',  // Active 文字色
      border: '#374151',      // 邊框色
      headerBg: '#111827',    // Header 背景
    },

    // Header 顏色
    header: {
      bg: '#FFFFFF',          // 白色背景
      border: '#E5E7EB',      // 邊框色
      text: '#111827',        // 文字色
      textSecondary: '#6B7280', // 次要文字色
    },

    // Content 顏色
    content: {
      bg: '#FFFFFF',          // 白色背景
      text: '#111827',         // 文字色
    },
  },

  // 間距定義（rem）
  spacing: {
    sm1: '0.25rem',   // 4px
    sm2: '0.375rem',  // 6px
    sm3: '0.5rem',    // 8px
    md1: '1rem',      // 16px
    md2: '1.25rem',   // 20px
    md3: '1.5rem',    // 24px
    lg1: '2rem',      // 32px
    lg2: '3rem',      // 48px
    lg3: '4rem',      // 64px
  },

  // 字體大小
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
  },

  // 圓角
  borderRadius: {
    sm: '0.25rem',    // 4px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    full: '9999px',   // 完全圓角
  },

  // 陰影
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
} as const;

export type AppTheme = typeof appTheme;
