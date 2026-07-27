/**
 * Unified Entry Router (UER) — single authoritative navigation resolution.
 *
 * ALL external entry (push / deep link / cold start) → normalize → queue →
 * wait until STABLE → resolve ONCE via navigation.reset.
 *
 * Hard rule: notification / deep-link handlers must NEVER call navigate().
 */

export type AppIntent =
  | { type: 'NONE' }
  | { type: 'OPEN_TODAYS_OUTFIT' }
  | { type: 'OPEN_STYLIST' }
  | { type: 'OPEN_CHAT'; threadId?: string }
  | { type: 'OPEN_OUTFIT'; id: string };

export type AppBootState = 'BOOTING' | 'HYDRATING' | 'STABLE';

export const INTENT_PRIORITY: Record<Exclude<AppIntent['type'], 'NONE'>, number> = {
  OPEN_TODAYS_OUTFIT: 100,
  OPEN_CHAT: 80,
  OPEN_OUTFIT: 70,
  OPEN_STYLIST: 10,
};

export function priorityOf(intent: AppIntent): number {
  if (intent.type === 'NONE') return -1;
  return INTENT_PRIORITY[intent.type] ?? 0;
}

export function enqueueIntentPure(queue: AppIntent[], intent: AppIntent): AppIntent[] {
  if (!intent || intent.type === 'NONE') return queue.slice();
  return [...queue, intent];
}

export function getHighestPriorityIntent(queue: AppIntent[]): AppIntent {
  const actionable = (queue || []).filter((i) => i && i.type !== 'NONE');
  if (actionable.length === 0) return { type: 'NONE' };
  return actionable.slice().sort((a, b) => priorityOf(b) - priorityOf(a))[0];
}

/** Notification data → intent (Today's Outfit uses type todays_outfit). */
export function parseNotificationData(data: Record<string, unknown> | null | undefined): AppIntent {
  if (!data || typeof data !== 'object') return { type: 'NONE' };
  const type = String(data.type || '').toLowerCase();
  if (type === 'todays_outfit' || type === 'todaysoutfit' || type === 'today_outfit') {
    return { type: 'OPEN_TODAYS_OUTFIT' };
  }
  if (type === 'chat_reply' || type === 'chat') {
    const threadId = data.threadId != null ? String(data.threadId) : undefined;
    return { type: 'OPEN_CHAT', threadId };
  }
  return { type: 'NONE' };
}

/** Deep link URL → intent. */
export function parseDeepLinkUrl(url: string | null | undefined): AppIntent {
  if (!url || typeof url !== 'string') return { type: 'NONE' };
  const lower = url.toLowerCase();
  if (lower.includes('today') || lower.includes('todays-outfit') || lower.includes('todays_outfit')) {
    return { type: 'OPEN_TODAYS_OUTFIT' };
  }
  if (lower.includes('chat') || lower.includes('stylist-chat')) {
    return { type: 'OPEN_CHAT' };
  }
  if (lower.includes('stylist') || lower.includes('style-tools')) {
    return { type: 'OPEN_STYLIST' };
  }
  return { type: 'NONE' };
}

/**
 * Nested reset state: MainTabs → StylistTab → StylistHub(+openToday).
 * Includes sibling tabs so reset does not drop the tab tree.
 * Used by resolveIntent — cannot be overridden by a later navigate().
 */
export function buildTodaysOutfitResetState() {
  return {
    index: 0,
    routes: [
      {
        name: 'StylistTab',
        state: {
          index: 0,
          routes: [
            {
              name: 'StylistHub',
              params: { openToday: true },
            },
          ],
        },
      },
      { name: 'WardrobeTab' },
      { name: 'ProfileTab' },
      { name: 'SettingsTab' },
    ],
  };
}

export function buildStylistHubResetState() {
  return {
    index: 0,
    routes: [
      {
        name: 'StylistTab',
        state: {
          index: 0,
          routes: [{ name: 'StylistHub' }],
        },
      },
      { name: 'WardrobeTab' },
      { name: 'ProfileTab' },
      { name: 'SettingsTab' },
    ],
  };
}

export function canResolveIntents(opts: {
  bootState: AppBootState;
  navigationReady: boolean;
}): boolean {
  return opts.bootState === 'STABLE' && opts.navigationReady === true;
}

/**
 * Pure flush: pick highest priority, clear queue, return intent to execute.
 */
export function flushIntentsPure(queue: AppIntent[]): {
  intent: AppIntent;
  remaining: AppIntent[];
} {
  const intent = getHighestPriorityIntent(queue);
  return { intent, remaining: [] };
}

export type EntryRouterSnapshot = {
  bootState: AppBootState;
  queue: AppIntent[];
  navLocked: boolean;
};

export function createEntryRouterSnapshot(
  partial?: Partial<EntryRouterSnapshot>,
): EntryRouterSnapshot {
  return {
    bootState: 'BOOTING',
    queue: [],
    navLocked: true,
    ...partial,
  };
}

export function markStablePure(state: EntryRouterSnapshot): EntryRouterSnapshot {
  return { ...state, bootState: 'STABLE' };
}

/**
 * Simulate cold-start race: intent queued, then default redirect would fire.
 * After stable flush, winner must still be OPEN_TODAYS_OUTFIT.
 */
export function assertNotificationBeatsDefaultRedirect(): void {
  let queue: AppIntent[] = [];
  queue = enqueueIntentPure(queue, { type: 'OPEN_STYLIST' }); // default-ish
  queue = enqueueIntentPure(queue, { type: 'OPEN_TODAYS_OUTFIT' }); // tap
  const { intent } = flushIntentsPure(queue);
  if (intent.type !== 'OPEN_TODAYS_OUTFIT') {
    throw new Error(`ENTRY_ROUTER: expected OPEN_TODAYS_OUTFIT, got ${intent.type}`);
  }
}
