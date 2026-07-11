import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import EventsScreen from "@/screens/EventsScreen";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";

export type EventsStackParamList = {
  Events: undefined;
};

const Stack = createNativeStackNavigator<EventsStackParamList>();

export default function EventsStackNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  return (
    <Stack.Navigator
      screenOptions={{
        ...getCommonScreenOptions({ theme, isDark }),
      }}
    >
      <Stack.Screen
        name="Events"
        component={EventsScreen}
        options={{
          title: t('navTitles.events') || "Events",
        }}
      />
    </Stack.Navigator>
  );
}
