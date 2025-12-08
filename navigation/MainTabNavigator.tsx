import React from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import DiscoverStackNavigator from "@/navigation/DiscoverStackNavigator";
import UserStylistStackNavigator from "@/navigation/UserStylistStackNavigator";
import CommunityStackNavigator from "@/navigation/CommunityStackNavigator";
import BargainsStackNavigator from "@/navigation/BargainsStackNavigator";
import EventsStackNavigator from "@/navigation/EventsStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

export type MainTabParamList = {
  HomeTab: undefined;
  DiscoverTab: undefined;
  StylistTab: undefined;
  CommunityTab: undefined;
  BargainsTab: undefined;
  EventsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_CONFIG: { name: keyof MainTabParamList; icon: string; label: string }[] = [
  { name: "HomeTab", icon: "home", label: "Home" },
  { name: "DiscoverTab", icon: "compass", label: "Discover" },
  { name: "StylistTab", icon: "scissors", label: "Stylist" },
  { name: "CommunityTab", icon: "users", label: "People" },
  { name: "BargainsTab", icon: "tag", label: "Offers" },
  { name: "EventsTab", icon: "calendar", label: "Events" },
  { name: "ProfileTab", icon: "user", label: "Profile" },
];

interface CustomTabBarProps extends BottomTabBarProps {
  onCreatePost: () => void;
}

function CustomTabBar({ state, descriptors, navigation, onCreatePost }: CustomTabBarProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const leftTabs = TAB_CONFIG.slice(0, 4);
  const rightTabs = TAB_CONFIG.slice(4);

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

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
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
          {tabConfig.label}
        </ThemedText>
      </Pressable>
    );
  };

  const TabBarBackground = Platform.OS === "ios" ? (
    <BlurView
      intensity={80}
      tint={isDark ? "dark" : "light"}
      style={StyleSheet.absoluteFill}
    />
  ) : (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.backgroundRoot }]} />
  );

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom }]}>
      {TabBarBackground}
      <View style={[styles.borderTop, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
      <View style={styles.tabBarContent}>
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
      </View>
    </View>
  );
}

import type { PortalMode } from "@/App";

interface MainTabNavigatorProps {
  onCreatePost: () => void;
  onOpenPortal?: (mode: PortalMode) => void;
}

export default function MainTabNavigator({ onCreatePost, onOpenPortal }: MainTabNavigatorProps) {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      tabBar={(props) => <CustomTabBar {...props} onCreatePost={onCreatePost} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} />
      <Tab.Screen name="DiscoverTab" component={DiscoverStackNavigator} />
      <Tab.Screen name="StylistTab" component={UserStylistStackNavigator} />
      <Tab.Screen name="CommunityTab" component={CommunityStackNavigator} />
      <Tab.Screen name="BargainsTab" component={BargainsStackNavigator} />
      <Tab.Screen name="EventsTab" component={EventsStackNavigator} />
      <Tab.Screen name="ProfileTab">
        {() => <ProfileStackNavigator onOpenPortal={onOpenPortal} />}
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
    flex: 4,
    justifyContent: "space-evenly",
    alignItems: "center",
    height: "100%",
  },
  rightTabGroup: {
    flexDirection: "row",
    flex: 3,
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
    justifyContent: "flex-end",
    paddingBottom: 4,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    marginBottom: 2,
  },
});
