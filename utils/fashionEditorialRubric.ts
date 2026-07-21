import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { classifyItem } from '@/utils/outfitClashRules';

type EditorialItem = Pick<WardrobeItem, 'name' | 'category'> & {
  subcategory?: string | null;
};

function itemText(item: EditorialItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

function isActive(item: EditorialItem): boolean {
  return item.category.includes('activewear')
    || /\b(gym|training|running|compression|sports bra|performance (?:tee|top|tank|hoodie|jersey|shorts?)|workout|leggings?|track pants?|joggers?|sweatpants?)\b/.test(itemText(item));
}

/** Hoodies, joggers, gym trainers — never office/work pool. */
function isCasualLoungewear(item: EditorialItem): boolean {
  const text = itemText(item);
  if (/\b(hoodies?|hooded sweat|sweatshirts?|joggers?|sweatpants?|track pants?|gym shorts?|athletic shorts?)\b/.test(text)) {
    return true;
  }
  if (item.category === 'shoes' && /\b(trainers?|sneakers?|runners?|canvas shoes?|skate shoes?)\b/.test(text)) {
    return true;
  }
  return false;
}

function isSleepwear(item: EditorialItem): boolean {
  return item.category === 'sleepwear'
    || /\b(pyjamas?|pajamas?|nightdress|nightgown|sleep shirt|bedtime)\b/.test(itemText(item));
}

function isBeachwear(item: EditorialItem): boolean {
  return item.category === 'swimwear'
    || /\b(bikini|swimsuit|swim trunks?|board shorts?|rash vest|beach cover-up|pool slide)\b/.test(itemText(item));
}

function isFormalShoes(item: EditorialItem): boolean {
  return item.category === 'shoes'
    && /\b(oxford|derby|brogue|dress shoe|stiletto|court shoe|formal pump)\b/.test(itemText(item));
}

const SOCIAL_OR_PROFESSIONAL = new Set<OutfitOccasionId | 'todays_look'>([
  'work_outfit',
  'date_night',
  'evening_out',
  'smart_casual',
]);

/** Occasion is a hard gate for automatic styling, not a small score penalty. */
export function passesEditorialOccasionGate(
  item: EditorialItem,
  occasion: OutfitOccasionId | 'todays_look' | undefined,
): boolean {
  if (!occasion || occasion === 'custom') return true;
  if (isSleepwear(item)) return false;
  if (isBeachwear(item)) return false;
  if (SOCIAL_OR_PROFESSIONAL.has(occasion) && isActive(item)) return false;
  if (occasion === 'work_outfit' && isCasualLoungewear(item)) return false;
  if (occasion === 'smart_casual' && /\b(hoodies?|hooded sweat|joggers?|sweatpants?|track pants?)\b/.test(itemText(item))) {
    return false;
  }
  if (occasion === 'gym' && isFormalShoes(item)) return false;
  return true;
}

/** Full-outfit check — label must match what was actually allocated. */
export function outfitMeetsOccasionStandard(
  items: EditorialItem[],
  occasion: OutfitOccasionId | 'todays_look',
): boolean {
  if (!items.length) return false;
  if (!items.every((item) => passesEditorialOccasionGate(item, occasion))) return false;

  const signals = items.map((item) => classifyItem(item as WardrobeItem));
  const minTier = Math.min(...signals.map((s) => s.formalityTier));

  if (occasion === 'work_outfit') {
    if (minTier < 3) return false;
    if (signals.some((s) => s.isHoodie || s.isJoggers || s.isAthleticTop || s.isAthleticBottom)) {
      return false;
    }
    if (signals.some((s) => s.isCasualTrainer || s.isAthleticShoes) && !signals.some((s) => s.isFormalShoes || s.isDressShirt || s.isBlazer)) {
      return false;
    }
  }

  if (occasion === 'smart_casual') {
    if (signals.some((s) => s.isHoodie || s.isJoggers || s.isAthleticBottom)) return false;
  }

  return true;
}

export function occasionLabelForType(occasion: OutfitOccasionId | 'todays_look'): string {
  switch (occasion) {
    case 'work_outfit':
      return 'Work / office';
    case 'smart_casual':
      return 'Smart casual';
    case 'date_night':
      return 'Date night';
    case 'evening_out':
      return 'Evening out';
    case 'weekend':
      return 'Weekend';
    case 'gym':
      return 'Gym';
    case 'travel':
      return 'Travel';
    case 'casual_day':
    case 'todays_look':
    default:
      return 'Everyday';
  }
}

export const EDITORIAL_SCORE_LABELS = {
  exceptional: 'Exceptional edit',
  strong: 'Strong, resolved look',
  good: 'Credible with one refinement',
  developing: 'Needs a concrete edit',
} as const;

export function editorialScoreLabel(score: number): string {
  if (score >= 95) return EDITORIAL_SCORE_LABELS.exceptional;
  if (score >= 82) return EDITORIAL_SCORE_LABELS.strong;
  if (score >= 65) return EDITORIAL_SCORE_LABELS.good;
  return EDITORIAL_SCORE_LABELS.developing;
}
