/**
 * Outfit lock clarification continuity — client FSM (mirrors travel clarify).
 *
 * After server `partial_lock_clarify`, preserve the pending outfit task so a
 * natural short reply ("The black Next blazer.") re-enters
 * POST /api/chat/outfit-from-wardrobe with frozen originalUserMessage + merged locks.
 *
 * Spec: docs/qa/STYLIST_CHAT_OUTFIT_CONTINUITY_SPEC.md
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { isMultiDayTravelOutfitAsk } from '@/utils/multiDayTravelClarify';
import { matchWardrobeItemsInText } from '@/utils/wardrobeMentionMatcher';

export const OUTFIT_LOCK_CLARIFY_FLOW = 'outfit_lock_clarify' as const;

export type OutfitClarifyState = 'AWAITING_PIECE' | 'READY' | 'DONE';

export type OutfitClarifyWeatherSnap = {
  temperature: number;
  condition: string;
} | null;

export type OutfitClarifyPending = {
  flow: typeof OUTFIT_LOCK_CLARIFY_FLOW;
  state: OutfitClarifyState;
  originalUserMessage: string;
  occasion: string;
  lockedItemIds: string[];
  expectedLockCount: number;
  pendingSlot?: 'second_piece' | 'blazer' | 'garment';
  createdAt: string;
  weather?: OutfitClarifyWeatherSnap;
  lat?: number | null;
};

export type OutfitRouteDecision =
  | {
      route: 'outfit-from-wardrobe';
      reason: 'outfit_task' | 'hard_lock' | 'pending_ready' | 'refine';
      pending?: OutfitClarifyPending;
      /** Frozen turn-1 ask when continuing after clarify — never the short reply alone. */
      userMessageForServer: string;
      lockedItemIds: string[];
      occasion: string;
      weather?: OutfitClarifyWeatherSnap;
      lat?: number | null;
    }
  | { route: 'cancel_pending'; pending: null }
  | { route: 'drop_pending_unrelated'; pending: null }
  | { route: 'awaiting_more'; pending: OutfitClarifyPending; clarifyHint?: string }
  | { route: 'other' };

type MessageLike = {
  role?: string;
  outfitClarify?: OutfitClarifyPending | null;
  hasOutfitRecommendation?: boolean;
  wardrobeVisual?: unknown;
};

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

/** Existing single-look create regex (moved here so isOutfitTaskAsk is one gate). */
export function isSingleLookWardrobeCreateAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t || isMultiLookOrStyleReferenceAsk(t)) return false;
  return (
    /\b(create|build|put together|make|pick|suggest|recommend)\b.{0,40}\b(outfit|look)\b/i.test(t)
    || /\bwhat (should|can|do) i wear\b/i.test(t)
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

export function isOutfitClarifyReady(state: OutfitClarifyPending | null | undefined): boolean {
  if (!state || state.state === 'DONE') return false;
  if (state.state === 'READY') return true;
  const expected = Math.max(1, Number(state.expectedLockCount) || 1);
  return (state.lockedItemIds || []).length >= expected;
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

export function findPendingOutfitClarify(
  messages: MessageLike[],
): OutfitClarifyPending | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    const oc = msg.outfitClarify;
    if (oc && oc.flow === OUTFIT_LOCK_CLARIFY_FLOW && oc.state !== 'DONE') {
      return { ...oc, lockedItemIds: [...(oc.lockedItemIds || [])] };
    }
    // Stop at published outfit or completed clarify
    if (oc?.state === 'DONE') return null;
    if (msg.hasOutfitRecommendation || msg.wardrobeVisual) return null;
  }
  return null;
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

export function advanceOutfitClarify(params: {
  query: string;
  prior: OutfitClarifyPending;
  wardrobeItems: WardrobeItem[];
}): {
  state: OutfitClarifyState;
  lockedItemIds: string[];
  ready: boolean;
  pending: OutfitClarifyPending;
} {
  const prior = params.prior;
  const matches = matchWardrobeItemsInText(params.query, params.wardrobeItems, 4);
  const newIds = matches.map((m) => String(m.id)).filter(Boolean);
  const lockedItemIds = [...new Set([...(prior.lockedItemIds || []), ...newIds])];
  const expected = Math.max(1, Number(prior.expectedLockCount) || 1);
  const ready = lockedItemIds.length >= expected;
  const pending: OutfitClarifyPending = {
    ...prior,
    lockedItemIds,
    state: ready ? 'READY' : 'AWAITING_PIECE',
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
        userMessageForServer: pending.originalUserMessage,
        lockedItemIds: advanced.lockedItemIds,
        occasion: pending.occasion,
        weather: pending.weather ?? null,
        lat: pending.lat ?? null,
      };
    }

    return {
      route: 'awaiting_more',
      pending: advanced.pending,
      clarifyHint: 'Which piece did you mean from your wardrobe?',
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
