import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { WardrobeItem } from '@/contexts/WardrobeContext';

type EditorialItem = Pick<WardrobeItem, 'name' | 'category'> & {
  subcategory?: string | null;
};

function itemText(item: EditorialItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

function isActive(item: EditorialItem): boolean {
  return item.category.includes('activewear')
    || /\b(gym|training|running|compression|sports bra|performance (?:tee|top|tank|hoodie|jersey|shorts?)|workout|legging|track pant)\b/.test(itemText(item));
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
  if (occasion === 'gym' && isFormalShoes(item)) return false;
  return true;
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
