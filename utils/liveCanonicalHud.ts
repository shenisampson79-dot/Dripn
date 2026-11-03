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

export const LIVE_CONTRACT_VERSION = 2;
export const CLOUD_CANONICAL_STABLE_MS = 12000;
export const CLOUD_CANONICAL_SUSPECT_MS = 2000;
export const CLOUD_CANONICAL_ACQUIRE_MS = 400;

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

export function liveCanonicalWaitMs(opts: {
  firstCloudSent: boolean;
  publishedCore: boolean;
  schedulerHint?: string | null;
}): { waitMs: number; reason: string } {
  if (!opts.firstCloudSent) return { waitMs: 0, reason: 'first_publish' };
  const hint = String(opts.schedulerHint || '');
  if (hint === 'scene_transition' || hint === 'establishing') {
    return { waitMs: CLOUD_CANONICAL_ACQUIRE_MS, reason: 'scene_transition' };
  }
  if (hint === 'suspect_change') {
    return { waitMs: CLOUD_CANONICAL_SUSPECT_MS, reason: 'suspect_change' };
  }
  if (opts.publishedCore || hint === 'occlusion' || hint === 'stable') {
    return { waitMs: CLOUD_CANONICAL_STABLE_MS, reason: 'layer_verify' };
  }
  return { waitMs: CLOUD_CANONICAL_ACQUIRE_MS, reason: 'first_publish' };
}

export function shouldBypassHashSkip(schedulerHint?: string | null): boolean {
  const hint = String(schedulerHint || '');
  return hint === 'suspect_change' || hint === 'scene_transition' || hint === 'establishing';
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
  return {
    kind: 'canonical',
    score,
    coaching: feedback.coaching || null,
    publicationStatus: status,
    schedulerHint: String(args.res.schedulerHint || 'stable'),
    liveSession: session,
    appliedObsSeq: Number.isFinite(seq) ? seq : (args.lastAppliedObsSeq || 0) + 1,
    items: Array.isArray(args.res.items) ? args.res.items : [],
    feedback,
  };
}
