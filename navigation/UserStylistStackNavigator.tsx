import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AIStylistScreen from "@/screens/AIStylistScreen";
import StyleShuffleScreen from "@/screens/StyleShuffleScreen";
import VisualSearchScreen from "@/screens/VisualSearchScreen";
import StylistHubScreen from "@/screens/StylistHubScreen";
import DreamOutfitGeneratorScreen from "@/screens/DreamOutfitGeneratorScreen";
import VoiceConversationScreen from "@/screens/VoiceConversationScreen";
import SocialStyleSyncScreen from "@/screens/SocialStyleSyncScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type UserStylistStackParamList = {
  StylistHub: undefined;
  AIStylist: undefined;
  StyleShuffle: undefined;
  VisualSearch: undefined;
  DreamOutfitGenerator: undefined;
  VoiceConversation: undefined;
  SocialStyleSync: undefined;
};

const Stack = createNativeStackNavigator<UserStylistStackParamList>();

export default function UserStylistStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="StylistHub"
        component={StylistHubScreen}
        options={{
          title: "Stylist",
        }}
      />
      <Stack.Screen
        name="AIStylist"
        component={AIStylistScreen}
        options={{ headerTitle: "Your Personal Stylist" }}
      />
      <Stack.Screen
        name="StyleShuffle"
        component={StyleShuffleScreen}
        options={{ headerTitle: "Style Shuffle" }}
      />
      <Stack.Screen
        name="VisualSearch"
        component={VisualSearchScreen}
        options={{ headerTitle: "Visual Search" }}
      />
      <Stack.Screen
        name="DreamOutfitGenerator"
        component={DreamOutfitGeneratorScreen}
        options={{ headerTitle: "Dream Outfit Generator" }}
      />
      <Stack.Screen
        name="VoiceConversation"
        component={VoiceConversationScreen}
        options={{ headerTitle: "Voice Chat" }}
      />
      <Stack.Screen
        name="SocialStyleSync"
        component={SocialStyleSyncScreen}
        options={{ headerTitle: "Social Style Sync" }}
      />
    </Stack.Navigator>
  );
}
