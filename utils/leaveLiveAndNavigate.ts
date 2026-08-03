/**
 * Leave Live without flashing Stylist hub.
 *
 * Keep Live (fullScreenModal) mounted as a cover, navigate on the root
 * navigator first, then dismiss Live. Never replace→pop (that reveals hub).
 */

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
};

function applyDestination(dest: LiveExitDestination): boolean {
  const root = getNavigationRef();
  if (!root?.isReady()) return false;

  if (dest.kind === 'subscription') {
    navigateToSubscription(root, {
      highlightPlan: dest.highlightPlan,
      scrollToAiTopUp: dest.scrollToAiTopUp,
    });
    return true;
  }

  root.dispatch(
    CommonActions.navigate({
      name: 'StylistTab',
      params: { screen: 'SanityCheck' },
    }),
  );
  return true;
}

function dismissLive(navigation: LiveNav) {
  try {
    if (navigation.canGoBack()) navigation.goBack();
  } catch {
    /* already leaving */
  }
}

/**
 * Navigate to the destination while Live still covers the UI, then dismiss Live.
 */
export function leaveLiveAndNavigate(
  navigation: LiveNav,
  destination: LiveExitDestination,
) {
  // Sanity Check on the same stack: replace Live directly (no hub flash).
  if (destination.kind === 'sanity' && typeof navigation.replace === 'function') {
    try {
      navigation.replace('SanityCheck');
      return;
    } catch {
      /* fall through to root navigate + dismiss */
    }
  }

  const go = () => {
    const ok = applyDestination(destination);
    // Dismiss Live after the destination has had a moment to mount under us.
    setTimeout(() => dismissLive(navigation), ok ? 220 : 400);
    if (!ok) {
      setTimeout(() => {
        applyDestination(destination);
      }, 120);
    }
  };

  // Let the budget overlay unmount / camera stop commit first.
  requestAnimationFrame(() => {
    setTimeout(go, 32);
  });
}

/** @deprecated No pending bridge flush — kept for any leftover callers. */
export function flushPendingLiveExit() {
  /* no-op */
}
