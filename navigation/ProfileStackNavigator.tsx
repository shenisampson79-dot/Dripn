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
import DFYStylePlanScreen from "@/screens/DFYStylePlanScreen";
import DFYExpiryScreen from "@/screens/DFYExpiryScreen";
import AskStylistScreen from "@/screens/AskStylistScreen";
import CancelSubscriptionScreen from "@/screens/CancelSubscriptionScreen";
import SubscriptionSuccessScreen from "@/screens/SubscriptionSuccessScreen";
import BodyMeasurementsScreen from "@/screens/BodyMeasurementsScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import AnalyticsDashboard from "@/screens/AnalyticsDashboard";
import FeedbackScreen from "@/screens/FeedbackScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import type { PortalMode } from "@/App";
import type { SubscriptionTier } from "@/contexts/AuthContext";

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
  Subscription: {
    highlightPlan?: SubscriptionTier;
    scrollToDFY?: boolean;
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
  DFYComparison: undefined;
  DFYStylePlan: undefined;
  DFYExpiry: undefined;
  AskStylist: undefined;
  CancelSubscription: undefined;
  BodyMeasurements: undefined;
  AdminDashboard: undefined;
  AnalyticsDashboard: undefined;
  Feedback: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

interface ProfileStackNavigatorProps {
  onOpenPortal?: (mode: PortalMode) => void;
}

export default function ProfileStackNavigator({ onOpenPortal }: ProfileStackNavigatorProps) {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Profile"
        options={{
          title: "Profile",
          headerShown: false,
        }}
      >
        {(props) => <ProfileScreen {...props} onOpenPortal={onOpenPortal} />}
      </Stack.Screen>
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
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          title: "Subscription",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="SubscriptionSuccess"
        component={SubscriptionSuccessScreen}
        options={{
          title: "Welcome",
          headerShown: false,
          presentation: "fullScreenModal",
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
        name="VIPMembers"
        component={VIPMembersScreen}
        options={{
          title: "VIP Members",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StyleExplorer"
        component={StyleExplorerScreen}
        options={{
          title: "Explore Styles",
          headerShown: false,
          presentation: "modal",
        }}
      />
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
        name="Wardrobe"
        component={WardrobeScreen}
        options={{
          title: "My Wardrobe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddWardrobeItem"
        component={AddWardrobeItemScreen}
        options={{
          title: "Add Item",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="BulkWardrobeUpload"
        component={BulkWardrobeUploadScreen}
        options={{
          title: "Quick Add Items",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="OutfitCalendar"
        component={OutfitCalendarScreen}
        options={{
          title: "Outfit Calendar",
          headerShown: false,
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
        name="FashionTherapy"
        component={FashionTherapyScreen}
        options={{
          title: "Fashion Therapy",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WeatherOutfit"
        component={WeatherOutfitScreen}
        options={{
          title: "Weather Outfits",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CostPerWear"
        component={CostPerWearScreen}
        options={{
          title: "Cost-per-Wear",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StyleDNA"
        component={StyleDNAScreen}
        options={{
          title: "Style DNA",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="VirtualTryOn"
        component={VirtualTryOnScreen}
        options={{
          title: "Virtual Try-On",
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="ColorAnalysis"
        component={ColorAnalysisScreen}
        options={{
          title: "Color Analysis",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BodyScanner"
        component={BodyScannerScreen}
        options={{
          title: "Body Scanner",
          headerShown: false,
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
        name="Help"
        component={HelpScreen}
        options={{
          title: "Help & FAQ",
        }}
      />
      <Stack.Screen
        name="ColdOpen"
        component={ColdOpenScreen}
        options={{
          title: "Get Started",
          headerShown: false,
          presentation: "modal",
        }}
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
        name="DFYStylePlan"
        component={DFYStylePlanScreen}
        options={{
          title: "Your Style Plan",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYExpiry"
        component={DFYExpiryScreen}
        options={{
          title: "Access Status",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="AskStylist"
        component={AskStylistScreen}
        options={{
          title: "Ask the Stylist",
          headerShown: false,
          presentation: "fullScreenModal",
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
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          title: "Admin Dashboard",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AnalyticsDashboard"
        component={AnalyticsDashboard}
        options={{
          title: "Retention Analytics",
          headerShown: false,
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
    </Stack.Navigator>
  );
}
