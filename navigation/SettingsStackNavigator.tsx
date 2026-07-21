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
import DFYTravelPlanScreen from "@/screens/DFYTravelPlanScreen";
import DFYUploadScreen from "@/screens/DFYUploadScreen";
import AnalyticsDashboard from "@/screens/AnalyticsDashboard";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";
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
  DFYTravelPlan: undefined;
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
  const { t } = useTranslations();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Settings"
        options={{
          title: t('settings.title'),
          headerShown: false,
        }}
      >
        {(props) => <SettingsScreen {...props} onOpenPortal={onOpenPortal} />}
      </Stack.Screen>
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          title: t('privacy.screenTitle'),
        }}
      />
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{
          title: t('terms.screenTitle'),
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: t('subscription.screenTitle') })}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: t('settings.editProfile'),
        }}
      />
      <Stack.Screen
        name="StyleExplorer"
        component={StyleExplorerScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: t('settings.styleTheme') })}
      />
      <Stack.Screen
        name="LogoPreview"
        component={LogoPreviewScreen}
        options={{
          title: t('common.logoPreview'),
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="OnboardingQuiz"
        component={OnboardingQuizScreen}
        options={{
          title: t('quiz.title'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: t('support.screenTitle') || t('settings.chatWithJulia') || 'Ask Julia' })}
      />
      <Stack.Screen
        name="FeatureSuggestions"
        component={FeatureSuggestionsScreen}
        options={{
          title: t('settings.aiFeatureLab'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          title: t('help.screenTitle'),
        }}
      />
      <Stack.Screen
        name="Partner"
        component={PartnerScreen}
        options={{
          title: t('settings.partnerWithUs'),
        }}
      />
      <Stack.Screen
        name="CancelSubscription"
        component={CancelSubscriptionScreen}
        options={{
          title: t('subscription.cancelSubscription'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="BodyMeasurements"
        component={BodyMeasurementsScreen}
        options={{
          title: t('settings.bodyMeasurements'),
        }}
      />
      <Stack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('feedback.screenTitle'),
        })}
      />
      <Stack.Screen
        name="CommunityVoting"
        component={CommunityVotingScreen}
        options={{
          title: t('navTitles.communityVote'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DFYComparison"
        component={DFYComparisonScreen}
        options={{
          title: t('navTitles.doneForYouStyle'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DFYStart"
        component={DFYStartScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('dfy.start.headerDefault') || 'Done-For-You Setup',
        })}
      />
      <Stack.Screen
        name="DFYUpload"
        component={DFYUploadScreen}
        options={{
          title: t('navTitles.uploadWardrobe'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYTravelPlan"
        component={DFYTravelPlanScreen}
        options={{
          title: t('dfy.travel.title') || 'Plan Your Trip',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYStylePlan"
        component={DFYStylePlanScreen}
        options={{
          title: t('navTitles.yourStylePlan'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="AnalyticsDashboard"
        component={AnalyticsDashboard}
        options={{
          title: t('navTitles.analytics'),
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
