/**
 * Runtime singleton for Unified Entry Router.
 * Handlers enqueue only; App.tsx calls markAppStable + flush after boot.
 */

import type { NavigationContainerRef } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';

import {
  type AppBootState,
  type AppIntent,
  buildStylistHubResetState,
  canResolveIntents,
  enqueueIntentPure,
  flushIntentsPure,
  parseDeepLinkUrl,
  parseNotificationData,
} from './types';
import { emitTodaysOutfitIntent } from '@/utils/todaysOutfitIntentBus';
import { ensureStylistHubVisible } from '@/utils/todaysOutfitEnsureRoute';

export * from './types';

type NavLike = Pick<NavigationContainerRef<any>, 'isReady' | 'dispatch'> & {
  navigate?: (...args: any[]) => void;
  getCurrentRoute?: () => { name?: string } | undefined;
};

let bootState: AppBootState = 'BOOTING';
let queue: AppIntent[] = [];
let navLocked = true;
let lastResolvedAt = 0;

/** Dedup rapid double-flush (focus + stable race). */
const FLUSH_DEDUP_MS = 400;

export function getBootState(): AppBootState {
  return bootState;
}

export function isNavLocked(): boolean {
  return navLocked;
}

export function getIntentQueueSnapshot(): AppIntent[] {
  return queue.slice();
}

export function enqueueIntent(intent: AppIntent): void {
  queue = enqueueIntentPure(queue, intent);
}

export function enqueueFromNotificationData(
  data: Record<string, unknown> | null | undefined,
): AppIntent {
  const intent = parseNotificationData(data);
  enqueueIntent(intent);
  return intent;
}

export function enqueueFromDeepLink(url: string | null | undefined): AppIntent {
  const intent = parseDeepLinkUrl(url);
  enqueueIntent(intent);
  return intent;
}

export function markAppHydrating(): void {
  bootState = 'HYDRATING';
  navLocked = true;
}

/**
 * App is ready for a single authoritative resolve.
 * Call once after auth + onboarding gate + navigation ready.
 */
export function markAppStable(): void {
  bootState = 'STABLE';
}

export function lockNavigation(): void {
  navLocked = true;
}

export function unlockNavigation(): void {
  navLocked = false;
}

/**
 * Safe navigate for in-app UI (not entry). Blocked while boot lock is on.
 */
export function safeNavigate(
  navigation: { navigate: (...args: any[]) => void } | null | undefined,
  ...args: any[]
): boolean {
  if (navLocked) return false;
  if (!navigation?.navigate) return false;
  try {
    navigation.navigate(...args);
    return true;
  } catch {
    return false;
  }
}

function executeIntent(intent: AppIntent, navigation: NavLike): boolean {
  if (intent.type === 'NONE') return false;
  try {
    if (intent.type === 'OPEN_TODAYS_OUTFIT') {
      // Passive: ensure screen visible + emit intent. Component owns loadOutfit.
      emitTodaysOutfitIntent('OPEN_TODAYS_OUTFIT');
      ensureStylistHubVisible(navigation as NavigationContainerRef<any>);
      return true;
    }
    if (intent.type === 'OPEN_STYLIST') {
      navigation.dispatch(CommonActions.reset(buildStylistHubResetState() as any));
      return true;
    }
    if (intent.type === 'OPEN_CHAT') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'StylistTab',
              state: {
                index: 1,
                routes: [
                  { name: 'StylistHub' },
                  {
                    name: 'AIStylist',
                    params: intent.threadId ? { threadId: intent.threadId } : undefined,
                  },
                ],
              },
            },
            { name: 'WardrobeTab' },
            { name: 'ProfileTab' },
            { name: 'SettingsTab' },
          ],
        } as any),
      );
      return true;
    }
    if (intent.type === 'OPEN_OUTFIT') {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: 'StylistTab',
              state: {
                index: 0,
                routes: [
                  {
                    name: 'StylistHub',
                    params: { openOutfitId: intent.id },
                  },
                ],
              },
            },
            { name: 'WardrobeTab' },
            { name: 'ProfileTab' },
            { name: 'SettingsTab' },
          ],
        } as any),
      );
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * THE only place entry navigation happens.
 * Returns the intent that was executed (or NONE).
 */
export function flushIntents(navigation: NavLike | null | undefined): AppIntent {
  if (!navigation) return { type: 'NONE' };
  if (!canResolveIntents({ bootState, navigationReady: navigation.isReady() })) {
    return { type: 'NONE' };
  }

  const now = Date.now();
  if (now - lastResolvedAt < FLUSH_DEDUP_MS && queue.length === 0) {
    return { type: 'NONE' };
  }

  const { intent, remaining } = flushIntentsPure(queue);
  queue = remaining;

  if (intent.type === 'NONE') {
    navLocked = false;
    return intent;
  }

  const ok = executeIntent(intent, navigation);
  lastResolvedAt = Date.now();
  // Unlock after resolve so in-app navigation works; entry already applied via reset.
  navLocked = false;
  return ok ? intent : { type: 'NONE' };
}

/**
 * Warm start: if already stable, flush now. Otherwise queue waits for markAppStable.
 */
export function tryResolveImmediately(navigation: NavLike | null | undefined): AppIntent {
  if (bootState !== 'STABLE') return { type: 'NONE' };
  return flushIntents(navigation);
}

/** Test / reset helper — do not call from product code except logout. */
export function __resetEntryRouterForTests(): void {
  bootState = 'BOOTING';
  queue = [];
  navLocked = true;
  lastResolvedAt = 0;
}
