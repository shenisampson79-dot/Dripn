/**
 * Outfit Mix UI Reality Layer — completeness + visibility + layout contracts.
 *
 * Rule: if an owned item exists for a reel, the user must be able to see it —
 * clearly, fully, and without obstruction. Occasion scoring may demote pieces;
 * it must not silently erase inventory from the Mix UI.
 */

export type LayoutRule =
  | { type: 'minItems'; row: string; count: number; whenInventoryAtLeast?: number }
  | { type: 'noEmptyCards'; row: string }
  | { type: 'noOverlap'; a: string; b: string }
  | { type: 'categoryCoverage'; row: string; categories: string[] }
  | { type: 'filterTransparency'; row: string; maxDropRatio: number };

export type LayoutContract = {
  screen: string;
  rules: LayoutRule[];
};

/** Layout geometry contract — Save CTA never shares vertical space with shoe row. */
export const OUTFIT_MIX_LAYOUT = Object.freeze({
  saveButtonMinHeight: 52,
  saveFooterPaddingTop: 8,
  /** Extra gap between last reel and Save button */
  reelToSaveGap: 12,
  /** Content padding below reels so absolute Save never covers cards */
  get contentPadForSave() {
    return this.saveFooterPaddingTop + this.saveButtonMinHeight + this.reelToSaveGap;
  },
});

export const OUTFIT_MIX_COVERAGE = Object.freeze({
  bottoms: 2,
  shoes: 3,
  tops: 2,
});

export const OutfitMixContract: LayoutContract = {
  screen: 'OutfitMix',
  rules: [
    { type: 'minItems', row: 'bottoms', count: 2, whenInventoryAtLeast: 2 },
    { type: 'minItems', row: 'shoes', count: 2, whenInventoryAtLeast: 2 },
    { type: 'noEmptyCards', row: 'shoes' },
    { type: 'noEmptyCards', row: 'bottoms' },
    { type: 'noOverlap', a: 'saveButton', b: 'row_shoes' },
    {
      type: 'categoryCoverage',
      row: 'bottoms',
      categories: ['casual', 'formal'],
    },
    { type: 'filterTransparency', row: 'bottoms', maxDropRatio: 0.85 },
    { type: 'filterTransparency', row: 'shoes', maxDropRatio: 0.85 },
  ],
};

export type MixUiRealityInput = {
  inventoryByRow: Record<string, number>;
  visibleByRow: Record<string, Array<{ id?: string | null; image?: string | null; _mixImageFallback?: boolean; softBanned?: boolean }>>;
  filterDropRatioByRow?: Record<string, number>;
  layout?: {
    saveButton?: { top: number; bottom: number };
    row_shoes?: { top: number; bottom: number };
  };
};

export type MixUiRealityResult = {
  pass: boolean;
  errors: string[];
  warnings: string[];
};

function overlaps(
  a: { top: number; bottom: number },
  b: { top: number; bottom: number },
): boolean {
  return a.top < b.bottom && b.top < a.bottom;
}

/**
 * Evaluate Outfit Mix UI Reality contracts (pure — no DOM).
 */
