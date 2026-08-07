/**
 * Score gate for the Live HUD.
 *
 * The scorer reacts to whatever the belief holds this instant, so an outfit read
 * on half-settled labels scored 76 and then jumped to 100 a second later. The
 * number was never wrong — it was published too early. Withhold the first score
 * until the garment belief is settled (or the max-hold safety valve trips), and
 * require a second agreeing sample before adopting a large jump.
 */

/** Points of movement treated as "the system changed its mind", not drift. */
export const LIVE_SCORE_JUMP = 10;
/** A pending score this close to the previous sample counts as agreement. */
export const LIVE_SCORE_AGREEMENT = 5;
/**
 * Safety valve only after a number is already on screen (large jumps).
 * Must NOT force the *first* publish — that is how warmup "dark shorts → 40
 * Mixed weights" anchored the user before identity locked.
 */
export const LIVE_SCORE_MAX_HOLD_MS = 3000;
/**
 * Absolute ceiling for the first score if belief never quite hits 0.85.
 * Still requires core slots filled — never score an empty warmup frame.
 */
export const LIVE_FIRST_SCORE_MAX_HOLD_MS = 7000;
/** Consecutive matching bottom+shoe identities before scoring is allowed. */
export const LIVE_IDENTITY_STABLE_FRAMES = 3;
/** Extra frames required when bottom/shoe identity changes vs the last lock. */
export const LIVE_IDENTITY_CHANGE_FRAMES = 4;
/** Mean slot confidence required to lock — consistency alone is not correctness. */
export const LIVE_IDENTITY_MIN_AVG_CONF = 0.88;
/** Max score movement while upper-body slots are still drifting (partial truth). */
export const LIVE_PARTIAL_SCORE_CAP = 3;
/** Slot weights for human-feeling stability (core identity dominates). */
export const LIVE_STABILITY_WEIGHTS = {
  bottom: 0.4,
  shoes: 0.4,
  top: 0.2,
} as const;

export type LiveJudgmentCertainty = 'high' | 'medium' | 'none';

export type LiveScoreGate = {
  shown: number | null;
  pending: number | null;
  signature: string | null;
  heldSince: number | null;
  /** Identity key the currently shown score was computed for. */
  scoredIdentityKey: string | null;
};

export type LiveIdentitySample = {
  bottomKind?: string | null;
  shoeSubtype?: string | null;
  /** Top or layer kind — styling signal, not a score gate. */
  topKind?: string | null;
  bottomConfidence?: number | null;
  shoeConfidence?: number | null;
  topConfidence?: number | null;
};

