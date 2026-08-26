/**
 * Persist / hydrate structured outfit occasion for refine continuity.
 * Never infer from free-text prose — only authoritative message fields.
 */
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import { OUTFIT_OCCASION_OPTIONS } from '@/constants/outfitOccasions';

const STRUCTURED_OCCASION_IDS = new Set<string>(
  OUTFIT_OCCASION_OPTIONS.map((o) => o.id),
);

/** Accept only allocator-style occasion ids (not prose labels like "drinks"). */
export function asStructuredOutfitOccasion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const norm = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!norm) return null;
  if (STRUCTURED_OCCASION_IDS.has(norm)) return norm;
  return null;
}

export type OccasionBearingMessage = {
  role?: string;
  outfitOccasion?: string | null;
  outfitSuggestion?: { occasion?: string | null } | null;
  outfitVisualSuggestion?: { occasion?: string | null } | null;
  styleSession?: { occasion?: string | null } | null;
};

/**
 * Prefer explicit outfitOccasion, then other persisted structured fields.
 * styleSession.occasion only when already a structured OccasionId.
 */
export function pickPersistedOutfitOccasion(message: OccasionBearingMessage | null | undefined): string | null {
  if (!message) return null;
  return (
    asStructuredOutfitOccasion(message.outfitOccasion)
    || asStructuredOutfitOccasion(message.outfitSuggestion?.occasion)
    || asStructuredOutfitOccasion(message.outfitVisualSuggestion?.occasion)
    || asStructuredOutfitOccasion(message.styleSession?.occasion)
  );
}

/** Walk newest→oldest assistant messages for a structured prior occasion. */
export function extractPriorOutfitOccasion(
  messages: Array<OccasionBearingMessage | null | undefined>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;
    const occ = pickPersistedOutfitOccasion(msg);
    if (occ) return occ;
  }
  return null;
}

export type { OutfitOccasionId };
