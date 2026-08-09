import { CommonActions } from "@react-navigation/native";

type DismissableNavigation = {
  canGoBack: () => boolean;
  goBack: () => void;
  dispatch: (action: unknown) => void;
  getParent?: () => DismissableNavigation | undefined;
  getState?: () => {
    routeNames?: string[];
    routes?: Array<{ name: string }>;
    index?: number;
  };
};

/**
 * Always-safe exit from Subscription / paywall.
 * Prefer goBack; if there is no history, reset this stack to its registered root
 * (StylistHub / Profile / Wardrobe / Settings — whichever owns the screen).
 */
export function dismissSubscription(navigation: DismissableNavigation) {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  let parent = navigation.getParent?.();
  while (parent) {
    if (parent.canGoBack()) {
      parent.goBack();
      return;
    }
    parent = parent.getParent?.();
  }

  const state = navigation.getState?.();
  const rootName =
    state?.routeNames?.[0]
    || state?.routes?.[0]?.name
    || "Profile";

  navigation.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: rootName }],
    }),
  );
}
