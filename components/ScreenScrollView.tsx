import React, { forwardRef } from "react";
import { ScrollView, ScrollViewProps, StyleSheet } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { Spacing } from "@/constants/theme";

export const ScreenScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function ScreenScrollView(
    { children, contentContainerStyle, style, ...scrollViewProps },
    ref
  ) {
    const { theme } = useTheme();
    const { paddingTop, paddingBottom, scrollInsetBottom } = useScreenInsets();

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
            paddingTop,
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
