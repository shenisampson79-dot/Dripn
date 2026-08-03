import { CommonActions } from "@react-navigation/native";

type DispatchableNavigation = {
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
};

/**
 * Subscription lives on ProfileTab (and Home stack), not on StylistTab.
 * Always hop via ProfileTab so Stylist / Wardrobe screens don't crash with
 * "NAVIGATE ... Subscription was not handled by any navigator".
 */
export function navigateToSubscription(
  navigation: DispatchableNavigation,
  highlightPlanOrParams?: string | SubscriptionNavParams,
) {
  const screenParams: SubscriptionNavParams | undefined =
    typeof highlightPlanOrParams === "string"
      ? { highlightPlan: highlightPlanOrParams }
      : highlightPlanOrParams;

  const hasParams =
    !!screenParams &&
    Object.values(screenParams).some((value) => value !== undefined && value !== "");

  navigation.dispatch(
    CommonActions.navigate({
      name: "ProfileTab",
      params: {
        screen: "Subscription",
        ...(hasParams ? { params: screenParams } : {}),
      },
    }),
  );
}
