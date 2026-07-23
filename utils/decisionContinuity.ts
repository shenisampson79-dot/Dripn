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
      ? ` You scored it ${payload.verdict.styleRating}/10${payload.verdict.ratingLabel ? ` (${payload.verdict.ratingLabel})` : ''}.`
      : '';
  const verdictBit = payload.verdict.recommendation
    ? ` Your verdict was: ${clip(payload.verdict.recommendation, 400)}`
    : '';

  if (payload.flow === 'sanity-check') {
    return (
      `In the ${label}, you offered to help me continue.${verdictBit}${score}${goal} `
      + `Please build me a more polished outfit from my wardrobe that addresses your feedback. `
      + `Keep the same occasion/weather context. Treat the pieces you criticized as avoid/fix unless I say otherwise.`
    ).trim();
  }

  if (payload.flow === 'event-outfit') {
    const eventBits = payload.eventDetails
      ? [payload.eventDetails.eventType, payload.eventDetails.dressCode, payload.eventDetails.venue, payload.eventDetails.timeOfDay]
          .filter(Boolean)
          .join(', ')
      : '';
    return (
      `Continuing from my ${label}${eventBits ? ` (${eventBits})` : ''}.${verdictBit}${score}${goal} `
      + `Please keep refining this look from my wardrobe — same event and dress code.`
    ).trim();
  }

  return (
    `Continuing from my ${label}.${verdictBit}${score}${goal} `
    + `Please keep helping me with this decision — same options and context.`
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
  const base: Omit<DecisionContinuityPayload, 'followUpPrompt'> = {
    decisionSessionId: session.id,
    flow: session.flow,
    stylistId,
    completedAt: response.timestamp || new Date().toISOString(),
    goalText: clip(session.input?.text || '', 1200),
    selectedContexts: Array.isArray(session.input?.selectedContexts)
      ? session.input.selectedContexts.slice(0, 12)
      : [],
    selectedWardrobeIds: Array.isArray(session.input?.selectedWardrobeIds)
      ? session.input.selectedWardrobeIds.map(String).slice(0, 24)
      : [],
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
