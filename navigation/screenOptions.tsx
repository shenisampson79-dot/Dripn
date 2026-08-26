import React from "react";
import { Platform, Text, StyleSheet } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { isLiquidGlassAvailable } from "expo-glass-effect";

interface ScreenOptionsParams {
  theme: {
    backgroundRoot: string;
    text: string;
  };
  isDark: boolean;
  transparent?: boolean;
}

/** High-contrast nav title — native stack can wash out theme.text on liquid-glass / translucent bars. */
function headerForegroundColor(theme: ScreenOptionsParams["theme"], isDark: boolean): string {
  if (isDark) return "#FFFFFF";
  return theme.text || "#111111";
}

function StackHeaderTitle({ title, color }: { title: string; color: string }) {
  return (
    <Text style={[styles.headerTitleText, { color }]} numberOfLines={1}>
      {title}
    </Text>
  );
}

export const getCommonScreenOptions = ({
  theme,
  isDark,
  transparent = true,
}: ScreenOptionsParams): NativeStackNavigationOptions => {
  const titleColor = headerForegroundColor(theme, isDark);

  return {
    headerTitleAlign: "center",
    headerTransparent: transparent,
    headerBlurEffect: transparent ? (isDark ? "dark" : "light") : undefined,
    headerTintColor: titleColor,
    headerBackVisible: true,
    headerTitleStyle: {
      color: titleColor,
      fontWeight: "600",
      fontSize: 17,
    },
    headerStyle: {
      backgroundColor: transparent
        ? Platform.select({
            ios: undefined,
            android: theme.backgroundRoot,
            web: theme.backgroundRoot,
          })
        : theme.backgroundRoot,
    },
    gestureEnabled: true,
    gestureDirection: "horizontal",
    fullScreenGestureEnabled: isLiquidGlassAvailable() ? false : true,
    animation: "slide_from_right",
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
  };
};

/** Standard stack header for screens opened from Settings (matches Edit Profile). */
export const getSettingsChildScreenOptions = ({
  theme,
  isDark,
  title,
  transparent = true,
}: ScreenOptionsParams & { title: string }): NativeStackNavigationOptions => {
  const titleColor = headerForegroundColor(theme, isDark);
  const base = getCommonScreenOptions({ theme, isDark, transparent });

  return {
    ...base,
    title,
    headerShown: true,
    // Custom title node so colour always applies (native headerTitleStyle is unreliable on iOS glass)
    headerTitle: ({ children }) => (
      <StackHeaderTitle title={String(children ?? title)} color={titleColor} />
    ),
  };
};

const styles = StyleSheet.create({
  headerTitleText: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
});
