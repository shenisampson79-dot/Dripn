/**
 * Leave Live without hub flash or black modal-dismiss slide.
 *
 * Live is a fullScreenModal layered on Hub. `goBack()` always animates that
 * modal away (black card sliding down). Instead we atomically reset root tab
 * state: Profile → Subscription, and strip Live from every stack in one shot.
 */

import { CommonActions, type NavigationState, type PartialState } from '@react-navigation/native';
import { getNavigationRef } from '@/components/ErrorFallback';

export type LiveExitDestination =
  | {
      kind: 'subscription';
      highlightPlan?: string;
      scrollToAiTopUp?: boolean;
    }
  | { kind: 'sanity' };

type LiveNav = {
  canGoBack: () => boolean;
  goBack: () => void;
  replace?: (name: string, params?: object) => void;
  dispatch?: (action: unknown) => void;
  getState?: () => { routeNames?: string[]; routes: { name: string }[] };
};

const LIVE_ROUTE_NAMES = new Set(['LiveStylist', 'ExitLiveBridge']);

function tabRootScreen(tabName: string): string {
  switch (tabName) {
    case 'StylistTab':
      return 'StylistHub';
    case 'WardrobeTab':
      return 'Wardrobe';
    case 'ProfileTab':
      return 'Profile';
    case 'SettingsTab':
      return 'Settings';
    default:
      return 'StylistHub';
  }
}

function stripLiveFromStack(
  tabName: string,
  stackState: NavigationState | PartialState<NavigationState> | undefined,
): NavigationState | PartialState<NavigationState> | undefined {
  if (!stackState || !('routes' in stackState) || !Array.isArray(stackState.routes)) {
    return stackState;
  }

  const kept = stackState.routes.filter(
    (r) => r?.name && !LIVE_ROUTE_NAMES.has(String(r.name)),
  );

  if (kept.length === stackState.routes.length) {
    return stackState;
  }

  if (kept.length === 0) {
    return {
      ...stackState,
      index: 0,
      routes: [{ name: tabRootScreen(tabName) }],
    };
  }

  return {
    ...stackState,
    index: kept.length - 1,
    routes: kept,
  };
}

function buildSubscriptionParams(dest: Extract<LiveExitDestination, { kind: 'subscription' }>) {
  const params: Record<string, string | boolean> = {};
  if (dest.highlightPlan) params.highlightPlan = dest.highlightPlan;
  if (dest.scrollToAiTopUp) params.scrollToAiTopUp = true;
  return Object.keys(params).length ? params : undefined;
}

/**
 * One CommonActions.reset: focus Profile/Subscription and remove Live everywhere.
 * No goBack → no fullScreenModal dismiss animation (the black slide).
 */
function resetRootToSubscription(
  dest: Extract<LiveExitDestination, { kind: 'subscription' }>,
): boolean {
  const root = getNavigationRef();
  if (!root?.isReady()) return false;

  const rootState = root.getRootState();
  if (!rootState?.routes?.length) return false;

  const subParams = buildSubscriptionParams(dest);

  const nextRoutes = rootState.routes.map((tabRoute) => {
    if (tabRoute.name === 'ProfileTab') {
      return {
        name: 'ProfileTab' as const,
        key: tabRoute.key,
        state: {
          stale: false as const,
          type: 'stack' as const,
          key: tabRoute.state?.key ?? `${tabRoute.key}-stack`,
          index: 1,
          routes: [
            {
              name: 'Profile',
              key:
                tabRoute.state?.routes?.find((r) => r.name === 'Profile')?.key ??
                `${tabRoute.key}-Profile`,
            },
            {
              name: 'Subscription',
              key: `${tabRoute.key}-Subscription`,
              params: subParams,
            },
          ],
        },
      };
    }

    const cleaned = stripLiveFromStack(String(tabRoute.name), tabRoute.state);
    if (cleaned === tabRoute.state) return tabRoute;
    return {
      ...tabRoute,
      state: cleaned,
    };
  });

  const profileIndex = nextRoutes.findIndex((r) => r.name === 'ProfileTab');

  root.dispatch(
    CommonActions.reset({
      index: profileIndex >= 0 ? profileIndex : rootState.index,
      routes: nextRoutes,
    }),
  );

  return true;
}

/**
 * Jump off Live without modal dismiss flash.
 */
export function leaveLiveAndNavigate(
  navigation: LiveNav,
  destination: LiveExitDestination,
) {
  // Same-stack replace — no hub, no modal dismiss.
  if (destination.kind === 'sanity' && typeof navigation.replace === 'function') {
    try {
      navigation.replace('SanityCheck');
      return;
    } catch {
      /* fall through */
    }
  }

  if (destination.kind === 'subscription') {
    // If Live was opened from Profile stack, replace in-place (cleanest).
    const routeNames = navigation.getState?.()?.routeNames;
    if (
      typeof navigation.replace === 'function' &&
      Array.isArray(routeNames) &&
      routeNames.includes('Subscription')
    ) {
      try {
        navigation.replace('Subscription', buildSubscriptionParams(destination));
        return;
      } catch {
        /* fall through to root reset */
      }
    }

    const go = () => {
      if (resetRootToSubscription(destination)) return;
      // Fallback if root not ready yet
      setTimeout(() => {
        resetRootToSubscription(destination);
      }, 80);
    };

    requestAnimationFrame(() => {
      setTimeout(go, 16);
    });
    return;
  }

  // Sanity fallback via root
  const root = getNavigationRef();
  if (root?.isReady()) {
    root.dispatch(
      CommonActions.navigate({
        name: 'StylistTab',
        params: { screen: 'SanityCheck' },
      }),
    );
    try {
      if (typeof navigation.replace === 'function') {
        navigation.replace('SanityCheck');
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch {
      /* ignore */
    }
  }
}

/** @deprecated */
export function flushPendingLiveExit() {
  /* no-op */
}
