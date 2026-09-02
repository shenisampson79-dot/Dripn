/**
 * v1 launch: App UI chrome is English-only.
 * Locale JSON bundles for other languages stay in the repo for later work
 * and for stylist speak-language lookups — they are not selectable as app UI.
 */

export const V1_APP_UI_LANGUAGE = 'en';

/** Every previously selectable app UI locale that must normalize to English. */
export const LEGACY_APP_UI_LANGUAGE_CODES = [
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

export const V1_APP_UI_LANGUAGE_OPTIONS: Array<{
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr';
}> = [
  { code: V1_APP_UI_LANGUAGE, name: 'English', nativeName: 'English', direction: 'ltr' },
];

export function isV1SelectableAppUiLanguage(code?: string | null): boolean {
  return String(code || '').trim().toLowerCase().split(/[-_]/)[0] === V1_APP_UI_LANGUAGE;
}

/** Persisted / backend / picker codes → v1 app UI language. Never throws. */
export function normalizeAppUiLanguage(_code?: string | null): typeof V1_APP_UI_LANGUAGE {
  return V1_APP_UI_LANGUAGE;
}

export function v1AppUiDirection(): 'ltr' {
  return 'ltr';
}

export function persistedAppUiLanguageNeedsRewrite(cachedLang?: string | null): boolean {
  if (cachedLang == null || String(cachedLang).trim() === '') return false;
  return normalizeAppUiLanguage(cachedLang) !== String(cachedLang).trim();
}

/**
 * v1 app chrome is LTR. Returns true when native RTL is still active and a
 * reload is required for React Native layout to drop leftover Arabic RTL.
 */
export function applyV1I18nLayoutDirection(i18n: {
  isRTL: boolean;
  allowRTL: (allow: boolean) => void;
  forceRTL: (force: boolean) => void;
}): boolean {
  const needsReload = i18n.isRTL === true;
  i18n.allowRTL(false);
  i18n.forceRTL(false);
  return needsReload;
}

/** App-language picker options — never the 19-locale list, even if the API returns it. */
export function selectableAppUiLanguages(
  _available?: Array<{ code: string; name: string; nativeName: string; direction: 'ltr' | 'rtl' }>,
): typeof V1_APP_UI_LANGUAGE_OPTIONS {
  return V1_APP_UI_LANGUAGE_OPTIONS;
}
