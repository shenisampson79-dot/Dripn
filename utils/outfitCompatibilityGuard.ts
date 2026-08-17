/**
 * Client mirror of Dripn-Server/services/outfitCompatibilityGuard.js
 * Keep the five-trait contract in sync. Run: npx tsx utils/outfitCompatibilityGuard.test.ts
 */
import {
  classifyItem,
  detectAllOutfitClashes,
} from '@/utils/outfitClashRules';
import {
  hasCoreOutfitRoles,
  isAccessoryItem,
  isBottomItem,
  isDressItem,
  isMidLayerItem,
  isOuterwearItem,
  isShoesItem,
  isSwimOrBeachItem,
  isTopItem,
} from '@/utils/completeOutfit';
import type { WardrobeItem } from '@/contexts/WardrobeContext';

export const COMPAT_CODES = {
  MISSING_ROLES: 'MISSING_ROLES',
  ROLE_LAYER: 'ROLE_LAYER',
  THERMAL_MISMATCH: 'THERMAL_MISMATCH',
  FORMALITY_MISMATCH: 'FORMALITY_MISMATCH',
  ATHLETIC_TAILORED_CLASH: 'ATHLETIC_TAILORED_CLASH',
  CONTEXT_MISMATCH: 'CONTEXT_MISMATCH',
  STRUCTURAL_CLASH: 'STRUCTURAL_CLASH',
} as const;

export type CompatibilityCode = typeof COMPAT_CODES[keyof typeof COMPAT_CODES];

export type CompatibilityIssue = {
  code: CompatibilityCode | string;
  items: string[];
  detail?: string;
  clashId?: string;
};

export type GuardContext = {
  occasion?: string;
  season?: string;
  userIntent?: string;
  workDressCode?: string;
  requireCoreRoles?: boolean;
  mode?: 'generate' | 'diagnose';
  source?: 'qsc' | 'chat' | 'gon' | 'mix' | 'live';
};

export type RejectedOutfit = {
  passed: false;
  reasons: CompatibilityIssue[];
  conflictingItemIds: string[];
  missingRoles: string[];
};

export type AcceptedGuard = {
  passed: true;
  lane: string;
  reasons: [];
  garments?: GarmentTraits[];
};

export type GuardResult = RejectedOutfit | AcceptedGuard;

export type GarmentTraits = {
  id: string;
  name: string;
  category: string | null;
  role: string[];
  styleLane: string[];
  thermalWeight: number;
  formality: number;
  useContext: string[];
  signals?: ReturnType<typeof classifyItem>;
  item?: WardrobeItem | Record<string, unknown>;
};

const CLASH_CODE_MAP: Record<string, string> = {
  insulated_athletic_top_season: COMPAT_CODES.THERMAL_MISMATCH,
  fleece_shorts_season: COMPAT_CODES.THERMAL_MISMATCH,
  blazer_athletic_top: COMPAT_CODES.ATHLETIC_TAILORED_CLASH,
  athletic_shorts_blazer: COMPAT_CODES.ATHLETIC_TAILORED_CLASH,
  joggers_blazer: COMPAT_CODES.ATHLETIC_TAILORED_CLASH,
  trainers_suit: COMPAT_CODES.ATHLETIC_TAILORED_CLASH,
  work_trainers_ban: COMPAT_CODES.ATHLETIC_TAILORED_CLASH,
  performance_trainer_tailored: COMPAT_CODES.ATHLETIC_TAILORED_CLASH,
  swimwear_formal: COMPAT_CODES.CONTEXT_MISMATCH,
  sleepwear_formal: COMPAT_CODES.CONTEXT_MISMATCH,
};

function itemText(item: Record<string, unknown> | WardrobeItem | null | undefined): string {
  return `${(item as WardrobeItem)?.name || ''} ${(item as WardrobeItem)?.category || ''} ${(item as { subcategory?: string })?.subcategory || ''}`.toLowerCase();
}

function itemId(item: Record<string, unknown> | WardrobeItem | null | undefined): string {
  const rec = item as { id?: unknown; wardrobeItemId?: unknown };
  if (rec?.id != null) return String(rec.id);
  if (rec?.wardrobeItemId != null) return String(rec.wardrobeItemId);
  return itemText(item).slice(0, 48) || 'item';
}

