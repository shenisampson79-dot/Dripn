import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WelcomeScreen from "@/screens/WelcomeScreen";
import AuthScreen from "@/screens/AuthScreen";
import OnboardingScreen from "@/screens/OnboardingScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type AuthStackParamList = {
  Welcome: undefined;
  Auth: { mode: 'login' | 'signup' };
  Onboarding: undefined;
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
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}
