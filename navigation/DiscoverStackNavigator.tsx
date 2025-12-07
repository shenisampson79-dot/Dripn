import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DiscoverScreen from "@/screens/DiscoverScreen";
import PostDetailScreen from "@/screens/PostDetailScreen";
import FashionBlogScreen from "@/screens/FashionBlogScreen";
import StyleShuffleScreen from "@/screens/StyleShuffleScreen";
import AIStylistScreen from "@/screens/AIStylistScreen";
import VisualSearchScreen from "@/screens/VisualSearchScreen";
import GamificationScreen from "@/screens/GamificationScreen";
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
        options={{ headerTitle: "AI Stylist" }}
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
    </Stack.Navigator>
  );
}
