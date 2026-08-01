/**
 * Outfit feedback → stylist brain bridge.
 *
 * Hard rules still live in clash / dress-code / allocator.
 * This module only feeds SOFT personalisation (liked / skipped / wore / saved)
 * into scorePreference01 and the server engage API.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WardrobeItem } from '@/contexts/WardrobeContext';

const STORAGE_KEY = '@dripn_outfit_feedback_brain_v1';
const MAX_EVENTS = 100;

export type OutfitFeedbackSignal = 'liked' | 'skipped' | 'wore' | 'saved';

export type OutfitFeedbackSource =
  | 'todays_outfit'
  | 'get_outfits_now'
  | 'stylist_decision'
  | 'stylist_chat'
  | 'guest_chat'
  | 'style_shuffle'
  | 'other';

export type OutfitFeedbackItem = {
  id?: string;
  name?: string;
  category?: string;
  color?: string;
};

type FeedbackEvent = {
  itemIds: string[];
  signal: OutfitFeedbackSignal;
  source: OutfitFeedbackSource;
  occasion?: string;
  at: number;
};

type BrainState = {
  events: FeedbackEvent[];
  liked: Record<string, number>;
  skipped: Record<string, number>;
};

const emptyState = (): BrainState => ({ events: [], liked: {}, skipped: {} });

let state: BrainState = emptyState();
let hydratePromise: Promise<void> | null = null;

function bump(map: Record<string, number>, id: string, delta: number) {
  if (!id) return;
  map[id] = Math.max(0, (map[id] || 0) + delta);
}

function rebuildIndexes(events: FeedbackEvent[]): BrainState {
  const next = emptyState();
  next.events = events.slice(-MAX_EVENTS);
  for (const ev of next.events) {
    const positive = ev.signal === 'liked' || ev.signal === 'wore' || ev.signal === 'saved';
    for (const id of ev.itemIds) {
      if (positive) bump(next.liked, id, ev.signal === 'wore' ? 2 : 1);
      else bump(next.skipped, id, 1);
    }
  }
  return next;
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ events: state.events }));
  } catch {
    /* ignore */
  }
}

export async function hydrateOutfitFeedbackBrain(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { events?: FeedbackEvent[] };
      if (Array.isArray(parsed?.events)) {
        state = rebuildIndexes(parsed.events);
      }
    } catch {
      state = emptyState();
    }
  })();
  return hydratePromise;
}

/** Soft affinity for an item: −1 (often skipped) … +1 (often liked/worn). */
export function itemFeedbackAffinity(itemId: string): number {
  const id = String(itemId || '');
  if (!id) return 0;
  const like = state.liked[id] || 0;
  const skip = state.skipped[id] || 0;
  if (!like && !skip) return 0;
  const total = like + skip;
  return Math.max(-1, Math.min(1, (like - skip) / Math.max(1, total)));
}

/**
 * Soft preference component for scoring (0–1).
 * Never a hard gate — allocator clash rules still win.
 */
export function feedbackPreference01(items: WardrobeItem[]): number {
  if (!items?.length) return 0.5;
  let sum = 0;
  for (const item of items) {
    const a = itemFeedbackAffinity(String(item.id));
    sum += 0.55 + a * 0.35;
  }
  return Math.max(0, Math.min(1, sum / items.length));
}

export type RecordFeedbackParams = {
  items: Array<string | OutfitFeedbackItem>;
  signal: OutfitFeedbackSignal;
  source: OutfitFeedbackSource;
  occasion?: string;
  outfitScore?: number;
  scoreBreakdown?: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  localOnly?: boolean;
};

function normalizeItemIds(items: RecordFeedbackParams['items']): string[] {
  return items
    .map((item) => (typeof item === 'string' ? item : String(item?.id || '')))
    .filter(Boolean);
}

/**
 * Single choke point: local brain + server taste pipe.
 * Soft learning only — does not change hard outfit validity.
 */
export async function recordStylistOutfitFeedback(
  params: RecordFeedbackParams,
): Promise<void> {
  await hydrateOutfitFeedbackBrain();

  const itemIds = normalizeItemIds(params.items);
  if (!itemIds.length) return;

  const ev: FeedbackEvent = {
    itemIds,
    signal: params.signal,
    source: params.source,
    occasion: params.occasion,
    at: Date.now(),
  };
  state = rebuildIndexes([...state.events, ev]);
  void persist();

  if (params.localOnly) return;

  try {
    const { apiService } = await import('@/services/ApiService');
    await apiService.recordOutfitEngagement({
      items: params.items.map((item) =>
        typeof item === 'string'
          ? item
          : {
              id: item.id,
              name: item.name || 'item',
              category: item.category,
              color: item.color,
            },
      ),
      signal: params.signal,
      outfitScore: params.outfitScore,
      scoreBreakdown: params.scoreBreakdown,
      occasion: params.occasion,
      contextSnapshot: {
        ...(params.contextSnapshot || {}),
        source: params.source,
        feedbackBrain: true,
      },
    });
  } catch {
    /* local brain retained */
  }
}

export function feedbackBrainInsights(): {
  eventCount: number;
  likedItems: number;
  skippedItems: number;
} {
  return {
    eventCount: state.events.length,
    likedItems: Object.keys(state.liked).length,
    skippedItems: Object.keys(state.skipped).length,
  };
}
