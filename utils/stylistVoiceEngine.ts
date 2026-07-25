/**
 * Stylist Voice Engine — signal → critique (NOT score → sentence).
 * Deterministic first; GPT may only rephrase locked signals + items.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { OutfitAestheticAnalysis } from '@/utils/outfitAestheticClassifier';
import { styleArchetypeLabel } from '@/utils/outfitAestheticClassifier';
import {
  evaluateStyleCoherence,
  type DetectedSignals,
  type StyleLane,
} from '@/utils/styleCoherenceEngine';
import { classifyItem } from '@/utils/outfitClashRules';
import {
  detectSubtypeConflicts,
  classifyGarment,
  footwearVoiceHint,
} from '@/utils/garmentTaxonomy';

export type StylistTone = 'excellent' | 'good' | 'mixed' | 'off';

export type StylistItemVerdict = 'works' | 'neutral' | 'fights' | 'swap';

export type StylistItemNote = {
  itemId: string;
  role: string;
  verdict: StylistItemVerdict;
  comment: string;
  suggestion?: string;
};

export type StylistAnalysis = {
  summary: string;
  overallTone: StylistTone;
  items: StylistItemNote[];
  /** Max 2, only when real signals fire. */
  adjustments?: string[];
};

function roleForCategory(category: string): string {
  const c = String(category || '').toLowerCase();
  if (c === 'shoes') return 'footwear';
  if (c === 'outerwear' || c === 'formal') return 'layer';
  if (c === 'bottoms' || c === 'activewear_bottoms') return 'bottoms';
  if (c === 'tops' || c === 'activewear_tops') return 'top';
  if (c === 'dresses') return 'dress';
  if (c === 'accessories') return 'accessory';
  return c || 'piece';
}

function toneFromScoreAndSignals(score: number, signals: DetectedSignals): StylistTone {
  if (signals.multiLaneChaos || signals.tailoringClash || (signals.laneConflict && signals.footwearMismatch)) {
    return 'off';
  }
  if (signals.laneConflict || signals.footwearMismatch || signals.footwearLaneMismatch || signals.invalidTwoLaneMix) {
    return score < 50 ? 'off' : 'mixed';
  }
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 65) return 'mixed';
  return 'off';
}

function laneLabel(lane: StyleLane): string {
  switch (lane) {
    case 'tailored': return 'tailoring';
    case 'athleisure': return 'athleisure';
    case 'street': return 'street';
    default: return 'casual';
  }
}

function buildAdjustments(signals: DetectedSignals, items: WardrobeItem[]): string[] {
  const out: string[] = [];
  if (signals.tailoringClash) {
    out.push('Swap tracksuit/joggers for chinos or tailored trousers — or drop the blazer');
  }
  if (signals.footwearMismatch || signals.footwearLaneMismatch) {
    if (signals.footwearClass === 'runner') {
      out.push('Replace running shoes with plain lifestyle sneakers or loafers');
    } else if (signals.footwearClass === 'slides') {
      out.push('Swap slides for loafers or minimal sneakers');
    } else if (signals.footwearClass === 'combat_boots') {
      out.push('Swap combat boots for Chelsea boots — or drop the blazer');
    } else if (signals.footwearClass === 'chunky_sneaker') {
      out.push('Replace chunky trainers with plain white lifestyle sneakers or dress shoes');
    } else if ((signals.lanesPresent || []).includes('tailored')) {
      out.push('Swap footwear to match the tailored lane — loafers, Chelsea boots, or minimal sneakers');
    } else if ((signals.lanesPresent || []).includes('athleisure')) {
      out.push('Swap footwear to clean lifestyle sneakers that match the athleisure lane');
    } else {
      out.push('Swap footwear so it matches the rest of this outfit');
    }
  }
  if (signals.multiLaneChaos && out.length < 2) {
    out.push(`Commit to one lane (${signals.lanesPresent.map(laneLabel).join(' / ')}) — remove the piece that breaks the story`);
  }
  if (signals.invalidTwoLaneMix && !signals.tailoringClash && out.length < 2) {
    out.push('Keep tailored with casual, or street with casual — not tailored with athleisure/street');
  }
  if (signals.colorClash && out.length < 2) {
    out.push('Simplify the palette to 2–3 colours');
  }
  // Resolve item names only as locked references (no invention)
  void items;
  return out.slice(0, 2);
}

