/**
 * Leave Live without navigating during Live's unmount.
 *
 * Flow:
 * 1. Live hard-unmounts the budget overlay and stops the camera.
 * 2. Live `replace`s itself with ExitLiveBridge (camera fully torn down).
 * 3. Bridge root-navigates while still covering the screen, then pops itself
 *    in the background (no Stylist hub flash).
 */

export type LiveExitDestination =
  | {
      kind: 'subscription';
      highlightPlan?: string;
      /** Scroll Subscription to AI Top-Up packs (Personal Stylist overflow). */
      scrollToAiTopUp?: boolean;
    }
  | { kind: 'sanity' };

type ReplaceableNav = {
  replace: (name: 'ExitLiveBridge', params: { destination: LiveExitDestination }) => void;
};

let pendingAfterBridge: LiveExitDestination | null = null;

export function setPendingLiveExit(destination: LiveExitDestination) {
  pendingAfterBridge = destination;
}

export function takePendingLiveExit(): LiveExitDestination | null {
  const dest = pendingAfterBridge;
  pendingAfterBridge = null;
  return dest;
}

export function peekPendingLiveExit(): LiveExitDestination | null {
  return pendingAfterBridge;
}

/**
 * Replace Live with the exit bridge. Do NOT call goBack + navigate from Live —
 * that races the fullScreenModal teardown and can leave a touch deadlock.
 */
export function leaveLiveAndNavigate(
  navigation: ReplaceableNav,
  destination: LiveExitDestination,
) {
  setPendingLiveExit(destination);
  navigation.replace('ExitLiveBridge', { destination });
}

/** @deprecated Bridge owns navigation now. */
export function flushPendingLiveExit() {
  /* no-op — ExitLiveBridgeScreen handles the hop */
}
