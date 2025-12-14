import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DiscoverScreen from "@/screens/DiscoverScreen";
import PostDetailScreen from "@/screens/PostDetailScreen";
import FashionBlogScreen from "@/screens/FashionBlogScreen";
import StyleShuffleScreen from "@/screens/StyleShuffleScreen";
import AIStylistScreen from "@/screens/AIStylistScreen";
import VisualSearchScreen from "@/screens/VisualSearchScreen";
import GamificationScreen from "@/screens/GamificationScreen";
import SmartNotificationsScreen from "@/screens/SmartNotificationsScreen";
import StyleChallengesScreen from "@/screens/StyleChallengesScreen";
import ChallengeDetailScreen from "@/screens/ChallengeDetailScreen";
import ChallengeSubmissionScreen from "@/screens/ChallengeSubmissionScreen";
import EventsScreen from "@/screens/EventsScreen";
import StreetStyleScannerScreen from "@/screens/StreetStyleScannerScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type DiscoverStackParamList = {
  Discover: undefined;
  PostDetail: { postId: string };
  FashionBlog: undefined;
  StyleShuffle: undefined;
  AIStylist: undefined;
  VisualSearch: undefined;
  Gamification: undefined;
  SmartNotifications: undefined;
  StyleChallenges: undefined;
  ChallengeDetail: { challengeId: string };
  ChallengeSubmission: { challengeId: string };
  Events: undefined;
  StreetStyleScanner: undefined;
};

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

export default function DiscoverStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Discover"
        component={DiscoverScreen}
        options={{
          title: "Discover",
        }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{ headerTitle: "Post" }}
      />
      <Stack.Screen
        name="FashionBlog"
        component={FashionBlogScreen}
        options={{ headerTitle: "Fashion Blog" }}
      />
      <Stack.Screen
        name="StyleShuffle"
        component={StyleShuffleScreen}
        options={{ headerTitle: "Style Shuffle" }}
      />
      <Stack.Screen
        name="AIStylist"
        component={AIStylistScreen}
        options={{ headerTitle: "Personal Stylist" }}
      />
      <Stack.Screen
        name="VisualSearch"
        component={VisualSearchScreen}
        options={{ headerTitle: "Visual Search" }}
      />
      <Stack.Screen
        name="Gamification"
        component={GamificationScreen}
        options={{ headerTitle: "Rewards" }}
      />
      <Stack.Screen
        name="SmartNotifications"
        component={SmartNotificationsScreen}
        options={{ headerTitle: "Smart Notifications" }}
      />
      <Stack.Screen
        name="StyleChallenges"
        component={StyleChallengesScreen}
        options={{ headerTitle: "Style Challenges" }}
      />
      <Stack.Screen
        name="ChallengeDetail"
        component={ChallengeDetailScreen}
        options={{ headerTitle: "Challenge" }}
      />
      <Stack.Screen
        name="ChallengeSubmission"
        component={ChallengeSubmissionScreen}
        options={{ headerTitle: "Submit Entry" }}
      />
      <Stack.Screen
        name="Events"
        component={EventsScreen}
        options={{ headerTitle: "Events Near You" }}
      />
      <Stack.Screen
        name="StreetStyleScanner"
        component={StreetStyleScannerScreen}
        options={{ headerTitle: "Street Style Scanner" }}
      />
    </Stack.Navigator>
  );
}
