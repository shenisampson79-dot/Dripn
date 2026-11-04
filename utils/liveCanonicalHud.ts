/**
 * Live contract v2 HUD + scheduler helpers.
 *
 * Worst-case genuine garment-change latency (YOLO-off Cloud, 12s heartbeat):
 * - Detection of a suspected miss: up to 12s to the next scheduled Vision call,
 *   or ~2s if the previous publication already set schedulerHint=suspect_change.
 * - Confirm add: one extra Vision (~2s + RTT) after the first new observation.
 * - Confirm removal: two misses. With one targeted verify: ~2s + 12s + 2 RTT.
 *   Heartbeat-only: ~24s + 2 RTT.
 * - Scene transition: ~400ms retry, not 12s.
 * Cost: at most one extra paid Vision call per suspected change, then resume 12s.
 * Hash-identical frames still send Vision when hint is suspect_change / scene_transition.
 */

import {
  LIVE_LOCALE,
  polishLiveFeedback,
  polishLiveHudItems,
  type LiveLocale,
} from './liveLocaleLabels';

export const LIVE_CONTRACT_VERSION = 2;
export const CLOUD_CANONICAL_STABLE_MS = 12000;
export const CLOUD_CANONICAL_SUSPECT_MS = 2000;
export const CLOUD_CANONICAL_ACQUIRE_MS = 400;
export const LIVE_ESTABLISHING_FAST_MAX = 3;
export const LIVE_SESSION_MAX_AGE_MS = 90_000;
export const LIVE_EMPTY_BACKOFF_MS = 2000;

export type LiveCanonicalPublication = {
  revision?: number;
  status?: 'establishing' | 'published' | 'incomplete' | 'scene_reset' | string;
  reason?: string;
  scoredGarmentIds?: string[];
};

export type LiveCanonicalResponse = {
  liveContractVersion?: number;
  liveSession?: Record<string, unknown> | null;
  publication?: LiveCanonicalPublication | null;
  schedulerHint?: string | null;
  obsSeq?: number;
  itemCount?: number;
  items?: unknown[];
  feedback?: {
    score?: number | null;
    coaching?: {
      headline?: string;
      summary?: string;
      bullets?: string[];
      [key: string]: unknown;
    } | null;
    publicationStatus?: string;
    confidenceLevel?: string;
    scoreApproximate?: boolean;
    itemCount?: number;
    [key: string]: unknown;
  } | null;
};

export type CanonicalHudApply =
  | { kind: 'legacy' }
  | { kind: 'ignore' }
  | {
    kind: 'canonical';
    score: number | null;
    coaching: LiveCanonicalResponse['feedback'] extends infer F
      ? F extends { coaching?: infer C } ? C : null
      : null;
    publicationStatus: string;
    schedulerHint: string;
    liveSession: Record<string, unknown> | null;
    appliedObsSeq: number;
    items: unknown[];
    identityItems: unknown[];
    identityFeedback: NonNullable<LiveCanonicalResponse['feedback']>;
    feedback: NonNullable<LiveCanonicalResponse['feedback']>;
  };

export function isLiveContractV2(res: LiveCanonicalResponse | null | undefined): boolean {
  return Number(res?.liveContractVersion) >= LIVE_CONTRACT_VERSION
    && Boolean(res?.publication);
}

export function shouldApplyCanonicalObs(args: {
  obsSeq?: number | null;
  lastAppliedObsSeq?: number | null;
  requestGeneration: number;
  currentGeneration: number;
}): boolean {
  if (args.requestGeneration !== args.currentGeneration) return false;
  const seq = Number(args.obsSeq);
  const last = Number(args.lastAppliedObsSeq);
  if (Number.isFinite(seq) && Number.isFinite(last) && seq <= last) return false;
  return true;
}

export type CanonicalRequestPolicy = {
  waitMs: number;
  reason: string;
  bypassHash: boolean;
  markSuspectVerify: boolean;
  incrementEstablishingFast: boolean;
};

export function nextCanonicalRequestPolicy(opts: {
  firstCloudSent: boolean;
  publishedCore: boolean;
  schedulerHint?: string | null;
  establishingFastCount?: number;
  suspectVerifySent?: boolean;
  inFlight?: boolean;
  lastOutcome?: 'ok' | 'empty' | 'fail' | null;
  emptyFailStreak?: number;
}): CanonicalRequestPolicy & { send: boolean } {
  if (opts.inFlight) {
    return {
      send: false,
      waitMs: 0,
      reason: 'in_flight',
      bypassHash: false,
      markSuspectVerify: false,
      incrementEstablishingFast: false,
    };
  }
  if (!opts.firstCloudSent) {
    return {
      send: true,
      waitMs: 0,
      reason: 'first_publish',
      bypassHash: true,
      markSuspectVerify: false,
      incrementEstablishingFast: false,
    };
  }
  const streak = Math.max(0, Number(opts.emptyFailStreak) || 0);
  if (opts.lastOutcome === 'fail' || opts.lastOutcome === 'empty') {
    return {
      send: true,
      waitMs: Math.min(CLOUD_CANONICAL_STABLE_MS, LIVE_EMPTY_BACKOFF_MS * (2 ** Math.min(streak, 2))),
      reason: 'backoff',
      bypassHash: false,
      markSuspectVerify: false,
      incrementEstablishingFast: false,
    };
  }
  const hint = String(opts.schedulerHint || '');
  if (hint === 'suspect_change' && !opts.suspectVerifySent) {
    return {
      send: true,
      waitMs: CLOUD_CANONICAL_SUSPECT_MS,
      reason: 'suspect_change',
      bypassHash: true,
      markSuspectVerify: true,
      incrementEstablishingFast: false,
    };
  }
  const fastCount = Number(opts.establishingFastCount) || 0;
  if (
    (hint === 'scene_transition' || hint === 'establishing')
    && fastCount < LIVE_ESTABLISHING_FAST_MAX
  ) {
    return {
      send: true,
      waitMs: CLOUD_CANONICAL_ACQUIRE_MS,
      reason: 'scene_transition',
      bypassHash: fastCount === 0,
      markSuspectVerify: false,
      incrementEstablishingFast: true,
    };
  }
  return {
    send: true,
    waitMs: CLOUD_CANONICAL_STABLE_MS,
    reason: 'layer_verify',
    bypassHash: false,
    markSuspectVerify: false,
    incrementEstablishingFast: false,
  };
}

