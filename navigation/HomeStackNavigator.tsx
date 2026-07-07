import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import PostDetailScreen from "@/screens/PostDetailScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import DFYComparisonScreen from "@/screens/DFYComparisonScreen";
import DFYStartScreen from "@/screens/DFYStartScreen";
import DFYStylePlanScreen from "@/screens/DFYStylePlanScreen";
import DFYUploadScreen from "@/screens/DFYUploadScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions, getSettingsChildScreenOptions } from "@/navigation/screenOptions";

export type HomeStackParamList = {
  Home: undefined;
  PostDetail: { postId: string };
  Subscription: { highlightPlan?: string } | undefined;
  DFYComparison: { selectedTier?: 'lite' | 'core'; autoCheckout?: boolean; paidAddOn?: boolean } | undefined;
  DFYStart: undefined;
  DFYStylePlan: { initialDay?: number } | undefined;
  DFYUpload: { type: "outfit" | "core" };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Dripn" />,
        }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={{
          title: "Post",
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: "Subscription" })}
      />
      <Stack.Screen
        name="DFYComparison"
        component={DFYComparisonScreen}
        options={{
          title: "Choose Your Setup",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DFYStart"
        component={DFYStartScreen}
        options={{
          title: "Stylist Setup",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYUpload"
        component={DFYUploadScreen}
        options={{
          title: "Upload Wardrobe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYStylePlan"
        component={DFYStylePlanScreen}
        options={{
          title: "Your Style Plan",
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
