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
import DFYStylePlanScreen from "@/screens/DFYStylePlanScreen";
import AnalyticsDashboard from "@/screens/AnalyticsDashboard";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
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
  DFYComparison: { selectedTier?: string; autoCheckout?: boolean };
  DFYStylePlan: { tier?: string };
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
        options={{
          title: "Subscription",
          headerShown: false,
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
        name="StyleExplorer"
        component={StyleExplorerScreen}
        options={{
          title: "Explore Styles",
          headerShown: false,
        }}
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
        options={{
          title: "Support",
          headerShown: false,
        }}
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
        options={{
          title: "Send Feedback",
          headerShown: false,
        }}
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
