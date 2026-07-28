/**
 * Lean “what to scan next” suggestions — gaps + outfit sequencing + conservative unlock math.
 * One suggestion at a time; specific stylist tone, never “scan more items”.
 */

export type ScanSuggestionSlot = 'tops' | 'bottoms' | 'shoes' | 'outerwear' | 'dresses';

export type ScanSuggestionInputItem = {
  category?: string | null;
  color?: string | null;
};

export type ScanNextSuggestion = {
  /** Short chip line, e.g. "Try scanning: a pair of jeans" */
  chip: string;
  /** Optional supporting line with unlock gain */
  detail?: string;
  slot: ScanSuggestionSlot;
  unlockGain: number;
  reason: 'category_gap' | 'sequence' | 'colour_gap' | 'coverage';
};

const DARK_COLORS = new Set([
  'black', 'navy', 'charcoal', 'grey', 'gray', 'brown', 'dark', 'burgundy', 'olive',
]);

const LIGHT_NEUTRALS = new Set([
  'white', 'cream', 'beige', 'ivory', 'off-white', 'ecru', 'camel', 'tan', 'sand',
]);

export function normalizeScanSlot(category?: string | null): ScanSuggestionSlot | 'other' {
  const c = String(category || '').toLowerCase().trim();
  if (c === 'tops' || c === 'activewear_tops') return 'tops';
  if (c === 'bottoms' || c === 'activewear_bottoms') return 'bottoms';
  if (c === 'shoes') return 'shoes';
  if (c === 'outerwear') return 'outerwear';
  if (c === 'dresses') return 'dresses';
  return 'other';
}

export function countScanSlots(
  items: ScanSuggestionInputItem[],
): Record<ScanSuggestionSlot, number> {
  const counts: Record<ScanSuggestionSlot, number> = {
    tops: 0,
    bottoms: 0,
    shoes: 0,
    outerwear: 0,
    dresses: 0,
  };
  for (const item of items) {
    const slot = normalizeScanSlot(item.category);
    if (slot !== 'other') counts[slot] += 1;
  }
  return counts;
}

/**
 * Conservative outfit estimate: tops×bottoms when shoes exist, plus dresses.
 * Does not multiply by shoe count (that inflates unrealistically).
 */
export function estimateOutfitCombos(counts: Record<ScanSuggestionSlot, number>): number {
  const tops = counts.tops || 0;
  const bottoms = counts.bottoms || 0;
  const shoes = counts.shoes || 0;
  const dresses = counts.dresses || 0;
  if (shoes < 1) {
    // No footwear → not counting complete looks
    return 0;
  }
  return tops * bottoms + dresses;
}

export function unlockGainIfAdd(
  counts: Record<ScanSuggestionSlot, number>,
  slot: ScanSuggestionSlot,
): number {
  // Outerwear finishes existing complete looks rather than inventing new combos.
  if (slot === 'outerwear') {
    return estimateOutfitCombos(counts);
  }
  const next = { ...counts, [slot]: (counts[slot] || 0) + 1 };
  return Math.max(0, estimateOutfitCombos(next) - estimateOutfitCombos(counts));
}

function isDarkColor(color?: string | null): boolean {
  const c = String(color || '').toLowerCase();
  if (!c || c === 'multicolor') return false;
  for (const d of DARK_COLORS) {
    if (c.includes(d)) return true;
  }
  return false;
}

function hasLightNeutral(items: ScanSuggestionInputItem[]): boolean {
  return items.some((item) => {
    const c = String(item.color || '').toLowerCase();
    for (const l of LIGHT_NEUTRALS) {
      if (c.includes(l)) return true;
    }
    return false;
  });
}

function suggestionForSlot(
  slot: ScanSuggestionSlot,
  unlockGain: number,
  reason: ScanNextSuggestion['reason'],
  tone: 'gap' | 'sequence' | 'colour' | 'coverage',
): ScanNextSuggestion {
  const lines: Record<ScanSuggestionSlot, { gap: string; sequence: string; colour?: string; coverage: string }> = {
    tops: {
      gap: 'Try scanning: a versatile top',
      sequence: 'Now add a top to build the look',
      colour: 'A white or beige top would unlock more outfits',
      coverage: 'A simple top would pull more looks together',
    },
    bottoms: {
      gap: 'Try scanning: trousers or jeans',
      sequence: 'Now add trousers or jeans',
      coverage: 'A pair of jeans would pull this together',
    },
    shoes: {
      gap: 'Try scanning: shoes to finish looks',
      sequence: 'Add shoes to complete the look',
      coverage: 'Shoes would finish a lot of outfits',
    },
    outerwear: {
      gap: 'Try scanning: a jacket or coat',
      sequence: 'A jacket would finish this look',
      coverage: 'A jacket would finish more outfits',
    },
    dresses: {
      gap: 'Try scanning: a dress or one-piece',
      sequence: 'A dress would give you an easy full look',
      coverage: 'A dress would add easy outfit coverage',
    },
  };
  const pack = lines[slot];
  const chip =
    tone === 'sequence' ? pack.sequence
      : tone === 'colour' && pack.colour ? pack.colour
        : tone === 'coverage' ? pack.coverage
          : pack.gap;

  const detail = unlockGain > 0
    ? (unlockGain === 1
      ? 'About 1 new outfit unlocked'
      : `About ${unlockGain} new outfits unlocked`)
    : undefined;

  return { chip, detail, slot, unlockGain, reason };
}

