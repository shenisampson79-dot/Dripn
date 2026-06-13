import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AIStylistScreen from "@/screens/AIStylistScreen";
import StyleShuffleScreen from "@/screens/StyleShuffleScreen";
import VisualSearchScreen from "@/screens/VisualSearchScreen";
import StylistHubScreen from "@/screens/StylistHubScreen";
import DreamOutfitGeneratorScreen from "@/screens/DreamOutfitGeneratorScreen";
import VoiceConversationScreen from "@/screens/VoiceConversationScreen";
import SocialStyleSyncScreen from "@/screens/SocialStyleSyncScreen";
import WardrobeScreen from "@/screens/WardrobeScreen";
import AddWardrobeItemScreen from "@/screens/AddWardrobeItemScreen";
import BulkWardrobeUploadScreen from "@/screens/BulkWardrobeUploadScreen";
import OutfitCalendarScreen from "@/screens/OutfitCalendarScreen";
import WeatherOutfitScreen from "@/screens/WeatherOutfitScreen";
import CostPerWearScreen from "@/screens/CostPerWearScreen";
import StyleDNAScreen from "@/screens/StyleDNAScreen";
import VirtualTryOnScreen from "@/screens/VirtualTryOnScreen";
import ColorAnalysisScreen from "@/screens/ColorAnalysisScreen";
import BodyScannerScreen from "@/screens/BodyScannerScreen";
import FashionBlogScreen from "@/screens/FashionBlogScreen";
import StyleRulesScreen from "@/screens/StyleRulesScreen";
import WishlistScreen from "@/screens/WishlistScreen";
import ColourInsightsScreen from "@/screens/ColourInsightsScreen";
import { useTheme } from "@/hooks/useTheme";
import { getCommonScreenOptions } from "@/navigation/screenOptions";

export type UserStylistStackParamList = {
  StylistHub: undefined;
  AIStylist: { initialPrompt?: string } | undefined;
  StyleShuffle: undefined;
  VisualSearch: undefined;
  DreamOutfitGenerator: undefined;
  VoiceConversation: undefined;
  Wardrobe: undefined;
  AddWardrobeItem: undefined;
  BulkWardrobeUpload: undefined;
  OutfitCalendar: undefined;
  WeatherOutfit: undefined;
  CostPerWear: undefined;
  StyleDNA: undefined;
  VirtualTryOn: undefined;
  ColorAnalysis: undefined;
  BodyScanner: undefined;
  FashionBlog: undefined;
  StyleRules: undefined;
  ColourInsights: undefined;
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
          headerShown: false,
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
        name="Wardrobe"
        component={WardrobeScreen}
        options={{ headerTitle: "My Wardrobe", headerShown: false }}
      />
      <Stack.Screen
        name="AddWardrobeItem"
        component={AddWardrobeItemScreen}
        options={{ headerTitle: "Add Item", headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="BulkWardrobeUpload"
        component={BulkWardrobeUploadScreen}
        options={{ headerTitle: "Quick Add Items", headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="OutfitCalendar"
        component={OutfitCalendarScreen}
        options={{ headerTitle: "Outfit Calendar", headerShown: false }}
      />
      <Stack.Screen
        name="WeatherOutfit"
        component={WeatherOutfitScreen}
        options={{ headerTitle: "Weather Outfits", headerShown: false }}
      />
      <Stack.Screen
        name="CostPerWear"
        component={CostPerWearScreen}
        options={{ headerTitle: "Cost-per-Wear", headerShown: false }}
      />
      <Stack.Screen
        name="StyleDNA"
        component={StyleDNAScreen}
        options={{ headerTitle: "Style DNA", headerShown: false }}
      />
      <Stack.Screen
        name="VirtualTryOn"
        component={VirtualTryOnScreen}
        options={{ headerTitle: "Virtual Try-On", headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="ColorAnalysis"
        component={ColorAnalysisScreen}
        options={{ headerTitle: "Color Analysis", headerShown: false }}
      />
      <Stack.Screen
        name="BodyScanner"
        component={BodyScannerScreen}
        options={{ headerTitle: "Body Scanner", headerShown: false }}
      />
      <Stack.Screen
        name="FashionBlog"
        component={FashionBlogScreen}
        options={{ headerTitle: "Blog", headerShown: false }}
      />
      <Stack.Screen
        name="StyleRules"
        component={StyleRulesScreen}
        options={{ headerTitle: "Style Rules", headerShown: false }}
      />
      <Stack.Screen
        name="ColourInsights"
        component={ColourInsightsScreen}
        options={{ headerTitle: "Colour Insights" }}
      />
    </Stack.Navigator>
  );
}
