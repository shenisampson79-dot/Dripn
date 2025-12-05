import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import type { PortalMode } from "@/App";

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Subscription: undefined;
  EditProfile: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

interface ProfileStackNavigatorProps {
  onOpenPortal?: (mode: PortalMode) => void;
}

export default function ProfileStackNavigator({ onOpenPortal }: ProfileStackNavigatorProps) {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Profile"
        options={{
          title: "Profile",
        }}
      >
        {(props) => <ProfileScreen {...props} onOpenPortal={onOpenPortal} />}
      </Stack.Screen>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          title: "Subscription",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: "Edit Profile",
        }}
      />
    </Stack.Navigator>
  );
}