function commentForItem(
  item: WardrobeItem,
  signals: DetectedSignals,
  tone: StylistTone,
  aesthetic: OutfitAestheticAnalysis | null | undefined,
): { verdict: StylistItemVerdict; comment: string; suggestion?: string } {
  const id = String(item.id || '');
  const role = roleForCategory(item.category);
  const sig = classifyItem(item);
  const name = item.name || 'This piece';

  if (tone === 'excellent') {
    return {
      verdict: 'works',
      comment: aesthetic?.primaryStyle
        ? `Holds the ${styleArchetypeLabel(aesthetic.primaryStyle)} story — leave it.`
        : 'Sits cleanly with the rest — leave it.',
    };
  }

  if (tone === 'good') {
    return {
      verdict: 'works',
      comment: 'Supports the look — only a micro polish would change anything.',
    };
  }

  // Mixed / off — name actual conflicts
  if (sig.isAthleticShorts && signals.tailoringClash) {
    return {
      verdict: 'swap',
      comment: `${name} reads athletic — it fights tailored pieces in this mix.`,
      suggestion: 'Swap to tailored shorts, chinos, or trousers.',
    };
  }

  if (sig.isSlipDress && signals.footwearMismatch) {
    return {
      verdict: 'fights',
      comment: footwearVoiceHint(
        sig.subtype === 'combat_boots' ? 'combat_boots' : 'chunky_trainer',
        'dress',
      ),
      suggestion: 'Swap to heels or plain lifestyle sneakers.',
    };
  }

  if (role === 'footwear' && sig.isChelseaBoots && !signals.footwearMismatch && !signals.tailoringClash) {
    return {
      verdict: 'works',
      comment: footwearVoiceHint('chelsea_boots', 'anchor_ok'),
    };
  }

  if (
    (sig.subtype === 'chunky_trainer' || sig.subtype === 'runner' || sig.isChunkyOrTechTrainer)
    && (signals.footwearMismatch || signals.footwearLaneMismatch || signals.tailoringClash)
  ) {
    return {
      verdict: 'swap',
      comment: footwearVoiceHint(sig.subtype === 'runner' ? 'runner' : 'chunky_trainer'),
      suggestion: 'Swap to plain white lifestyle sneakers, loafers, or heels.',
    };
  }

  if (sig.isCombatBoots && (signals.footwearMismatch || signals.footwearLaneMismatch || signals.tailoringClash)) {
    return {
      verdict: 'swap',
      comment: footwearVoiceHint('combat_boots'),
      suggestion: 'Swap to Chelsea boots or drop the blazer.',
    };
  }

  if (sig.isSlides && (signals.footwearMismatch || signals.footwearLaneMismatch)) {
    return {
      verdict: 'swap',
      comment: footwearVoiceHint('slides'),
      suggestion: 'Swap to loafers or minimal sneakers.',
    };
  }

  if (signals.overdressedPiece === id || (sig.isBlazer && (signals.tailoringClash || signals.footwearMismatch || signals.multiLaneChaos))) {
    if (signals.tailoringClash) {
      return {
        verdict: 'fights',
        comment: `${name} is fighting the athleisure bottoms — tailoring and track/joggers don't share a lane.`,
        suggestion: 'Keep the blazer only with chinos, trousers, or denim.',
      };
    }
    if (signals.footwearMismatch) {
      return {
        verdict: 'fights',
        comment: `${name} sets a tailored lane that the footwear is ignoring.`,
        suggestion: 'Pair with plain lifestyle sneakers or dress shoes.',
      };
    }
    if (signals.multiLaneChaos) {
      return {
        verdict: 'fights',
        comment: `${name} is one of three competing lanes — the outfit reads confused.`,
        suggestion: 'Pick tailored or drop the blazer for a casual/street read.',
      };
    }
  }

  if (signals.underdressedPiece === id || (role === 'footwear' && signals.footwearMismatch)) {
    const hint = signals.footwearClass === 'runner'
      ? footwearVoiceHint('runner')
      : signals.footwearClass === 'slides'
        ? footwearVoiceHint('slides')
        : signals.footwearClass === 'combat_boots'
          ? footwearVoiceHint('combat_boots')
          : signals.footwearClass === 'chunky_sneaker'
            ? footwearVoiceHint('chunky_trainer')
            : footwearVoiceHint(sig.subtype || 'footwear');
    return {
      verdict: 'swap',
      comment: hint,
      suggestion: signals.footwearClass === 'combat_boots'
        ? 'Swap to Chelsea boots or drop the blazer.'
        : 'Swap to plain white lifestyle sneakers or loafers.',
    };
  }

  if (role === 'bottoms' && (sig.isJoggers || sig.isAthleticBottom || sig.isLoungeBottom) && (signals.tailoringClash || signals.multiLaneChaos)) {
    return {
      verdict: 'swap',
      comment: 'Track/jogger bottoms clash with tailored pieces — athleisure vs tailoring.',
      suggestion: 'Swap to chinos or tailored trousers.',
    };
  }

  if (signals.multiLaneChaos) {
    return {
      verdict: 'neutral',
      comment: `${name} is wearable alone, but the full mix spans ${signals.lanesPresent.map(laneLabel).join(', ')}.`,
    };
  }

  if (signals.laneConflict || signals.invalidTwoLaneMix) {
    return {
      verdict: 'neutral',
      comment: `${name} isn't the sole problem — the lane mix (${signals.lanesPresent.map(laneLabel).join(' + ')}) needs a clearer anchor.`,
    };
  }

  return {
    verdict: 'neutral',
    comment: `${name} is fine in isolation — fix the conflicting piece first.`,
  };
}

