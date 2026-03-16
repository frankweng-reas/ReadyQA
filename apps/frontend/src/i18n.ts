import { getRequestConfig } from 'next-intl/server';

// 固定繁體中文，不支援多語言切換
export const locales = ['zh-TW'] as const;
export type Locale = (typeof locales)[number];

// 預設語言
export const defaultLocale: Locale = 'zh-TW';

export default getRequestConfig(async ({ locale }) => {
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
