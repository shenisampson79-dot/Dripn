import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import { compileRefineIntent, resolveRefineOccasion } from '@/utils/compileRefineIntent';

/** Bounded occasion negation — same principle as "stylish not formal". */
export function isNegatedDateNightAsk(text: string): boolean {
  const t = String(text || '');
  if (/\b(?:definitely\s+)?not\s+['"‘’“”]?(date[-\s]?night)\b/i.test(t)) return true;
  if (/\b(?:isn['’]?t|is\s+not|not)\s+a\s+date\b/i.test(t)) return true;
  return false;
}

/** Card title cue — negated date-night language must not become "Date night look". */
export function isDateNightLookTitleAsk(text: string): boolean {
  const lower = String(text || '').toLowerCase();
  return !isNegatedDateNightAsk(lower) && /date night|date-night/.test(lower);
}

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

  // Solemn ceremony — allocator uses work_outfit lane (server activityConstraints parity).
  if (/\b(funeral|memorial|wake|bereavement)\b/.test(t)) return 'work_outfit';

  const dateNightNegated = isNegatedDateNightAsk(t);

  // "stylish not formal" must not map to formal_event
  if (/\bnot\s+formal\b|\bnon-?formal\b|\bstylish\b/.test(t) && /\b(dinner|evening|elevated)\b/.test(t)) {
    return 'evening_out';
  }

  // Dinner / evening elevation — even when "casual" is also mentioned.
  // Negated "date night" must not enter this block via the date-night cue.
  if (
    /\b(dinner|anniversary|cocktail|theatre|theater|opera)\b/.test(t)
    || (!dateNightNegated && /\b(date night|date-night)\b/.test(t))
    || /\b(somewhere|place)\s+nice\b/.test(t)
    || /\bnice\s+(dinner|evening|restaurant|place)\b/.test(t)
    || /\b(smart|dressy|elevated|polished|stylish)\b.{0,40}\b(casual|dinner|evening|night)\b/.test(t)
    || /\bcasual\b.{0,40}\b(nice|dinner|restaurant|evening)\b/.test(t)
  ) {
    if (!dateNightNegated && /\b(date|romantic|anniversary)\b/.test(t)) return 'date_night';
    return 'evening_out';
  }

  if (/\b(evening out|night out|drinks|cocktails?|party|club)\b/.test(t)) return 'evening_out';
  if (!dateNightNegated && /\b(date)\b/.test(t)) return 'date_night';
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

/**
 * Contract 1: inherit prior occasion unless the refine ask has an explicit cue
 * or a formality-raise. Never treat the fallback default as an "inferred" occasion.
 */
export function raiseOccasionForRefine(
  prior: string | null | undefined,
  refineText: string,
): OutfitOccasionId {
  const priorNorm = String(prior || '').trim() || 'casual_day';
  const intent = compileRefineIntent(refineText, { priorOccasion: priorNorm });
  return (intent.occasion as OutfitOccasionId) || (priorNorm as OutfitOccasionId);
}

/** Explicit export for tests / callers that only need occasion resolution. */
export { resolveRefineOccasion };
