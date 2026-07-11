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
import { useTranslations } from "@/contexts/TranslationContext";
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
  const { t } = useTranslations();

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
          title: t('navTitles.post') || "Post",
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          title: t('navTitles.subscription') || t('subscription.screenTitle') || "Subscription",
        })}
      />
      <Stack.Screen
        name="DFYComparison"
        component={DFYComparisonScreen}
        options={{
          title: t('navTitles.chooseYourSetup') || "Choose Your Setup",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DFYStart"
        component={DFYStartScreen}
        options={{
          title: t('navTitles.stylistSetup') || "Stylist Setup",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYUpload"
        component={DFYUploadScreen}
        options={{
          title: t('navTitles.uploadWardrobe') || "Upload Wardrobe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYStylePlan"
        component={DFYStylePlanScreen}
        options={{
          title: t('navTitles.yourStylePlan') || "Your Style Plan",
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
