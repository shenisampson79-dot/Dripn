/**
 * Outcome Contract Enforcement — final paint gate for Live judgment.
 *
 * Score → band → allowed language → (optional) confidence soften.
 * Score, headline, summary, and bullets must express ONE truth. Independently
 * authored copy that contradicts the numeric band is rewritten or dropped.
 *
 * Plug-in: AFTER scoring / BEFORE HUD render.
 */

import type { LiveCoaching } from '@/types/liveStylist';
import { sentenceCaseGarmentName } from '@/utils/liveLayeringIntelligence';

export type LiveOutcomeBand = 'weak' | 'mixed' | 'good' | 'strong';
export type LiveOutcomeCertainty = 'high' | 'medium' | 'none';

const MIXED_HEADLINE_RE = /mixed directions?/i;
const MIXED_WEIGHTS_RE = /mixed weights?/i;
const SWAP_NO_REASON_RE = /\bswap\b.+\bfor\b/i;
const REASON_RE =
  /\b(because|to (?:add|create|give|keep|lift|smart|clean|finish|polish)|cleaner|smarter|finish|polish|which|so that)\b/i;
const COLOUR_CLASH_NAG_RE = /colou?r\s*clash/i;
const FORMALITY_SPAN_RE = /formality span|tiers of each|formality mismatch across/i;
const TENSION_COPY_RE =
  /\b(clash|conflict|awkward|mismatch|pull(?:s)? in different directions|do not fully come together|feel slightly out of step|out of step|fighting|formality span|tiers of each|disjoint|messy|unclear)\b/i;
const COHESION_COPY_RE =
  /\b(consistent|cohesive|clean(?:er)?|balanced|work(?:s| well)? together|deliberately simple|palette stays|simple,? easy|sit together cleanly|sharp|tight|dialed|intentional)\b/i;

/** Headlines illegal for each numeric band — rewritten from score. */
const HEADLINE_FORBIDDEN: Record<LiveOutcomeBand, RegExp> = {
  weak: /polished|looks sharp|looking good|nice balance|sport-ready|smart casual|casual and easy|street-focused/i,
  mixed: /polished|looks sharp|looking good|sport-ready|smart casual|casual and easy/i,
  good: /mixed (?:weights|directions)|needs a tweak|disjoint|getting a read/i,
  strong: /mixed (?:weights|directions)|needs a tweak|almost there|getting a read|one piece|waiting on pieces/i,
};

/** Summary / bullet language forbidden for the band. */
const COPY_FORBIDDEN: Record<LiveOutcomeBand, RegExp> = {
  weak: /\b(cohesive|balanced|clean(?:er)?|sharp|polished|tight|dialed|intentional|work(?:s| well)? together|sit together cleanly)\b/i,
  mixed: /\b(sharp|polished|tight|dialed|looks sharp|intentional)\b/i,
  good: /\b(conflicting|messy|disjoint|clash|awkward|fighting)\b/i,
  strong: /\b(mixed|uneven|conflicting|messy|disjoint|clash|awkward|fighting|formality span)\b/i,
};

/**
 * Deterministic score → band. No overrides. Ever.
 * weak <50 · mixed <65 · good <80 · strong ≥80
 */
export function scoreToBand(score: number): LiveOutcomeBand {
  const n = Number(score);
  if (!Number.isFinite(n) || n < 50) return 'weak';
  if (n < 65) return 'mixed';
  if (n < 80) return 'good';
  return 'strong';
}

/** Checksum — score and declared band must agree. */
export function assertOutcomeConsistency(score: number, band: LiveOutcomeBand): void {
  const expected = scoreToBand(score);
  if (expected !== band) {
    throw new Error(`Outcome contract violated: score ${score} → ${expected}, got ${band}`);
  }
}

/**
 * Score owns the headline band. Lane only picks among legal tones for that band.
 */
export function headlineFromScore(
  score: number,
  lane?: string | null,
): string {
  const band = scoreToBand(score);
  if (band === 'strong') {
    if (score >= 90) {
      if (lane === 'athleisure') return 'Sport-ready';
      if (lane === 'formal' || lane === 'smart_casual') return 'Polished';
      return 'Looks sharp';
    }
    if (lane === 'athleisure') return 'Sport-ready';
    if (lane === 'smart_casual') return 'Smart casual';
    if (lane === 'casual') return 'Casual and easy';
    return 'Looking good';
  }
  if (band === 'good') {
    if (score >= 70) return 'Nice balance';
    return 'Almost there';
  }
  if (band === 'mixed') {
    return 'Almost there';
  }
  return 'Needs a tweak';
}

