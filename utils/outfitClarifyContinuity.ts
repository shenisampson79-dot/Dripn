/**
 * Outfit lock / Tier-B clarification continuity — client FSM (mirrors travel clarify).
 *
 * After server `partial_lock_clarify`, preserve the pending outfit task so a
 * natural short reply re-enters POST /api/chat/outfit-from-wardrobe with frozen
 * originalUserMessage + merged locks.
 *
 * After server `allocator_tier_b_narrow`, preserve the pending outfit task so the
 * user's narrowing reply re-enters the same canonical path with frozen ask +
 * explicit `occasion` override from a structured Tier-B choice (never resilient
 * freestyle). Do NOT send skipTierGuard / tierBNarrowResolved — the normal
 * tier guard re-evaluates the bound occasion pool.
 *
 * Readiness invariant (lock clarify): complete only when every required
 * structural slot is resolved unambiguously and expectedLockCount is satisfied.
 *
 * Spec: docs/qa/STYLIST_CHAT_OUTFIT_CONTINUITY_SPEC.md
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { isMultiDayTravelOutfitAsk } from '@/utils/multiDayTravelClarify';
import { matchWardrobeItemsInText } from '@/utils/wardrobeMentionMatcher';

export const OUTFIT_LOCK_CLARIFY_FLOW = 'outfit_lock_clarify' as const;
export const OUTFIT_TIER_B_NARROW_FLOW = 'outfit_tier_b_narrow' as const;

/** Launch Tier-B choice ids ≡ authoritative allocator occasions (server SSoT mirror). */
export const TIER_B_STRUCTURED_OCCASIONS = [
  'smart_casual',
  'evening_out',
  'work_outfit',
  'gym',
  'date_night',
] as const;

export type TierBStructuredOccasion = (typeof TIER_B_STRUCTURED_OCCASIONS)[number];

/**
 * Map Tier-B chip id or typed reply → structured occasion.
 * Returns null for coffee / walk / relaxed everyday (still broad — no bypass).
 */
export function resolveTierBStructuredOccasion(raw: string): TierBStructuredOccasion | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const asKey = text.toLowerCase().replace(/[-\s]+/g, '_');
  if ((TIER_B_STRUCTURED_OCCASIONS as readonly string[]).includes(asKey)) {
    return asKey as TierBStructuredOccasion;
  }
  if (/\b(lunch|drinks?|pub|pint|brewery|wine\s*bar|smart\s*casual)\b/i.test(text)) {
    return 'smart_casual';
  }
  if (/\b(dinner|restaurant|somewhere\s+nice(?:r)?|evening\s+out|cocktail)\b/i.test(text)) {
    return 'evening_out';
  }
  if (/\b(work(?:day|place|wear)?|office|meeting|interview|business)\b/i.test(text)) {
    return 'work_outfit';
  }
  if (/\b(gym|workout|training|active|athleisure|hiit|sport)\b/i.test(text)) {
    return 'gym';
  }
  if (/\b(date|romantic)\b/i.test(text)) {
    return 'date_night';
  }
  return null;
}

export type OutfitClarifyFlow =
  | typeof OUTFIT_LOCK_CLARIFY_FLOW
  | typeof OUTFIT_TIER_B_NARROW_FLOW;

export type OutfitClarifyState = 'AWAITING_PIECE' | 'READY' | 'DONE';

export type OutfitClarifyWeatherSnap = {
  temperature: number;
  condition: string;
} | null;

/** Structural garment slots used for readiness and pending-slot validation. */
export type StructuralSlot = 'top' | 'blazer_or_outerwear' | 'bottom' | 'shoes' | 'other';

export type OutfitClarifyPending = {
  flow: OutfitClarifyFlow;
  state: OutfitClarifyState;
  originalUserMessage: string;
  occasion: string;
  lockedItemIds: string[];
  expectedLockCount: number;
  pendingSlot?: 'second_piece' | 'blazer' | 'garment';
  createdAt: string;
  weather?: OutfitClarifyWeatherSnap;
  lat?: number | null;
  /** How many times we already continued after a short clarify reply (anti-loop). */
  continuationCount?: number;
};