function newOutfitId(): string {
  return `look_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function inferGarmentRole(item: WardrobeItem, signals: ReturnType<typeof classifyItem>): string[] {
  if (isDressItem(item) || signals?.isDress) return ['one_piece'];
  if (isShoesItem(item)) return ['footwear'];
  if (isMidLayerItem(item)) return ['mid_layer'];
  if (signals?.isBlazer || (isOuterwearItem(item) && !isMidLayerItem(item))) return ['outerwear'];
  if (isBottomItem(item) && !isDressItem(item)) return ['bottom'];
  if (isTopItem(item)) return ['base_top'];
  if (isAccessoryItem(item) || signals?.isTie) return ['accessory'];
  return ['base_top'];
}

export function inferStyleLane(item: WardrobeItem, signals: ReturnType<typeof classifyItem>): string[] {
  const t = itemText(item);
  const lanes = new Set<string>();
  const athleticExclusive = (signals?.isAthleticTop && /singlet|tank|sleeveless|jersey|running|gym|performance|compression/.test(t))
    || (signals?.isAthleticBottom && !/chino|tailored/.test(t));
  if (athleticExclusive || (signals?.isAthleticShoes && !signals?.isFashionTrainer && /running|gym|asics|hoka/.test(t))) {
    lanes.add('athletic');
  }
  if (signals?.isBlazer) {
    lanes.add('smart-casual');
    lanes.add('tailored');
  } else if (signals?.isSuitPiece || signals?.isEveningWear || signals?.isGown || signals?.isTie) {
    lanes.add('tailored');
  }
  if (signals?.isDressShirt && !signals?.isAthleticTop) {
    lanes.add('smart-casual');
    lanes.add('tailored');
  }
  if (signals?.isFashionTrainer) {
    lanes.add('casual');
    lanes.add('smart-casual');
  }
  if (signals?.isHoodie || signals?.isJoggers || signals?.isLoungeBottom) {
    lanes.add('casual');
  }
  const tier = Number(signals?.formalityTier) || 3;
  if (tier <= 2 && !lanes.has('athletic') && !lanes.has('tailored')) {
    lanes.add('casual');
    if (!signals?.isHoodie && !signals?.isJoggers && !signals?.isSlides) lanes.add('smart-casual');
  }
  if (tier === 3) {
    lanes.add('casual');
    lanes.add('smart-casual');
  }
  if (tier === 4 && !lanes.size) {
    lanes.add('smart-casual');
    lanes.add('tailored');
  }
  if (tier >= 5) lanes.add('tailored');
  if (isMidLayerItem(item) && (signals?.isAthleticTop || /athletic|quarter[\s_-]?zip|pullover/.test(t))) {
    lanes.add('athletic');
    lanes.add('casual');
  }
  if (!lanes.size) lanes.add('casual');
  return [...lanes];
}

export function inferThermalWeight(item: WardrobeItem, signals: ReturnType<typeof classifyItem>): number {
  const t = itemText(item);
  if (signals?.isFleeceOrInsulated || /winter coat|parka|puffer|insulated|down jacket/.test(t)) return 5;
  if (signals?.isSwimwear || (/linen|seersucker|chambray/.test(t) && (signals?.isShorts || signals?.isShortSleeve))) return 1;
  if (signals?.isAthleticTop && /singlet|tank|sleeveless/.test(t)) return 1;
  if (signals?.isShorts) return 2;
  if (signals?.isHoodie || /sweater|knit|pullover|cardigan/.test(t)) return 3;
  if (signals?.isBlazer || /coat\b/.test(t)) return 3;
  return 2;
}

export function inferUseContext(item: WardrobeItem, signals: ReturnType<typeof classifyItem>): string[] {
  const t = itemText(item);
  const ctx = new Set<string>();
  if (isSwimOrBeachItem(item) || signals?.isSwimwear) ctx.add('beach');
  const performanceTop = Boolean(signals?.isAthleticTop && /singlet|tank|sleeveless|jersey|compression/.test(t));
  if (signals?.isAthleticTop || signals?.isAthleticBottom || /running|gym|training|athletic/.test(t)) {
    ctx.add('sport');
    if (!performanceTop) ctx.add('everyday');
  }
  if (signals?.isBlazer || signals?.isSuitPiece || signals?.isDressShirt || signals?.isTie) ctx.add('work');
  if (signals?.isEveningWear || signals?.isGown) ctx.add('evening');
  if (signals?.isSlides && !ctx.has('sport')) ctx.add('beach');
  if (!ctx.size) ctx.add('everyday');
  const tier = Number(signals?.formalityTier) || 3;
  if (tier >= 3 && tier <= 4) {
    ctx.add('everyday');
    if (!ctx.has('sport') && !ctx.has('beach')) ctx.add('work');
  }
  return [...ctx];
}

export function normalizeGarmentTraits(item: WardrobeItem | Record<string, unknown>): GarmentTraits {
  const signals = classifyItem(item as WardrobeItem);
  return {
    id: itemId(item),
    name: String((item as WardrobeItem).name || ''),
    category: (item as WardrobeItem).category || null,
    role: inferGarmentRole(item as WardrobeItem, signals),
    styleLane: inferStyleLane(item as WardrobeItem, signals),
    thermalWeight: inferThermalWeight(item as WardrobeItem, signals),
    formality: Number(signals.formalityTier) || 3,
    useContext: inferUseContext(item as WardrobeItem, signals),
    signals,
    item,
  };
}

function issue(code: string, items: Array<WardrobeItem | Record<string, unknown>>, detail?: string): CompatibilityIssue {
  return { code, items: (items || []).map(itemId), detail };
}

function rangesOverlap(a: string[], b: string[]): boolean {
  if (!a?.length || !b?.length) return true;
  return a.some((v) => b.includes(v));
}

function missingRolesFor(garments: GarmentTraits[], items: WardrobeItem[]): string[] {
  if (hasCoreOutfitRoles(items)) return [];
  const roles = new Set(garments.flatMap((g) => g.role));
  const missing: string[] = [];
  if (roles.has('one_piece')) {
    if (!roles.has('footwear')) missing.push('footwear');
    return missing;
  }
  const swim = items.some(isSwimOrBeachItem);
  if (swim) return missing;
  if (!roles.has('base_top')) missing.push('base_top');
  if (!roles.has('bottom')) missing.push('bottom');
  if (!roles.has('footwear')) missing.push('footwear');
  return missing;
}

export function evaluateTraitContradictions(items: WardrobeItem[] = []): CompatibilityIssue[] {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const garments = list.map(normalizeGarmentTraits);
  const reasons: CompatibilityIssue[] = [];
  const core = garments.filter((g) => !g.role.includes('accessory'));

  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) {
      const a = core[i];
      const b = core[j];
      const dressAndShoes = (a.role.includes('one_piece') && b.role.includes('footwear'))
        || (b.role.includes('one_piece') && a.role.includes('footwear'));
      if (dressAndShoes) continue;
      if (!rangesOverlap(a.styleLane, b.styleLane)) {
        const athleticTailored = (a.styleLane.includes('athletic') && b.styleLane.includes('tailored'))
          || (b.styleLane.includes('athletic') && a.styleLane.includes('tailored'));
        reasons.push(issue(
          athleticTailored ? COMPAT_CODES.ATHLETIC_TAILORED_CLASH : COMPAT_CODES.FORMALITY_MISMATCH,
          [a.item as WardrobeItem, b.item as WardrobeItem],
          `${a.styleLane.join('|')} vs ${b.styleLane.join('|')}`,
        ));
      }
      if (!rangesOverlap(a.useContext, b.useContext)) {
        const sportPolished = (a.useContext.includes('sport') && (b.useContext.includes('work') || b.useContext.includes('evening')))
          || (b.useContext.includes('sport') && (a.useContext.includes('work') || a.useContext.includes('evening')));
        const beachPolished = (a.useContext.includes('beach') && (b.useContext.includes('work') || b.useContext.includes('evening')))
          || (b.useContext.includes('beach') && (a.useContext.includes('work') || a.useContext.includes('evening')));
        if (sportPolished || beachPolished) {
          reasons.push(issue(
            COMPAT_CODES.CONTEXT_MISMATCH,
            [a.item as WardrobeItem, b.item as WardrobeItem],
            `${a.useContext.join('|')} vs ${b.useContext.join('|')}`,
          ));
        }
      }
    }
  }

  const thermals = garments.map((g) => g.thermalWeight);
  const tMin = Math.min(...thermals);
  const tMax = Math.max(...thermals);
  if (thermals.length >= 2 && tMin <= 1 && tMax >= 4) {
    const hot = garments.filter((g) => g.thermalWeight <= 1);
    const cold = garments.filter((g) => g.thermalWeight >= 4);
    reasons.push(issue(
      COMPAT_CODES.THERMAL_MISMATCH,
      [...hot, ...cold].map((g) => g.item as WardrobeItem),
      `thermal ${tMin} vs ${tMax}`,
    ));
  }

  const formals = garments.map((g) => g.formality);
  const fMin = Math.min(...formals);
  const fMax = Math.max(...formals);
  if (formals.length >= 2 && fMax - fMin >= 3) {
    const low = garments.filter((g) => g.formality === fMin);
    const high = garments.filter((g) => g.formality === fMax);
    const laneGap = low.some((l) => high.some((h) => !rangesOverlap(l.styleLane, h.styleLane)));
    if (laneGap) {
      reasons.push(issue(
        COMPAT_CODES.FORMALITY_MISMATCH,
        [...low, ...high].map((g) => g.item as WardrobeItem),
        `formality ${fMin} vs ${fMax}`,
      ));
    }
  }

  const hoodie = garments.find((g) => g.signals?.isHoodie);
  const tie = garments.find((g) => g.signals?.isTie);
  if (hoodie && tie) {
    reasons.push(issue(COMPAT_CODES.FORMALITY_MISMATCH, [hoodie.item as WardrobeItem, tie.item as WardrobeItem], 'hoodie + tie'));
  }

  return dedupeReasons(reasons);
}

function dedupeReasons(reasons: CompatibilityIssue[]): CompatibilityIssue[] {
  const seen = new Set<string>();
  const out: CompatibilityIssue[] = [];
  for (const r of reasons) {
    const key = `${r.code}:${(r.items || []).slice().sort().join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function outfitCompatibilityGuard(
  items: WardrobeItem[] = [],
  context: GuardContext = {},
): GuardResult {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const garments = list.map(normalizeGarmentTraits);
  const diagnose = context.mode === 'diagnose';
  const requireCore = !diagnose && (context.requireCoreRoles === true
    || (context.mode === 'generate' && context.requireCoreRoles !== false));

  const missingRoles = requireCore ? missingRolesFor(garments, list) : [];
  const traitReasons = evaluateTraitContradictions(list);
  const clashes = detectAllOutfitClashes(list, {
    occasion: context.occasion || (diagnose ? 'unspecified' : undefined),
    workDressCode: context.workDressCode as never,
  }).filter((c) => c.severity === 'fatal' || c.severity === 'major');

  const reasons = [
    ...(missingRoles.length ? [issue(COMPAT_CODES.MISSING_ROLES, list, missingRoles.join(','))] : []),
    ...traitReasons,
    ...clashes.map((c) => ({
      code: CLASH_CODE_MAP[c.id] || COMPAT_CODES.STRUCTURAL_CLASH,
      items: list.map(itemId),
      detail: c.id,
      clashId: c.id,
    })),
  ];
  const unique = dedupeReasons(reasons);

  if (unique.length) {
    return {
      passed: false,
      reasons: unique,
      conflictingItemIds: [...new Set(unique.flatMap((r) => r.items || []))],
      missingRoles,
    };
  }

  const lanes = [...new Set(garments.flatMap((g) => g.styleLane))];
  return {
    passed: true,
    lane: lanes.includes('tailored') && lanes.includes('casual') ? 'smart-casual' : (lanes[0] || 'casual'),
    reasons: [],
    garments,
  };
}

export function freezeCanonicalOutfit(
  items: WardrobeItem[],
  opts: { source?: GuardContext['source']; context?: GuardContext; guard?: GuardResult | null } = {},
) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const accepted = opts.guard?.passed
    ? opts.guard
    : outfitCompatibilityGuard(list, { ...opts.context, requireCoreRoles: true, mode: 'generate' });
  if (!accepted.passed) return null;
  const garments = accepted.garments || list.map(normalizeGarmentTraits);
  const byRole: Record<string, { id: string; displayName: string }> = {};
  for (const g of garments) {
    const role = g.role[0];
    const key = role === 'base_top' ? 'top'
      : role === 'one_piece' ? 'onePiece'
        : role === 'mid_layer' ? 'midLayer'
          : role;
    if (!byRole[key]) byRole[key] = { id: g.id, displayName: g.name };
  }
  return {
    outfitId: newOutfitId(),
    source: opts.source || 'chat',
    items: byRole,
    context: {
      occasion: opts.context?.occasion,
      season: opts.context?.season,
      userIntent: opts.context?.userIntent,
    },
    compatibility: { passed: true as const, lane: accepted.lane, reasons: [] as string[] },
  };
}

export function canonicalItemIds(canonical: { items?: Record<string, { id?: string } | undefined> } | null | undefined): string[] {
  if (!canonical?.items) return [];
  return Object.values(canonical.items)
    .filter(Boolean)
    .map((g) => String(g?.id || ''))
    .filter(Boolean);
}

export function assertStripMatchesCanonical(stripIds: string[], canonical: { items?: Record<string, { id?: string } | undefined> }): boolean {
  const a = [...(stripIds || [])].map(String).filter(Boolean).sort().join('|');
  const b = canonicalItemIds(canonical).sort().join('|');
  return a === b;
}

export function presentCanonicalOutfit(items: WardrobeItem[], context: GuardContext = {}) {
  const guard = outfitCompatibilityGuard(items, { requireCoreRoles: true, mode: 'generate', ...context });
  if (!guard.passed) return null;
  return freezeCanonicalOutfit(items, { source: context.source || 'chat', context, guard });
}
