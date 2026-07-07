import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SettingsScreen from "@/screens/SettingsScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import StyleExplorerScreen from "@/screens/StyleExplorerScreen";
import LogoPreviewScreen from "@/screens/LogoPreviewScreen";
import OnboardingQuizScreen from "@/screens/OnboardingQuizScreen";
import SupportScreen from "@/screens/SupportScreen";
import FeatureSuggestionsScreen from "@/screens/FeatureSuggestionsScreen";
import HelpScreen from "@/screens/HelpScreen";
import PartnerScreen from "@/screens/PartnerScreen";
import CancelSubscriptionScreen from "@/screens/CancelSubscriptionScreen";
import BodyMeasurementsScreen from "@/screens/BodyMeasurementsScreen";
import FeedbackScreen from "@/screens/FeedbackScreen";
import CommunityVotingScreen from "@/screens/CommunityVotingScreen";
import DFYComparisonScreen from "@/screens/DFYComparisonScreen";
import DFYStartScreen from "@/screens/DFYStartScreen";
import DFYStylePlanScreen from "@/screens/DFYStylePlanScreen";
import DFYUploadScreen from "@/screens/DFYUploadScreen";
import AnalyticsDashboard from "@/screens/AnalyticsDashboard";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions, getSettingsChildScreenOptions } from "@/navigation/screenOptions";
import type { PortalMode } from "@/App";

export type SettingsStackParamList = {
  Settings: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  Subscription: undefined;
  EditProfile: undefined;
  StyleExplorer: undefined;
  LogoPreview: undefined;
  OnboardingQuiz: undefined;
  Support: undefined;
  FeatureSuggestions: undefined;
  Help: undefined;
  Partner: undefined;
  CancelSubscription: undefined;
  BodyMeasurements: undefined;
  Feedback: undefined;
  CommunityVoting: { session: any };
  DFYComparison: { selectedTier?: 'lite' | 'core'; autoCheckout?: boolean; paidAddOn?: boolean };
  DFYStart: undefined;
  DFYStylePlan: { tier?: string; initialDay?: number } | undefined;
  DFYUpload: { type: "outfit" | "core" };
  AnalyticsDashboard: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

interface SettingsStackNavigatorProps {
  onOpenPortal?: (mode: PortalMode) => void;
}

export default function SettingsStackNavigator({ onOpenPortal }: SettingsStackNavigatorProps) {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Settings"
        options={{
          title: "Settings",
          headerShown: false,
        }}
      >
        {(props) => <SettingsScreen {...props} onOpenPortal={onOpenPortal} />}
      </Stack.Screen>
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          title: "Privacy Policy",
        }}
      />
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{
          title: "Terms of Service",
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: "Subscription" })}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: "Edit Profile",
        }}
      />
      <Stack.Screen
        name="StyleExplorer"
        component={StyleExplorerScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: "Style Theme" })}
      />
      <Stack.Screen
        name="LogoPreview"
        component={LogoPreviewScreen}
        options={{
          title: "Logo Preview",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="OnboardingQuiz"
        component={OnboardingQuizScreen}
        options={{
          title: "Style Quiz",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: "Chat with Julia" })}
      />
      <Stack.Screen
        name="FeatureSuggestions"
        component={FeatureSuggestionsScreen}
        options={{
          title: "Feature Suggestions",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          title: "Help & FAQ",
        }}
      />
      <Stack.Screen
        name="Partner"
        component={PartnerScreen}
        options={{
          title: "Partner With Us",
        }}
      />
      <Stack.Screen
        name="CancelSubscription"
        component={CancelSubscriptionScreen}
        options={{
          title: "Cancel Subscription",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="BodyMeasurements"
        component={BodyMeasurementsScreen}
        options={{
          title: "Body Measurements",
        }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: "Send Feedback" })}
      />
      <Stack.Screen
        name="CommunityVoting"
        component={CommunityVotingScreen}
        options={{
          title: "Community Vote",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DFYComparison"
        component={DFYComparisonScreen}
        options={{
          title: "Done-For-You Style",
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
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="AnalyticsDashboard"
        component={AnalyticsDashboard}
        options={{
          title: "Analytics",
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
