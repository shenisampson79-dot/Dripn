import React from "react";
import { FlatList, FlatListProps, StyleSheet } from "react-native";

import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { Spacing } from "@/constants/theme";

type ScreenFlatListProps<T> = FlatListProps<T> & {
  /**
   * Use when the stack header is opaque (headerTransparent: false).
   * Scene content is already inset below the header — avoid adding headerHeight again.
   */
  opaqueHeader?: boolean;
};

export function ScreenFlatList<T>({
  contentContainerStyle,
  style,
  opaqueHeader = false,
  ...flatListProps
}: ScreenFlatListProps<T>) {
  const { theme } = useTheme();
  const { paddingTop, paddingBottom, scrollInsetBottom } = useScreenInsets();
  const topPad = opaqueHeader ? Spacing.md : paddingTop;

  return (
    <FlatList
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
      {...flatListProps}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
  },
});