export function liveCanonicalWaitMs(opts: {
  firstCloudSent: boolean;
  publishedCore: boolean;
  schedulerHint?: string | null;
  establishingFastCount?: number;
  suspectVerifySent?: boolean;
  lastOutcome?: 'ok' | 'empty' | 'fail' | null;
  emptyFailStreak?: number;
}): { waitMs: number; reason: string } {
  const policy = nextCanonicalRequestPolicy(opts);
  return { waitMs: policy.waitMs, reason: policy.reason };
}

export function shouldBypassHashSkip(
  schedulerHint?: string | null,
  policy?: Pick<CanonicalRequestPolicy, 'bypassHash'> | null,
): boolean {
  if (policy) return Boolean(policy.bypassHash);
  return false;
}

export function shouldResetCanonicalSessionAfterBackground(
  pausedAtMs?: number | null,
  nowMs: number = Date.now(),
): boolean {
  if (!Number.isFinite(Number(pausedAtMs)) || Number(pausedAtMs) <= 0) return false;
  return (nowMs - Number(pausedAtMs)) > LIVE_SESSION_MAX_AGE_MS;
}

function validHudBbox(bbox: unknown): bbox is number[] {
  return Array.isArray(bbox)
    && bbox.length >= 4
    && bbox.slice(0, 4).every((n) => Number.isFinite(Number(n)))
    && Number(bbox[2]) > 0.02
    && Number(bbox[3]) > 0.02;
}

export function canonicalHudBoxItems(args: {
  publicationStatus?: string | null;
  items?: unknown[];
}): Array<Record<string, unknown>> {
  const status = String(args.publicationStatus || '');
  if (status === 'establishing' || status === 'scene_reset') return [];
  return (Array.isArray(args.items) ? args.items : [])
    .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
    .filter((it) => validHudBbox(it.bbox));
}

export function attachLiveContractPayload(
  payload: Record<string, unknown>,
  args: {
    liveSession?: Record<string, unknown> | null;
    sessionEpoch: number;
    obsSeq: number;
  },
): Record<string, unknown> {
  payload.liveContractVersion = LIVE_CONTRACT_VERSION;
  payload.sessionEpoch = args.sessionEpoch;
  payload.obsSeq = args.obsSeq;
  if (args.liveSession) payload.liveSession = args.liveSession;
  return payload;
}

export function applyCanonicalLiveResponse(args: {
  res: LiveCanonicalResponse;
  lastAppliedObsSeq?: number | null;
  requestGeneration: number;
  currentGeneration: number;
  locale?: LiveLocale;
}): CanonicalHudApply {
  if (!isLiveContractV2(args.res)) return { kind: 'legacy' };
  const session = args.res.liveSession || null;
  const seq = Number(
    args.res.obsSeq
    ?? (session && typeof session.lastAppliedObsSeq === 'number' ? session.lastAppliedObsSeq : NaN),
  );
  if (!shouldApplyCanonicalObs({
    obsSeq: Number.isFinite(seq) ? seq : (args.lastAppliedObsSeq || 0) + 1,
    lastAppliedObsSeq: args.lastAppliedObsSeq,
    requestGeneration: args.requestGeneration,
    currentGeneration: args.currentGeneration,
  })) {
    return { kind: 'ignore' };
  }
  const feedback = { ...(args.res.feedback || {}) };
  const status = String(args.res.publication?.status || feedback.publicationStatus || 'establishing');
  const score = feedback.score == null || !Number.isFinite(Number(feedback.score))
    ? null
    : Number(feedback.score);
  feedback.score = score;
  const items = canonicalHudBoxItems({
    publicationStatus: status,
    items: Array.isArray(args.res.items) ? args.res.items : [],
  });
  const locale = args.locale || LIVE_LOCALE;
  const displayFeedback = polishLiveFeedback(feedback, locale) || feedback;
  return {
    kind: 'canonical',
    score,
    coaching: displayFeedback.coaching || null,
    publicationStatus: status,
    schedulerHint: String(args.res.schedulerHint || 'stable'),
    liveSession: session,
    appliedObsSeq: Number.isFinite(seq) ? seq : (args.lastAppliedObsSeq || 0) + 1,
    identityItems: items,
    identityFeedback: feedback,
    items: polishLiveHudItems(items, locale),
    feedback: displayFeedback,
  };
}
