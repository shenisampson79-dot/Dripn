import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import VIPMembersScreen from "@/screens/VIPMembersScreen";
import VideoCallScreen from "@/screens/VideoCallScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import type { PortalMode } from "@/App";

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Subscription: undefined;
  EditProfile: undefined;
  VIPMembers: undefined;
  VideoCall: {
    callId?: string;
    roomUrl: string;
    roomToken?: string;
    calleeId?: string;
    calleeName?: string;
    sessionId?: string;
    isStylistSession?: boolean;
  };
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
        options={{
          title: "Settings",
        }}
      >
        {(props) => <SettingsScreen {...props} onOpenPortal={onOpenPortal} />}
      </Stack.Screen>
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
      <Stack.Screen
        name="VIPMembers"
        component={VIPMembersScreen}
        options={{
          title: "VIP Members",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="VideoCall"
        component={VideoCallScreen}
        options={{
          title: "Video Call",
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
    </Stack.Navigator>
  );
}