function hasTipReason(text: string): boolean {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (SWAP_NO_REASON_RE.test(t) && !REASON_RE.test(t)) return false;
  if (COLOUR_CLASH_NAG_RE.test(t) && !REASON_RE.test(t)) return false;
  return true;
}

function contradictsCohesion(summary: string, bullet: string): boolean {
  if (!COHESION_COPY_RE.test(summary)) return false;
  return TENSION_COPY_RE.test(bullet) || COLOUR_CLASH_NAG_RE.test(bullet);
}

function stripTensionPhrases(text: string): string {
  return String(text || '')
    .replace(/\s*[-–—,]?\s*(clash(?:es|ing)?|conflict(?:s|ing)?|awkward(?:ly)?|mismatch(?:es|ed)?)\b/gi, '')
    .replace(/\bpull(?:s)? in different directions\b/gi, 'sit together cleanly')
    .replace(/\bdo not fully come together yet\b/gi, 'hold a consistent direction')
    .replace(/\bfeel slightly out of step\b/gi, 'sit in one lane')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,])/g, '$1')
    .trim();
}

function stripForbiddenCopy(text: string, band: LiveOutcomeBand): string {
  const re = COPY_FORBIDDEN[band];
  if (!re.test(text)) return text;
  // Drop sentences that carry forbidden claims rather than half-rewrite nonsense.
  const parts = String(text || '').split(/(?<=[.!?])\s+/);
  const kept = parts.filter((p) => !re.test(p));
  return kept.join(' ').trim();
}

function editorialiseSummaryProse(text: string): string {
  const raw = String(text || '').trim();
  if (!raw) return raw;
  return raw.replace(
    /\b([A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+){1,5})\b/g,
    (span, _g, offset) => sentenceCaseGarmentName(span, offset === 0),
  );
}

/**
 * Confidence modifies intensity, never category/band meaning.
 */
export function softenOutcomeTone(text: string, certainty: LiveOutcomeCertainty): string {
  if (certainty !== 'medium' || !text) return text;
  return String(text)
    .replace(/\bfeels\b/gi, 'reads as')
    .replace(/\bwork(?:s)? together cleanly\b/gi, 'are settling together')
    .replace(/\bholds a consistent direction\b/gi, 'is settling into one direction')
    .replace(/\bsit together cleanly\b/gi, 'are settling together')
    .replace(/\bLooking good\b/g, 'Looking solid')
    .replace(/\bLooks sharp\b/g, 'Looking solid')
    .replace(/\bPolished\b/g, 'Looking solid')
    .trim();
}

function defaultSummaryForBand(band: LiveOutcomeBand, score: number): string {
  if (band === 'strong') {
    return score >= 90
      ? 'The pieces work together cleanly.'
      : 'The combination holds a consistent direction.';
  }
  if (band === 'good') return 'The combination is mostly holding together.';
  if (band === 'mixed') return 'The pieces are only partially aligned.';
  return 'The pieces are pulling in different directions.';
}

/**
 * Band-safe observational tips when medium certainty strips hard claims.
 * Keeps the card from feeling empty without reintroducing contradictions.
 */
const SAFE_MEDIUM_TRAITS: Record<LiveOutcomeBand, string> = {
  weak: 'Still reading the overall direction of the look.',
  mixed: 'Simple structure is coming into focus.',
  good: 'Consistent base — top is still settling.',
  strong: 'Clean palette with a relaxed, settling cohesion.',
};

export function ensureMediumTraitDensity(
  bullets: string[],
  band: LiveOutcomeBand,
  certainty: LiveOutcomeCertainty,
): string[] {
  if (certainty !== 'medium') return bullets;
  if (bullets.length > 0) return bullets.slice(0, 1);
  return [SAFE_MEDIUM_TRAITS[band]];
}

/**
 * Bind score + headline + summary + bullets into one paintable outcome.
 * Certainty softens tone under partial truth; it never changes the band.
 */
