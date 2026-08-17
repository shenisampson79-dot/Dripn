/**
 * Decision → Stylist Chat continuity payload (client).
 * Compact snapshot only — never attach image data URIs to navigation or chat body.
 */
import type { DecisionContext } from '@/services/DecisionService';
import type { DecisionFlow, DecisionSession, DecisionSessionEventDetails } from '@/services/DecisionSessionManager';
import type { DecisionResponse } from '@/services/DecisionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DecisionContinuityVerdict = {
  recommendation: string;
  reasoning: string;
  styleRating?: number | null;
  ratingLabel?: string | null;
  outfitSummary?: string | null;
  outfitPieces?: Array<{
    role?: string;
    name?: string;
    wardrobeItemId?: number | string;
    category?: string | null;
    color?: string | null;
  }>;
  recommendedIndex?: number | null;
};

export type DecisionContinuityPayload = {
  decisionSessionId: string;
  flow: DecisionFlow;
  stylistId: string;
  completedAt: string;
  goalText: string;
  selectedContexts: DecisionContext[];
  selectedWardrobeIds: string[];
  eventDetails?: DecisionSessionEventDetails | null;
  uploadedImageCount: number;
  verdict: DecisionContinuityVerdict;
  followUpPrompt: string;
  /**
   * Decide-for-me → Stylist Chat snapshot bind only (not Live).
   * Soft TTL discard + session id prefix check reject corrupted/stale payloads.
   */
  truthVersion?: string | null;
  /** Shopping ownership lock — chat must not overturn DO_NOT_BUY. */
  purchaseDecision?: {
    decision?: string;
    reason?: string;
    hardBlock?: boolean;
  } | null;
  alreadyOwnedOverride?: boolean;
};

const LAST_CONTINUITY_PREFIX = '@dripn_decision_continuity:v1:';
/** Soft-attach when opening chat without CTA (hours). */
export const CLIENT_CONTINUITY_SOFT_TTL_MS = 2 * 60 * 60 * 1000;
/** Hard discard after this age. */
export const CLIENT_CONTINUITY_HARD_TTL_MS = 72 * 60 * 60 * 1000;

function clip(value: unknown, max = 1200): string {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function flowLabel(flow: DecisionFlow): string {
  if (flow === 'sanity-check') return 'Quick Sanity Check';
  if (flow === 'event-outfit') return 'Outfit for Event';
  if (flow === 'shopping') return 'Choosing What to Buy';
  return flow;
}

/** User is clearly following up on a recent QSC / Decide look. */
export function looksLikeDecisionFollowUp(text: string): boolean {
  return /\b(quick sanity|sanity check|you (just )?(gave|suggested|said|recommended|picked)|the outfit you|that outfit|this look|that look|footwear|what (shoes|footwear)|shoes? to wear|finish (off )?the outfit|complete (the |that )?outfit|earlier|before|continuation|forgot (the |a )?(top|bottom|shoes?|footwear|layer)|why did you (pick|choose|suggest|recommend)|with that|you didn't (suggest|include|tell))\b/i
    .test(String(text || ''));
}

function sanitizePieces(
  pieces: DecisionResponse['outfitPieces'],
): DecisionContinuityVerdict['outfitPieces'] {
  if (!Array.isArray(pieces)) return undefined;
  const out = pieces
    .slice(0, 12)
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const name = clip(p.name, 120);
      const role = clip(p.role, 40);
      const wardrobeItemId = p.wardrobeItemId != null ? p.wardrobeItemId : undefined;
      if (!name && wardrobeItemId == null) return null;
      return {
        role: role || undefined,
        name: name || undefined,
        wardrobeItemId,
        category: p.category ? clip(p.category, 40) : null,
        color: null as string | null,
      };
    })
    .filter(Boolean) as NonNullable<DecisionContinuityVerdict['outfitPieces']>;
  return out.length ? out : undefined;
}

