/**
 * Style session date backbone for Stylist Chat actions.
 * Generation intent and Wear/Try/Save must share the same targetDate.
 */

import { dateKeyInTimeZone, TODAYS_OUTFIT_TIMEZONE } from '@/utils/todaysOutfitTime';
import { todaysOutfitDateKey } from '@/utils/todaysOutfitDailyStore';

export type WearTargetKind = 'today' | 'tomorrow' | 'date' | 'unspecified';

export type WearTargetDay = {
  kind: WearTargetKind;
  /** YYYY-MM-DD in Europe/London — null when no date was stated */
  dateKey: string | null;
  /** Short human label: today | tomorrow | Saturday */
  dayLabel: string;
  /** Only true when the user asked for today / tonight / later today */
  markAsWornToday: boolean;
};

/** Single source of truth linking chat generation → Wear/Try/Save */
export type StyleSession = {
  intent: 'multi_look' | 'single_look' | string;
  occasion?: string | null;
  /** YYYY-MM-DD or null when unspecified */
  targetDate: string | null;
  timeContext?: 'morning' | 'afternoon' | 'evening' | null;
  dayLabel: string;
  kind: WearTargetKind;
  markAsWornToday: boolean;
  userMessage?: string;
};

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = Date.UTC(y, (m || 1) - 1, d || 1);
  const next = new Date(utc + days * 24 * 60 * 60 * 1000);
  return dateKeyInTimeZone(next, 'UTC');
}

function weekdayIndexInLondon(now: Date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-GB', {
    timeZone: TODAYS_OUTFIT_TIMEZONE,
    weekday: 'long',
  }).format(now).toLowerCase();
  const idx = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
  return idx >= 0 ? idx : now.getDay();
}

function nextWeekdayDateKey(targetDow: number, todayKey: string, now: Date): string {
  const current = weekdayIndexInLondon(now);
  let delta = (targetDow - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addDaysToDateKey(todayKey, delta);
}

function weekdayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(utc);
}

function detectTimeContext(text: string): StyleSession['timeContext'] {
  if (/\b(tonight|this evening|evening)\b/i.test(text)) return 'evening';
  if (/\b(this afternoon|afternoon)\b/i.test(text)) return 'afternoon';
  if (/\b(this morning|morning)\b/i.test(text)) return 'morning';
  return null;
}

function detectOccasion(text: string): string | null {
  if (/\bdrinks?\b/i.test(text)) return 'drinks';
  if (/\b(date|dinner)\b/i.test(text)) return 'date';
  if (/\b(work|office)\b/i.test(text)) return 'work';
  if (/\b(gym|workout)\b/i.test(text)) return 'gym';
  if (/\bpark\b/i.test(text)) return 'casual';
  return null;
}

/**
 * Prefer the user's ask; fall back to assistant prose if needed.
 */
export function resolveWearTargetFromChat(
  userMessage = '',
  assistantContent = '',
  now: Date = new Date(),
): WearTargetDay {
  const text = `${String(userMessage || '')}\n${String(assistantContent || '')}`.toLowerCase();
  const todayKey = todaysOutfitDateKey(now);

  if (/\b(tomorrow|tmrw|tmr)\b/i.test(text)) {
    const dateKey = addDaysToDateKey(todayKey, 1);
    return {
      kind: 'tomorrow',
      dateKey,
      dayLabel: 'tomorrow',
      markAsWornToday: false,
    };
  }

  if (/\b(later today|this afternoon|this morning|this evening|tonight|today)\b/i.test(text)) {
    return {
      kind: 'today',
      dateKey: todayKey,
      dayLabel: 'today',
      markAsWornToday: true,
    };
  }

  if (/\bthis weekend\b/i.test(text)) {
    const dow = weekdayIndexInLondon(now);
    const delta = dow === 6 ? 0 : dow === 0 ? 6 : (6 - dow);
    const dateKey = delta === 0 ? todayKey : addDaysToDateKey(todayKey, delta);
    return {
      kind: dateKey === todayKey ? 'today' : 'date',
      dateKey,
      dayLabel: dateKey === todayKey ? 'today' : weekdayLabel(dateKey),
      markAsWornToday: dateKey === todayKey,
    };
  }

  for (let i = 0; i < WEEKDAYS.length; i += 1) {
    const name = WEEKDAYS[i];
    if (new RegExp(`\\b(on\\s+)?${name}\\b`, 'i').test(text)) {
      const dateKey = nextWeekdayDateKey(i, todayKey, now);
      return {
        kind: 'date',
        dateKey,
        dayLabel: weekdayLabel(dateKey),
        markAsWornToday: false,
      };
    }
  }

  // No day stated — null targetDate; never hijack Today's Outfit
  return {
    kind: 'unspecified',
    dateKey: null,
    dayLabel: '',
    markAsWornToday: false,
  };
}

