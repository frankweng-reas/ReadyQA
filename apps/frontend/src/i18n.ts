import { getRequestConfig } from 'next-intl/server';

// 支援語系；預設繁中。URL 需帶前綴：/zh-TW/...、/en/...（localeDetection: false 時不依瀏覽器自動切換）
export const locales = ['zh-TW', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-TW';

export default getRequestConfig(async ({ locale }) => {
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
