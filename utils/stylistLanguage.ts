/**
 * Stylist speak-language helpers.
 * App UI language (welcome / Settings) is separate from stylist chat + voice language.
 */

export const STYLIST_LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  English: 'en',
  Spanish: 'es',
  French: 'fr',
  German: 'de',
  Italian: 'it',
  Portuguese: 'pt',
  Japanese: 'ja',
  Korean: 'ko',
  Chinese: 'zh',
  Arabic: 'ar',
  Hindi: 'hi',
  Dutch: 'nl',
  Russian: 'ru',
  Swedish: 'sv',
};

export const STYLIST_LANGUAGE_CODE_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STYLIST_LANGUAGE_NAME_TO_CODE).map(([name, code]) => [code, name])
);

/** Backend accent key for voice chat / TTS (lower-case). */
export const STYLIST_LANGUAGE_CODE_TO_ACCENT: Record<string, string> = {
  en: 'american',
  es: 'spanish',
  fr: 'french',
  de: 'german',
  it: 'italian',
  pt: 'portuguese',
  ja: 'japanese',
  ko: 'korean',
  zh: 'mandarin',
  ar: 'arabic',
  hi: 'hindi',
  nl: 'dutch',
  ru: 'russian',
  sv: 'swedish',
};

export function stylistLanguageNameToCode(name?: string | null): string {
  if (!name) return 'en';
  if (STYLIST_LANGUAGE_NAME_TO_CODE[name]) return STYLIST_LANGUAGE_NAME_TO_CODE[name];
  const lower = name.toLowerCase();
  if (STYLIST_LANGUAGE_CODE_TO_NAME[lower]) return lower;
  return 'en';
}

export function stylistLanguageCodeToName(code?: string | null): string {
  if (!code) return 'English';
  return STYLIST_LANGUAGE_CODE_TO_NAME[code] || 'English';
}

export function stylistLanguageCodeToAccent(code?: string | null): string {
  if (!code) return 'american';
  return STYLIST_LANGUAGE_CODE_TO_ACCENT[code] || 'american';
}

/**
 * Language the stylist should use in chat + voice.
 * Priority: onboarding / Settings stylist preference → voice preferredLanguage → UI language.
 */
export function resolveStylistSpeakLanguage(options: {
  stylistLanguageName?: string | null;
  preferredLanguageCode?: string | null;
  uiLanguageCode?: string | null;
}): string {
  if (options.stylistLanguageName) {
    return stylistLanguageNameToCode(options.stylistLanguageName);
  }
  if (options.preferredLanguageCode) {
    return options.preferredLanguageCode;
  }
  return options.uiLanguageCode || 'en';
}
