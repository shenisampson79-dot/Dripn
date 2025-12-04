import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderHeightContext } from "@react-navigation/elements";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useContext } from "react";

import { Spacing } from "@/constants/theme";

export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  
  const headerHeightContext = useContext(HeaderHeightContext);
  const headerHeight = headerHeightContext ?? 0;
  
  const tabBarHeightContext = useContext(BottomTabBarHeightContext);
  const tabBarHeight = tabBarHeightContext ?? 0;

  return {
    paddingTop: headerHeight > 0 ? headerHeight + Spacing.xl : insets.top + Spacing.xl,
    paddingBottom: tabBarHeight > 0 ? tabBarHeight + Spacing.xl : insets.bottom + Spacing.xl,
    scrollInsetBottom: insets.bottom + 16,
    hasTabBar: tabBarHeight > 0,
    hasHeader: headerHeight > 0,
  };
}