/**
 * Pick a single next-scan suggestion. Prefer hard gaps, then sequence, then colour, then coverage.
 */
export function getScanNextSuggestion(opts: {
  wardrobe: ScanSuggestionInputItem[];
  sessionItems?: ScanSuggestionInputItem[];
  lastCategory?: string | null;
}): ScanNextSuggestion | null {
  const all = [...(opts.wardrobe || []), ...(opts.sessionItems || [])];
  if (all.length === 0) {
    return {
      chip: 'Try scanning: a top you wear often',
      slot: 'tops',
      unlockGain: 0,
      reason: 'sequence',
    };
  }

  const counts = countScanSlots(all);
  const last = normalizeScanSlot(opts.lastCategory);
  const hasBasePieces = counts.tops > 0 || counts.bottoms > 0 || counts.dresses > 0;

  // 1) Hard category gaps (highest priority)
  if (counts.shoes < 1 && (counts.tops > 0 || counts.bottoms > 0 || counts.dresses > 0)) {
    return suggestionForSlot('shoes', unlockGainIfAdd(counts, 'shoes'), 'category_gap', 'gap');
  }
  if (counts.tops < 1 && counts.bottoms > 0 && counts.dresses < 1) {
    return suggestionForSlot('tops', unlockGainIfAdd(counts, 'tops'), 'category_gap', 'gap');
  }
  if (counts.bottoms < 1 && counts.tops > 0 && counts.dresses < 1) {
    return suggestionForSlot('bottoms', unlockGainIfAdd(counts, 'bottoms'), 'category_gap', 'gap');
  }
  if (counts.outerwear < 1 && counts.shoes > 0 && (counts.tops * counts.bottoms > 0 || counts.dresses > 0)) {
    return suggestionForSlot('outerwear', unlockGainIfAdd(counts, 'outerwear'), 'category_gap', 'gap');
  }

  // 2) Outfit sequencing after last capture
  if (last === 'tops') {
    if (counts.bottoms < 1) {
      return suggestionForSlot('bottoms', unlockGainIfAdd(counts, 'bottoms'), 'sequence', 'sequence');
    }
    if (counts.shoes < 1) {
      return suggestionForSlot('shoes', unlockGainIfAdd(counts, 'shoes'), 'sequence', 'sequence');
    }
    if (counts.bottoms <= counts.tops) {
      return suggestionForSlot('bottoms', unlockGainIfAdd(counts, 'bottoms'), 'sequence', 'sequence');
    }
  }
  if (last === 'bottoms') {
    if (counts.tops < 1) {
      return suggestionForSlot('tops', unlockGainIfAdd(counts, 'tops'), 'sequence', 'sequence');
    }
    if (counts.shoes < 1) {
      return suggestionForSlot('shoes', unlockGainIfAdd(counts, 'shoes'), 'sequence', 'sequence');
    }
    if (counts.tops <= counts.bottoms) {
      return suggestionForSlot('tops', unlockGainIfAdd(counts, 'tops'), 'sequence', 'sequence');
    }
  }
  if (last === 'dresses' && counts.shoes < 2) {
    return suggestionForSlot('shoes', unlockGainIfAdd(counts, 'shoes'), 'sequence', 'sequence');
  }
  if (last === 'shoes' && counts.outerwear < 1 && hasBasePieces) {
    return suggestionForSlot('outerwear', unlockGainIfAdd(counts, 'outerwear'), 'sequence', 'sequence');
  }

  // 3) Colour gap — mostly dark, no light neutral
  const colored = all.filter((i) => i.color && String(i.color).toLowerCase() !== 'multicolor');
  const darkShare = colored.length > 0
    ? colored.filter((i) => isDarkColor(i.color)).length / colored.length
    : 0;
  if (colored.length >= 3 && darkShare >= 0.7 && !hasLightNeutral(all)) {
    return suggestionForSlot('tops', unlockGainIfAdd(counts, 'tops'), 'colour_gap', 'colour');
  }

  // 4) Coverage — pick slot with best unlock gain
  const candidates: ScanSuggestionSlot[] = ['bottoms', 'tops', 'shoes', 'outerwear', 'dresses'];
  let best: ScanSuggestionSlot | null = null;
  let bestGain = 0;
  for (const slot of candidates) {
    const gain = unlockGainIfAdd(counts, slot);
    if (gain > bestGain) {
      bestGain = gain;
      best = slot;
    }
  }
  if (best && bestGain > 0) {
    return suggestionForSlot(best, bestGain, 'coverage', 'coverage');
  }

  // Soft default when wardrobe is already balanced
  if (counts.tops <= counts.bottoms) {
    return suggestionForSlot('tops', unlockGainIfAdd(counts, 'tops'), 'coverage', 'coverage');
  }
  return suggestionForSlot('bottoms', unlockGainIfAdd(counts, 'bottoms'), 'coverage', 'coverage');
}
