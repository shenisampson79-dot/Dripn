/**
 * Score gate for the Live HUD.
 *
 * First publish: a high-confidence complete Cloud read may land immediately
 * on top+bottom (or dress) — do NOT wait for shoes. If footwear is still
 * unresolved, the number is approximate (~82), not a withheld dash. When
 * shoes (or explicit cropped/barefoot/none) resolve, drop ~ and adopt a new
 * number atomically if identity changed. Never return to "—".
 *
 * Do NOT wait for BELIEF_PROVEN / slot settle on that first number — Cloud is
 * already ~5s, and waiting for belief lock pushed the badge to ~12s. Belief may
 * keep running in the background. After a number is showing, hold it until a
 * materially different read is corroborated (or identity/core drifts).
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
 * Absolute ceiling for the first score if belief never quite hits settled.
 * Requires coreFilled (bottom + shoe/barefoot) — never score an empty frame.
 */
export const LIVE_FIRST_SCORE_MAX_HOLD_MS = 7000;
/**
 * Hard failsafe: if a finite Vision score has been held this long with core
 * present, publish even when settle/identity lock never trips. Stops eternal "—".
 */
export const LIVE_FORCE_PUBLISH_MS = 2000;
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
  /**
   * HUD must prefix ~ until footwear is a stable answer (named shoes, or
   * explicit cropped / barefoot / none). Sticky false once resolved.
   */
  approximate: boolean;
};

export type LiveIdentitySample = {
  bottomKind?: string | null;
  shoeSubtype?: string | null;
  /** Top or layer kind — styling signal, not a score gate. */
  topKind?: string | null;
  /**
   * Stable piece-set fingerprint (e.g. "t:hoodie" or "t:top+l:hoodie").
   * Phantom add/remove must change this so score cannot stay on a stale outfit.
   */
  pieceSet?: string | null;
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
    approximate: false,
  };
}

/**
 * Footwear is a stable scoring answer — named shoes, or an explicit
 * cropped / barefoot / none. Missing shoes on a fast top+bottom Cloud read
 * is unresolved, not a final "none".
 */
export function isLiveFootwearResolved(opts: {
  shoeSubtype?: string | null;
  cropped?: boolean;
  searching?: boolean;
  barefootConfirmed?: boolean;
}): boolean {
  if (opts.cropped) return true;
  if (opts.barefootConfirmed) return true;
  const shoe = String(opts.shoeSubtype || '').toLowerCase().trim();
  if (opts.searching) return false;
  if (!shoe || shoe === 'searching') return false;
  return true;
}

/**
 * ~ stays until footwear resolves; once the marker drops it must not return
 * just because a later frame is Searching.
 *
 * Identity shift + hold (shoes just arrived, score not yet adopted) keeps ~
 * so the HUD never paints a false-exact number, then swaps ~82 → 78 atomically.
 */
export function nextLiveScoreApproximation(args: {
  shown: number | null;
  previouslyApproximate: boolean;
  footwearResolved: boolean;
  identityShifted?: boolean;
  adopting?: boolean;
}): boolean {
  if (args.shown != null && !args.previouslyApproximate) return false;
  if (args.adopting) return !args.footwearResolved;
  if (args.footwearResolved && !args.identityShifted) return false;
  if (args.shown == null) return !args.footwearResolved;
  return args.previouslyApproximate;
}

