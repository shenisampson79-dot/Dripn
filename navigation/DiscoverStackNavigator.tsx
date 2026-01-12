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
import VirtualTryOnScreen from "@/screens/VirtualTryOnScreen";
import CommunityScreen from "@/screens/CommunityScreen";
import UserProfileScreen from "@/screens/UserProfileScreen";
import FriendsActivityScreen from "@/screens/FriendsActivityScreen";
import FriendRequestsScreen from "@/screens/FriendRequestsScreen";
import DiscoverPeopleScreen from "@/screens/DiscoverPeopleScreen";
import MessagesScreen from "@/screens/MessagesScreen";
import ConversationScreen from "@/screens/ConversationScreen";
import StyleSoulmatesScreen from "@/screens/StyleSoulmatesScreen";
import BargainsScreen from "@/screens/BargainsScreen";
import WishlistScreen from "@/screens/WishlistScreen";
import SustainabilityScreen from "@/screens/SustainabilityScreen";
import FashionTherapyScreen from "@/screens/FashionTherapyScreen";
import MotionCoachingScreen from "@/screens/MotionCoachingScreen";
import WardrobeDigitalTwinScreen from "@/screens/WardrobeDigitalTwinScreen";
import CulturalStyleScreen from "@/screens/CulturalStyleScreen";
import StyleStoriesScreen from "@/screens/StyleStoriesScreen";
import CollectiveInsightsScreen from "@/screens/CollectiveInsightsScreen";
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
  VirtualTryOn: { garmentImageUrl?: string; garmentDescription?: string } | undefined;
  Community: undefined;
  UserProfile: { userId: string };
  FriendsActivity: undefined;
  FriendRequests: undefined;
  DiscoverPeople: undefined;
  Messages: undefined;
  Conversation: { conversationId: string; participantName: string };
  StyleSoulmates: undefined;
  Bargains: undefined;
  Wishlist: undefined;
  Sustainability: undefined;
  FashionTherapy: undefined;
  MotionCoaching: undefined;
  WardrobeDigitalTwin: undefined;
  CulturalStyle: undefined;
  StyleStories: undefined;
  CollectiveInsights: undefined;
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
      <Stack.Screen
        name="VirtualTryOn"
        component={VirtualTryOnScreen}
        options={{ headerTitle: "Virtual Try-On" }}
      />
      <Stack.Screen
        name="Community"
        component={CommunityScreen}
        options={{ headerTitle: "People" }}
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
        name="Bargains"
        component={BargainsScreen}
        options={{ headerTitle: "Offers" }}
      />
      <Stack.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{ headerTitle: "Wishlist" }}
      />
      <Stack.Screen
        name="Sustainability"
        component={SustainabilityScreen}
        options={{ headerTitle: "Sustainability" }}
      />
      <Stack.Screen
        name="FashionTherapy"
        component={FashionTherapyScreen}
        options={{ headerTitle: "Fashion Therapy", headerShown: false }}
      />
      <Stack.Screen
        name="MotionCoaching"
        component={MotionCoachingScreen}
        options={{ headerTitle: "Presence Analysis" }}
      />
      <Stack.Screen
        name="WardrobeDigitalTwin"
        component={WardrobeDigitalTwinScreen}
        options={{ headerTitle: "Wardrobe Twin" }}
      />
      <Stack.Screen
        name="CulturalStyle"
        component={CulturalStyleScreen}
        options={{ headerTitle: "Style Diplomat" }}
      />
      <Stack.Screen
        name="StyleStories"
        component={StyleStoriesScreen}
        options={{ headerTitle: "Style Stories" }}
      />
      <Stack.Screen
        name="CollectiveInsights"
        component={CollectiveInsightsScreen}
        options={{ headerTitle: "Fashion Intelligence" }}
      />
    </Stack.Navigator>
  );
}