function summaryFor(
  tone: StylistTone,
  signals: DetectedSignals,
  aesthetic: OutfitAestheticAnalysis | null | undefined,
  fallbackHint?: string | null,
  items: WardrobeItem[] = [],
): string {
  const intentPhrase = signals.intent
    ? (signals.intentLabel
      ? `This reads as ${String(signals.intentLabel).charAt(0).toLowerCase()}${String(signals.intentLabel).slice(1)}`
      : null)
    : null;
  // Prefer catalog summaryTone via intent name when present
  const catalogTone = signals.intent
    ? ({
      effortless: 'This reads as effortless casual',
      power: 'This reads as power dressing',
      date_night: 'This reads as date-night polish',
      editorial: 'This reads as editorial / high-fashion',
      casual_day: 'This reads as everyday casual',
      smart_casual: 'This reads as smart casual',
    } as Record<string, string>)[signals.intent] || intentPhrase
    : null;

  const hasBlazerPiece = items.some((i) => /blazer|suit jacket/i.test(`${i.name || ''} ${i.category || ''}`));
  const hasTailoredLane = (signals.lanesPresent || []).includes('tailored');

  if (tone === 'excellent') {
    if (catalogTone && aesthetic?.primaryStyle) {
      return `${catalogTone} — intentional ${styleArchetypeLabel(aesthetic.primaryStyle)}, cohesive end to end.`;
    }
    if (aesthetic?.primaryStyle) {
      return `Excellent — intentional ${styleArchetypeLabel(aesthetic.primaryStyle)}, cohesive end to end.`;
    }
    return catalogTone ? `${catalogTone} — polished and intentional.` : 'Excellent combo — polished and intentional.';
  }
  if (tone === 'good') {
    return catalogTone
      ? `${catalogTone} — pieces sit in the same story.`
      : 'Strong outfit — pieces sit in the same story.';
  }
  if (signals.multiLaneChaos) {
    return `Off — ${signals.lanesPresent.map(laneLabel).join(', ')} are fighting each other. Commit to one lane.`;
  }
  if (signals.tailoringClash && signals.footwearMismatch) {
    return hasBlazerPiece
      ? 'Off — the blazer is fighting track bottoms and chunky trainers.'
      : 'Off — tailored pieces are fighting athleisure bottoms and trainers.';
  }
  if (signals.tailoringClash) {
    return hasBlazerPiece
      ? 'Off — blazer over joggers/tracksuit reads accidental, not styled.'
      : 'Off — tailoring mixed with joggers/tracksuit reads accidental, not styled.';
  }
  if (signals.footwearMismatch) {
    const undercutTarget = hasTailoredLane ? 'the tailored pieces' : 'the rest of this outfit';
    return signals.footwearClass === 'runner'
      ? `Mixed — running shoes undercut ${undercutTarget}.`
      : signals.footwearClass === 'combat_boots'
        ? `Mixed — combat boots undercut ${undercutTarget}.`
        : signals.footwearClass === 'slides'
          ? `Mixed — slides undercut ${undercutTarget}.`
          : signals.footwearClass === 'chunky_sneaker'
            ? `Mixed — chunky trainers undercut ${undercutTarget}.`
            : `Mixed — footwear undercuts ${undercutTarget}.`;
  }
  if (signals.invalidTwoLaneMix) {
    return `Mixed — ${signals.lanesPresent.map(laneLabel).join(' + ')} isn't an allowed mix.`;
  }
  if (fallbackHint && !/refine footwear/i.test(fallbackHint)) return fallbackHint;
  return tone === 'mixed' ? 'Mixed — one piece is breaking the story.' : 'Needs a clearer style lane.';
}

export type BuildStylistAnalysisOptions = {
  score: number;
  signals?: DetectedSignals | null;
  aesthetic?: OutfitAestheticAnalysis | null;
  hint?: string | null;
  clashId?: string | null;
  intent?: string | null;
};

