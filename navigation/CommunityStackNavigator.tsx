import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityScreen from "@/screens/CommunityScreen";
import UserProfileScreen from "@/screens/UserProfileScreen";
import FriendsActivityScreen from "@/screens/FriendsActivityScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import ConversationScreen from "@/screens/ConversationScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type CommunityStackParamList = {
  Community: undefined;
  UserProfile: { userId: string };
  FriendsActivity: undefined;
  Messages: undefined;
  Conversation: { conversationId: string; participantName: string };
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          title: "Community",
        }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{ headerTitle: "Profile" }}
      />
      <Stack.Screen
        name="FriendsActivity"
        component={FriendsActivityScreen}
        options={{ headerTitle: "Friends Activity" }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ headerTitle: "Messages" }}
      />
      <Stack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ headerTitle: "Chat" }}
      />
    </Stack.Navigator>
  );
}
