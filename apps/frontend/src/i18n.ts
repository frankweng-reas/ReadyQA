import { getRequestConfig } from 'next-intl/server';

// 支援的語言列表
export const locales = ['zh-TW', 'en', 'ja'] as const;
export type Locale = (typeof locales)[number];

// 預設語言
export const defaultLocale: Locale = 'zh-TW';

export default getRequestConfig(async ({ locale }) => {
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
