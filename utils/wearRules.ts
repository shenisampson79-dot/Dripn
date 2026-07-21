/**
 * Wear / laundry constraint helpers for wardrobe reuse.
 * No fixed "wait 5 days" — driven by category rules + user laundry habit + item state.
 */

export type LaundryHabit = 'after_each_wear' | 'few_wears' | 'weekly' | 'flexible';

export type LaundryProfile = {
  habit: LaundryHabit;
};

export type WearRule = {
  wearsBeforeWash: number;
  daysBetweenWears: number;
};

export type WearTrackableItem = {
  id?: string | number;
  category?: string;
  subcategory?: string;
  name?: string;
  lastWorn?: string | Date | null;
  wearCountSinceWash?: number;
  isDirty?: boolean;
  timesWorn?: number;
  wearCount?: number;
};

export const DEFAULT_LAUNDRY_PROFILE: LaundryProfile = { habit: 'flexible' };

export const WEAR_RULES: Record<string, WearRule> = {
  tops: { wearsBeforeWash: 2, daysBetweenWears: 1 },
  activewear_tops: { wearsBeforeWash: 1, daysBetweenWears: 1 },
  bottoms: { wearsBeforeWash: 3, daysBetweenWears: 2 },
  activewear_bottoms: { wearsBeforeWash: 1, daysBetweenWears: 1 },
  dresses: { wearsBeforeWash: 2, daysBetweenWears: 2 },
  outerwear: { wearsBeforeWash: 5, daysBetweenWears: 3 },
  formal: { wearsBeforeWash: 3, daysBetweenWears: 2 },
  shoes: { wearsBeforeWash: 10, daysBetweenWears: 1 },
  bags: { wearsBeforeWash: 999, daysBetweenWears: 0 },
  accessories: { wearsBeforeWash: 999, daysBetweenWears: 0 },
  swimwear: { wearsBeforeWash: 1, daysBetweenWears: 7 },
  sleepwear: { wearsBeforeWash: 3, daysBetweenWears: 1 },
};

const DEFAULT_RULE: WearRule = { wearsBeforeWash: 2, daysBetweenWears: 1 };

const LAUNDRY_MODIFIERS: Record<LaundryHabit, { wearMult: number; dayMult: number; minWears: number }> = {
  after_each_wear: { wearMult: 0.5, dayMult: 1, minWears: 1 },
  few_wears: { wearMult: 1, dayMult: 1, minWears: 1 },
  weekly: { wearMult: 1.5, dayMult: 1.5, minWears: 2 },
  flexible: { wearMult: 1.25, dayMult: 0.85, minWears: 1 },
};

export function normalizeLaundryHabit(value: unknown): LaundryHabit {
  const key = String(value || '').toLowerCase().replace(/[-\s]+/g, '_');
  if (key === 'after_each_wear' || key === 'after_each') return 'after_each_wear';
  if (key === 'few_wears' || key === 'few') return 'few_wears';
  if (key === 'weekly' || key === 'week') return 'weekly';
  if (key === 'flexible' || key === 'flex') return 'flexible';
  return DEFAULT_LAUNDRY_PROFILE.habit;
}

export function laundryProfileFromUser(user?: {
  extendedPreferences?: { laundryHabit?: string };
  profileData?: Record<string, unknown>;
} | null): LaundryProfile {
  const habit =
    user?.extendedPreferences?.laundryHabit
    ?? (user?.profileData?.laundryHabit as string | undefined)
    ?? DEFAULT_LAUNDRY_PROFILE.habit;
  return { habit: normalizeLaundryHabit(habit) };
}

export function getWearRuleKey(item: WearTrackableItem): string {
  const cat = String(item.category || '').toLowerCase();
  if (WEAR_RULES[cat]) return cat;
  if (cat.includes('activewear') && cat.includes('bottom')) return 'activewear_bottoms';
  if (cat.includes('activewear')) return 'activewear_tops';
  if (cat.includes('dress')) return 'dresses';
  if (cat.includes('shoe') || cat.includes('footwear')) return 'shoes';
  if (cat.includes('outer')) return 'outerwear';
  if (cat.includes('bottom') || cat.includes('pant') || cat.includes('jean')) return 'bottoms';
  if (cat.includes('top') || cat.includes('shirt') || cat.includes('blouse')) return 'tops';
  return 'tops';
}

export function getWearRule(item: WearTrackableItem): WearRule {
  return WEAR_RULES[getWearRuleKey(item)] || DEFAULT_RULE;
}

