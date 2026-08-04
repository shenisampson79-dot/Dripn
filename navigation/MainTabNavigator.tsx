/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Platform, Keyboard } from "react-native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import type { NavigatorScreenParams } from "@react-navigation/native";
import WardrobeStackNavigator from "@/navigation/WardrobeStackNavigator";
import UserStylistStackNavigator, {
  type UserStylistStackParamList,
} from "@/navigation/UserStylistStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import SettingsStackNavigator from "@/navigation/SettingsStackNavigator";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTranslations } from "@/contexts/TranslationContext";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

export type MainTabParamList = {
  StylistTab: NavigatorScreenParams<UserStylistStackParamList> | undefined;
  WardrobeTab: undefined;
  ProfileTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_CONFIG: { name: keyof MainTabParamList; icon: string; label: string }[] = [
  { name: "StylistTab", icon: "scissors", label: "Stylist" },
  { name: "WardrobeTab", icon: "box", label: "Wardrobe" },
  { name: "ProfileTab", icon: "user", label: "Profile" },
  { name: "SettingsTab", icon: "settings", label: "Settings" },
];

/** Root screen per tab stack — tab press always returns here (pop-to-top behavior). */
const TAB_ROOT_SCREENS: Record<keyof MainTabParamList, string> = {
  StylistTab: "StylistHub",
  WardrobeTab: "Wardrobe",
  ProfileTab: "Profile",
  SettingsTab: "Settings",
};

interface CustomTabBarProps extends BottomTabBarProps {
  onCreatePost?: () => void;
}

const TAB_TRANSLATION_KEYS: Record<string, string> = {
  StylistTab: 'nav.stylist',
  WardrobeTab: 'nav.wardrobe',
  ProfileTab: 'nav.profile',
  SettingsTab: 'nav.settings',
};

/** Deepest focused route name in a nested navigation state. */
function getFocusedRouteName(route: BottomTabBarProps['state']['routes'][number]): string | undefined {
  let current: { name: string; state?: any } | undefined = route;
  while (current?.state?.routes?.length) {
    current = current.state.routes[current.state.index ?? 0];
  }
  return current?.name;
}

/** Screens that own the full viewport — hide the floating tab bar. */
const HIDE_TAB_BAR_SCREENS = new Set([
  'LiveStylist',
  'ScanWardrobe',
  'QuickAdd',
  'ImproveRecognition',
]);

function CustomTabBar({ state, descriptors, navigation, onCreatePost }: CustomTabBarProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslations();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showListener = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideListener = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const focusedRoute = state.routes[state.index];
  const focusedScreen = getFocusedRouteName(focusedRoute);
  if (keyboardVisible || (focusedScreen && HIDE_TAB_BAR_SCREENS.has(focusedScreen))) {
    return null;
  }

  const leftTabs = FEATURE_FLAGS.launchSimplified ? [] : TAB_CONFIG.slice(0, 2);
  const rightTabs = FEATURE_FLAGS.launchSimplified ? [] : TAB_CONFIG.slice(2);
  const allTabs = FEATURE_FLAGS.launchSimplified ? TAB_CONFIG : [];

  const renderTabItem = (tabConfig: typeof TAB_CONFIG[0], index: number) => {
    const routeIndex = state.routes.findIndex(r => r.name === tabConfig.name);
    const route = state.routes[routeIndex];
    const isFocused = state.index === routeIndex;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (event.defaultPrevented) return;

      const nested = route.state as { index?: number; routes?: { name: string }[] } | undefined;
      const nestedIndex = nested?.index ?? 0;
      const isNestedDeep = nestedIndex > 0;
      const rootScreen = TAB_ROOT_SCREENS[tabConfig.name];

      if (!isFocused) {
        // Only reset to root when the destination stack is deep (e.g. stuck on Subscription).
        // Remounting root every switch shakes StylistHub.
        if (rootScreen && isNestedDeep) {
          navigation.navigate(tabConfig.name, { screen: rootScreen });
        } else {
          navigation.navigate(tabConfig.name);
        }
        return;
      }

      // Re-tap focused tab → pop to root if needed
      if (rootScreen && isNestedDeep) {
        navigation.navigate(tabConfig.name, { screen: rootScreen });
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: "tabLongPress",
        target: route.key,
      });
    };

    return (
      <Pressable
        key={tabConfig.name}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabItem}
      >
        <Feather
          name={tabConfig.icon as any}
          size={22}
          color={isFocused ? theme.tabIconSelected : theme.tabIconDefault}
        />
        <ThemedText
          type="caption"
          style={[
            styles.tabLabel,
            { color: isFocused ? theme.tabIconSelected : theme.tabIconDefault },
          ]}
          numberOfLines={1}
        >
          {t(TAB_TRANSLATION_KEYS[tabConfig.name]) || tabConfig.label}
        </ThemedText>
      </Pressable>
    );
  };

  const TabBarBackground = Platform.OS === "ios" ? (
    <>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.9)' }]} />
      <BlurView
        intensity={80}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
    </>
  ) : (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundRoot }]} />
  );

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom }]}>
      {TabBarBackground}
      <View style={[styles.borderTop, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
      <View style={styles.tabBarContent}>
        {FEATURE_FLAGS.launchSimplified ? (
          <View style={styles.fullTabGroup}>
            {allTabs.map((tab, i) => renderTabItem(tab, i))}
          </View>
        ) : (
          <>
            <View style={styles.leftTabGroup}>
              {leftTabs.map((tab, i) => renderTabItem(tab, i))}
            </View>

            <View style={styles.centerButtonContainer}>
              <Pressable
                onPress={onCreatePost}
                style={({ pressed }) => [
                  styles.centerButton,
                  {
                    backgroundColor: theme.link,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Feather name="plus" size={28} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.rightTabGroup}>
              {rightTabs.map((tab, i) => renderTabItem(tab, i + 4))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

import type { PortalMode } from "@/App";

interface MainTabNavigatorProps {
  onCreatePost?: () => void;
  onOpenPortal?: (mode: PortalMode) => void;
}

export default function MainTabNavigator({ onCreatePost, onOpenPortal }: MainTabNavigatorProps) {
  return (
    <Tab.Navigator
      initialRouteName="StylistTab"
      tabBar={(props) => <CustomTabBar {...props} onCreatePost={onCreatePost} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="StylistTab" component={UserStylistStackNavigator} />
      <Tab.Screen name="WardrobeTab" component={WardrobeStackNavigator} />
      <Tab.Screen name="ProfileTab">
        {() => <ProfileStackNavigator onOpenPortal={onOpenPortal} />}
      </Tab.Screen>
      <Tab.Screen name="SettingsTab">
        {() => <SettingsStackNavigator onOpenPortal={onOpenPortal} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Platform.OS === "ios" ? "transparent" : undefined,
  },
  borderTop: {
    height: StyleSheet.hairlineWidth,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  tabBarContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  leftTabGroup: {
    flexDirection: "row",
    flex: 2,
    justifyContent: "space-evenly",
    alignItems: "center",
    height: "100%",
  },
  fullTabGroup: {
    flexDirection: "row",
    flex: 1,
    justifyContent: "space-around",
    alignItems: "center",
    height: "100%",
  },
  rightTabGroup: {
    flexDirection: "row",
    flex: 2,
    justifyContent: "space-evenly",
    alignItems: "center",
    height: "100%",
  },
  tabItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    minWidth: 44,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  centerButtonContainer: {
    width: 60,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
