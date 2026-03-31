/**
 * Theme 內建預設字串（與後端 getDefaultTheme()、前端 defaultTheme、ChatbotWidget 後備字一致）
 * 在後台依介面語系顯示翻譯，不變更資料庫存檔內容，直到使用者編輯並儲存。
 */

export const BUILTIN_HEADER_TITLE_ALICE = 'FAQ 助手 Alice';
export const BUILTIN_HEADER_TITLE_GENERIC = 'AI 問答助手';
/** ChatbotWidget 標題為空時的後備文案 */
export const BUILTIN_HEADER_TITLE_MINIMAL = 'AI 助手';

export const BUILTIN_HEADER_SUBTITLE_LIVE = '服務上線中...';
export const BUILTIN_HEADER_SUBTITLE_TAGLINE = '不生成、不猜測、快速找到正確答案';

export const BUILTIN_INPUT_PLACEHOLDER_VARIANTS = [
  '請輸入你的問題...',
  '請輸入您的問題...',
] as const;

export function previewLocalizedHeaderTitle(
  value: string,
  t: (key: string) => string
): string {
  if (value === BUILTIN_HEADER_TITLE_ALICE) {
    return t('previewBuiltinHeaderTitleAlice');
  }
  if (value === BUILTIN_HEADER_TITLE_GENERIC) {
    return t('previewBuiltinHeaderTitleGeneric');
  }
  if (value === BUILTIN_HEADER_TITLE_MINIMAL) {
    return t('previewBuiltinHeaderTitleMinimal');
  }
  return value;
}

/** 標題空白時使用與 Widget 一致的多語後備字 */
export function displayLocalizedHeaderTitle(
  value: string | undefined | null,
  t: (key: string) => string
): string {
  const v = (value ?? '').trim();
  if (!v) {
    return t('previewBuiltinHeaderTitleMinimal');
  }
  return previewLocalizedHeaderTitle(v, t);
}

export function previewLocalizedHeaderSubtitle(
  value: string,
  t: (key: string) => string
): string {
  if (value === BUILTIN_HEADER_SUBTITLE_LIVE) {
    return t('previewBuiltinSubtitleLive');
  }
  if (value === BUILTIN_HEADER_SUBTITLE_TAGLINE) {
    return t('previewBuiltinSubtitleTagline');
  }
  return value;
}

export function previewLocalizedInputPlaceholder(
  value: string,
  t: (key: string) => string
): string {
  if ((BUILTIN_INPUT_PLACEHOLDER_VARIANTS as readonly string[]).includes(value)) {
    return t('previewBuiltinInputPlaceholder');
  }
  return value;
}
