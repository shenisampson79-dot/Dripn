import React, { forwardRef } from "react";
import { Platform, StyleSheet } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
  KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";

import { useTheme } from "@/hooks/useTheme";
import { useScreenInsets } from "@/hooks/useScreenInsets";
import { Spacing } from "@/constants/theme";
import { ScreenScrollView } from "./ScreenScrollView";

type Props = KeyboardAwareScrollViewProps & {
  /**
   * Use when the stack header is opaque (headerTransparent: false).
   * Scene content is already inset below the header — avoid adding headerHeight again.
   */
  opaqueHeader?: boolean;
};

export const ScreenKeyboardAwareScrollView = forwardRef<
  KeyboardAwareScrollViewRef,
  Props
>(function ScreenKeyboardAwareScrollView(
  {
    children,
    contentContainerStyle,
    style,
    keyboardShouldPersistTaps = "handled",
    opaqueHeader = false,
    ...scrollViewProps
  },
  ref
) {
  const { theme } = useTheme();
  const { paddingTop, paddingBottom, scrollInsetBottom } = useScreenInsets();
  const topPad = opaqueHeader ? Spacing.md : paddingTop;

  /**
   * KeyboardAwareScrollView isn't compatible with web (it relies on native APIs), so the code falls back to ScreenScrollView on web to avoid runtime errors.
   */
  if (Platform.OS === "web") {
    return (
      <ScreenScrollView
        ref={ref as React.Ref<any>}
        style={style}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        opaqueHeader={opaqueHeader}
        {...scrollViewProps}
      >
        {children}
      </ScreenScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
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
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...scrollViewProps}
    >
      {children}
    </KeyboardAwareScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.xl,
  },
});
