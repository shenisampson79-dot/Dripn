/**
 * Score gate for the Live HUD.
 *
 * The scorer reacts to whatever the belief holds this instant, so an outfit read
 * on half-settled labels scored 76 and then jumped to 100 a second later. The
 * number was never wrong — it was published too early. Withhold the first score
 * until the garment signature repeats, and require a second agreeing sample
 * before adopting a large jump.
 */

/** Points of movement treated as "the system changed its mind", not drift. */
export const LIVE_SCORE_JUMP = 10;
/** A pending score this close to the previous sample counts as agreement. */
export const LIVE_SCORE_AGREEMENT = 5;
/** Never withhold longer than this — a held number beats a permanent dash. */
export const LIVE_SCORE_MAX_HOLD_MS = 3000;

export type LiveScoreGate = {
  shown: number | null;
  pending: number | null;
  signature: string | null;
  heldSince: number | null;
};

export function createLiveScoreGate(): LiveScoreGate {
  return { shown: null, pending: null, signature: null, heldSince: null };
}

/**
 * Garment signature — which pieces the score was computed from. A change means
 * the previous sample described a different outfit and cannot corroborate.
 */
export function liveScoreSignature(
  items: { category?: string | null; subcategory?: string | null; color?: string | null }[],
): string {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${item.category || '?'}/${item.subcategory || '?'}/${item.color || '?'}`)
    .sort()
    .join('|');
}

export function gateLiveScore(
  gate: LiveScoreGate,
  next: number | null | undefined,
  opts: { signature: string; now: number },
): { gate: LiveScoreGate; score: number | null } {
  const value = Number(next);
  if (!Number.isFinite(value)) {
    return { gate, score: gate.shown };
  }

  const sameOutfit = gate.signature === opts.signature;
  // The hold clock runs from when withholding began, not from the last stable
  // signature. Labels that jitter every frame must still surface a number.
  const heldSince = gate.heldSince ?? opts.now;
  const forceAdopt = opts.now - heldSince >= LIVE_SCORE_MAX_HOLD_MS;

  const adopt = (): { gate: LiveScoreGate; score: number | null } => ({
    gate: { shown: value, pending: null, signature: opts.signature, heldSince: null },
    score: value,
  });
  const hold = (): { gate: LiveScoreGate; score: number | null } => ({
    gate: { shown: gate.shown, pending: value, signature: opts.signature, heldSince },
    score: gate.shown,
  });

  if (forceAdopt) return adopt();

  // Nothing shown yet: one corroborating sample on the same outfit first.
  if (gate.shown === null) {
    const corroborated = sameOutfit
      && gate.pending !== null
      && Math.abs(gate.pending - value) <= LIVE_SCORE_AGREEMENT;
    return corroborated ? adopt() : hold();
  }

  // Drift within the band is normal movement — show it immediately.
  if (Math.abs(value - gate.shown) < LIVE_SCORE_JUMP) return adopt();

  const corroborated = sameOutfit
    && gate.pending !== null
    && Math.abs(gate.pending - value) <= LIVE_SCORE_AGREEMENT;
  return corroborated ? adopt() : hold();
}