export function getEffectiveWearRule(item: WearTrackableItem, profile: LaundryProfile): WearRule {
  const base = getWearRule(item);
  const mod = LAUNDRY_MODIFIERS[profile.habit] || LAUNDRY_MODIFIERS.flexible;
  const wearsBeforeWash = Math.max(
    mod.minWears,
    profile.habit === 'after_each_wear' ? 1 : Math.round(base.wearsBeforeWash * mod.wearMult),
  );
  const daysBetweenWears = Math.max(
    0,
    profile.habit === 'after_each_wear'
      ? 1
      : Math.round(base.daysBetweenWears * mod.dayMult),
  );
  return { wearsBeforeWash, daysBetweenWears };
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function calendarDaysBetween(from: Date | string, to: Date): number {
  const start = startOfDay(typeof from === 'string' ? new Date(from) : from);
  const end = startOfDay(to);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function normalizeWearState(item: WearTrackableItem): {
  wearCountSinceWash: number;
  isDirty: boolean;
} {
  const wearCountSinceWash = Math.max(
    0,
    item.wearCountSinceWash
    ?? item.timesWorn
    ?? item.wearCount
    ?? 0,
  );
  return {
    wearCountSinceWash,
    isDirty: Boolean(item.isDirty),
  };
}

/** Hard filter — dirty items never pass (relax tiers do not override). */
export function canWearItem(
  item: WearTrackableItem,
  today: Date,
  laundryProfile: LaundryProfile = DEFAULT_LAUNDRY_PROFILE,
  options?: { relaxLevel?: 0 | 1 | 2 },
): boolean {
  const { isDirty, wearCountSinceWash } = normalizeWearState(item);
  if (isDirty) return false;

  const relax = options?.relaxLevel ?? 0;
  const rule = getEffectiveWearRule(item, laundryProfile);
  const maxWears = rule.wearsBeforeWash + (relax >= 1 ? 1 : 0) + (relax >= 2 ? 1 : 0);
  if (wearCountSinceWash >= maxWears) return false;

  if (item.lastWorn) {
    const gap = calendarDaysBetween(item.lastWorn, today);
    const minGap = Math.max(0, rule.daysBetweenWears - relax);
    if (gap < minGap) return false;
  }

  return true;
}

/** 0 = empty pool, 1 = severe shortage */
export function computeWardrobePressure(available: number, needed: number): number {
  if (needed <= 0) return 0;
  if (available >= needed) return 0;
  return Math.min(1, 1 - available / needed);
}

export function resolveCanWearRelaxLevel(pressure: number): 0 | 1 | 2 {
  if (pressure >= 0.55) return 2;
  if (pressure >= 0.3) return 1;
  return 0;
}

/** Soft reuse freshness 0–1 (higher = fresher). Used as ~15% of combo score. */
export function itemReuseFreshness(
  item: WearTrackableItem,
  today: Date,
  laundryProfile: LaundryProfile,
): number {
  const { isDirty, wearCountSinceWash } = normalizeWearState(item);
  if (isDirty) return 0;

  const rule = getEffectiveWearRule(item, laundryProfile);
  const wearRatio = rule.wearsBeforeWash > 0
    ? Math.min(1, wearCountSinceWash / rule.wearsBeforeWash)
    : 0;

  let dayRatio = 0;
  if (item.lastWorn && rule.daysBetweenWears > 0) {
    const gap = calendarDaysBetween(item.lastWorn, today);
    dayRatio = Math.max(0, 1 - gap / rule.daysBetweenWears);
  }

  return Math.max(0, 1 - wearRatio * 0.65 - dayRatio * 0.35);
}

/** ~15% scoring component — negative penalty when items are over-worn / too soon. */
export function reuseScoreComponent(
  items: WearTrackableItem[],
  today: Date,
  laundryProfile: LaundryProfile,
  wardrobePressure = 0,
): number {
  if (!items.length) return 0;
  const avgFreshness =
    items.reduce((sum, item) => sum + itemReuseFreshness(item, today, laundryProfile), 0)
    / items.length;
  const pressureBoost = wardrobePressure * 8;
  const scale = 30 * 0.15;
  return avgFreshness * scale + pressureBoost;
}

export function applyWearIncrement(
  item: WearTrackableItem,
  laundryProfile: LaundryProfile,
  wornAt: Date = new Date(),
): { timesWorn: number; wearCountSinceWash: number; isDirty: boolean; lastWorn: string } {
  const rule = getEffectiveWearRule(item, laundryProfile);
  const state = normalizeWearState(item);
  const wearCountSinceWash = state.wearCountSinceWash + 1;
  const timesWorn = (item.timesWorn ?? item.wearCount ?? 0) + 1;
  const isDirty = wearCountSinceWash >= rule.wearsBeforeWash;
  return {
    timesWorn,
    wearCountSinceWash,
    isDirty,
    lastWorn: wornAt.toISOString(),
  };
}

export const LAUNDRY_HABIT_OPTIONS: Array<{ id: LaundryHabit; labelKey: string }> = [
  { id: 'after_each_wear', labelKey: 'settings.laundry.afterEachWear' },
  { id: 'few_wears', labelKey: 'settings.laundry.fewWears' },
  { id: 'weekly', labelKey: 'settings.laundry.weekly' },
  { id: 'flexible', labelKey: 'settings.laundry.flexible' },
];