export type OutfitRouteDecision =
  | {
      route: 'outfit-from-wardrobe';
      reason: 'outfit_task' | 'hard_lock' | 'pending_ready' | 'tier_b_ready' | 'refine';
      pending?: OutfitClarifyPending;
      /** Frozen turn-1 ask when continuing after clarify — never the short reply alone. */
      userMessageForServer: string;
      lockedItemIds: string[];
      occasion: string;
      weather?: OutfitClarifyWeatherSnap;
      lat?: number | null;
      /**
       * True when the Tier-B reply did not bind a structured occasion
       * (coffee / relaxed). Server must re-apply the guard and return
       * second-step copy — never skipTierGuard.
       */
      tierBStillBroad?: boolean;
    }
  | { route: 'cancel_pending'; pending: null }
  | { route: 'drop_pending_unrelated'; pending: null }
  | { route: 'awaiting_more'; pending: OutfitClarifyPending; clarifyHint?: string }
  | { route: 'other' };

export type AdvanceOutfitClarifyResult = {
  state: OutfitClarifyState;
  lockedItemIds: string[];
  ready: boolean;
  pending: OutfitClarifyPending;
  clarifyHint?: string;
  ambiguous?: boolean;
  wrongSlot?: boolean;
};

type MessageLike = {
  role?: string;
  outfitClarify?: OutfitClarifyPending | null;
  hasOutfitRecommendation?: boolean;
  wardrobeVisual?: unknown;
};

type ScoredWardrobeMatch = {
  item: WardrobeItem;
  score: number;
};

const MATCH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'with', 'in', 'of', 'for', 'your', 'my', 'from',
  'cotton', 'linen', 'wool', 'leather', 'light', 'dark', 'soft', 'pair', 'wear',
  'carry', 'this', 'works', 'because', 'optional', 'use', 'actually', 'instead',
]);

