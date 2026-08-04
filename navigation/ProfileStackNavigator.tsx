import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import VIPMembersScreen from "@/screens/VIPMembersScreen";
import StyleExplorerScreen from "@/screens/StyleExplorerScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import LogoPreviewScreen from "@/screens/LogoPreviewScreen";
import OnboardingQuizScreen from "@/screens/OnboardingQuizScreen";
import WardrobeScreen from "@/screens/WardrobeScreen";
import AddWardrobeItemScreen from "@/screens/AddWardrobeItemScreen";
import BulkWardrobeUploadScreen from "@/screens/BulkWardrobeUploadScreen";
import ScanWardrobeScreen from "@/screens/ScanWardrobeScreen";
import LiveStylistScreen from "@/screens/LiveStylistScreen";
import OutfitCalendarScreen from "@/screens/OutfitCalendarScreen";
import SupportScreen from "@/screens/SupportScreen";
import FeatureSuggestionsScreen from "@/screens/FeatureSuggestionsScreen";
import FashionTherapyScreen from "@/screens/FashionTherapyScreen";
import WeatherOutfitScreen from "@/screens/WeatherOutfitScreen";
import CostPerWearScreen from "@/screens/CostPerWearScreen";
import StyleDNAScreen from "@/screens/StyleDNAScreen";
import VirtualTryOnScreen from "@/screens/VirtualTryOnScreen";
import ColorAnalysisScreen from "@/screens/ColorAnalysisScreen";
import BodyScannerScreen from "@/screens/BodyScannerScreen";
import PartnerScreen from "@/screens/PartnerScreen";
import HelpScreen from "@/screens/HelpScreen";
import ColdOpenScreen from "@/screens/ColdOpenScreen";
import DFYComparisonScreen from "@/screens/DFYComparisonScreen";
import DFYStartScreen from "@/screens/DFYStartScreen";
import DFYStylePlanScreen from "@/screens/DFYStylePlanScreen";
import DFYTravelPlanScreen from "@/screens/DFYTravelPlanScreen";
import DFYExpiryScreen from "@/screens/DFYExpiryScreen";
import DFYUploadScreen from "@/screens/DFYUploadScreen";
import AskStylistScreen from "@/screens/AskStylistScreen";
import SanityCheckScreen from "@/screens/SanityCheckScreen";
import type { DecisionType } from "@/services/DecisionService";
import CancelSubscriptionScreen from "@/screens/CancelSubscriptionScreen";
import SubscriptionSuccessScreen from "@/screens/SubscriptionSuccessScreen";
import BodyMeasurementsScreen from "@/screens/BodyMeasurementsScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import AnalyticsDashboard from "@/screens/AnalyticsDashboard";
import FeedbackScreen from "@/screens/FeedbackScreen";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";
import { getCommonScreenOptions, getSettingsChildScreenOptions } from "@/navigation/screenOptions";
import type { PortalMode } from "@/App";
import type { SubscriptionTier } from "@/contexts/AuthContext";

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Subscription: {
    highlightPlan?: SubscriptionTier;
    scrollToDFY?: boolean;
    scrollToAiTopUp?: boolean;
    offer50?: boolean;
    pause?: boolean;
    winbackBanner?: string;
  } | undefined;
  SubscriptionSuccess: { sessionId?: string } | undefined;
  EditProfile: undefined;
  VIPMembers: undefined;
  StyleExplorer: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  LogoPreview: undefined;
  OnboardingQuiz: undefined;
  Wardrobe: undefined;
  AddWardrobeItem: undefined;
  ScanWardrobe: undefined;
  LiveStylist: { occasionType?: string } | undefined;
  BulkWardrobeUpload: undefined;
  OutfitCalendar: undefined;
  Support: undefined;
  FeatureSuggestions: undefined;
  FashionTherapy: undefined;
  WeatherOutfit: undefined;
  CostPerWear: undefined;
  StyleDNA: undefined;
  VirtualTryOn: undefined;
  ColorAnalysis: undefined;
  BodyScanner: undefined;
  Partner: undefined;
  Help: undefined;
  ColdOpen: undefined;
  DFYComparison: { selectedTier?: 'lite' | 'core'; autoCheckout?: boolean; paidAddOn?: boolean } | undefined;
  DFYStart: undefined;
  DFYTravelPlan: { mode?: 'create' | 'edit'; tripId?: string } | undefined;
  DFYStylePlan: { initialDay?: number } | undefined;
  DFYExpiry: undefined;
  DFYUpload: { type: "outfit" | "core" };
  AskStylist: { initialDecisionType?: DecisionType } | undefined;
  SanityCheck: undefined;
  CancelSubscription: undefined;
  BodyMeasurements: undefined;
  AdminDashboard: undefined;
  AnalyticsDashboard: undefined;
  Feedback: undefined;
  CommunityVoting: { session?: unknown };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