export function createLiveScoreGate(): LiveScoreGate {
  return {
    shown: null,
    pending: null,
    signature: null,
    heldSince: null,
    scoredIdentityKey: null,
  };
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

/** Stability at which a belief slot is treated as settled, matching the HUD's LOCKED. */
export const LIVE_SLOT_SETTLED_STABILITY = 0.85;

/**
 * Corroboration exists to avoid publishing a score computed from labels that are
 * still moving. When the belief is already locked there is nothing to wait for —
 * withholding then just shows a dash over a settled outfit, which is what
 * happened after stopping and restarting a scan.
 */
export function liveBeliefIsSettled(
  slots: ({ stability?: number | null } | null | undefined)[],
): boolean {
  const present = slots.filter(Boolean) as { stability?: number | null }[];
  if (!present.length) return false;
  return present.every(
    (slot) => Number(slot.stability) >= LIVE_SLOT_SETTLED_STABILITY,
  );
}

/** Ring buffer of recent bottom/shoe identities for the 3-frame lock. */
export function pushLiveIdentitySample(
  buf: LiveIdentitySample[],
  sample: LiveIdentitySample,
  max = 8,
): LiveIdentitySample[] {
  return [...buf, sample].slice(-Math.max(LIVE_IDENTITY_CHANGE_FRAMES, max));
}

export function liveIdentityKey(sample: LiveIdentitySample | null | undefined): string {
  if (!sample) return '';
  const bottom = String(sample.bottomKind || '').toLowerCase();
  const shoe = String(sample.shoeSubtype || '').toLowerCase();
  if (!bottom || !shoe) return '';
  return `${bottom}|${shoe}`;
}

function sampleSlotConfidence(sample: LiveIdentitySample): number {
  const bottom = Number(sample.bottomConfidence);
  const shoe = Number(sample.shoeConfidence);
  const parts = [bottom, shoe].filter((n) => Number.isFinite(n) && n > 0);
  if (!parts.length) return 0;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

/**
 * Bottom + shoes must agree for N frames with enough mean confidence.
 * Consistency alone can lock a confidently-wrong early guess; confidence
 * weighting blocks that. Identity changes need one extra frame of inertia.
 */
export function liveIdentityIsConsistent(
  buf: LiveIdentitySample[],
  opts?: {
    need?: number;
    /** Last identity key that successfully locked — changes require more frames. */
    prevLockedKey?: string | null;
  },
): boolean {
  const tip = buf[buf.length - 1];
  const tipKey = liveIdentityKey(tip);
  if (!tipKey) return false;
  const changing = Boolean(opts?.prevLockedKey && tipKey !== opts.prevLockedKey);
  const need = opts?.need
    ?? (changing ? LIVE_IDENTITY_CHANGE_FRAMES : LIVE_IDENTITY_STABLE_FRAMES);
  const last = buf.slice(-need);
  if (last.length < need) return false;
  const bottom0 = String(last[0].bottomKind || '').toLowerCase();
  const shoe0 = String(last[0].shoeSubtype || '').toLowerCase();
  if (!bottom0 || !shoe0) return false;
  const same = last.every(
    (f) => String(f.bottomKind || '').toLowerCase() === bottom0
      && String(f.shoeSubtype || '').toLowerCase() === shoe0,
  );
  if (!same) return false;
  const avgConf = last.reduce((sum, f) => sum + sampleSlotConfidence(f), 0) / need;
  return avgConf >= LIVE_IDENTITY_MIN_AVG_CONF;
}

/**
 * Belief slot stability AND identity consistency. Either alone still lets a
 * confident-but-wrong "dark shorts" frame score.
 *
 * Only core slots (bottom + footwear) gate publish. Top/layer drift must not
 * block scoring — that is split-brain: stable core, unstable styling signal.
 * Callers downgrade certainty via liveJudgmentCertainty instead.
 */
export function liveOutfitReadyToScore(args: {
  slots: ({ stability?: number | null } | null | undefined)[];
  identityBuf: LiveIdentitySample[];
  prevLockedKey?: string | null;
}): boolean {
  return liveBeliefIsSettled(args.slots)
    && liveIdentityIsConsistent(args.identityBuf, { prevLockedKey: args.prevLockedKey });
}

/**
 * Upper-body (top/layer) consistency. Missing top on every frame counts as
 * consistent (dress-only / still filling). Flicker of present kinds does not.
 */
export function liveTopIsConsistent(
  buf: LiveIdentitySample[],
  need = LIVE_IDENTITY_STABLE_FRAMES,
): boolean {
  const last = buf.slice(-need);
  if (last.length < need) return false;
  const kinds = last.map((f) => String(f.topKind || '').toLowerCase());
  const present = kinds.filter(Boolean);
  if (!present.length) return true;
  if (present.length !== kinds.length) return false;
  const kind0 = present[0];
  if (!last.every((f) => String(f.topKind || '').toLowerCase() === kind0)) return false;
  const avgConf = last.reduce((sum, f) => {
    const c = Number(f.topConfidence);
    return sum + (Number.isFinite(c) && c > 0 ? c : 0);
  }, 0) / need;
  return avgConf >= LIVE_IDENTITY_MIN_AVG_CONF;
}

/**
 * Slot-weighted stability in [0,1]. Core identity dominates; top is a soft vote.
 */
export function liveSlotWeightedStability(buf: LiveIdentitySample[]): number {
  const need = LIVE_IDENTITY_STABLE_FRAMES;
  const last = buf.slice(-need);
  if (last.length < need) return 0;
  const coreOk = liveIdentityIsConsistent(last) ? 1 : 0;
  const topOk = liveTopIsConsistent(last) ? 1 : 0;
  return (
    LIVE_STABILITY_WEIGHTS.bottom * coreOk
    + LIVE_STABILITY_WEIGHTS.shoes * coreOk
    + LIVE_STABILITY_WEIGHTS.top * topOk
  );
}

/**
 * high  = core locked and top stable — full judgment OK
 * medium = core locked, top still drifting — score OK, soften claims
 * none  = core not ready — no score
 */
export function liveJudgmentCertainty(args: {
  identityBuf: LiveIdentitySample[];
  prevLockedKey?: string | null;
  coreReady: boolean;
}): LiveJudgmentCertainty {
  if (!args.coreReady) return 'none';
  if (liveTopIsConsistent(args.identityBuf)) return 'high';
  return 'medium';
}

/** Consecutive high samples required before ~84 becomes 84. */
export const LIVE_CERTAINTY_UPGRADE_STREAK = 2;
/**
 * Medium must not be a permanent escape hatch. After this many consecutive
 * medium frames with a locked core (~1 fps → ~10s), commit the displayed score
 * so Live still feels decisive while labels wait on top lock.
 */
export const LIVE_MEDIUM_MAX_STREAK = 10;

export type CertaintySmoothState = {
  lastRaw: LiveJudgmentCertainty | null;
  /** Consecutive frames of the current raw certainty. */
  streak: number;
  /** What the HUD is allowed to express. */
  displayed: LiveJudgmentCertainty;
};

export function createCertaintySmoothState(): CertaintySmoothState {
  return { lastRaw: null, streak: 0, displayed: 'none' };
}

/**
 * Delay medium→high visual upgrades so certainty feels earned, not snapped.
 * Downgrades to medium apply immediately.
 * Long medium streaks converge to high display (score commits; labels still use identity lock).
 */
export function smoothLiveCertainty(
  state: CertaintySmoothState,
  current: LiveJudgmentCertainty,
): { state: CertaintySmoothState; certainty: LiveJudgmentCertainty } {
  if (current === 'none') {
    return {
      state: { lastRaw: 'none', streak: 0, displayed: 'none' },
      certainty: 'none',
    };
  }

  const streak = state.lastRaw === current ? state.streak + 1 : 1;

  // Softness arrives immediately — users should see ~N the moment the top drifts.
  if (current === 'medium') {
    // Convergence pressure: core has been ready long enough — stop eternal hedging.
    if (streak >= LIVE_MEDIUM_MAX_STREAK) {
      return {
        state: { lastRaw: 'medium', streak, displayed: 'high' },
        certainty: 'high',
      };
    }
    return {
      state: { lastRaw: 'medium', streak, displayed: 'medium' },
      certainty: 'medium',
    };
  }

  // current === 'high': hold medium briefly when upgrading from soft display.
  if (state.displayed === 'medium' && streak < LIVE_CERTAINTY_UPGRADE_STREAK) {
    return {
      state: { lastRaw: 'high', streak, displayed: 'medium' },
      certainty: 'medium',
    };
  }

  return {
    state: { lastRaw: 'high', streak, displayed: 'high' },
    certainty: 'high',
  };
}

/**
 * No judgment copy until a finite score is publishable. Partial intelligence
 * (summary / bullets / headline) while the badge shows "—" is what made Live
 * feel wrong even when detection was already correct.
 */
export function gateLiveJudgment<T extends {
  headline?: string;
  summary?: string;
  bullets?: string[];
}>(
  coaching: T | null | undefined,
  score: number | null | undefined,
): T | null | undefined {
  if (!coaching) return coaching;
  // Number(null) === 0 — must check null/undefined before isFinite.
  if (score != null && Number.isFinite(Number(score))) return coaching;
  return {
    ...coaching,
    headline: '',
    summary: '',
    bullets: [],
  };
}

export function gateLiveScore(
  gate: LiveScoreGate,
  next: number | null | undefined,
  opts: {
    signature: string;
    now: number;
    settled?: boolean;
    /** 3-frame bottom+shoe lock — required for the first-score safety valve. */
    identityLocked?: boolean;
    /** Top + bottom (+ footwear when visible) present — for first-score safety valve. */
    coreFilled?: boolean;
    /**
     * Stable identity key for this frame. When it differs from the key the
     * shown score was computed for, allow an immediate rescore (versioned
     * invalidation) instead of freezing a wrong early judgment forever.
     */
    identityKey?: string | null;
    /** Partial truth: top still drifting — cap movement, do not block publish. */
    certainty?: LiveJudgmentCertainty;
  },
): { gate: LiveScoreGate; score: number | null } {
  let value = Number(next);
  if (!Number.isFinite(value)) {
    return { gate, score: gate.shown };
  }

  // Medium certainty: keep the badge calm while upper-body labels settle.
  if (
    opts.certainty === 'medium'
    && gate.shown != null
    && Number.isFinite(gate.shown)
  ) {
    value = Math.max(
      gate.shown - LIVE_PARTIAL_SCORE_CAP,
      Math.min(gate.shown + LIVE_PARTIAL_SCORE_CAP, value),
    );
  }

  const sameOutfit = gate.signature === opts.signature;
  const heldSince = gate.heldSince ?? opts.now;
  const heldMs = opts.now - heldSince;
  const identityKey = opts.identityKey || null;

  const adopt = (): { gate: LiveScoreGate; score: number | null } => ({
    gate: {
      shown: value,
      pending: null,
      signature: opts.signature,
      heldSince: null,
      scoredIdentityKey: identityKey ?? gate.scoredIdentityKey,
    },
    score: value,
  });
  const hold = (): { gate: LiveScoreGate; score: number | null } => ({
    gate: {
      shown: gate.shown,
      pending: value,
      signature: opts.signature,
      heldSince,
      scoredIdentityKey: gate.scoredIdentityKey,
    },
    score: gate.shown,
  });

  // First publish: NEVER force-adopt an unsettled warmup score. That is the
  // "40 Mixed weights on dark shorts" bug. Only settle — or a long safety valve
  // once core slots + identity lock exist — may surface the first number.
  if (gate.shown === null) {
    if (opts.settled) return adopt();
    if (
      opts.coreFilled
      && opts.identityLocked
      && heldMs >= LIVE_FIRST_SCORE_MAX_HOLD_MS
    ) {
      return adopt();
    }
    return hold();
  }

  // Identity still thrashing: keep the last good number. Do not score a new frame.
  if (!opts.settled) {
    return {
      gate: { ...gate, heldSince: null },
      score: gate.shown,
    };
  }

  // New stable identity version — invalidate the frozen score and adopt.
  if (
    identityKey
    && gate.scoredIdentityKey
    && identityKey !== gate.scoredIdentityKey
  ) {
    return adopt();
  }

  // Already showing: large jumps still use the shorter hold, then force-adopt.
  if (heldMs >= LIVE_SCORE_MAX_HOLD_MS) return adopt();

  // Drift within the band is normal movement — show it immediately.
  if (Math.abs(value - gate.shown) < LIVE_SCORE_JUMP) return adopt();

  const corroborated = sameOutfit
    && gate.pending !== null
    && Math.abs(gate.pending - value) <= LIVE_SCORE_AGREEMENT;
  return corroborated ? adopt() : hold();
}

/**
 * How the Live HUD should express a gated score. Medium certainty keeps the
 * numeric value for logic but presents it as approximate (~84) so users do not
 * read a soft judgment as a hard claim — then feel the system "got worse"
 * when certainty rises and the exact number lands nearby.
 */
export function presentLiveScore(
  score: number | null | undefined,
  confidence: LiveJudgmentCertainty | 'high' | 'medium' = 'high',
): { display: string; numeric: number | null; soft: boolean } {
  if (score == null || !Number.isFinite(Number(score))) {
    return { display: '—', numeric: null, soft: false };
  }
  const n = Math.round(Number(score));
  if (confidence === 'medium') {
    return { display: `~${n}`, numeric: n, soft: true };
  }
  return { display: String(n), numeric: n, soft: false };
}
