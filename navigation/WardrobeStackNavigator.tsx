import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WardrobeScreen from "@/screens/WardrobeScreen";
import AddWardrobeItemScreen from "@/screens/AddWardrobeItemScreen";
import BulkWardrobeUploadScreen from "@/screens/BulkWardrobeUploadScreen";
import OutfitCalendarScreen from "@/screens/OutfitCalendarScreen";
import OutfitBuilderScreen from "@/screens/OutfitBuilderScreen";
import WardrobeDigitalTwinScreen from "@/screens/WardrobeDigitalTwinScreen";
import CostPerWearScreen from "@/screens/CostPerWearScreen";
import StyleDNAScreen from "@/screens/StyleDNAScreen";
import VirtualTryOnScreen from "@/screens/VirtualTryOnScreen";
import ColorAnalysisScreen from "@/screens/ColorAnalysisScreen";
import BodyScannerScreen from "@/screens/BodyScannerScreen";
import WeatherOutfitScreen from "@/screens/WeatherOutfitScreen";
import DFYLookbookScreen from "@/screens/DFYLookbookScreen";
import DFYModularWardrobeScreen from "@/screens/DFYModularWardrobeScreen";
import DFYCalendarScreen from "@/screens/DFYCalendarScreen";
import { useTheme } from "@/hooks/useTheme";
import { useTranslations } from "@/contexts/TranslationContext";
import { getCommonScreenOptions } from "@/navigation/screenOptions";
import { DFYTier } from "@/services/DFYService";

export type WardrobeStackParamList = {
  Wardrobe: undefined;
  AddWardrobeItem: undefined;
  BulkWardrobeUpload: undefined;
  OutfitCalendar: undefined;
  OutfitBuilder: undefined;
  WardrobeDigitalTwin: undefined;
  CostPerWear: undefined;
  StyleDNA: undefined;
  VirtualTryOn: { garmentImageUrl?: string; garmentDescription?: string } | undefined;
  ColorAnalysis: undefined;
  BodyScanner: undefined;
  WeatherOutfit: undefined;
  DFYLookbook: { packageId?: string } | undefined;
  DFYModularWardrobe: { packageId?: string } | undefined;
  DFYCalendar: { tier: DFYTier; packageId?: string };
};

const Stack = createNativeStackNavigator<WardrobeStackParamList>();

export default function WardrobeStackNavigator() {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Wardrobe"
        component={WardrobeScreen}
        options={{
          title: t('navTitles.myWardrobe') || t('wardrobe.myWardrobe') || "My Wardrobe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddWardrobeItem"
        component={AddWardrobeItemScreen}
        options={{
          title: t('navTitles.addItem') || t('wardrobe.addItem') || "Add Item",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="BulkWardrobeUpload"
        component={BulkWardrobeUploadScreen}
        options={{
          title: t('navTitles.quickAddItems') || t('wardrobe.bulkUpload') || "Quick Add Items",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="OutfitCalendar"
        component={OutfitCalendarScreen}
        options={{
          title: t('navTitles.outfitCalendar') || t('wardrobe.outfitCalendar') || "Outfit Calendar",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="OutfitBuilder"
        component={OutfitBuilderScreen}
        options={{
          title: t('navTitles.outfitBuilder') || "Outfit Builder",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WardrobeDigitalTwin"
        component={WardrobeDigitalTwinScreen}
        options={{
          title: t('navTitles.wardrobeTwin') || "Wardrobe Twin",
        }}
      />
      <Stack.Screen
        name="CostPerWear"
        component={CostPerWearScreen}
        options={{
          title: t('navTitles.costPerWear') || "Cost-per-Wear",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StyleDNA"
        component={StyleDNAScreen}
        options={{
          title: t('navTitles.styleDna') || t('profile.styleDna') || "Style DNA",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="VirtualTryOn"
        component={VirtualTryOnScreen}
        options={{
          title: t('navTitles.virtualTryOn') || "Virtual Try-On",
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="ColorAnalysis"
        component={ColorAnalysisScreen}
        options={{
          title: t('navTitles.colorAnalysis') || t('profile.colorAnalysis') || "Color Analysis",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BodyScanner"
        component={BodyScannerScreen}
        options={{
          title: t('navTitles.bodyScanner') || t('bodyScan.title') || "Body Scanner",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WeatherOutfit"
        component={WeatherOutfitScreen}
        options={{
          title: t('navTitles.weatherOutfits') || t('stylistHub.weatherOutfits') || "Weather Outfits",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYLookbook"
        component={DFYLookbookScreen}
        options={{
          title: t('navTitles.myLookbook') || t('wardrobe.myLookbook') || "My Lookbook",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYModularWardrobe"
        component={DFYModularWardrobeScreen}
        options={{
          title: t('navTitles.modularWardrobe') || t('wardrobe.modularWardrobe') || "Modular Wardrobe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYCalendar"
        component={DFYCalendarScreen}
        options={{
          title: t('navTitles.dfyCalendar') || "DFY Calendar",
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