export function evaluateOutfitMixUiReality(input: MixUiRealityInput): MixUiRealityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of OutfitMixContract.rules) {
    if (rule.type === 'minItems') {
      const inventory = input.inventoryByRow[rule.row] ?? 0;
      const floor = rule.whenInventoryAtLeast ?? rule.count;
      if (inventory < floor) continue;
      const visible = input.visibleByRow[rule.row]?.length ?? 0;
      if (visible < rule.count) {
        errors.push(
          `minItems:${rule.row} inventory=${inventory} visible=${visible} need≥${rule.count}`,
        );
      }
    }

    if (rule.type === 'noEmptyCards') {
      const cards = input.visibleByRow[rule.row] || [];
      for (const card of cards) {
        const hasImage = Boolean(card.image) || Boolean(card._mixImageFallback);
        if (!hasImage && !card.id) {
          errors.push(`noEmptyCards:${rule.row} blank card`);
        }
      }
    }

    if (rule.type === 'noOverlap') {
      const a = input.layout?.[rule.a as 'saveButton'];
      const b = input.layout?.[rule.b as 'row_shoes'];
      if (a && b && overlaps(a, b)) {
        errors.push(
          `noOverlap:${rule.a}/${rule.b} save.bottom=${a.bottom} row.top=${b.top}`,
        );
      }
    }

    if (rule.type === 'filterTransparency') {
      const ratio = input.filterDropRatioByRow?.[rule.row];
      if (typeof ratio === 'number' && ratio > rule.maxDropRatio) {
        errors.push(
          `filterTransparency:${rule.row} dropRatio=${ratio.toFixed(2)} > ${rule.maxDropRatio}`,
        );
      }
    }

    if (rule.type === 'categoryCoverage') {
      // Structural: visible bottoms should include formal candidates when inventory has them
      const inv = input.inventoryByRow[`${rule.row}:formal`] ?? 0;
      const visFormal = input.inventoryByRow[`${rule.row}:formalVisible`] ?? 0;
      if (inv > 0 && visFormal < 1) {
        errors.push(`categoryCoverage:${rule.row} formal inventory hidden`);
      }
    }
  }

  // Layout geometry contract (constant-level guarantee)
  if (OUTFIT_MIX_LAYOUT.contentPadForSave < OUTFIT_MIX_LAYOUT.saveButtonMinHeight) {
    errors.push('layout:contentPadForSave too small for save button');
  }

  return {
    pass: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Ensure minimum visible coverage without inventing items.
 * Keeps full preferred order (does not truncate once min is met), then
 * backfills from soft pool and full inventory until minCount or inventory ends.
 */
export function ensureMinimumCoverage<T extends { id?: string | null }>(
  preferred: T[],
  softPool: T[],
  fullInventory: T[],
  minCount: number,
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  const push = (item: T) => {
    const id = String(item?.id ?? '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(item);
  };
  for (const item of preferred) push(item);
  if (out.length < minCount) {
    for (const item of softPool) {
      push(item);
      if (out.length >= minCount) break;
    }
  }
  if (out.length < minCount) {
    for (const item of fullInventory) {
      push(item);
      if (out.length >= minCount) break;
    }
  }
  return out;
}

/**
 * Soft-ban vs hard-ban for Mix *visibility*.
 * Hard: athletic tops/bottoms stay demoted but still visible after preferred.
 * Soft: cargo/trainers visible after preferred (scoring still warns).
 * Nothing owned is silently erased from the reel.
 */
export function partitionMixVisibility<T extends { id?: string | null }>(
  candidates: T[],
  preferred: T[],
): { preferred: T[]; softVisible: T[] } {
  const prefIds = new Set(preferred.map((i) => String(i.id)));
  const softVisible = candidates.filter((i) => i.id && !prefIds.has(String(i.id)));
  return { preferred, softVisible };
}

/**
 * Layout pad required under reels when Save is shown.
 */
export function outfitMixReelBottomPad(showSave: boolean): number {
  return showSave ? OUTFIT_MIX_LAYOUT.contentPadForSave : 0;
}

/**
 * Pure overlap check used by verify + optional runtime asserts.
 */
export function assertSaveDoesNotCoverShoes(layout: {
  saveButton: { top: number; bottom: number };
  row_shoes: { top: number; bottom: number };
}): void {
  if (overlaps(layout.saveButton, layout.row_shoes)) {
    throw new Error(
      `UI_FAIL: save button overlaps shoes row (save.bottom=${layout.saveButton.bottom}, shoes.top=${layout.row_shoes.top})`,
    );
  }
}

export default {
  OutfitMixContract,
  OUTFIT_MIX_LAYOUT,
  OUTFIT_MIX_COVERAGE,
  evaluateOutfitMixUiReality,
  ensureMinimumCoverage,
  partitionMixVisibility,
  outfitMixReelBottomPad,
  assertSaveDoesNotCoverShoes,
};
