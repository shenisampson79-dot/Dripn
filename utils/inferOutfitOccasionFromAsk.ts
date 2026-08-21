import type { OutfitOccasionId } from '@/constants/outfitOccasions';

/**
 * Map free-text stylist asks onto allocator occasion ids.
 * Prefer dressier reads when the ask mixes casual + elevated (e.g. nice dinner).
 */
export function inferOutfitOccasionFromAsk(
  text: string,
  fallback: OutfitOccasionId = 'casual_day',
): OutfitOccasionId {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return fallback;

  if (/\b(gym|workout|training|run|exercise)\b/.test(t)) return 'gym';

  // Dinner / evening elevation — even when "casual" is also mentioned.
  if (
    /\b(dinner|date night|date-night|anniversary|cocktail|theatre|theater|opera)\b/.test(t)
    || /\b(somewhere|place)\s+nice\b/.test(t)
    || /\bnice\s+(dinner|evening|restaurant|place)\b/.test(t)
    || /\b(smart|dressy|elevated|polished)\b.{0,40}\b(casual|dinner|evening|night)\b/.test(t)
    || /\bcasual\b.{0,40}\b(nice|dinner|restaurant|evening)\b/.test(t)
  ) {
    if (/\b(date|romantic|anniversary)\b/.test(t)) return 'date_night';
    return 'evening_out';
  }

  if (/\b(evening out|night out|drinks|cocktails?|party|club)\b/.test(t)) return 'evening_out';
  if (/\b(date)\b/.test(t)) return 'date_night';
  // Social pubs before generic "meeting" (friends meeting ≠ work meeting)
  if (/\b(pub|friends|park|errands|daytime|casual day|brunch)\b/.test(t)) return 'casual_day';
  if (/\b(work|office|interview|client)\b/.test(t) || /\bwork\s+meeting\b|\bmeeting\s+at\s+(the\s+)?office\b/.test(t)) {
    return 'work_outfit';
  }
  if (/\b(smart casual|business casual|elevated)\b/.test(t)) return 'smart_casual';
  if (/\b(travel|airport|flight|packing)\b/.test(t)) return 'travel';
  if (/\b(weekend|saturday|sunday)\b/.test(t)) return 'weekend';

  return fallback;
}

/** Bump formality when the user rejects a look as too casual / not dinner-appropriate. */
export function raiseOccasionForRefine(
  prior: string | null | undefined,
  refineText: string,
): OutfitOccasionId {
  const inferred = inferOutfitOccasionFromAsk(refineText, 'smart_casual');
  if (
    inferred === 'evening_out'
    || inferred === 'date_night'
    || inferred === 'work_outfit'
    || inferred === 'smart_casual'
  ) {
    return inferred;
  }

  const priorNorm = String(prior || '').toLowerCase().replace(/\s+/g, '_');
  if (priorNorm.includes('date')) return 'date_night';
  if (priorNorm.includes('evening') || priorNorm.includes('dinner')) return 'evening_out';
  if (priorNorm.includes('work')) return 'work_outfit';
  if (priorNorm.includes('smart')) return 'smart_casual';
  if (
    /\b(not appropriate|too casual|dressier|smarter|more formal|nice dinner|dinner)\b/i.test(
      refineText,
    )
  ) {
    return 'evening_out';
  }
  if (priorNorm.includes('weekend') || priorNorm.includes('casual')) return 'smart_casual';
  return (priorNorm as OutfitOccasionId) || 'smart_casual';
}
