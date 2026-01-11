/**
 * Layout Configuration
 * 統一管理 new page 的布局設定
 */

export const layout = {
  // Sidebar 設定
  sidebar: {
    width: '14rem',           // 224px (展開寬度)
    collapsedWidth: '6rem',   // 80px (折疊寬度)
    headerHeight: '5rem',     // 80px
    headerFontSize: '1.5rem', // 20px (標題字體大小)
    headerLogoSize: '4rem',   // 64px (Header logo 大小 - 展開時)
    headerLogoSizeCollapsed: '3.5rem', // 56px (Header logo 大小 - 折疊時)
    itemHeight: '4rem',       // 48px (選項高度)
    itemFontSize: '1.25rem',     // 16px (選項字體大小)
    iconSize: '1.5rem',         // 32px (icon 大小 - 展開時)
    iconSizeCollapsed: '2rem', // 40px (icon 大小 - 折疊時)
    padding: {
      x: '1rem',              // 16px
      y: '1rem',              // 16px
    },
    paddingCollapsed: {
      x: '0.5rem',            // 8px (折疊時的 padding)
      y: '1rem',              // 16px
    },
  },

  // Header 設定
  header: {
    height: '4rem',           // 64px
    padding: {
      x: '1.5rem',            // 24px
      y: '1rem',              // 16px
    },
    margin: {
      top: '1rem',            // 上方間隔
      right: '1rem',          // 右方間隔
      bottom: '1rem',         // 下方間隔（與 Content 之間的間隔）
      left: '1rem',           // 左方間隔
    },
    borderRadius: '0.75rem',   // 12px (圓角)
  },

  // Content 設定
  content: {
    padding: '1.5rem',         // 24px
    margin: {
      top: '0',               // 上方間隔（由 Header 的 marginBottom 控制）
      right: '1rem',          // 右方間隔
      bottom: '1rem',         // 下方間隔
      left: '1rem',           // 左方間隔
    },
    borderRadius: '0.75rem',   // 12px (圓角)
  },

  // 右側區域設定
  rightArea: {
    marginLeft: '0rem',       // 右側區域和 Sidebar 之間的間隔
    padding: {
      top: '0',               // 上方 padding
      right: '0',             // 右方 padding
      bottom: '0',            // 下方 padding
      left: '0',              // 左方 padding
    },
  },
} as const;

export type Layout = typeof layout;