export function buildFollowUpPrompt(payload: Omit<DecisionContinuityPayload, 'followUpPrompt'>): string {
  const label = flowLabel(payload.flow);
  const goal = payload.goalText ? ` My notes: ${payload.goalText}.` : '';
  const score =
    payload.verdict.styleRating != null
    && Number(payload.verdict.styleRating) > 5.4
      ? ` You scored it ${payload.verdict.styleRating}/10${payload.verdict.ratingLabel ? ` (${payload.verdict.ratingLabel})` : ''}.`
      : '';
  const verdictBit = payload.verdict.recommendation
    ? ` Your verdict was: ${clip(payload.verdict.recommendation, 400)}`
    : '';
  const summaryBit = payload.verdict.outfitSummary
    ? ` Summary: ${clip(payload.verdict.outfitSummary, 280)}`
    : '';

  if (payload.flow === 'sanity-check') {
    const pieceBits = (payload.verdict.outfitPieces || [])
      .map((p) => {
        const bits = [p.role, p.name, p.wardrobeItemId != null ? `id=${p.wardrobeItemId}` : '']
          .filter(Boolean)
          .join(' ');
        return bits;
      })
      .filter(Boolean);
    const pieceLock = pieceBits.length
      ? ` Stick to this recommended look unless I change it: ${pieceBits.join('; ')}.`
      : '';
    return (
      `Following on from my ${label}.${verdictBit}${summaryBit}${score}${goal}${pieceLock} `
      + `If anything is missing from that look (especially a base top under a blazer), keep every piece you already named and add only the missing role from my wardrobe — do not invent a different full outfit. `
      + `Keep the same occasion and weather context. Treat the pieces you criticised as avoid or fix unless I say otherwise.`
    ).trim();
  }

  if (payload.flow === 'event-outfit') {
    const eventBits = payload.eventDetails
      ? [payload.eventDetails.eventType, payload.eventDetails.dressCode, payload.eventDetails.venue, payload.eventDetails.timeOfDay]
          .filter(Boolean)
          .join(', ')
      : '';
    return (
      `Following on from my ${label}${eventBits ? ` (${eventBits})` : ''}.${verdictBit}${score}${goal} `
      + `Please keep refining this look from my wardrobe — same event and dress code.`
    ).trim();
  }

  const buyLock = payload.flow === 'shopping'
    && (
      payload.alreadyOwnedOverride
      || payload.purchaseDecision?.decision === 'DO_NOT_BUY'
      || payload.purchaseDecision?.hardBlock
    );
  if (buyLock) {
    return (
      `Following on from my ${label}.${verdictBit}${score}${goal} `
      + `You told me not to buy because I already own something too similar. `
      + `Please keep that do-not-buy lock — do not recommend buying the blocked option(s). `
      + `Help me with wardrobe alternatives or different products instead.`
    ).trim();
  }

  return (
    `Following on from my ${label}.${verdictBit}${score}${goal} `
    + `Please keep working this decision with me — same options and context.`
  ).trim();
}

