import { CommonActions } from "@react-navigation/native";

type NavLike = {
  navigate?: (name: string, params?: Record<string, unknown>) => void;
  dispatch: (action: ReturnType<typeof CommonActions.navigate>) => void;
};

export type SubscriptionNavParams = {
  highlightPlan?: string;
  scrollToDFY?: boolean;
  /** Scroll to AI meter top-up packs (extra Live/chat allowance). */
  scrollToAiTopUp?: boolean;
  offer50?: boolean;
  pause?: boolean;
  winbackBanner?: string;
  /**
   * Paywall presentation — SubscriptionScreen always shows a dismiss control.
   * Set automatically by navigateToSubscription.
   */
  asPaywall?: boolean;
  /**
   * Analytics / funnel source (stylist_chat, shopping, event-outfit,
   * sanity-check, profile, live, …). Also drives the header back label.
   */
  source?: string;
  /** Override header back label (otherwise derived from `source` / previous route). */
  backLabel?: string;
};

/**
 * Open Subscription as a dismissible paywall.
 *
 * Prefer the current tab's stack (modal) so dismiss returns to the screen that
 * triggered upgrade. Fall back to ProfileTab with `initial: false` so
 * Subscription is never mounted as the Profile stack's sole root.
 *
 * Always go through this helper — do not call `navigation.navigate('Subscription')`
 * from feature screens directly.
 */
export function navigateToSubscription(
  navigation: NavLike,
  highlightPlanOrParams?: string | SubscriptionNavParams,
) {
  const incoming: SubscriptionNavParams | undefined =
    typeof highlightPlanOrParams === "string"
      ? { highlightPlan: highlightPlanOrParams }
      : highlightPlanOrParams;

  const screenParams: SubscriptionNavParams = {
    ...incoming,
    asPaywall: true,
  };

  // 1) In-stack modal — best UX (close returns to chat / wardrobe / settings).
  if (typeof navigation.navigate === "function") {
    navigation.navigate("Subscription", screenParams as Record<string, unknown>);
    return;
  }

  // 2) Cross-tab fallback — preserve Profile under the modal.
  navigation.dispatch(
    CommonActions.navigate({
      name: "ProfileTab",
      params: {
        screen: "Subscription",
        initial: false,
        params: screenParams,
      },
    }),
  );
}
