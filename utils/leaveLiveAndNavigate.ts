/**
 * Leave Live safely — no nested state resets (those crash React Navigation).
 *
 * Pattern (adapted for tab tree):
 * 1. Root-navigate to ProfileTab → Subscription (or replace if already on Profile stack)
 * 2. After interactions, dismiss Live with animation: 'none' (no black modal slide)
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
  setOptions?: (options: Record<string, unknown>) => void;
  getState?: () => { routeNames?: string[]; routes: { name: string }[] };
};

function subscriptionParams(dest: Extract<LiveExitDestination, { kind: 'subscription' }>) {
  const params: Record<string, string | boolean> = {};
  if (dest.highlightPlan) params.highlightPlan = dest.highlightPlan;
  if (dest.scrollToAiTopUp) params.scrollToAiTopUp = true;
  return Object.keys(params).length ? params : undefined;
}

function dismissLiveQuietly(navigation: LiveNav) {
  try {
    navigation.setOptions?.({ animation: 'none' });
  } catch {
    /* ignore */
  }
  try {
    if (navigation.canGoBack()) navigation.goBack();
  } catch {
    /* ignore */
  }
}

/**
 * See plans / Buy credit / Sanity Check — never rebuild navigator state.
 */
export function leaveLiveAndNavigate(
  navigation: LiveNav,
  destination: LiveExitDestination,
) {
  try {
    // Same-stack Sanity Check
    if (destination.kind === 'sanity') {
      if (typeof navigation.replace === 'function') {
        try {
          navigation.replace('SanityCheck');
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
      InteractionManager.runAfterInteractions(() => {
        dismissLiveQuietly(navigation);
      });
      return;
    }

    const params = subscriptionParams(destination);

    // Live opened from Profile stack → replace (ChatGPT's StackActions.replace case)
    const routeNames = navigation.getState?.()?.routeNames;
    if (
      typeof navigation.replace === 'function' &&
      Array.isArray(routeNames) &&
      routeNames.includes('Subscription')
    ) {
      try {
        navigation.replace('Subscription', params);
        return;
      } catch {
        /* fall through to root navigate */
      }
    }

    // Root navigate only — Subscription lives under ProfileTab, not at root
    const root = getNavigationRef();
    if (root?.isReady()) {
      navigateToSubscription(root, {
        highlightPlan: destination.highlightPlan,
        scrollToAiTopUp: destination.scrollToAiTopUp,
      });
    }

    // Wait for stable tree, then dismiss Live without the modal slide animation.
    // Hard fallback: InteractionManager can stall while CameraView is still mounted.
    let dismissed = false;
    const dismissOnce = () => {
      if (dismissed) return;
      dismissed = true;
      dismissLiveQuietly(navigation);
    };
    InteractionManager.runAfterInteractions(() => {
      setTimeout(dismissOnce, 40);
    });
    setTimeout(dismissOnce, 450);
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
      dismissLiveQuietly(navigation);
    } catch {
      /* give up quietly — never throw into ErrorBoundary */
    }
  }
}

/** @deprecated */
export function flushPendingLiveExit() {
  /* no-op */
}
