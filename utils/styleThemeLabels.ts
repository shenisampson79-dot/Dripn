import type { StyleTheme } from '@/constants/theme';

/** Maps stored stylePreference IDs → i18n keys for display labels. */
export const STYLE_THEME_I18N_KEYS: Record<StyleTheme, string> = {
  luxury: 'styleThemes.minimalist',
  streetwear: 'styleThemes.casual',
  boho: 'styleThemes.creative',
  sporty: 'styleThemes.active',
  'smart-casual': 'styleThemes.smartCasual',
  business: 'styleThemes.professional',
  edgy: 'styleThemes.trendsetter',
};

const STYLE_THEME_FALLBACKS: Record<StyleTheme, string> = {
  luxury: 'Minimalist',
  streetwear: 'Casual',
  boho: 'Creative',
  sporty: 'Active',
  'smart-casual': 'Smart Casual',
  business: 'Professional',
  edgy: 'Trendsetter',
};

export function getStyleThemeLabel(
  styleId: string | null | undefined,
  t: (key: string) => string,
  fallbackId: StyleTheme = 'luxury',
): string {
  const id = (styleId && styleId in STYLE_THEME_I18N_KEYS
    ? styleId
    : fallbackId) as StyleTheme;
  return t(STYLE_THEME_I18N_KEYS[id]) || STYLE_THEME_FALLBACKS[id];
}