export function enforceLiveOutcomeContract<T extends LiveCoaching>(
  coaching: T | null | undefined,
  score: number | null | undefined,
  opts?: { certainty?: LiveOutcomeCertainty },
): T | null | undefined {
  if (!coaching) return coaching;
  if (score == null || !Number.isFinite(Number(score))) {
    return {
      ...coaching,
      headline: '',
      summary: '',
      bullets: [],
      hasConflict: false,
    };
  }

  const n = Number(score);
  const band = scoreToBand(n);
  assertOutcomeConsistency(n, band);

  const certainty = opts?.certainty || 'high';
  const partial = certainty === 'medium';
  const lane = coaching.styleLane || null;

  let headline = String(coaching.headline || '');
  let summary = String(coaching.summary || '');
  let bullets = Array.isArray(coaching.bullets)
    ? coaching.bullets.map((b) => String(b || '').trim()).filter(Boolean)
    : [];
  let hasConflict = Boolean(coaching.hasConflict);

  // 1. Score → headline authority (band-illegal headlines are always rewritten).
  if (partial) {
    hasConflict = false;
    if (
      !headline.trim()
      || HEADLINE_FORBIDDEN[band].test(headline)
      || MIXED_HEADLINE_RE.test(headline)
      || MIXED_WEIGHTS_RE.test(headline)
      || /polished|needs a tweak/i.test(headline)
    ) {
      headline = band === 'strong' || band === 'good'
        ? (n >= 80 ? 'Looking good' : 'Almost there')
        : headlineFromScore(n, lane);
    }
  } else if (!headline.trim() || HEADLINE_FORBIDDEN[band].test(headline)) {
    if (band === 'mixed' && hasConflict && MIXED_WEIGHTS_RE.test(String(coaching.headline || ''))) {
      headline = 'Mixed weights';
    } else if (band === 'mixed' && hasConflict) {
      headline = 'Mixed directions';
    } else if (band === 'weak' && hasConflict) {
      headline = MIXED_WEIGHTS_RE.test(String(coaching.headline || ''))
        ? 'Mixed weights'
        : 'Mixed directions';
    } else {
      headline = headlineFromScore(n, lane);
    }
  }

  // Strong / good bands cannot keep conflict flags.
  if (band === 'strong' || (band === 'good' && n >= 75)) {
    hasConflict = false;
  }
  if (partial) hasConflict = false;

  // 2. Summary must match band language.
  if (band === 'strong' || band === 'good') {
    if (coaching.summaryArchetype === 'tension' || TENSION_COPY_RE.test(summary) || COPY_FORBIDDEN[band].test(summary)) {
      summary = stripTensionPhrases(summary);
      summary = stripForbiddenCopy(summary, band);
      if (!summary || TENSION_COPY_RE.test(summary) || COPY_FORBIDDEN[band].test(summary)) {
        summary = defaultSummaryForBand(band, n);
      }
    }
  } else if (band === 'weak' || band === 'mixed') {
    summary = stripForbiddenCopy(summary, band);
    if (!summary || COPY_FORBIDDEN[band].test(summary) || COHESION_COPY_RE.test(summary)) {
      if (COHESION_COPY_RE.test(String(coaching.summary || '')) || !summary) {
        summary = defaultSummaryForBand(band, n);
      }
    }
  }

  if (partial && (TENSION_COPY_RE.test(summary) || coaching.summaryArchetype === 'tension')) {
    summary = stripTensionPhrases(summary);
    if (!summary || TENSION_COPY_RE.test(summary)) {
      summary = 'The combination is settling into one direction.';
    }
  }

  summary = editorialiseSummaryProse(summary);
  summary = softenOutcomeTone(summary, certainty);
  headline = softenOutcomeTone(headline, certainty);

  // 3. Bullets: reason + band language + no cross-contradiction.
  bullets = bullets
    .filter((b) => hasTipReason(b))
    .filter((b) => !COPY_FORBIDDEN[band].test(b))
    .filter((b) => !(partial && (MIXED_HEADLINE_RE.test(b) || MIXED_WEIGHTS_RE.test(b))))
    .filter((b) => !(partial && TENSION_COPY_RE.test(b)))
    .filter((b) => !(band === 'strong' && contradictsCohesion(summary, b)))
    .filter((b) => !(band === 'strong' && (TENSION_COPY_RE.test(b) || COLOUR_CLASH_NAG_RE.test(b))))
    .filter((b) => !(band === 'strong' && FORMALITY_SPAN_RE.test(b)))
    .filter((b) => !(band === 'good' && TENSION_COPY_RE.test(b)))
    .filter((b) => !(hasConflict && COHESION_COPY_RE.test(b) && !TENSION_COPY_RE.test(b)))
    .map((b) => softenOutcomeTone(b, certainty))
    .slice(0, partial ? 1 : 2);

  bullets = ensureMediumTraitDensity(bullets, band, certainty);

  // Medium with only a soft headline still needs a concrete observational line.
  if (partial && !summary.trim()) {
    summary = softenOutcomeTone(SAFE_MEDIUM_TRAITS[band], certainty);
  }

  return {
    ...coaching,
    headline,
    summary,
    bullets,
    hasConflict,
    sameLane: hasConflict ? coaching.sameLane : true,
    summaryArchetype: (band === 'strong' || band === 'good' || partial)
      && coaching.summaryArchetype === 'tension'
      ? 'balanced'
      : coaching.summaryArchetype,
  };
}
