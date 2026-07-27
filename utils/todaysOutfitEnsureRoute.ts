/**
 * Passive route ensure for Today's Outfit.
 *
 * Routing may ONLY make StylistHub visible.
 * It must NEVER call loadOutfit or mutate card state.
 */

import type { NavigationContainerRef } from '@react-navigation/native';

import { getNavigationRef } from '@/components/ErrorFallback';

let lastNavAt = 0;
const NAV_DEDUP_MS = 500;

function routeName(
  navigation: Pick<NavigationContainerRef<any>, 'getCurrentRoute'> | null | undefined,
): string | undefined {
  try {
    return navigation?.getCurrentRoute?.()?.name;
  } catch {
    return undefined;
  }
}

/**
 * Ensure StylistHub is on screen. Idempotent. No business logic.
 */
export function ensureStylistHubVisible(
  navigation?: NavigationContainerRef<any> | null,
): boolean {
  const nav = navigation || getNavigationRef();
  if (!nav?.isReady?.()) return false;

  const now = Date.now();
  if (now - lastNavAt < NAV_DEDUP_MS) return false;

  const current = routeName(nav);
  if (current === 'StylistHub') {
    lastNavAt = now;
    return true;
  }

  try {
    // Soft navigate — never reset the whole tree (that fought the card before).
    (nav as any).navigate('StylistTab', { screen: 'StylistHub' });
    lastNavAt = now;
    return true;
  } catch {
    try {
      (nav as any).navigate('StylistHub');
      lastNavAt = now;
      return true;
    } catch {
      return false;
    }
  }
}

export function __resetEnsureRouteForTests(): void {
  lastNavAt = 0;
}
