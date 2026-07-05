import type { UserProfile } from '@/contexts/AuthContext';
import type { OnboardingProfile } from '@/services/OnboardingProfileService';

/** ISO codes where blazer/chinos/dress + fashion trainers is mainstream smart casual. */
export const SMART_CASUAL_COUNTRY_CODES = new Set([
  'GB', 'IE', 'NL', 'BE', 'DK', 'SE', 'NO', 'FI', 'AU', 'NZ', 'ZA', 'SG', 'HK',
  'US', 'CA', 'FR', 'IT', 'ES', 'DE', 'PT', 'AT', 'CH', 'LU', 'MT', 'CY', 'GR',
]);

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'united kingdom': 'GB',
  uk: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  ireland: 'IE',
  'united states': 'US',
  usa: 'US',
  'united states of america': 'US',
  canada: 'CA',
  australia: 'AU',
  'new zealand': 'NZ',
  france: 'FR',
  germany: 'DE',
  italy: 'IT',
  spain: 'ES',
  netherlands: 'NL',
  holland: 'NL',
  belgium: 'BE',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  portugal: 'PT',
  switzerland: 'CH',
  austria: 'AT',
  'south africa': 'ZA',
  singapore: 'SG',
  'hong kong': 'HK',
};

export type RegionalStyleContext = {
  countryCode: string | null;
  allowsSmartCasualTrainers: boolean;
  typicalDressCode: string | null;
  styleTags: string[];
};

export function normalizeCountryCode(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  const mapped = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()];
  return mapped || null;
}

function collectStyleTags(
  user?: UserProfile | null,
  onboarding?: OnboardingProfile | null,
): string[] {
  const tags = new Set<string>();
  const push = (value?: string | string[] | null) => {
    if (!value) return;
    const list = Array.isArray(value) ? value : [value];
    for (const entry of list) {
      if (typeof entry === 'string' && entry.trim()) tags.add(entry.trim().toLowerCase());
    }
  };

  push(user?.stylePreference);
  push(user?.extendedPreferences?.culturalStyle?.preferredStyles);
  push(user?.onboardingProfile?.likedStyles);
  push(onboarding?.likedStyles);
  push(onboarding?.identity);
  push(user?.profileData?.preferredStyles as string[] | undefined);
  push(user?.profileData?.styleGoals as string[] | undefined);

  return [...tags];
}

function styleTagsImplySmartCasual(tags: string[]): boolean {
  const blob = tags.join(' ');
  return /smart.?casual|british|heritage|prep|european|parisian|minimal|street|samba|trainer|sneaker|tailored casual|office casual/.test(blob);
}

export function resolveRegionalStyleContext(
  user?: UserProfile | null,
  onboarding?: OnboardingProfile | null,
  countryCodeOverride?: string | null,
): RegionalStyleContext {
  const countryCode =
    normalizeCountryCode(countryCodeOverride)
    || normalizeCountryCode(user?.actualCountry)
    || normalizeCountryCode(user?.country)
    || normalizeCountryCode((user?.profileData?.countryCode as string) || null);

  const styleTags = collectStyleTags(user, onboarding);
  const fromCountry = countryCode ? SMART_CASUAL_COUNTRY_CODES.has(countryCode) : false;
  const fromStyles = styleTagsImplySmartCasual(styleTags);
  const allowsSmartCasualTrainers = fromCountry || fromStyles;

  return {
    countryCode,
    allowsSmartCasualTrainers,
    typicalDressCode: allowsSmartCasualTrainers ? 'smart-casual' : null,
    styleTags,
  };
}

/** Fashion/lifestyle trainers (Samba, white leather, etc.) — not gym runners. */
export function isFashionTrainer(item: { name?: string; category?: string }): boolean {
  const t = `${item.name || ''} ${item.category || ''}`.toLowerCase();
  if (/running|gym|training|performance|hoka|zoomx|pegasus|ultraboost|fresh foam|cross.?train/.test(t)) {
    return false;
  }
  return /samba|gazelle|campus|spezial|handball|superstar|stan smith|air force|af1|club c|retro|vintage trainer|leather trainer|canvas shoe|converse|old skool|autry|veja|clean white|white trainer|white sneaker|off.?white sneaker|trainer|sneaker/.test(t);
}

export function isSmartCasualTailoringPiece(item: { name?: string; category?: string }): boolean {
  const t = `${item.name || ''} ${item.category || ''}`.toLowerCase();
  const cat = item.category || '';
  return /blazer|sport coat|suit jacket|tailored jacket/.test(t)
    || (cat === 'outerwear' && /blazer|tailored/.test(t))
    || /chino|trouser|slack|dress shirt|oxford shirt|button.?down|blouse|shirt/.test(t)
    || cat === 'dresses'
    || (cat === 'bottoms' && /skirt/.test(t));
}

export function isIntentionalSmartCasualTrainerLook(
  items: Array<{ name?: string; category?: string; subcategory?: string }>,
  regional?: RegionalStyleContext | null,
): boolean {
  if (!regional?.allowsSmartCasualTrainers || items.length < 2) return false;

  const text = items.map((item) => `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`).join(' ').toLowerCase();
  const hasFashionTrainer = items.some((item) => item.category === 'shoes' && isFashionTrainer(item));
  if (!hasFashionTrainer) return false;

  if (/gym|running vest|track pant|jogger|legging|sports bra|compression|athletic short/.test(text)) {
    return false;
  }
  if (items.some((item) => item.category === 'activewear_tops' || item.category === 'activewear_bottoms')) {
    return false;
  }

  const hasBlazer = /blazer|sport coat|suit jacket|tailored jacket/.test(text);
  const hasDress = items.some((item) => item.category === 'dresses') || /\bdress\b/.test(text);
  const hasTailoring = hasBlazer || hasDress || /chino|trouser|slack|shirt|blouse|skirt/.test(text);
  const isEvening = /gown|evening|cocktail|black tie|ballgown/.test(text);

  return hasTailoring && !isEvening;
}