export function buildDecisionContinuity(args: {
  session: DecisionSession;
  response: DecisionResponse;
  stylistId?: string;
}): DecisionContinuityPayload | null {
  const { session, response } = args;
  if (!session?.id || !response) return null;

  const stylistId = clip(args.stylistId || response.stylistId || 'ruby', 20).toLowerCase() || 'ruby';
  const purchaseDecision = session.flow === 'shopping' && response.purchaseDecision
    ? {
        decision: clip(response.purchaseDecision.decision, 40) || undefined,
        reason: clip(
          response.purchaseDecision.reason
          || (response.ownershipDecision as { message?: string } | undefined)?.message
          || '',
          1200,
        ) || undefined,
        hardBlock: Boolean(
          response.alreadyOwnedOverride
          || response.purchaseDecision.decision === 'DO_NOT_BUY',
        ),
      }
    : null;
  const recommendedIds = (sanitizePieces(response.outfitPieces) || [])
    .map((p) => (p.wardrobeItemId != null ? String(p.wardrobeItemId) : ''))
    .filter(Boolean);
  const wornIds = Array.isArray(session.input?.selectedWardrobeIds)
    ? session.input.selectedWardrobeIds.map(String).slice(0, 24)
    : [];
  const base: Omit<DecisionContinuityPayload, 'followUpPrompt'> = {
    decisionSessionId: session.id,
    flow: session.flow,
    stylistId,
    completedAt: response.timestamp || new Date().toISOString(),
    goalText: clip(session.input?.text || '', 1200),
    selectedContexts: Array.isArray(session.input?.selectedContexts)
      ? session.input.selectedContexts.slice(0, 12)
      : [],
    // Prefer the recommended wardrobe fix IDs so chat does not rebuild from the criticised worn set.
    selectedWardrobeIds: recommendedIds.length ? recommendedIds.slice(0, 24) : wornIds,
    eventDetails: session.input?.eventDetails || null,
    uploadedImageCount: Math.min(
      12,
      (session.input?.images?.length || 0) || (response.uploadedImages?.length || 0),
    ),
    verdict: {
      recommendation: clip(response.recommendation || response.decision || response.response || '', 1200),
      reasoning: clip(response.reasoning || '', 1600),
      styleRating: response.styleRating ?? null,
      ratingLabel: response.ratingLabel ?? null,
      outfitSummary: response.outfitSummary ? clip(response.outfitSummary, 1200) : null,
      outfitPieces: sanitizePieces(response.outfitPieces),
      recommendedIndex: response.recommendedIndex ?? null,
    },
    purchaseDecision,
    alreadyOwnedOverride: Boolean(
      response.alreadyOwnedOverride
      || purchaseDecision?.decision === 'DO_NOT_BUY',
    ),
    // Bind chat follow-ups to this decision snapshot (stale → soft TTL discard / resync).
    truthVersion: `${session.id}#${response.timestamp || new Date().toISOString()}`,
  };

  return {
    ...base,
    followUpPrompt: buildFollowUpPrompt(base),
  };
}

/** API body field — omit followUpPrompt (chat sends it as the user message). */
export function toApiDecisionContinuity(
  payload: DecisionContinuityPayload | null | undefined,
): Omit<DecisionContinuityPayload, 'followUpPrompt'> | undefined {
  if (!payload) return undefined;
  const { followUpPrompt: _omit, ...rest } = payload;
  return rest;
}

export async function saveLastDecisionContinuity(
  userId: string,
  payload: DecisionContinuityPayload,
): Promise<void> {
  if (!userId || !payload) return;
  try {
    await AsyncStorage.setItem(
      `${LAST_CONTINUITY_PREFIX}${userId}`,
      JSON.stringify(payload),
    );
  } catch (err) {
    console.warn('[DecisionContinuity] save failed:', err);
  }
}

export async function loadLastDecisionContinuity(
  userId: string,
  opts?: { maxAgeMs?: number },
): Promise<DecisionContinuityPayload | null> {
  if (!userId) return null;
  const maxAgeMs = opts?.maxAgeMs ?? CLIENT_CONTINUITY_SOFT_TTL_MS;
  try {
    const raw = await AsyncStorage.getItem(`${LAST_CONTINUITY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DecisionContinuityPayload;
    if (!parsed?.decisionSessionId || !parsed?.verdict) return null;
    if (
      parsed.truthVersion
      && !String(parsed.truthVersion).startsWith(`${parsed.decisionSessionId}#`)
    ) {
      return null;
    }
    const ts = Date.parse(parsed.completedAt || '');
    if (Number.isFinite(ts) && Date.now() - ts > maxAgeMs) return null;
    if (Number.isFinite(ts) && Date.now() - ts > CLIENT_CONTINUITY_HARD_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearLastDecisionContinuity(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(`${LAST_CONTINUITY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}
