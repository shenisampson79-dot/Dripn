import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AIStylistScreen from "@/screens/AIStylistScreen";
import StyleShuffleScreen from "@/screens/StyleShuffleScreen";
import VisualSearchScreen from "@/screens/VisualSearchScreen";
import StylistHubScreen from "@/screens/StylistHubScreen";
import DreamOutfitGeneratorScreen from "@/screens/DreamOutfitGeneratorScreen";
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
import { useTranslations } from "@/contexts/TranslationContext";
import { getCommonScreenOptions, getSettingsChildScreenOptions } from "@/navigation/screenOptions";

export type UserStylistStackParamList = {
  StylistHub: undefined;
  AIStylist: { initialPrompt?: string } | undefined;
  StyleShuffle: undefined;
  VisualSearch: undefined;
  DreamOutfitGenerator: undefined;
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
  FashionBlog: { highlightArticle?: string } | undefined;
  StyleRules: undefined;
  ColourInsights: undefined;
  SocialStyleSync: undefined;
};

const Stack = createNativeStackNavigator<UserStylistStackParamList>();

export default function UserStylistStackNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark, transparent: false })}>
      <Stack.Screen
        name="StylistHub"
        component={StylistHubScreen}
        options={{
          title: t('nav.stylist'),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AIStylist"
        component={AIStylistScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          // Must stay transparent: AIStylistScreen pads its content by headerHeight,
          // so an opaque header doubles the gap above the chat.
          transparent: true,
          title: t('navTitles.stylistChat'),
        })}
      />
      <Stack.Screen
        name="StyleShuffle"
        component={StyleShuffleScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('navTitles.styleShuffle'),
        })}
      />
      <Stack.Screen
        name="VisualSearch"
        component={VisualSearchScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('navTitles.visualSearch'),
        })}
      />
      <Stack.Screen
        name="DreamOutfitGenerator"
        component={DreamOutfitGeneratorScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('navTitles.dreamOutfitGenerator'),
        })}
      />
      <Stack.Screen
        name="Wardrobe"
        component={WardrobeScreen}
        options={{ headerTitle: t('wardrobe.myWardrobe'), headerShown: false }}
      />
      <Stack.Screen
        name="AddWardrobeItem"
        component={AddWardrobeItemScreen}
        options={{ headerTitle: t('wardrobe.addItem'), headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="BulkWardrobeUpload"
        component={BulkWardrobeUploadScreen}
        options={{ headerTitle: t('navTitles.quickAddItems'), headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="OutfitCalendar"
        component={OutfitCalendarScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('wardrobe.outfitCalendar') || t('stylistHub.outfitCalendar'),
        })}
      />
      <Stack.Screen
        name="WeatherOutfit"
        component={WeatherOutfitScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('stylistHub.weatherOutfits'),
        })}
      />
      <Stack.Screen
        name="CostPerWear"
        component={CostPerWearScreen}
        options={{ headerTitle: t('navTitles.costPerWear'), headerShown: false }}
      />
      <Stack.Screen
        name="StyleDNA"
        component={StyleDNAScreen}
        options={{ headerTitle: t('profile.styleDna'), headerShown: false }}
      />
      <Stack.Screen
        name="VirtualTryOn"
        component={VirtualTryOnScreen}
        options={{ headerTitle: t('navTitles.virtualTryOn'), headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="ColorAnalysis"
        component={ColorAnalysisScreen}
        options={{ headerTitle: t('profile.colorAnalysis'), headerShown: false }}
      />
      <Stack.Screen
        name="BodyScanner"
        component={BodyScannerScreen}
        options={{ headerTitle: t('bodyScan.title'), headerShown: false }}
      />
      <Stack.Screen
        name="FashionBlog"
        component={FashionBlogScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('navTitles.fashionBlog') || t('blog.title') || t('navTitles.blog'),
        })}
      />
      <Stack.Screen
        name="StyleRules"
        component={StyleRulesScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('navTitles.styleRules') || t('stylistHub.styleRules'),
        })}
      />
      <Stack.Screen
        name="ColourInsights"
        component={ColourInsightsScreen}
        options={getSettingsChildScreenOptions({
          theme,
          isDark,
          transparent: false,
          title: t('navTitles.colourInsights') || t('stylistHub.colourInsights'),
        })}
      />
    </Stack.Navigator>
  );
}
