/**
 * Pure open-intent model for Today's Outfit notification → modal.
 * Intent wins over async load; expires so stale cold-starts don't reopen hours later.
 */

export const TODAYS_OUTFIT_NOTIF_TYPE = 'todays_outfit';

/** How long a tap/delivery may force-open after arming (survives slow loads, not stale returns). */
export const OPEN_PENDING_TTL_MS = 5 * 60 * 1000;

/** Ignore duplicate arms within this window (double-tap / receive+response). */
export const OPEN_PENDING_DEDUP_MS = 2_000;

/**
 * Higher number wins when two different notification types compete.
 * Last-write-wins within the same type.
 */
export const NOTIFICATION_OPEN_PRIORITY: Record<string, number> = {
  todays_outfit: 100,
  style_of_the_day: 40,
  event_reminder: 30,
  trend_alert: 20,
  personalized_offer: 10,
};

export type OpenPendingIntent = {
  type: string;
  armedAt: number;
  source: 'tap' | 'delivery' | 'cold_start' | 'manual';
};

export function priorityForType(type: string): number {
  return NOTIFICATION_OPEN_PRIORITY[type] ?? 0;
}

export function parseOpenPending(raw: string | null | undefined): OpenPendingIntent | null {
  if (raw == null || raw === '') return null;
  // Legacy flag from earlier fix
  if (raw === '1') {
    return {
      type: TODAYS_OUTFIT_NOTIF_TYPE,
      armedAt: Date.now(),
      source: 'manual',
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<OpenPendingIntent>;
    if (!parsed || typeof parsed.type !== 'string' || typeof parsed.armedAt !== 'number') {
      return null;
    }
    return {
      type: parsed.type,
      armedAt: parsed.armedAt,
      source: (parsed.source as OpenPendingIntent['source']) || 'manual',
    };
  } catch {
    return null;
  }
}

export function serializeOpenPending(intent: OpenPendingIntent): string {
  return JSON.stringify(intent);
}

export function isOpenPendingExpired(
  intent: OpenPendingIntent | null,
  now: number = Date.now(),
  ttlMs: number = OPEN_PENDING_TTL_MS,
): boolean {
  if (!intent) return true;
  return now - intent.armedAt > ttlMs;
}

/**
 * Last-write-wins for same type; otherwise higher priority wins.
 * Equal priority → newer armedAt wins.
 */
export function resolveOpenPendingConflict(
  existing: OpenPendingIntent | null,
  incoming: OpenPendingIntent,
  now: number = Date.now(),
): OpenPendingIntent {
  if (!existing || isOpenPendingExpired(existing, now)) return incoming;

  if (existing.type === incoming.type) {
    // Dedup rapid double-arm: keep existing if within dedup window
    if (incoming.armedAt - existing.armedAt < OPEN_PENDING_DEDUP_MS) {
      return existing;
    }
    return incoming.armedAt >= existing.armedAt ? incoming : existing;
  }

  const pe = priorityForType(existing.type);
  const pi = priorityForType(incoming.type);
  if (pi > pe) return incoming;
  if (pi < pe) return existing;
  return incoming.armedAt >= existing.armedAt ? incoming : existing;
}

/**
 * Should the modal force-open from pending intent?
 * Intent always beats appearance-window / dismiss auto rules.
 */
export function shouldForceOpenFromIntent(
  intent: OpenPendingIntent | null,
  opts: {
    now?: number;
    modalAlreadyVisible?: boolean;
    expectedType?: string;
  } = {},
): boolean {
  const now = opts.now ?? Date.now();
  if (!intent || isOpenPendingExpired(intent, now)) return false;
  if (opts.expectedType && intent.type !== opts.expectedType) return false;
  // Already open — honor intent as satisfied without re-driving load churn
  if (opts.modalAlreadyVisible) return false;
  return true;
}

/**
 * Simulate the race: load decides closed, then reconcile with intent.
 * Returns final modal visibility.
 */
export function reconcileModalVisibilityAfterLoad(opts: {
  loadWouldShow: boolean;
  intent: OpenPendingIntent | null;
  now?: number;
  modalAlreadyVisible?: boolean;
}): { visible: boolean; consumedIntent: boolean } {
  const force = shouldForceOpenFromIntent(opts.intent, {
    now: opts.now,
    modalAlreadyVisible: false, // reconciliation always re-applies intent
  });
  if (force) {
    return { visible: true, consumedIntent: true };
  }
  if (opts.modalAlreadyVisible && opts.intent && !isOpenPendingExpired(opts.intent, opts.now)) {
    // Intent armed while already showing — consume, stay open
    return { visible: true, consumedIntent: true };
  }
  return { visible: opts.loadWouldShow, consumedIntent: false };
}
