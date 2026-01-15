/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 保留原有的 primary 色階（如果需要的話）
        primary: {
          DEFAULT: '#35577D', // appTheme primary
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // appTheme 顏色
        accent: '#0B3037',
        grey: '#F2F5F5',
        'grey-200': '#E5E7EB',
        'grey-220': '#ededed',
        'grey-250': '#D1D5DB',
        text: '#0B3037',
        label: '#0B3037',
        disabled: '#35577D',
        // Sidebar 顏色
        'sidebar-bg': '#1F2937',
        'sidebar-bg-hover': '#374151',
        'sidebar-bg-active': '#4B5563',
        'sidebar-text': '#D1D5DB',
        'sidebar-text-active': '#FFFFFF',
        'sidebar-border': '#374151',
        'sidebar-header-bg': '#111827',
        // Header 顏色
        'header-bg': '#4b5563',
        'header-border': '#E5E7EB',
        'header-text': '#111827',
        'header-text-secondary': '#6B7280',
        // Content 顏色
        'content-bg': '#FFFFFF',
        'content-text': '#111827',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
}

