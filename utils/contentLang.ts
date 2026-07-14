/**
 * Content language helpers for long-form / generated copy
 * (fashion rules, blog fallbacks, weather outfit templates).
 * Must stay in sync with UI_FULL_COVERAGE_LANGUAGES in localeBundles.
 */

export const CONTENT_LANGS = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'pl',
  'ru',
  'zh',
  'ja',
  'ko',
  'ar',
  'hi',
  'tr',
  'sv',
  'da',
  'no',
  'fi',
] as const;

export type ContentLang = (typeof CONTENT_LANGS)[number];

/** Map app language codes (including regional) to a supported content language. */
export function resolveContentLang(language?: string | null): ContentLang {
  if (!language) return 'en';
  const base = language.trim().toLowerCase().split(/[-_]/)[0];
  // Chinese variants
  if (base === 'zh' || language.toLowerCase().startsWith('zh')) return 'zh';
  if ((CONTENT_LANGS as readonly string[]).includes(base)) {
    return base as ContentLang;
  }
  return 'en';
}

export function isContentLang(code: string): code is ContentLang {
  return (CONTENT_LANGS as readonly string[]).includes(code);
}
