/**
 * Leave Live in ONE stack action — never goBack, never bridge.
 *
 * Live is a normal stack card (tab bar hidden). StackActions.replace swaps it
 * for Subscription/SanityCheck with no modal dismiss animation.
 */

import { StackActions } from '@react-navigation/native';

export type LiveExitDestination =
  | {
      kind: 'subscription';
      highlightPlan?: string;
      scrollToAiTopUp?: boolean;
    }
  | { kind: 'sanity' };

type LiveNav = {
  dispatch: (action: ReturnType<typeof StackActions.replace>) => void;
  replace?: (name: string, params?: object) => void;
};

function subscriptionParams(dest: Extract<LiveExitDestination, { kind: 'subscription' }>) {
  const params: Record<string, string | boolean> = {};
  if (dest.highlightPlan) params.highlightPlan = dest.highlightPlan;
  if (dest.scrollToAiTopUp) params.scrollToAiTopUp = true;
  return Object.keys(params).length ? params : undefined;
}

/**
 * See plans / Buy credit / Sanity Check — single replace, zero dismiss animation.
 */
export function leaveLiveAndNavigate(
  navigation: LiveNav,
  destination: LiveExitDestination,
) {
  try {
    if (destination.kind === 'sanity') {
      navigation.dispatch(StackActions.replace('SanityCheck'));
      return;
    }

    navigation.dispatch(
      StackActions.replace('Subscription', subscriptionParams(destination)),
    );
  } catch (err) {
    console.warn('[leaveLiveAndNavigate] replace failed:', err);
    try {
      if (destination.kind === 'sanity') {
        navigation.replace?.('SanityCheck');
      } else {
        navigation.replace?.('Subscription', subscriptionParams(destination));
      }
    } catch {
      /* never throw into ErrorBoundary */
    }
  }
}

/** @deprecated */
export function flushPendingLiveExit() {
  /* no-op */
}