/**
 * Deterministic stylist read from DetectedSignals (+ score only for tone banding).
 * Excellent (≥90 / no major signals): affirm per item; zero refine/confused/adjustments.
 */
export function buildStylistAnalysis(
  items: WardrobeItem[],
  options: BuildStylistAnalysisOptions,
): StylistAnalysis {
  if (!items || items.length === 0) {
    return { summary: 'Swipe rows to build a look', overallTone: 'mixed', items: [] };
  }
  if (items.length === 1) {
    return {
      summary: 'Add more pieces to score the outfit',
      overallTone: 'mixed',
      items: [{
        itemId: String(items[0].id),
        role: roleForCategory(items[0].category),
        verdict: 'neutral',
        comment: 'Waiting on a full outfit to judge.',
      }],
    };
  }

  const coherence = options.signals
    ? null
    : evaluateStyleCoherence(items);
  const signals = options.signals || coherence!.signals;
  const score = options.score;
  const majorSignal = signals.multiLaneChaos
    || signals.tailoringClash
    || signals.footwearMismatch
    || signals.footwearLaneMismatch
    || signals.invalidTwoLaneMix
    || signals.laneConflict;

  const tone = toneFromScoreAndSignals(score, signals);
  // Excellent path: no adjustments unless somehow a major signal slipped through (shouldn't)
  const excellentClean = score >= 90 && !majorSignal;
  const subtypeConflicts = detectSubtypeConflicts(items).conflicts;
  const clashId = options.clashId || null;

  const itemNotes = items.map((item) => {
    const { verdict, comment, suggestion } = commentForItem(
      item,
      signals,
      excellentClean ? 'excellent' : tone,
      options.aesthetic,
    );
    const note: StylistItemNote = {
      itemId: String(item.id),
      role: roleForCategory(item.category),
      verdict: excellentClean ? 'works' : verdict,
      comment: excellentClean
        ? (options.aesthetic?.primaryStyle
          ? `Works in this ${styleArchetypeLabel(options.aesthetic.primaryStyle)} story — colour and formality align.`
          : 'Supports a cohesive, intentional finish.')
        : comment,
    };
    if (!excellentClean && suggestion) note.suggestion = suggestion;

    if (!excellentClean) {
      const subtypeHit = subtypeConflicts.find(
        (c) => String(c.itemA?.id) === String(item.id) || String(c.itemB?.id) === String(item.id),
      );
      if (
        subtypeHit
        && (clashId === 'athletic_shorts_blazer'
          || clashId === 'slip_dress_chunky_trainer'
          || clashId === 'slip_dress_combat_boots'
          || clashId === 'blazer_slides'
          || clashId === 'blazer_combat_boots'
          || clashId === 'blazer_leather_sandals'
          || clashId === 'footwear_lane_mismatch'
          || clashId === 'occasion_footwear_lock'
          || clashId === 'subtype_avoid_pair'
          || clashId === 'revealing_stack'
          || note.verdict === 'neutral'
          || subtypeHit.footwearAnchor)
      ) {
        const g = classifyGarment(item);
        if (g.subtype && (subtypeHit.a === g.subtype || subtypeHit.b === g.subtype || subtypeHit.footwearAnchor)) {
          note.verdict = note.verdict === 'works' ? 'fights' : note.verdict;
          note.comment = subtypeHit.hint || note.comment;
          note.suggestion = note.suggestion || 'Swap this piece for a subtype that shares the outfit lane.';
        }
      }
    }
    return note;
  });

  const adjustments = excellentClean ? undefined : (() => {
    const list = buildAdjustments(signals, items);
    return list.length ? list : undefined;
  })();

  return {
    summary: summaryFor(
      excellentClean ? 'excellent' : tone,
      signals,
      options.aesthetic,
      options.hint,
      items,
    ),
    overallTone: excellentClean ? 'excellent' : tone,
    items: itemNotes,
    adjustments,
  };
}

/** Map StylistAnalysis → legacy itemNotes shape used by Outfit Mix UI / API. */
export function stylistAnalysisToItemNotes(analysis: StylistAnalysis): Array<{
  id: string;
  role: string;
  name?: string;
  note: string;
  verdict?: StylistItemVerdict;
  suggestion?: string;
}> {
  return analysis.items.map((n) => ({
    id: n.itemId,
    role: n.role,
    note: n.suggestion ? `${n.comment} ${n.suggestion}` : n.comment,
    verdict: n.verdict,
    suggestion: n.suggestion,
  }));
}
