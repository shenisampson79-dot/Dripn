import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BargainsScreen from "@/screens/BargainsScreen";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { useTheme } from "@/hooks/useTheme";

export type BargainsStackParamList = {
  Bargains: undefined;
};

const Stack = createNativeStackNavigator<BargainsStackParamList>();

export default function BargainsStackNavigator() {
  const { theme, isDark } = useTheme();

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
          title: "Bargains",
        }}
      />
    </Stack.Navigator>
  );
}
