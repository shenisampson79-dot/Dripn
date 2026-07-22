/**
 * Decision response contract — shopping / multi-photo compares.
 * Never invent recommendedIndex (no ?? 0) when optionCount >= 2.
 */

export class DecisionContractError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DecisionContractError';
    this.code = code;
  }
}

export type DecisionContractInput = {
  success?: boolean;
  decision?: string | null;
  response?: string | null;
  recommendation?: string | null;
  reasoning?: string | null;
  recommendedIndex?: number | null;
  selectedOptionIndex?: number | null;
  outfitSummary?: string | null;
  [key: string]: unknown;
};

export type EnforceDecisionOptions = {
  /** Uploaded / compared photo count (client-side source of truth). */
  optionCount: number;
  /** When false, skip requiring non-empty advice text. Default true if optionCount >= 1. */
  requireAdvice?: boolean;
};

export type EnforcedDecision = DecisionContractInput & {
  recommendedIndex?: number;
  advice: string;
};

function coerceIndex(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw === 'string' && /^-?\d+$/.test(raw.trim())) {
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

/** Extract SELECTED_OPTION:N (1-based) from stylist prose — recovery, not a silent 0 default. */
export function parseSelectedOptionFromText(text: string, optionCount: number): number | null {
  if (!Number.isInteger(optionCount) || optionCount <= 1) return null;
  if (typeof text !== 'string' || !text.trim()) return null;
  const structured = text.match(/SELECTED_OPTION(?:_INDEX)?\s*[:=]\s*(\d+)/i);
  if (!structured) return null;
  const n = Number.parseInt(structured[1], 10);
  if (n >= 1 && n <= optionCount) return n - 1;
  if (n === 0 && optionCount > 0) return 0;
  return null;
}

/**
 * Resolve a valid 0-based winner index.
 * Single option → 0. Multi → only an in-bounds API/text index; never invent 0.
 */
export function resolveContractRecommendedIndex(
  res: DecisionContractInput | null | undefined,
  optionCount: number,
): number | undefined {
  if (!Number.isInteger(optionCount) || optionCount <= 0) return undefined;
  if (optionCount === 1) return 0;

  for (const raw of [res?.recommendedIndex, res?.selectedOptionIndex]) {
    const idx = coerceIndex(raw);
    if (idx != null && idx >= 0 && idx < optionCount) return idx;
  }

  const text = [res?.decision, res?.recommendation, res?.response, res?.reasoning]
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .join('\n');
  const fromText = parseSelectedOptionFromText(text, optionCount);
  if (fromText != null) return fromText;

  return undefined;
}

function adviceFrom(res: DecisionContractInput): string {
  for (const t of [res.decision, res.recommendation, res.response, res.outfitSummary]) {
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  return '';
}

/**
 * Strict contract. Throws DecisionContractError when multi-compare lacks a valid index.
 */
export function enforceDecisionContract(
  res: DecisionContractInput | null | undefined,
  opts: EnforceDecisionOptions,
): EnforcedDecision {
  const optionCount = opts.optionCount;
  if (!res || typeof res !== 'object') {
    throw new DecisionContractError('invalid_payload', 'Decision response missing');
  }
  if (!Number.isInteger(optionCount) || optionCount < 0) {
    throw new DecisionContractError('invalid_option_count', 'optionCount must be a non-negative integer');
  }

  const advice = adviceFrom(res);
  const requireAdvice = opts.requireAdvice ?? optionCount >= 1;
  if (requireAdvice && !advice) {
    throw new DecisionContractError('advice_required', 'Decision advice text missing');
  }

  const recommendedIndex = resolveContractRecommendedIndex(res, optionCount);

  if (optionCount >= 2) {
    if (recommendedIndex == null) {
      const rawProvided =
        coerceIndex(res.recommendedIndex) != null || coerceIndex(res.selectedOptionIndex) != null;
      throw new DecisionContractError(
        rawProvided ? 'recommendedIndex_out_of_bounds' : 'recommendedIndex_required',
        rawProvided
          ? `recommendedIndex out of bounds for ${optionCount} options`
          : `recommendedIndex required for multi-option compare (${optionCount} options)`,
      );
    }
  }

  return {
    ...res,
    advice,
    recommendedIndex: optionCount === 0 ? undefined : recommendedIndex,
  };
}

export type SafeEnforceResult = {
  ok: boolean;
  payload: EnforcedDecision;
  issues: string[];
  error?: string;
};

/**
 * Production-safe: log + strip invalid winner instead of crashing.
 * Multi-compare never gets recommendedIndex: 0 invented.
 */
export function safeEnforceDecisionContract(
  res: DecisionContractInput | null | undefined,
  opts: EnforceDecisionOptions,
): SafeEnforceResult {
  try {
    const payload = enforceDecisionContract(res, opts);
    return { ok: true, payload, issues: [] };
  } catch (e) {
    const err = e as DecisionContractError;
    const code = err?.code || 'contract_failed';
    console.warn('[DecisionContract]', code, {
      optionCount: opts.optionCount,
      recommendedIndex: res?.recommendedIndex,
      selectedOptionIndex: res?.selectedOptionIndex,
      message: err?.message,
    });

    const advice = res ? adviceFrom(res) : '';
    let recommendedIndex = resolveContractRecommendedIndex(res, opts.optionCount);

    // Hard invariant: never invent a multi-compare winner
    if (opts.optionCount >= 2) {
      if (
        recommendedIndex == null
        || recommendedIndex < 0
        || recommendedIndex >= opts.optionCount
      ) {
        recommendedIndex = undefined;
      }
    } else if (opts.optionCount === 1) {
      recommendedIndex = 0;
    } else {
      recommendedIndex = undefined;
    }

    return {
      ok: false,
      payload: {
        ...(res && typeof res === 'object' ? res : {}),
        advice,
        recommendedIndex,
      },
      issues: [code],
      error: err?.message || 'Decision contract failed',
    };
  }
}
