/**
 * Leave Live in ONE stack action — never goBack, never bridge/modal dismiss.
 *
 * Live is a normal card (presentation: card, slide_from_right). Tab bar is
 * hidden via layout while Live is focused. replace() swaps Live for
 * Subscription/SanityCheck on the same stack.
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
  // asPaywall: false → card presentation (Live replace must not become a modal).
  const params: Record<string, string | boolean> = {
    asPaywall: false,
    source: 'live',
  };
  if (dest.highlightPlan) params.highlightPlan = dest.highlightPlan;
  if (dest.scrollToAiTopUp) params.scrollToAiTopUp = true;
  return params;
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
