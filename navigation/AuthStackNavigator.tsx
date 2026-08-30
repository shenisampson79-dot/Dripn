import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "@/screens/WelcomeScreen";
import TrustOnboardingScreen from "@/screens/TrustOnboardingScreen";
import OnboardingProfileScreen from "@/screens/OnboardingProfileScreen";
import PreSignupStyleQuizScreen from "@/screens/PreSignupStyleQuizScreen";
import OnboardingEntryScreen from "@/screens/OnboardingEntryScreen";
import DecideForMeScreen from "@/screens/DecideForMeScreen";
import StyleMeProperlyScreen from "@/screens/StyleMeProperlyScreen";
import SoftSignupGateScreen from "@/screens/SoftSignupGateScreen";
import UploadInstructionsScreen from "@/screens/UploadInstructionsScreen";
import DFYUploadScreen from "@/screens/DFYUploadScreen";
import ConfirmationScreen from "@/screens/ConfirmationScreen";
import AuthScreen from "@/screens/AuthScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import OnboardingQuizScreen from "@/screens/OnboardingQuizScreen";
import OnboardingStyleQuizScreen from "@/screens/OnboardingStyleQuizScreen";
import StyleQuizOnboardingScreen from "@/screens/StyleQuizOnboardingScreen";
import GuestBrowseScreen from "@/screens/GuestBrowseScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { PasswordResetDeepLinkHandler } from "@/components/PasswordResetDeepLinkHandler";
import { readWebPasswordResetToken } from "@/utils/passwordResetDeepLink";

export type AuthStackParamList = {
  Welcome: undefined;
  TrustOnboarding: undefined;
  OnboardingProfile: undefined;
  PreSignupStyleQuiz: undefined;
  OnboardingEntry: undefined;
  DecideForMe: undefined;
  StyleMeProperly: undefined;
  SoftSignupGate: { fromPath: string };
  UploadInstructions: { type: "outfit" | "core" };
  DFYUpload: { type: "outfit" | "core" };
  Confirmation: { type: "outfit" | "core" };
  Auth: { mode: 'login' | 'signup'; resetSuccessMessage?: string };
  ResetPassword: { token: string };
  Onboarding: undefined;
  OnboardingQuiz: undefined;
  OnboardingStyleQuiz: undefined;
  StyleQuizOnboarding: undefined;
  GuestBrowse: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

type AuthStackNavigatorProps = {
  initialRouteName?: keyof AuthStackParamList;
  initialResetToken?: string;
};

export default function AuthStackNavigator({
  initialRouteName = "Welcome",
  initialResetToken,
}: AuthStackNavigatorProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  const webResetToken = readWebPasswordResetToken();
  const resetToken = initialResetToken || webResetToken;
  const resolvedInitialRoute = resetToken ? "ResetPassword" : initialRouteName;

  return (
    <>
      <PasswordResetDeepLinkHandler />
    <Stack.Navigator 
      initialRouteName={resolvedInitialRoute}
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark, transparent: false }),
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="TrustOnboarding" component={TrustOnboardingScreen} />
      <Stack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
      {/* Kept registered for later reintroduction; simplified Get Styled skips to GuestBrowse */}
      <Stack.Screen name="PreSignupStyleQuiz" component={PreSignupStyleQuizScreen} />
      <Stack.Screen name="OnboardingEntry" component={OnboardingEntryScreen} />
      <Stack.Screen name="DecideForMe" component={DecideForMeScreen} />
      <Stack.Screen name="StyleMeProperly" component={StyleMeProperlyScreen} />
      <Stack.Screen name="SoftSignupGate" component={SoftSignupGateScreen} />
      <Stack.Screen name="UploadInstructions" component={UploadInstructionsScreen} />
      <Stack.Screen name="DFYUpload" component={DFYUploadScreen} />
      <Stack.Screen name="Confirmation" component={ConfirmationScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        initialParams={resetToken ? { token: resetToken } : undefined}
      />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="OnboardingQuiz" component={OnboardingQuizScreen} />
      <Stack.Screen name="OnboardingStyleQuiz" component={OnboardingStyleQuizScreen} />
      <Stack.Screen name="StyleQuizOnboarding" component={StyleQuizOnboardingScreen} />
      <Stack.Screen name="GuestBrowse" component={GuestBrowseScreen} />
      <Stack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{
          headerShown: true,
          title: t('navTitles.termsOfService') || t('terms.screenTitle') || "Terms of Service",
        }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          headerShown: true,
          title: t('navTitles.privacyPolicy') || t('privacy.screenTitle') || "Privacy Policy",
        }}
      />
    </Stack.Navigator>
    </>
  );
}
