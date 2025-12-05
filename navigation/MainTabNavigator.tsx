import React from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import DiscoverStackNavigator from "@/navigation/DiscoverStackNavigator";
import CommunityStackNavigator from "@/navigation/CommunityStackNavigator";
import BargainsStackNavigator from "@/navigation/BargainsStackNavigator";
import EventsStackNavigator from "@/navigation/EventsStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export type MainTabParamList = {
  HomeTab: undefined;
  DiscoverTab: undefined;
  CommunityTab: undefined;
  PostTab: undefined;
  BargainsTab: undefined;
  EventsTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function EmptyScreen() {
  return null;
}

interface FloatingPostButtonProps {
  onPress: () => void;
}

function FloatingPostButton({ onPress }: FloatingPostButtonProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.fabContainer, { bottom: 49 + insets.bottom + 8 }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.fab,
          { 
            backgroundColor: theme.link,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

interface MainTabNavigatorProps {
  onCreatePost: () => void;
}

export default function MainTabNavigator({ onCreatePost }: MainTabNavigatorProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={{
          tabBarActiveTintColor: theme.tabIconSelected,
          tabBarInactiveTintColor: theme.tabIconDefault,
          tabBarStyle: {
            position: "absolute",
            backgroundColor: Platform.select({
              ios: "transparent",
              android: theme.backgroundRoot,
            }),
            borderTopWidth: 0,
            elevation: 0,
          },
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackNavigator}
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="DiscoverTab"
          component={DiscoverStackNavigator}
          options={{
            title: "Discover",
            tabBarIcon: ({ color, size }) => (
              <Feather name="compass" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="CommunityTab"
          component={CommunityStackNavigator}
          options={{
            title: "Community",
            tabBarIcon: ({ color, size }) => (
              <Feather name="users" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="PostTab"
          component={EmptyScreen}
          options={{
            title: "Post",
            tabBarIcon: () => null,
            tabBarButton: () => null,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tab.Screen
          name="BargainsTab"
          component={BargainsStackNavigator}
          options={{
            title: "Bargains",
            tabBarIcon: ({ color, size }) => (
              <Feather name="tag" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="EventsTab"
          component={EventsStackNavigator}
          options={{
            title: "Events",
            tabBarIcon: ({ color, size }) => (
              <Feather name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStackNavigator}
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <FloatingPostButton onPress={onCreatePost} />
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  fab: {
    width: 56,
    height: 56,
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
