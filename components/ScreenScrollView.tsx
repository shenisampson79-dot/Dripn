import React, { forwardRef } from "react";
import { ScrollView, ScrollViewProps, StyleSheet } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { Spacing } from "@/constants/theme";

type ScreenScrollViewProps = ScrollViewProps & {
  /**
   * Use when the stack header is opaque (headerTransparent: false).
   * Scene content is already inset below the header — avoid adding headerHeight again.
   */
  opaqueHeader?: boolean;
};

export const ScreenScrollView = forwardRef<ScrollView, ScreenScrollViewProps>(
  function ScreenScrollView(
    { children, contentContainerStyle, style, opaqueHeader = false, ...scrollViewProps },
    ref
  ) {
    const { theme } = useTheme();
    const { paddingTop, paddingBottom, scrollInsetBottom } = useScreenInsets();
    const topPad = opaqueHeader ? Spacing.md : paddingTop;

    return (
      <ScrollView
        ref={ref}
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot },
          style,
        ]}
        contentContainerStyle={[
          {
            paddingTop: topPad,
            paddingBottom,
          },
          styles.contentContainer,
          contentContainerStyle,
        ]}
        scrollIndicatorInsets={{ bottom: scrollInsetBottom }}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
  },
});