function normalizeForMatch(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSignificantTokens(value: string) {
  return normalizeForMatch(value)
    .split(' ')
    .filter((word) => word.length > 2 && !MATCH_STOP_WORDS.has(word));
}

/** Local token scorer — mirrors wardrobeMentionMatcher scoring for clarify replies. */
export function scoreClarifyTextMatch(itemSurface: string, query: string): number {
  const normName = normalizeForMatch(itemSurface);
  const normText = normalizeForMatch(query);
  if (!normName || !normText) return 0;

  if (normText.includes(normName)) return normName.length + 50;

  const tokens = getSignificantTokens(itemSurface);
  if (tokens.length === 0) return 0;

  const matched = tokens.filter((token) => normText.includes(token));
  const ratio = matched.length / tokens.length;

  if (matched.length >= 2 && ratio >= 0.38) {
    return matched.join('').length + ratio * 20;
  }
  if (tokens.length === 1 && matched.length === 1) {
    return matched[0].length;
  }
  return 0;
}

function itemMatchSurfaces(item: WardrobeItem): string[] {
  const name = String(item.name || '').trim();
  const alias = [item.brand, item.color, name].filter(Boolean).join(' ');
  return alias === name ? [name] : [name, alias];
}

function wardrobeById(wardrobeItems: WardrobeItem[]): Map<string, WardrobeItem> {
  return new Map(wardrobeItems.map((item) => [String(item.id), item]));
}

function lookupLockedItems(ids: string[], wardrobeItems: WardrobeItem[]): WardrobeItem[] {
  const byId = wardrobeById(wardrobeItems);
  return ids.map((id) => byId.get(String(id))).filter((item): item is WardrobeItem => Boolean(item));
}

function itemTextBlob(item: WardrobeItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''} ${item.brand || ''}`.toLowerCase();
}

/** Map a wardrobe item to its structural slot for lock validation. */
export function inferItemStructuralSlot(item: WardrobeItem): StructuralSlot {
  const blob = itemTextBlob(item);
  const cat = String(item.category || '').toLowerCase();

  if (cat === 'shoes' || /\b(shoe|boot|trainer|sneaker|loafers?|footwear|ugg)\b/.test(blob)) {
    return 'shoes';
  }
  if (cat === 'bottoms' || /\b(trouser|pant|jean|short|skirt|chino|cargo)\b/.test(blob)) {
    return 'bottom';
  }
  if (/\bblazer\b/.test(blob)) return 'blazer_or_outerwear';
  if (cat === 'outerwear' || /\b(jacket|coat|overcoat|gilet)\b/.test(blob)) {
    return 'blazer_or_outerwear';
  }
  if (cat === 'tops' || /\b(tee|shirt|top|polo|tank|blouse|henley|sweater|jumper|hoodie|running)\b/.test(blob)) {
    return 'top';
  }
  return 'other';
}

function structuralSlotMatchesRequired(itemSlot: StructuralSlot, required: StructuralSlot): boolean {
  if (required === itemSlot) return true;
  if (required === 'blazer_or_outerwear' && itemSlot === 'blazer_or_outerwear') return true;
  return false;
}

/** Infer required structural slots from the original outfit ask. */
export function inferRequiredStructuralSlotsFromAsk(
  originalAsk: string,
  expectedCount: number,
): StructuralSlot[] {
  const t = String(originalAsk || '').toLowerCase();
  const slots: StructuralSlot[] = [];

  if (/\b(running top|performance top|gym top|training top|tee|shirt|top|tank|blouse|polo|henley|jumper|sweater|hoodie|chambray)\b/.test(t)) {
    slots.push('top');
  }
  if (/\b(blazer|jacket|coat|outerwear)\b/.test(t)) {
    slots.push('blazer_or_outerwear');
  }
  if (/\b(trouser|pant|jean|short|skirt|bottom|chino)\b/.test(t)) {
    slots.push('bottom');
  }
  if (/\b(shoe|boot|trainer|sneaker|loafer|footwear)\b/.test(t)) {
    slots.push('shoes');
  }

  const expected = Math.max(1, expectedCount || 1);
  while (slots.length < expected) {
    slots.push('other');
  }
  return slots.slice(0, expected);
}

function pendingSlotToStructuralTargets(
  pendingSlot: OutfitClarifyPending['pendingSlot'],
  originalAsk: string,
  priorLockedItems: WardrobeItem[],
): StructuralSlot[] {
  if (pendingSlot === 'blazer') return ['blazer_or_outerwear'];
  if (pendingSlot === 'second_piece') {
    const required = inferRequiredStructuralSlotsFromAsk(originalAsk, Math.max(2, priorLockedItems.length + 1));
    const filled = new Set(priorLockedItems.map(inferItemStructuralSlot));
    return required.filter((slot) => !filled.has(slot));
  }
  const required = inferRequiredStructuralSlotsFromAsk(originalAsk, Math.max(2, priorLockedItems.length + 1));
  const filled = new Set(priorLockedItems.map(inferItemStructuralSlot));
  const missing = required.filter((slot) => !filled.has(slot));
  return missing.length ? missing : ['other'];
}

/** True when the item satisfies the currently pending unresolved slot(s). */
export function itemSatisfiesPendingSlot(
  item: WardrobeItem,
  pendingSlot: OutfitClarifyPending['pendingSlot'],
  priorLockedItems: WardrobeItem[],
  originalAsk: string,
): boolean {
  const itemSlot = inferItemStructuralSlot(item);
  const targets = pendingSlotToStructuralTargets(pendingSlot, originalAsk, priorLockedItems);

  if (!targets.length) return false;

  if (targets.some((target) => structuralSlotMatchesRequired(itemSlot, target))) {
    if (pendingSlot === 'second_piece' || pendingSlot === 'garment') {
      const priorSlots = priorLockedItems.map(inferItemStructuralSlot);
      if (priorSlots.includes(itemSlot) && itemSlot !== 'other') return false;
    }
    return true;
  }
  return false;
}

/** Infer which slot Ivy is still waiting on after partial resolution. */
export function inferNextPendingSlot(
  prior: OutfitClarifyPending,
  lockedItemIds: string[],
  wardrobeItems: WardrobeItem[],
): OutfitClarifyPending['pendingSlot'] {
  const lockedItems = lookupLockedItems(lockedItemIds, wardrobeItems);
  const required = inferRequiredStructuralSlotsFromAsk(
    prior.originalUserMessage,
    prior.expectedLockCount,
  );
  const filled = new Set(lockedItems.map(inferItemStructuralSlot));

  for (const slot of required) {
    if (!filled.has(slot)) {
      if (slot === 'blazer_or_outerwear') return 'blazer';
      return 'garment';
    }
  }
  return lockedItems.length < prior.expectedLockCount ? 'second_piece' : 'garment';
}

/**
 * Readiness predicate — BOTH lock count AND every required structural slot satisfied.
 * Finding any wardrobe item alone never makes the task READY.
 */
export function evaluateOutfitClarifyReadiness(
  prior: OutfitClarifyPending,
  lockedItemIds: string[],
  wardrobeItems: WardrobeItem[],
): boolean {
  const expected = Math.max(1, Number(prior.expectedLockCount) || 1);
  if (lockedItemIds.length < expected) return false;

  const lockedItems = lookupLockedItems(lockedItemIds, wardrobeItems);
  if (lockedItems.length < expected) return false;

  const required = inferRequiredStructuralSlotsFromAsk(prior.originalUserMessage, expected);

  for (const req of required) {
    if (req === 'other') continue;
    if (!lockedItems.some((item) => structuralSlotMatchesRequired(inferItemStructuralSlot(item), req))) {
      return false;
    }
  }

  return true;
}

export function looksLikeSlotCorrection(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    /\b(actually|instead|rather|not that|wrong one)\b/i.test(t)
    || /\b(use|wear|pick|choose)\b.{0,40}\b(the|my)\b.{0,40}\b(instead|rather)\b/i.test(t)
    || /\b(swap|change)\b.{0,24}\b(to|for)\b/i.test(t)
  );
}

function scoreClarifyItemMatch(item: WardrobeItem, query: string): number {
  return Math.max(...itemMatchSurfaces(item).map((surface) => scoreClarifyTextMatch(surface, query)), 0);
}

/** Score and rank clarify reply candidates (brand/color alias included). */
export function matchClarifyCandidatesScored(
  query: string,
  wardrobeItems: WardrobeItem[],
  limit = 8,
): ScoredWardrobeMatch[] {
  const seen = new Set<string>();
  const scored: ScoredWardrobeMatch[] = [];

  for (const item of wardrobeItems) {
    const score = scoreClarifyItemMatch(item, query);
    if (score <= 0 || seen.has(String(item.id))) continue;
    seen.add(String(item.id));
    scored.push({ item, score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

function isAmbiguousAmongCandidates(candidates: ScoredWardrobeMatch[]): boolean {
  if (candidates.length <= 1) return false;
  const [top, second] = candidates;
  const scoreDiff = top.score - second.score;
  const ratio = top.score > 0 ? second.score / top.score : 0;
  return scoreDiff < 12 && ratio >= 0.72;
}

function formatItemLabel(item: WardrobeItem): string {
  const parts = [item.color, item.brand, item.name].filter(Boolean);
  return parts.join(' ').trim() || String(item.name || 'item');
}

export function buildAmbiguityClarifyHint(candidates: WardrobeItem[], pendingSlot?: OutfitClarifyPending['pendingSlot']): string {
  const labels = candidates.slice(0, 4).map(formatItemLabel);
  const slotWord = pendingSlot === 'blazer' ? 'blazer' : 'piece';
  if (labels.length === 2) {
    return `I found two ${slotWord}s that could work — ${labels[0]} or ${labels[1]}?`;
  }
  return `I found a few ${slotWord}s that could work — ${labels.join(', ')}. Which one did you mean?`;
}

export function buildWrongSlotClarifyHint(pendingSlot?: OutfitClarifyPending['pendingSlot']): string {
  if (pendingSlot === 'blazer') {
    return "That doesn't look like the blazer I'm waiting for — which blazer from your wardrobe did you mean?";
  }
  return "That piece doesn't match what I'm waiting for — which item from your wardrobe did you mean?";
}

export function emptyOutfitClarifyState(): OutfitClarifyPending {
  return {
    flow: OUTFIT_LOCK_CLARIFY_FLOW,
    state: 'DONE',
    originalUserMessage: '',
    occasion: 'casual_day',
    lockedItemIds: [],
    expectedLockCount: 1,
    createdAt: new Date().toISOString(),
  };
}

/** Multi-day / celebrity style refs — not single-look wardrobe create. */
function isMultiLookOrStyleReferenceAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    isMultiDayTravelOutfitAsk(t)
    || /\bdress me like\b|\bstyle me like\b|\bin the style of\b/i.test(t)
    || /\blike\s+[A-Z][A-Za-z0-9.'’\-]+(?:\s+[A-Z][A-Za-z0-9.'’\-]+){0,3}\b/.test(t)
  );
}

/**
 * Conversational formality / styling advice — must NOT route to outfit-from-wardrobe.
 * Covers C2 how-to and C6 “make it smarter but still relaxed”.
 */
export function isStylingAdviceHowAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\bfrom my (wardrobe|closet)\b/i.test(t)) return false;
  if (/\b(create|build|put together)\b.{0,40}\b(outfit|look)\b/i.test(t)) return false;
  if (/\b(show me|find me|generate)\b.{0,40}\b(outfit|look)\b/i.test(t)) return false;
  if (/\b(different|another)\s+(outfit|look)\b/i.test(t)) return false;
  if (
    /\bhow (would|do|can|should) i\b/i.test(t)
    && /\b(smarter|dressier|sharper|more formal|overdress|style|look)\b/i.test(t)
  ) {
    return true;
  }
  if (/\bmake it look (smarter|dressier|sharper|better|more formal|more casual)\b/i.test(t)) {
    return true;
  }
  if (
    /\bmake it (smarter|dressier|sharper|better|more formal|more casual|more relaxed|more smart)\b/i.test(t)
    && /\b(but|while|without|still|keep(ing)?(\s+it)?)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\bmake it more (casual|relaxed|smart|dressy)\b/i.test(t)
    && !/\b(outfit|look|wardrobe)\b/i.test(t)
  ) {
    return true;
  }
  if (/\bwithout (looking|being) overdressed\b/i.test(t)) return true;
  if (
    /\b(don['\u2019]?t like that|do not like that)\b/i.test(t)
    && /\b(another option|something (else|different)|give (me )?another)\b/i.test(t)
    && !/\b(outfit|look|wardrobe|shoes?|tops?|bottoms?)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * Wear-intent phrasing — "what should I wear" and natural variants such as
 * "what I should I wear" (extra subject pronoun before the modal).
 */
export function isWhatToWearAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/\bwhat (should|can|do) i wear\b/i.test(t)) return true;
  if (/\bwhat i (should|can|do) i wear\b/i.test(t)) return true;
  return false;
}

/** Existing single-look create regex (moved here so isOutfitTaskAsk is one gate). */
export function isSingleLookWardrobeCreateAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || isMultiLookOrStyleReferenceAsk(t)) return false;
  // "make it look smarter…" is advice, not "make … look/outfit"
  if (isStylingAdviceHowAsk(t)) return false;
  return (
    /\b(create|build|put together|make|pick|suggest|recommend)\b.{0,40}\b(outfit|look)\b/i.test(t)
    || isWhatToWearAsk(t)
    || /\bfrom my (wardrobe|closet|mobile|phone)\b/i.test(t)
    || /\boutfit for (today|tonight|tomorrow)\b/i.test(t)
    || /\bwear today\b|\blook for today\b/i.test(t)
  );
}

/**
 * Natural hard-lock phrasing — must NOT require "from my wardrobe" or repeated "build an outfit".
 * Spec Fixture B: "I definitely want to wear my chambray shirt. Build the rest around it."
 */
export function isWardrobeHardLockAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || isMultiLookOrStyleReferenceAsk(t)) return false;

  const wearMyHero =
    /\b(definitely |really |absolutely )?(want to |wanna |need to |gotta )?wear my\b/i.test(t)
    || /\bi('m| am) (definitely |really )?wearing my\b/i.test(t);

  const buildAround =
    /\bbuild (the )?rest around (it|that|this)\b/i.test(t)
    || /\bbuild .{0,24}\baround (it|that|this|those)\b/i.test(t)
    || /\bput together .{0,40}\baround\b/i.test(t)
    || /\bbuild the (outfit|look) around\b/i.test(t);

  const wearMyOccasion =
    /\bwear my\b.{0,80}\b(tonight|this afternoon|this evening|today|to dinner|for dinner)\b/i.test(t);

  return (wearMyHero && (buildAround || wearMyOccasion || /\b(shirt|top|tee|blazer|jacket|jumper|sweater|hoodie)\b/i.test(t)))
    || (buildAround && /\b(wear|using|with) my\b/i.test(t))
    || (wearMyHero && buildAround);
}

/** Outfit task = classic create regex OR natural hard-lock. */
export function isOutfitTaskAsk(text: string): boolean {
  return isSingleLookWardrobeCreateAsk(text) || isWardrobeHardLockAsk(text);
}

/** Thin refine follow-ups (mirror AIStylistScreen — kept here for Fixture E). */
export function isWardrobeOutfitRefineAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  // Open advice "how would I make it look smarter" is not a published-look refine.
  if (isStylingAdviceHowAsk(t)) return false;
  if (
    /\bkeep\b.{0,24}\b(shoe|shoes|trainer|trainers|sneaker|sneakers|boot|boots|footwear)\b/i.test(t)
    || (
      /\b(change|swap|different|other|new)\b.{0,40}\b(top|tops|bottom|bottoms|trousers?|pants?|shorts?)\b/i.test(t)
      && /\b(shoe|shoes|trainer|trainers|boot|boots|footwear)\b/i.test(t)
      && /\b(keep|same|still)\b/i.test(t)
    )
    || /\b(change|swap|different)\b.{0,40}\b(top|tops)\b.{0,24}\b(and|&)\b.{0,16}\b(bottom|bottoms)\b/i.test(t)
  ) {
    return true;
  }
  return (
    /\b(swap|change|different|other)\b.{0,24}\b(shoe|shoes|trainer|trainers|sneaker|sneakers|boot|boots|footwear)\b/i.test(t)
    || /\b(shoe|shoes|trainer|trainers|boot|boots)\b.{0,16}\b(swap|change|different|other)\b/i.test(t)
    || /\bmake it (smarter|dressier|sharper|smarter looking|more smart|more formal|better)\b/i.test(t)
    || /\b(smarter|dressier|sharper)\b/i.test(t)
    || /\bdifferent (outfit|look)\b/i.test(t)
    || /\btry (again|another|something else)\b/i.test(t)
    || /\b(don'?t like|do not like|not appropriate|another option|another look|give me another|something different)\b/i.test(t)
    || /\b(reject|hate)\b.{0,24}\b(outfit|look)\b/i.test(t)
    || /\b(hotter|cooler|warmer|for (?:the )?gym|gym (?:look|outfit)|refine)\b/i.test(t)
  );
}

export function isOutfitClarifyReady(
  state: OutfitClarifyPending | null | undefined,
  wardrobeItems: WardrobeItem[] = [],
): boolean {
  if (!state || state.state === 'DONE') return false;
  if (state.state === 'READY') return true;
  return evaluateOutfitClarifyReadiness(state, state.lockedItemIds || [], wardrobeItems);
}

export function looksLikeOutfitClarifyCancel(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    /\b(never mind|nevermind|forget (it|that)|cancel|scratch that|different question|changed my mind)\b/i.test(t)
    || /\b(stop|don't|do not)\b.{0,16}\b(outfit|look|bother)\b/i.test(t)
  );
}

/**
 * Unrelated topic while outfit clarify pending — drop and route normally.
 * Spec Fixture C: "Who invented the little black dress?"
 */
export function looksLikeUnrelatedChatDuringOutfitClarify(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  if (isOutfitTaskAsk(t) || isWardrobeOutfitRefineAsk(t)) return false;
  // Short garment answers stay related
  if (t.length <= 80 && /\b(blazer|shirt|top|tee|jacket|boot|shoe|jean|trouser|jumper|sweater|hoodie|next|nike|primark)\b/i.test(t)) {
    return false;
  }
  if (isMultiDayTravelOutfitAsk(t)) return true;
  if (/\bshould i buy\b|\bwhich should i (buy|get)\b|\bbetween\b.{0,40}\b(buy|get)\b/i.test(t)) return true;
  if (
    /\b(who invented|who created|who designed|history of|what is|when did|tell me about)\b/i.test(t)
    && !/\bwear\b|\boutfit\b|\blook\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function isOutfitClarifyFlow(flow: unknown): flow is OutfitClarifyFlow {
  return flow === OUTFIT_LOCK_CLARIFY_FLOW || flow === OUTFIT_TIER_B_NARROW_FLOW;
}

export function findPendingOutfitClarify(
  messages: MessageLike[],
): OutfitClarifyPending | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    const oc = msg.outfitClarify;
    // Pending clarify wins even if the bubble also has a visual/recommendation flag.
    if (oc && isOutfitClarifyFlow(oc.flow) && oc.state !== 'DONE') {
      return { ...oc, lockedItemIds: [...(oc.lockedItemIds || [])] };
    }
    // Stop at published outfit or completed clarify
    if (oc?.state === 'DONE') return null;
    if (msg.hasOutfitRecommendation || msg.wardrobeVisual) return null;
  }
  return null;
}

/**
 * Resolve a short clarify reply against wardrobe — include brand/color in the
 * match surface so brand+colour tokens in the reply can hit structured fields.
 */
export function matchClarifyReplyItems(
  query: string,
  wardrobeItems: WardrobeItem[],
  limit = 4,
): WardrobeItem[] {
  return matchClarifyCandidatesScored(query, wardrobeItems, limit).map((entry) => entry.item);
}

/** Build server userMessage after clarify — keep original ask, append confirmation. */
export function buildContinuedOutfitUserMessage(
  originalUserMessage: string,
  shortReply: string,
): string {
  const original = String(originalUserMessage || '').trim();
  const reply = String(shortReply || '').trim();
  if (!original) return reply;
  if (!reply) return original;
  return `${original}\n\nUser confirmed piece: ${reply}`;
}

/** Merge Tier-B narrowing answer into the frozen broad outfit ask. */
export function buildContinuedTierBUserMessage(
  originalUserMessage: string,
  narrowReply: string,
): string {
  const original = String(originalUserMessage || '').trim();
  const reply = String(narrowReply || '').trim();
  if (!original) return reply;
  if (!reply) return original;
  return `${original}\n\nUser narrowed intent: ${reply}`;
}

export function buildOutfitClarifyFromPartialLock(params: {
  originalUserMessage: string;
  occasion: string;
  lockedItemIds?: Array<string | number>;
  expectedLockCount?: number;
  weather?: OutfitClarifyWeatherSnap;
  lat?: number | null;
  pendingSlot?: OutfitClarifyPending['pendingSlot'];
}): OutfitClarifyPending {
  const locks = [...new Set((params.lockedItemIds || []).map(String).filter(Boolean))];
  const dualAsk = /\b(and|with)\b/i.test(params.originalUserMessage)
    && /\b(top|blazer|shirt|tee|tank|jacket)\b/i.test(params.originalUserMessage);
  const expected = Math.max(
    1,
    params.expectedLockCount
      ?? (dualAsk ? 2 : Math.max(locks.length + 1, 1)),
  );
  return {
    flow: OUTFIT_LOCK_CLARIFY_FLOW,
    state: 'AWAITING_PIECE',
    originalUserMessage: String(params.originalUserMessage || '').trim(),
    occasion: String(params.occasion || 'casual_day').trim() || 'casual_day',
    lockedItemIds: locks,
    expectedLockCount: expected,
    pendingSlot: params.pendingSlot || (/\bblazer\b/i.test(params.originalUserMessage) ? 'blazer' : 'garment'),
    createdAt: new Date().toISOString(),
    weather: params.weather ?? null,
    lat: params.lat ?? null,
  };
}

/**
 * Persist pending after allocator Tier-B narrowing (no piece locks — intent only).
 */
export function buildOutfitClarifyFromTierBNarrow(params: {
  originalUserMessage: string;
  occasion: string;
  weather?: OutfitClarifyWeatherSnap;
  lat?: number | null;
}): OutfitClarifyPending {
  return {
    flow: OUTFIT_TIER_B_NARROW_FLOW,
    state: 'AWAITING_PIECE',
    originalUserMessage: String(params.originalUserMessage || '').trim(),
    occasion: String(params.occasion || 'casual_day').trim() || 'casual_day',
    lockedItemIds: [],
    expectedLockCount: 0,
    createdAt: new Date().toISOString(),
    weather: params.weather ?? null,
    lat: params.lat ?? null,
  };
}

export function advanceOutfitClarify(params: {
  query: string;
  prior: OutfitClarifyPending;
  wardrobeItems: WardrobeItem[];
}): AdvanceOutfitClarifyResult {
  const prior = params.prior;
  const priorIds = prior.lockedItemIds || [];
  const priorItems = lookupLockedItems(priorIds, params.wardrobeItems);
  const isCorrection = looksLikeSlotCorrection(params.query);

  const scored = matchClarifyCandidatesScored(params.query, params.wardrobeItems, 8);
  const slotCandidates = scored.filter((entry) =>
    itemSatisfiesPendingSlot(
      entry.item,
      prior.pendingSlot,
      priorItems,
      prior.originalUserMessage,
    ),
  );

  if (slotCandidates.length === 0) {
    const hadAnyMatch = scored.length > 0;
    return {
      state: 'AWAITING_PIECE',
      lockedItemIds: priorIds,
      ready: false,
      pending: { ...prior, state: 'AWAITING_PIECE' },
      wrongSlot: hadAnyMatch,
      clarifyHint: hadAnyMatch
        ? buildWrongSlotClarifyHint(prior.pendingSlot)
        : 'Which piece did you mean from your wardrobe?',
    };
  }

  if (isAmbiguousAmongCandidates(slotCandidates)) {
    return {
      state: 'AWAITING_PIECE',
      lockedItemIds: priorIds,
      ready: false,
      pending: { ...prior, state: 'AWAITING_PIECE' },
      ambiguous: true,
      clarifyHint: buildAmbiguityClarifyHint(
        slotCandidates.map((entry) => entry.item),
        prior.pendingSlot,
      ),
    };
  }

  const chosen = slotCandidates[0].item;
  const chosenId = String(chosen.id);
  const chosenSlot = inferItemStructuralSlot(chosen);

  let lockedItemIds: string[];
  if (isCorrection) {
    lockedItemIds = [
      ...priorIds.filter((id) => {
        const item = params.wardrobeItems.find((w) => String(w.id) === String(id));
        return item ? inferItemStructuralSlot(item) !== chosenSlot : true;
      }),
      chosenId,
    ];
    lockedItemIds = [...new Set(lockedItemIds)];
  } else if (priorIds.includes(chosenId)) {
    lockedItemIds = priorIds;
  } else {
    lockedItemIds = [...new Set([...priorIds, chosenId])];
  }

  const ready = evaluateOutfitClarifyReadiness(prior, lockedItemIds, params.wardrobeItems);
  const pending: OutfitClarifyPending = {
    ...prior,
    lockedItemIds,
    pendingSlot: ready
      ? prior.pendingSlot
      : inferNextPendingSlot(prior, lockedItemIds, params.wardrobeItems),
    state: ready ? 'READY' : 'AWAITING_PIECE',
    continuationCount: ready
      ? Number(prior.continuationCount || 0) + 1
      : prior.continuationCount || 0,
  };

  return {
    state: pending.state,
    lockedItemIds,
    ready,
    pending,
  };
}

/**
 * Resolve client route for a user turn — pending merge BEFORE cold classification.
 * Spec C3–C5.
 */
export function resolveOutfitRoute(params: {
  userText: string;
  messages: MessageLike[];
  wardrobeItems: WardrobeItem[];
  hasPriorOutfitItems?: boolean;
}): OutfitRouteDecision {
  const text = String(params.userText || '').trim();
  if (!text) return { route: 'other' };

  const pending = findPendingOutfitClarify(params.messages);

  if (pending) {
    if (looksLikeOutfitClarifyCancel(text)) {
      return { route: 'cancel_pending', pending: null };
    }
    if (looksLikeUnrelatedChatDuringOutfitClarify(text)) {
      return { route: 'drop_pending_unrelated', pending: null };
    }

    // Tier-B: related reply re-enters outfit-from-wardrobe with occasionOverride
    // when the reply binds a structured lane. Unbound (coffee/relaxed) still
    // hits the same path so the normal guard returns second-step copy — no bypass.
    if (pending.flow === OUTFIT_TIER_B_NARROW_FLOW) {
      const boundOccasion = resolveTierBStructuredOccasion(text);
      return {
        route: 'outfit-from-wardrobe',
        reason: 'tier_b_ready',
        pending: {
          ...pending,
          state: 'DONE',
          continuationCount: Number(pending.continuationCount || 0) + 1,
        },
        userMessageForServer: buildContinuedTierBUserMessage(
          pending.originalUserMessage,
          text,
        ),
        lockedItemIds: [],
        occasion: boundOccasion || 'casual_day',
        weather: pending.weather ?? null,
        lat: pending.lat ?? null,
        tierBStillBroad: !boundOccasion,
      };
    }

    const advanced = advanceOutfitClarify({
      query: text,
      prior: pending,
      wardrobeItems: params.wardrobeItems,
    });

    if (advanced.ready) {
      return {
        route: 'outfit-from-wardrobe',
        reason: 'pending_ready',
        pending: { ...advanced.pending, state: 'DONE' },
        userMessageForServer: buildContinuedOutfitUserMessage(
          pending.originalUserMessage,
          text,
        ),
        lockedItemIds: advanced.lockedItemIds,
        occasion: pending.occasion,
        weather: pending.weather ?? null,
        lat: pending.lat ?? null,
      };
    }

    return {
      route: 'awaiting_more',
      pending: advanced.pending,
      clarifyHint: advanced.clarifyHint || 'Which piece did you mean from your wardrobe?',
    };
  }

  if (isWardrobeOutfitRefineAsk(text) && params.hasPriorOutfitItems) {
    return {
      route: 'outfit-from-wardrobe',
      reason: 'refine',
      userMessageForServer: text,
      lockedItemIds: [],
      occasion: '',
    };
  }

  if (isOutfitTaskAsk(text)) {
    return {
      route: 'outfit-from-wardrobe',
      reason: isWardrobeHardLockAsk(text) && !isSingleLookWardrobeCreateAsk(text)
        ? 'hard_lock'
        : 'outfit_task',
      userMessageForServer: text,
      lockedItemIds: [],
      occasion: '',
    };
  }

  return { route: 'other' };
}

/** Mark clarify done after publish / structured refuse. */
export function clearOutfitClarify(
  pending: OutfitClarifyPending | null | undefined,
): OutfitClarifyPending | null {
  if (!pending) return null;
  return { ...pending, state: 'DONE' };
}