interface ProfileStackNavigatorProps {
  onOpenPortal?: (mode: PortalMode) => void;
}

export default function ProfileStackNavigator({ onOpenPortal }: ProfileStackNavigatorProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Profile"
        options={{
          title: t('profile.profile'),
          headerShown: false,
        }}
      >
        {(props) => <ProfileScreen {...props} onOpenPortal={onOpenPortal} />}
      </Stack.Screen>
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
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          ...getSettingsChildScreenOptions({ theme, isDark, title: t('subscription.screenTitle') }),
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="SubscriptionSuccess"
        component={SubscriptionSuccessScreen}
        options={{
          title: t('subscription.success.screenTitle'),
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          title: t('settings.editProfile'),
        }}
      />
      <Stack.Screen
        name="VIPMembers"
        component={VIPMembersScreen}
        options={{
          title: t('navTitles.vipMembers'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StyleExplorer"
        component={StyleExplorerScreen}
        options={getSettingsChildScreenOptions({ theme, isDark, title: t('settings.styleTheme') })}
      />
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
        name="Wardrobe"
        component={WardrobeScreen}
        options={{
          title: t('wardrobe.myWardrobe'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddWardrobeItem"
        component={AddWardrobeItemScreen}
        options={{
          title: t('wardrobe.addItem'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="ScanWardrobe"
        component={ScanWardrobeScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('wardrobe.getOutfitsNow') || 'Get outfits now',
        })}
      />
      <Stack.Screen
        name="LiveStylist"
        component={LiveStylistScreen}
        options={{
          title: "Live Stylist",
          headerShown: false,
          presentation: "card",
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen
        name="BulkWardrobeUpload"
        component={BulkWardrobeUploadScreen}
        options={{
          title: t('wardrobe.bulkUpload'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="OutfitCalendar"
        component={OutfitCalendarScreen}
        options={{
          title: t('wardrobe.outfitCalendar'),
          headerShown: false,
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
        name="FashionTherapy"
        component={FashionTherapyScreen}
        options={{
          title: t('navTitles.fashionTherapy'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WeatherOutfit"
        component={WeatherOutfitScreen}
        options={{
          title: t('stylistHub.weatherOutfits'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CostPerWear"
        component={CostPerWearScreen}
        options={{
          title: t('navTitles.costPerWear'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StyleDNA"
        component={StyleDNAScreen}
        options={{
          title: t('profile.styleDna'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="VirtualTryOn"
        component={VirtualTryOnScreen}
        options={{
          title: t('navTitles.virtualTryOn'),
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="ColorAnalysis"
        component={ColorAnalysisScreen}
        options={{
          title: t('profile.colorAnalysis'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BodyScanner"
        component={BodyScannerScreen}
        options={{
          title: t('bodyScan.title'),
          headerShown: false,
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
        name="Help"
        component={HelpScreen}
        options={{
          title: t('help.screenTitle'),
        }}
      />
      <Stack.Screen
        name="ColdOpen"
        component={ColdOpenScreen}
        options={{
          title: t('onboarding.getStarted'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="DFYComparison"
        component={DFYComparisonScreen}
        options={{
          title: t('dfy.comparison.titleDefault'),
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
        }}
      />
      <Stack.Screen
        name="DFYExpiry"
        component={DFYExpiryScreen}
        options={{
          title: t('navTitles.accessStatus'),
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="AskStylist"
        component={AskStylistScreen}
        options={{
          title: t('aiStylist.askStylistTitle'),
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="SanityCheck"
        component={SanityCheckScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          title: t('navTitles.sanityCheck') || t('stylistHub.quickSanityCheck'),
        })}
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
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          title: t('profile.adminDashboard'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AnalyticsDashboard"
        component={AnalyticsDashboard}
        options={{
          title: t('common.retentionAnalytics'),
          headerShown: false,
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
    </Stack.Navigator>
  );
}
