'use client';

import { useEffect } from 'react';

/**
 * 同步 <html lang> 與目前語系（根 layout 固定為 zh-TW 時，英文路由仍須正確標記）
 */
export function DocumentLang({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-TW';
  }, [locale]);

  return null;
}
