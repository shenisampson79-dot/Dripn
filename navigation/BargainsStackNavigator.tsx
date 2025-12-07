import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BargainsScreen from "@/screens/BargainsScreen";
import WishlistScreen from "@/screens/WishlistScreen";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { useTheme } from "@/hooks/useTheme";

export type BargainsStackParamList = {
  Bargains: undefined;
  Wishlist: undefined;
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
      <Stack.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{
          title: "My Wishlist",
        }}
      />
    </Stack.Navigator>
  );
}