/** Build persisted session — attach to assistant message; actions must reuse this. */
export function buildStyleSession(opts: {
  userMessage?: string;
  assistantContent?: string;
  intent?: StyleSession['intent'];
  occasion?: string | null;
  now?: Date;
}): StyleSession {
  const userMessage = String(opts.userMessage || '');
  const assistantContent = String(opts.assistantContent || '');
  const target = resolveWearTargetFromChat(userMessage, assistantContent, opts.now);
  const blob = `${userMessage}\n${assistantContent}`;
  return {
    intent: opts.intent || 'multi_look',
    occasion: opts.occasion || detectOccasion(blob),
    targetDate: target.dateKey,
    timeContext: detectTimeContext(blob),
    dayLabel: target.dayLabel,
    kind: target.kind,
    markAsWornToday: target.markAsWornToday,
    userMessage: userMessage || undefined,
  };
}

export function wearTargetFromSession(session: StyleSession): WearTargetDay {
  return {
    kind: session.kind,
    dateKey: session.targetDate,
    dayLabel: session.dayLabel,
    markAsWornToday: session.markAsWornToday,
  };
}

export function plannedDateIsoFromKey(dateKey: string): string {
  return `${dateKey}T12:00:00.000Z`;
}

export function wearCtaLabels(target: WearTargetDay, opts: {
  isPrimary: boolean;
  isCommitted: boolean;
}): {
  primary: string;
  committed: string;
  confirmBody: string;
  heroBadgeHint: string | null;
  resolvedAction: 'wear_today' | 'plan' | 'save';
} {
  const { isPrimary } = opts;

  if (target.kind === 'tomorrow') {
    return {
      primary: isPrimary ? 'Wear tomorrow' : 'Try for tomorrow',
      committed: 'Planned for tomorrow',
      confirmBody: 'This look is planned for tomorrow.',
      heroBadgeHint: isPrimary ? 'Best for tomorrow' : null,
      resolvedAction: 'plan',
    };
  }

  if (target.kind === 'today' && target.markAsWornToday) {
    return {
      primary: isPrimary ? 'Wear this' : 'Try this',
      committed: 'Wearing today',
      confirmBody: 'This look is marked for today.',
      heroBadgeHint: null,
      resolvedAction: 'wear_today',
    };
  }

  if (target.kind === 'date' && target.dateKey) {
    const day = target.dayLabel || 'that day';
    return {
      primary: isPrimary ? `Plan for ${day}` : `Try for ${day}`,
      committed: `Planned for ${day}`,
      confirmBody: `This look is planned for ${day}.`,
      heroBadgeHint: isPrimary ? `Best for ${day}` : null,
      resolvedAction: 'plan',
    };
  }

  // No date — Save look (do not mark worn today)
  return {
    primary: isPrimary ? 'Save look' : 'Try this',
    committed: 'Saved',
    confirmBody: 'Look saved. It was not marked as worn today.',
    heroBadgeHint: null,
    resolvedAction: 'save',
  };
}

export function logStyleSessionAction(payload: {
  sessionDate: string | null;
  actionTriggered: string;
  resolvedAction: string;
  savedTo: string;
  lookRole?: string;
}) {
  try {
    console.log('[StyleSession]', JSON.stringify(payload));
  } catch {
    console.log('[StyleSession]', payload);
  }
}
