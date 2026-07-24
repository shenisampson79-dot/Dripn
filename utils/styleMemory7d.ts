/**
 * 7-day style memory — reads the same history Today's Outfit already persists,
 * and produces rotation badges / similarity signals for UX + scoring.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { localDateKey } from '@/utils/localDateKey';
import {
  coreSlotIds,
  countCoreOverlap,
  countTrioChanges,
  isTooSimilar,
} from '@/utils/outfitDiversityHard';
import { dateKeyInTimeZone, TODAYS_OUTFIT_TIMEZONE } from '@/utils/todaysOutfitTime';

const HISTORY_KEY = '@dripn_todays_outfit_history';
const PREVIOUS_KEY = '@dripn_todays_wardrobe_outfit_previous';

export type OutfitMemoryFingerprint = {
  date: string;
  items: {
    top?: string;
    bottom?: string;
    outerwear?: string;
    footwear?: string;
  };
  itemIds: string[];
  colors: string[];
};

export type RotationInsight = {
  similarYesterday: boolean;
  differsFromYesterday: boolean;
  hasPrior: boolean;
  trioChanges: number;
  sharedIds: number;
  repetitionDays: number;
  badge: 'fresh' | 'similar_yesterday' | 'limited' | 'new';
  label: string;
};

type HistoryEntry = { dateKey: string; itemIds: string[] };

async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed)
      ? parsed.filter((e) => e?.dateKey && Array.isArray(e.itemIds))
      : [];
  } catch {
    return [];
  }
}

function fingerprintFromItems(date: string, items: WardrobeItem[]): OutfitMemoryFingerprint {
  const slots = coreSlotIds(items);
  return {
    date,
    items: {
      top: slots.top || undefined,
      bottom: slots.bottom || undefined,
      outerwear: slots.outerwear || undefined,
      footwear: slots.footwear || undefined,
    },
    itemIds: items.map((i) => String(i.id)),
    colors: [...new Set(items.map((i) => String(i.color || '').toLowerCase()).filter(Boolean))],
  };
}

function resolveIds(
  ids: string[],
  wardrobe: WardrobeItem[],
): WardrobeItem[] {
  return ids
    .map((id) => wardrobe.find((w) => String(w.id) === id))
    .filter(Boolean) as WardrobeItem[];
}

/**
 * Compare today's outfit pieces to yesterday's stored recommendation.
 */
export async function analyzeRotationVsYesterday(
  todayItems: WardrobeItem[],
  wardrobeItems: WardrobeItem[] = [],
): Promise<RotationInsight> {
  const today = dateKeyInTimeZone(new Date(), TODAYS_OUTFIT_TIMEZONE);
  const history = await loadHistory();
  const yesterdayEntry =
    history.find((e) => e.dateKey < today)
    || null;

  let priorIds: string[] = yesterdayEntry?.itemIds?.map(String) || [];
  if (!priorIds.length) {
    try {
      const raw = await AsyncStorage.getItem(PREVIOUS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { itemIds?: string[]; dateKey?: string };
        if (parsed?.itemIds?.length && parsed.dateKey !== today) {
          priorIds = parsed.itemIds.map(String);
        }
      }
    } catch {
      // ignore
    }
  }

  if (!priorIds.length) {
    return {
      similarYesterday: false,
      differsFromYesterday: true,
      hasPrior: false,
      trioChanges: 3,
      sharedIds: 0,
      repetitionDays: 0,
      badge: 'new',
      label: 'New look',
    };
  }

  const todayIds = todayItems.map((i) => String(i.id));
  const todaySet = new Set(todayIds);
  const sharedIds = priorIds.filter((id) => todaySet.has(id)).length;
  const exactSame =
    sharedIds === priorIds.length && sharedIds === todayIds.length && priorIds.length > 0;

  const pool = wardrobeItems.length ? wardrobeItems : todayItems;
  const priorResolved = resolveIds(priorIds, pool);

  let similarYesterday = exactSame;
  let trioChanges = Math.max(0, Math.min(3, Math.max(priorIds.length, todayIds.length) - sharedIds));
  let differs = !exactSame;

  if (!exactSame && priorResolved.length >= 2 && todayItems.length >= 2) {
    similarYesterday = isTooSimilar(todayItems, priorResolved);
    trioChanges = countTrioChanges(todayItems, priorResolved);
    differs = !similarYesterday && trioChanges >= 2;
  } else if (!exactSame) {
    const maxLen = Math.max(priorIds.length, todayIds.length, 1);
    differs = sharedIds / maxLen < 0.67;
    similarYesterday = !differs;
  }

  let repetitionDays = 0;
  if (todayItems.length) {
    for (const past of history.slice(0, 7)) {
      if (past.dateKey >= today) continue;
      const pastItems = resolveIds(past.itemIds.map(String), pool);
      if (pastItems.length >= 2 && isTooSimilar(todayItems, pastItems)) {
        repetitionDays += 1;
      }
    }
  }

  if (!differs || similarYesterday) {
    return {
      similarYesterday: true,
      differsFromYesterday: false,
      hasPrior: true,
      trioChanges,
      sharedIds,
      repetitionDays,
      badge: pool.length < 8 ? 'limited' : 'similar_yesterday',
      label: pool.length < 8 ? 'Limited wardrobe options today' : 'Similar to yesterday',
    };
  }

  return {
    similarYesterday: false,
    differsFromYesterday: true,
    hasPrior: true,
    trioChanges,
    sharedIds,
    repetitionDays,
    badge: 'fresh',
    label: 'Different from yesterday',
  };
}

export function fingerprintToday(
  items: WardrobeItem[],
  now: Date = new Date(),
): OutfitMemoryFingerprint {
  return fingerprintFromItems(dateKeyInTimeZone(now, TODAYS_OUTFIT_TIMEZONE), items);
}

export { countCoreOverlap, fingerprintFromItems, localDateKey };
