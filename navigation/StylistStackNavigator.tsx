import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import StylistLoginScreen from "@/screens/StylistLoginScreen";
import StylistDashboardScreen from "@/screens/StylistDashboardScreen";
import SessionDetailScreen from "@/screens/SessionDetailScreen";
import AdminLoginScreen from "@/screens/AdminLoginScreen";
import AdminStylistScreen from "@/screens/AdminStylistScreen";
import { useStylistAuth } from "@/contexts/StylistAuthContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { useTheme } from "@/hooks/useTheme";

export type StylistStackParamList = {
  StylistLogin: undefined;
  StylistDashboard: undefined;
  SessionDetail: { sessionId: string };
  AdminLogin: undefined;
  AdminDashboard: undefined;
};

const Stack = createNativeStackNavigator<StylistStackParamList>();

type StylistStackNavigatorProps = {
  mode: 'stylist' | 'admin';
  onExit: () => void;
};

export default function StylistStackNavigator({ mode, onExit }: StylistStackNavigatorProps) {
  const { theme, isDark } = useTheme();
  const { isAuthenticated: isStylistAuth, logout: stylistLogout } = useStylistAuth();
  const { isAuthenticated: isAdminAuth, logout: adminLogout } = useAdminAuth();

  const commonOptions = getCommonScreenOptions({ theme, isDark });

  const handleStylistLogout = async () => {
    await stylistLogout();
    onExit();
  };

  const handleAdminLogout = async () => {
    await adminLogout();
    onExit();
  };

  if (mode === 'admin') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationIndependentTree>
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                ...commonOptions,
                headerShown: false,
              }}
            >
              {isAdminAuth ? (
                <Stack.Screen
                  name="AdminDashboard"
                >
                  {(props) => <AdminStylistScreen {...props} onExit={onExit} onLogout={handleAdminLogout} />}
                </Stack.Screen>
              ) : (
                <Stack.Screen
                  name="AdminLogin"
                >
                  {(props) => <AdminLoginScreen {...props} onExit={onExit} />}
                </Stack.Screen>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </NavigationIndependentTree>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationIndependentTree>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              ...commonOptions,
              headerShown: false,
            }}
          >
            {isStylistAuth ? (
              <>
                <Stack.Screen
                  name="StylistDashboard"
                >
                  {(props) => <StylistDashboardScreen {...props} onExit={onExit} onLogout={handleStylistLogout} />}
                </Stack.Screen>
                <Stack.Screen
                  name="SessionDetail"
                >
                  {(props) => <SessionDetailScreen {...props} onExit={onExit} />}
                </Stack.Screen>
              </>
            ) : (
              <Stack.Screen
                name="StylistLogin"
              >
                {(props) => <StylistLoginScreen {...props} onExit={onExit} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </NavigationIndependentTree>
    </GestureHandlerRootView>
  );
}
