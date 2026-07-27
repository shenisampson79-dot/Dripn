/**
 * Strip internal stylist-engine jargon from user-facing "Why this works" copy.
 */

const ENGINE_JARGON =
  /shared stylist engine|allocator\s*\+|clash gate|confidence gate|allocation mode|critique loop|intent\s*["']/i;

const FALLBACK =
  'A wearable mix from pieces you already own — colours and formality that work together.';

export function humanizeStylistMessage(raw?: string | null): string | undefined {
  const text = String(raw || '').trim();
  if (!text) return undefined;
  if (ENGINE_JARGON.test(text) || /^picked for intent/i.test(text)) {
    return FALLBACK;
  }
  return text;
}
