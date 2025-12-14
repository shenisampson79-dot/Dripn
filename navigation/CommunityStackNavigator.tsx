import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CommunityScreen from "@/screens/CommunityScreen";
import UserProfileScreen from "@/screens/UserProfileScreen";
import FriendsActivityScreen from "@/screens/FriendsActivityScreen";
import FriendRequestsScreen from "@/screens/FriendRequestsScreen";
import DiscoverPeopleScreen from "@/screens/DiscoverPeopleScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import ConversationScreen from "@/screens/ConversationScreen";
import StyleSoulmatesScreen from "@/screens/StyleSoulmatesScreen";
import BodyScannerScreen from "@/screens/BodyScannerScreen";
import ColorAnalysisScreen from "@/screens/ColorAnalysisScreen";
import BodyShapeStylingGuideScreen from "@/screens/BodyShapeStylingGuideScreen";
import PersonalizedWardrobeFilterScreen from "@/screens/PersonalizedWardrobeFilterScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type CommunityStackParamList = {
  Community: undefined;
  UserProfile: { userId: string };
  FriendsActivity: undefined;
  FriendRequests: undefined;
  DiscoverPeople: undefined;
  Messages: undefined;
  Conversation: { conversationId: string; participantName: string };
  StyleSoulmates: undefined;
  BodyScanner: undefined;
  ColorAnalysis: undefined;
  BodyShapeStylingGuide: undefined;
  PersonalizedWardrobeFilter: undefined;
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
        name="FriendRequests"
        component={FriendRequestsScreen}
        options={{ headerTitle: "Friend Requests" }}
      />
      <Stack.Screen
        name="DiscoverPeople"
        component={DiscoverPeopleScreen}
        options={{ headerTitle: "Discover People" }}
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
      <Stack.Screen
        name="StyleSoulmates"
        component={StyleSoulmatesScreen}
        options={{ headerTitle: "Style Soulmates" }}
      />
      <Stack.Screen
        name="BodyScanner"
        component={BodyScannerScreen}
        options={{ headerTitle: "Body Scanner" }}
      />
      <Stack.Screen
        name="ColorAnalysis"
        component={ColorAnalysisScreen}
        options={{ headerTitle: "Color Analysis" }}
      />
      <Stack.Screen
        name="BodyShapeStylingGuide"
        component={BodyShapeStylingGuideScreen}
        options={{ headerTitle: "Styling Guide" }}
      />
      <Stack.Screen
        name="PersonalizedWardrobeFilter"
        component={PersonalizedWardrobeFilterScreen}
        options={{ headerTitle: "Wardrobe Filter" }}
      />
    </Stack.Navigator>
  );
}
