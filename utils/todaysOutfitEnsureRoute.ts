/**
 * Passive route ensure for Today's Outfit.
 *
 * Routing may ONLY make StylistHub visible.
 * It must NEVER call loadOutfit or mutate card state.
 *
 * Soft-navigate alone is unsafe while a stylist-stack modal (e.g. GON /
 * ScanWardrobe) is open — React Navigation can push another StylistHub on
 * top of the modal, which hides the tab bar and leaves the previous card
 * peeking behind. Prefer popToTop inside StylistTab so the existing Hub
 * (and TodaysOutfitCard cache) stay mounted.
 */

import {
  StackActions,
  type NavigationContainerRef,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';

import { getNavigationRef } from '@/components/ErrorFallback';

let lastNavAt = 0;
const NAV_DEDUP_MS = 500;

type StackLike = {
  key?: string;
  index?: number;
  routes: Array<{ name: string; state?: NavigationState | PartialState<NavigationState> }>;
};

function routeName(
  navigation: Pick<NavigationContainerRef<any>, 'getCurrentRoute'> | null | undefined,
): string | undefined {
  try {
    return navigation?.getCurrentRoute?.()?.name;
  } catch {
    return undefined;
  }
}

function findStylistStackState(
  state: NavigationState | PartialState<NavigationState> | undefined,
): StackLike | null {
  if (!state?.routes) return null;
  for (const route of state.routes) {
    if (route.name === 'StylistTab') {
      const nested = route.state as StackLike | undefined;
      if (nested?.routes?.length) return nested;
      return { index: 0, routes: [{ name: 'StylistHub' }] };
    }
    const deeper = findStylistStackState(route.state as NavigationState | undefined);
    if (deeper) return deeper;
  }
  return null;
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

  try {
    const rootState = typeof (nav as any).getRootState === 'function'
      ? (nav as any).getRootState()
      : null;
    const stylistStack = findStylistStackState(rootState);

    // Modal / pushed screens above Hub → pop them (keeps Hub mounted).
    if (stylistStack?.key && (stylistStack.index ?? 0) > 0) {
      nav.dispatch({
        ...StackActions.popToTop(),
        target: stylistStack.key,
      });
      (nav as any).navigate('StylistTab');
      lastNavAt = now;
      return true;
    }

    const current = routeName(nav);
    if (current === 'StylistHub') {
      (nav as any).navigate('StylistTab');
      lastNavAt = now;
      return true;
    }

    // Soft navigate — never reset the whole tree (that remounts the card).
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