function liveFootwearResolvedFromIdentityKey(identityKey?: string | null): boolean {
  if (!identityKey) return false;
  const shoe = String(identityKey).split('|')[1] || '';
  if (!shoe || shoe === 'none' || shoe === 'searching') return false;
  return true;
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

/** Build a piece-set key from belief slots — order-normalized. */
export function livePieceSetKey(args: {
  topSub?: string | null;
  topKind?: string | null;
  layerSub?: string | null;
  layerKind?: string | null;
}): string {
  const parts: string[] = [];
  if (args.topSub || args.topKind) {
    parts.push(`t:${String(args.topSub || args.topKind || '').toLowerCase()}`);
  }
  if (args.layerSub || args.layerKind) {
    parts.push(`l:${String(args.layerSub || args.layerKind || '').toLowerCase()}`);
  }
  return parts.length ? parts.join('+') : 'none';
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

/** Bare feet / explicit none — valid identity, not "waiting on shoes". */
export function isBarefootShoeIdentity(shoeSubtype?: string | null): boolean {
  const shoe = String(shoeSubtype || '').toLowerCase();
  return shoe === 'barefoot' || shoe === 'none' || shoe === 'bare';
}

/**
 * Full outfit identity for score *versioning*: bottom + shoe + piece-set.
 * Piece-set changes after a score is shown must invalidate the frozen number
 * (phantom charcoal top under hoodie). First publish uses {@link liveCoreIdentityKey}.
 */
export function liveIdentityKey(sample: LiveIdentitySample | null | undefined): string {
  if (!sample) return '';
  const core = liveCoreIdentityKey(sample);
  if (!core) return '';
  const pieces = String(sample.pieceSet || sample.topKind || 'none').toLowerCase();
  return `${core}|${pieces}`;
}

/**
 * Barefoot / cropped / still-searching footwear is one identity — not a missing
 * slot that should block first publish or blank a held score.
 */
export function normalizeLiveShoeIdentity(shoeSubtype?: string | null): string {
  const s = String(shoeSubtype || '').toLowerCase().trim();
  if (
    !s
    || s === 'none'
    || s === 'bare'
    || s === 'barefoot'
    || s === 'searching'
    || s === 'cropped'
  ) {
    return 'none';
  }
  // Vision flips trainers ↔ sneakers; that is one footwear identity.
  if (/^(sneakers?|trainers?|runners?)$/.test(s)) return 'sneakers';
  return s;
}

/**
 * G3-LIVE-HOLD-01: athletic/sweat/casual/chino/tailored shorts are one
 * customer shorts family while the outfit is held stationary.
 */
export function collapseLiveShortsFamilyBottom(bottomKind?: string | null): string {
  const b = String(bottomKind || '').toLowerCase().trim();
  if (!b) return '';
  if (/short/.test(b)) return 'shorts';
  return b;
}

/** bottom|shoe core with shorts subtypes collapsed (ignores piece-set). */
export function liveShortsAwareCoreKey(identityKey?: string | null): string {
  const raw = String(identityKey || '');
  if (!raw) return '';
  const parts = raw.split('|');
  if (parts.length < 2) return raw.toLowerCase();
  return `${collapseLiveShortsFamilyBottom(parts[0])}|${normalizeLiveShoeIdentity(parts[1])}`;
}

/**
 * When the gate still holds the previous number, customer copy must stay on
 * that scored identity. Publishing "white trainers" next to a loafers-48 is
 * the QA 18 Aug desync.
 */
export function shouldHoldLivePublishedCopy(args: {
  adoptedScore: number | null;
  scoredIdentityKey: string | null;
  nextIdentityKey: string | null;
}): boolean {
  if (args.adoptedScore == null || !Number.isFinite(Number(args.adoptedScore))) {
    return false;
  }
  if (!args.scoredIdentityKey || !args.nextIdentityKey) return false;
  return args.scoredIdentityKey !== args.nextIdentityKey;
}

/** Core identity for first-score settle — bottom subtype + shoe (tolerate upper flicker). */
export function liveCoreIdentityKey(sample: LiveIdentitySample | null | undefined): string {
  if (!sample) return '';
  const bottom = String(sample.bottomKind || '').toLowerCase();
  if (!bottom) return '';
  return `${bottom}|${normalizeLiveShoeIdentity(sample.shoeSubtype)}`;
}

/**
 * Floor-trainer / subtype-flicker Cloud scores must not paint Sport-ready or
 * Nice balance while a loafers Mixed/weak clash is still the scored identity.
 * G3-LIVE-HOLD-01: also covers 47→72 / 48→73 (good band), not only ≥80.
 */
export function isSportReadyInflationOnHeldLoafers(
  identityKey: string | null,
  shown: number | null,
  next: number,
): boolean {
  const shoe = normalizeLiveShoeIdentity(String(identityKey || '').split('|')[1] || '');
  if (shoe !== 'loafers') return false;
  if (shown == null || !Number.isFinite(shown)) return false;
  return shown < 65 && next >= 65;
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
 * Piece-set / top flicker must NOT block the first score — that left the badge
 * on "—" while Vision already scored 45–96 (hoodie ↔ ghost charcoal top).
 */
export function liveIdentityIsConsistent(
  buf: LiveIdentitySample[],
  opts?: {
    need?: number;
    /** Last *core* identity key that successfully locked — changes require more frames. */
    prevLockedKey?: string | null;
  },
): boolean {
  const tip = buf[buf.length - 1];
  const tipKey = liveCoreIdentityKey(tip);
  if (!tipKey) return false;
  const prevCore = opts?.prevLockedKey
    ? String(opts.prevLockedKey).split('|').slice(0, 2).join('|')
    : '';
  const changing = Boolean(prevCore && tipKey !== prevCore);
  const need = opts?.need
    ?? (changing ? LIVE_IDENTITY_CHANGE_FRAMES : LIVE_IDENTITY_STABLE_FRAMES);
  const last = buf.slice(-need);
  if (last.length < need) return false;
  const bottom0 = String(last[0].bottomKind || '').toLowerCase();
  const shoe0 = normalizeLiveShoeIdentity(last[0].shoeSubtype);
  if (!bottom0) return false;
  const same = last.every(
    (f) => String(f.bottomKind || '').toLowerCase() === bottom0
      && normalizeLiveShoeIdentity(f.shoeSubtype) === shoe0,
  );
  if (!same) return false;
  const avgConf = last.reduce((sum, f) => sum + sampleSlotConfidence(f), 0) / need;
  return avgConf >= LIVE_IDENTITY_MIN_AVG_CONF;
}

/**
 * Belief slot stability AND core identity consistency (bottom + shoe).
 * Upper-body / piece-set flicker softens certainty — it must not withhold the badge.
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
 * medium frames with a locked core, commit the displayed score.
 * Cloud Vision is often ~0.3–1 fps — keep this low so ~10–15s max, not minutes.
 */
export const LIVE_MEDIUM_MAX_STREAK = 5;
/** Wall-clock fallback when frame rate is very low (cloud-only). */
export const LIVE_MEDIUM_MAX_MS = 12_000;

export type CertaintySmoothState = {
  lastRaw: LiveJudgmentCertainty | null;
  /** Consecutive frames of the current raw certainty. */
  streak: number;
  /** What the HUD is allowed to express. */
  displayed: LiveJudgmentCertainty;
  /** When the current medium streak began (ms). */
  mediumSinceMs?: number | null;
};

export function createCertaintySmoothState(): CertaintySmoothState {
  return { lastRaw: null, streak: 0, displayed: 'none', mediumSinceMs: null };
}

/**
 * Delay medium→high visual upgrades so certainty feels earned, not snapped.
 * Downgrades to medium apply immediately.
 * Long medium streaks converge to high display (score commits; labels still use identity lock).
 */
export function smoothLiveCertainty(
  state: CertaintySmoothState,
  current: LiveJudgmentCertainty,
  nowMs: number = Date.now(),
): { state: CertaintySmoothState; certainty: LiveJudgmentCertainty } {
  if (current === 'none') {
    return {
      state: { lastRaw: 'none', streak: 0, displayed: 'none', mediumSinceMs: null },
      certainty: 'none',
    };
  }

  const streak = state.lastRaw === current ? state.streak + 1 : 1;

  // Softness arrives immediately — users should see ~N the moment the top drifts.
  if (current === 'medium') {
    const mediumSinceMs = state.lastRaw === 'medium' && state.mediumSinceMs != null
      ? state.mediumSinceMs
      : nowMs;
    const heldMs = nowMs - mediumSinceMs;
    // Convergence pressure: core has been ready long enough — stop eternal hedging.
    if (streak >= LIVE_MEDIUM_MAX_STREAK || heldMs >= LIVE_MEDIUM_MAX_MS) {
      return {
        state: { lastRaw: 'medium', streak, displayed: 'high', mediumSinceMs },
        certainty: 'high',
      };
    }
    return {
      state: { lastRaw: 'medium', streak, displayed: 'medium', mediumSinceMs },
      certainty: 'medium',
    };
  }

  // current === 'high': hold medium briefly when upgrading from soft display.
  if (state.displayed === 'medium' && streak < LIVE_CERTAINTY_UPGRADE_STREAK) {
    return {
      state: { lastRaw: 'high', streak, displayed: 'medium', mediumSinceMs: null },
      certainty: 'medium',
    };
  }

  return {
    state: { lastRaw: 'high', streak, displayed: 'high', mediumSinceMs: null },
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

/** Mean slot confidence required for a Cloud piece to count as "high". */
export const LIVE_CLOUD_COMPLETE_MIN_CONF = 0.85;

function cloudItemBlob(item: {
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
}): string {
  return `${item.category || ''} ${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
}

function isCloudDressItem(item: {
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
}): boolean {
  const blob = cloudItemBlob(item);
  if (/dress[\s_-]*shirt|shirt[\s_-]*dress/.test(blob)) return false;
  return /\bdress\b/.test(blob) || /dresses/.test(blob);
}

function isCloudFootwearItem(item: {
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
}): boolean {
  const blob = cloudItemBlob(item);
  if (/oxford\s*shirt|dress\s*shirt/.test(blob)) return false;
  return /shoe|boot|sneaker|loafer|footwear|heel|sandal|mule|oxford|boat|deck|topsider|trainer|clog|flip/.test(blob);
}

function isCloudBottomItem(item: {
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
}): boolean {
  if (isCloudDressItem(item) || isCloudFootwearItem(item)) return false;
  return /bottom|trouser|jean|short|skirt|pant|chino|sweatpant|jogger/.test(cloudItemBlob(item));
}

function isCloudTopItem(item: {
  category?: string | null;
  subcategory?: string | null;
  name?: string | null;
}): boolean {
  if (isCloudDressItem(item) || isCloudFootwearItem(item) || isCloudBottomItem(item)) return false;
  return /top|shirt|polo|blouse|knit|sweater|outer|blazer|jacket|coat|vest|gilet|hoodie|tee/.test(
    cloudItemBlob(item),
  );
}

/**
 * First-publish eligibility: a high-confidence complete Cloud (or hybrid) read.
 * Dress-only or top+bottom is enough — footwear may still be unresolved.
 * Does NOT require BELIEF_PROVEN / slot stability.
 */
export function isHighConfidenceCompleteCloudRead(args: {
  source?: string | null;
  items?: Array<{
    category?: string | null;
    subcategory?: string | null;
    name?: string | null;
    confidence?: number | null;
  }> | null;
  completeness?: string | null;
}): boolean {
  const source = String(args.source || '');
  if (/yolo|on_device/i.test(source) && !/hybrid|cloud/i.test(source)) return false;
  if (!/cloud_vision|hybrid|vision/i.test(source)) return false;
  const items = (args.items || []).filter(
    (it) => Number(it.confidence) >= LIVE_CLOUD_COMPLETE_MIN_CONF,
  );
  if (!items.length) return false;
  const hasDress = items.some(isCloudDressItem);
  const hasTop = items.some(isCloudTopItem);
  const hasBottom = items.some(isCloudBottomItem);
  if (hasDress) return true;
  if (hasTop && hasBottom) return true;
  return String(args.completeness || '').toLowerCase() === 'complete'
    && (hasTop || hasBottom);
}

export function gateLiveScore(
  gate: LiveScoreGate,
  next: number | null | undefined,
  opts: {
    signature: string;
    now: number;
    settled?: boolean;
    /** 3-frame bottom+shoe lock — preferred for first publish. */
    identityLocked?: boolean;
    /**
     * Bottom + (footwear OR barefoot) present — required for force-publish.
     * Must NOT require a stable top/layer.
     */
    coreFilled?: boolean;
    /**
     * Stable identity key for this frame. When it differs from the key the
     * shown score was computed for, allow an immediate rescore (versioned
     * invalidation) instead of freezing a wrong early judgment forever.
     */
    identityKey?: string | null;
    /** Partial truth: top still drifting — cap movement, do not block publish. */
    certainty?: LiveJudgmentCertainty;
    /**
     * First high-confidence complete Cloud read. Publishes immediately even
     * when belief is not yet settled (BELIEF_PROVEN not required).
     */
    cloudComplete?: boolean;
    /**
     * Footwear is a stable answer (named shoes / cropped / barefoot / none).
     * First top+bottom publish without this stays approximate (~N).
     */
    footwearResolved?: boolean;
  },
): { gate: LiveScoreGate; score: number | null } {
  let value = Number(next);
  if (!Number.isFinite(value)) {
    return { gate, score: gate.shown };
  }

  const sameOutfit = gate.signature === opts.signature;
  const heldSince = gate.heldSince ?? opts.now;
  const heldMs = opts.now - heldSince;
  const identityKey = opts.identityKey || null;
  const footwearResolved = opts.footwearResolved
    ?? liveFootwearResolvedFromIdentityKey(identityKey);
  const coreOf = (key: string | null | undefined): string => {
    const raw = String(key || '');
    if (!raw) return '';
    // full key is bottom|shoe|pieceSet — core is bottom|shoe
    const parts = raw.split('|');
    return parts.length >= 2 ? `${parts[0]}|${parts[1]}` : raw;
  };
  const scoredCore = coreOf(gate.scoredIdentityKey);
  const nextCore = coreOf(identityKey);
  const coreDrift = Boolean(scoredCore && nextCore && scoredCore !== nextCore);
  const signatureDrift = Boolean(
    gate.signature
    && opts.signature
    && gate.signature !== opts.signature,
  );
  // G3-LIVE-HOLD-01: athletic↔chino shorts subtype flicker looks like coreDrift
  // but is still the same customer shorts+loafers outfit — hold Mixed→Nice.
  const shortsFamilyStable = Boolean(
    liveShortsAwareCoreKey(gate.scoredIdentityKey)
    && liveShortsAwareCoreKey(identityKey)
    && liveShortsAwareCoreKey(gate.scoredIdentityKey)
      === liveShortsAwareCoreKey(identityKey),
  );
  const floorPairInflation = (shortsFamilyStable || !coreDrift)
    && isSportReadyInflationOnHeldLoafers(
      gate.scoredIdentityKey || identityKey,
      gate.shown,
      value,
    );
  const approxOpts = {
    shown: gate.shown,
    previouslyApproximate: gate.approximate,
    footwearResolved,
    identityShifted: coreDrift && !shortsFamilyStable,
  };

  // Medium certainty: keep the badge calm while upper-body labels settle.
  // Identity changes (loafers → trainers) must NOT be capped to ±3 — that
  // left 48 on screen while the summary already named the new shoes.
  if (
    opts.certainty === 'medium'
    && gate.shown != null
    && Number.isFinite(gate.shown)
    && !coreDrift
    && !signatureDrift
  ) {
    value = Math.max(
      gate.shown - LIVE_PARTIAL_SCORE_CAP,
      Math.min(gate.shown + LIVE_PARTIAL_SCORE_CAP, value),
    );
  }

  const adopt = (): { gate: LiveScoreGate; score: number | null } => ({
    gate: {
      shown: value,
      pending: null,
      signature: opts.signature,
      heldSince: null,
      scoredIdentityKey: identityKey ?? gate.scoredIdentityKey,
      approximate: nextLiveScoreApproximation({ ...approxOpts, adopting: true }),
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
      approximate: nextLiveScoreApproximation({ ...approxOpts, adopting: false }),
    },
    score: gate.shown,
  });

  // First publish: complete Cloud read wins immediately — do not wait for
  // BELIEF_PROVEN. Otherwise settle, else force after 2s with core present.
  // Upper-body / piece-set must never be required here.
  if (gate.shown === null) {
    if (opts.cloudComplete) return adopt();
    if (opts.settled) return adopt();
    if (opts.coreFilled && heldMs >= LIVE_FORCE_PUBLISH_MS) return adopt();
    if (
      opts.coreFilled
      && opts.identityLocked
      && heldMs >= LIVE_FIRST_SCORE_MAX_HOLD_MS
    ) {
      return adopt();
    }
    return hold();
  }

  // --- After a score is showing ---
  // HOLD the published number while Cloud searches shoes or athletic↔sweat
  // shorts flicker. Blanking 78 → "—" is a regression. Adopt a new number
  // only when the next identity is corroborated (settled / locked / Cloud).
  // Floor trainers / chino flicker must not inflate a loafers clash into Nice.
  if (floorPairInflation) return hold();
  if (coreDrift || signatureDrift) {
    if (opts.settled || opts.identityLocked || opts.cloudComplete) return adopt();
    return hold();
  }

  // Same core: a complete Cloud read (or locked identity) of this outfit must
  // be allowed to replace the held number. Shoes STABLE-but-not-0.85 used to
  // freeze loafers-48 under a trainers summary until a later round.
  if (!opts.settled) {
    if (opts.cloudComplete || opts.identityLocked) return adopt();
    if (heldMs >= LIVE_SCORE_MAX_HOLD_MS) return adopt();
    return hold();
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
 * How the Live HUD should express a gated score.
 *
 * ~ / "approx" is footwear-unresolved only. Medium certainty (top still
 * drifting) must not re-paint a tilde after shoes have resolved — that left
 * ~96 on trainers for the rest of the QA 18 Aug session.
 */
export function presentLiveScore(
  score: number | null | undefined,
  _confidence: LiveJudgmentCertainty | 'high' | 'medium' = 'high',
  opts?: { approximate?: boolean },
): { display: string; numeric: number | null; soft: boolean } {
  if (score == null || !Number.isFinite(Number(score))) {
    return { display: '—', numeric: null, soft: false };
  }
  const n = Math.round(Number(score));
  if (opts?.approximate) {
    return { display: `~${n}`, numeric: n, soft: true };
  }
  return { display: String(n), numeric: n, soft: false };
}
