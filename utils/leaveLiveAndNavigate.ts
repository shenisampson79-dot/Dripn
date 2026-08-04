/**
 * Leave Live without the black fullScreenModal slide.
 *
 * Pattern:
 * 1. If Subscription is on this stack → replace Live with Subscription
 * 2. Otherwise → replace Live with ExitLiveBridge (animation: 'none'),
 *    which root-navigates to ProfileTab/Subscription then silently pops
 */

import { InteractionManager } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { getNavigationRef } from '@/components/ErrorFallback';
import { navigateToSubscription } from '@/utils/navigateToSubscription';

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
  getState?: () => { routeNames?: string[]; routes: { name: string }[] };
};

function subscriptionParams(dest: Extract<LiveExitDestination, { kind: 'subscription' }>) {
  const params: Record<string, string | boolean> = {};
  if (dest.highlightPlan) params.highlightPlan = dest.highlightPlan;
  if (dest.scrollToAiTopUp) params.scrollToAiTopUp = true;
  return Object.keys(params).length ? params : undefined;
}

function routeNamesInclude(navigation: LiveNav, name: string): boolean {
  const names = navigation.getState?.()?.routeNames;
  return Array.isArray(names) && names.includes(name);
}

/**
 * See plans / Buy credit / Sanity Check — never goBack() Live (that slides the black modal).
 */
export function leaveLiveAndNavigate(
  navigation: LiveNav,
  destination: LiveExitDestination,
) {
  try {
    if (destination.kind === 'sanity') {
      if (typeof navigation.replace === 'function' && routeNamesInclude(navigation, 'SanityCheck')) {
        try {
          navigation.replace('SanityCheck');
          return;
        } catch {
          /* fall through */
        }
      }
      if (typeof navigation.replace === 'function' && routeNamesInclude(navigation, 'ExitLiveBridge')) {
        try {
          navigation.replace('ExitLiveBridge', { destination });
          return;
        } catch {
          /* fall through */
        }
      }
      const root = getNavigationRef();
      if (root?.isReady()) {
        root.dispatch(
          CommonActions.navigate({
            name: 'StylistTab',
            params: { screen: 'SanityCheck' },
          }),
        );
      }
      return;
    }

    const params = subscriptionParams(destination);

    // Live opened from Profile (or any stack that owns Subscription) → replace in place
    if (typeof navigation.replace === 'function' && routeNamesInclude(navigation, 'Subscription')) {
      try {
        navigation.replace('Subscription', params);
        return;
      } catch {
        /* fall through */
      }
    }

    // Stylist / Wardrobe Live: replace with silent bridge (no modal dismiss animation)
    if (typeof navigation.replace === 'function' && routeNamesInclude(navigation, 'ExitLiveBridge')) {
      try {
        navigation.replace('ExitLiveBridge', { destination });
        return;
      } catch {
        /* fall through */
      }
    }

    // Last resort: root navigate only (Live may remain until user backs out)
    const root = getNavigationRef();
    if (root?.isReady()) {
      navigateToSubscription(root, {
        highlightPlan: destination.highlightPlan,
        scrollToAiTopUp: destination.scrollToAiTopUp,
      });
    }
  } catch (err) {
    console.warn('[leaveLiveAndNavigate] failed:', err);
    try {
      const root = getNavigationRef();
      if (root?.isReady() && destination.kind === 'subscription') {
        navigateToSubscription(root, {
          highlightPlan: destination.highlightPlan,
          scrollToAiTopUp: destination.scrollToAiTopUp,
        });
      }
    } catch {
      /* give up quietly — never throw into ErrorBoundary */
    }
  }
}

/** @deprecated */
export function flushPendingLiveExit() {
  /* no-op */
}
