import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "@/screens/WelcomeScreen";
import TrustOnboardingScreen from "@/screens/TrustOnboardingScreen";
import OnboardingEntryScreen from "@/screens/OnboardingEntryScreen";
import DecideForMeScreen from "@/screens/DecideForMeScreen";
import StyleMeProperlyScreen from "@/screens/StyleMeProperlyScreen";
import SoftSignupGateScreen from "@/screens/SoftSignupGateScreen";
import AuthScreen from "@/screens/AuthScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import SuggestedFollowsScreen from "@/screens/SuggestedFollowsScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type AuthStackParamList = {
  Welcome: undefined;
  TrustOnboarding: undefined;
  OnboardingEntry: undefined;
  DecideForMe: undefined;
  StyleMeProperly: undefined;
  SoftSignupGate: { fromPath: string };
  Auth: { mode: 'login' | 'signup' };
  Onboarding: undefined;
  SuggestedFollows: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

type AuthStackNavigatorProps = {
  initialRouteName?: keyof AuthStackParamList;
};

export default function AuthStackNavigator({ initialRouteName = "Welcome" }: AuthStackNavigatorProps) {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator 
      initialRouteName={initialRouteName}
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark, transparent: false }),
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="TrustOnboarding" component={TrustOnboardingScreen} />
      <Stack.Screen name="OnboardingEntry" component={OnboardingEntryScreen} />
      <Stack.Screen name="DecideForMe" component={DecideForMeScreen} />
      <Stack.Screen name="StyleMeProperly" component={StyleMeProperlyScreen} />
      <Stack.Screen name="SoftSignupGate" component={SoftSignupGateScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="SuggestedFollows" component={SuggestedFollowsScreen} />
    </Stack.Navigator>
  );
}
