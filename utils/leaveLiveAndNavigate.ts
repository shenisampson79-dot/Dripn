/**
 * Leave Live without navigating during Live's unmount.
 *
 * Flow:
 * 1. Live hard-unmounts the budget overlay and stops the camera.
 * 2. Live `replace`s itself with ExitLiveBridge (camera fully torn down).
 * 3. Bridge pops itself, then root-navigates after interactions settle.
 */

export type LiveExitDestination =
  | { kind: 'subscription'; highlightPlan?: string }
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
