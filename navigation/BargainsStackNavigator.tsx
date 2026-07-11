import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BargainsScreen from "@/screens/BargainsScreen";
import WishlistScreen from "@/screens/WishlistScreen";
import SustainabilityScreen from "@/screens/SustainabilityScreen";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";

export type BargainsStackParamList = {
  Bargains: undefined;
  Sustainability: undefined;
};

const Stack = createNativeStackNavigator<BargainsStackParamList>();

export default function BargainsStackNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Bargains"
        component={BargainsScreen}
        options={{
          title: t('navTitles.bargains') || "Bargains",
        }}
      />
      <Stack.Screen
        name="Sustainability"
        component={SustainabilityScreen}
        options={{
          title: t('navTitles.sustainability') || "Sustainability",
        }}
      />
    </Stack.Navigator>
  );
}
