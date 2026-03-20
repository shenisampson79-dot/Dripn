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
  DFYLookbook: undefined;
  DFYModularWardrobe: undefined;
  DFYCalendar: { tier: DFYTier };
};

const Stack = createNativeStackNavigator<WardrobeStackParamList>();

export default function WardrobeStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen
        name="Wardrobe"
        component={WardrobeScreen}
        options={{
          title: "My Wardrobe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddWardrobeItem"
        component={AddWardrobeItemScreen}
        options={{
          title: "Add Item",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="BulkWardrobeUpload"
        component={BulkWardrobeUploadScreen}
        options={{
          title: "Quick Add Items",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="OutfitCalendar"
        component={OutfitCalendarScreen}
        options={{
          title: "Outfit Calendar",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="OutfitBuilder"
        component={OutfitBuilderScreen}
        options={{
          title: "Outfit Builder",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WardrobeDigitalTwin"
        component={WardrobeDigitalTwinScreen}
        options={{
          title: "Wardrobe Twin",
        }}
      />
      <Stack.Screen
        name="CostPerWear"
        component={CostPerWearScreen}
        options={{
          title: "Cost-per-Wear",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StyleDNA"
        component={StyleDNAScreen}
        options={{
          title: "Style DNA",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="VirtualTryOn"
        component={VirtualTryOnScreen}
        options={{
          title: "Virtual Try-On",
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="ColorAnalysis"
        component={ColorAnalysisScreen}
        options={{
          title: "Color Analysis",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="BodyScanner"
        component={BodyScannerScreen}
        options={{
          title: "Body Scanner",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="WeatherOutfit"
        component={WeatherOutfitScreen}
        options={{
          title: "Weather Outfits",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYLookbook"
        component={DFYLookbookScreen}
        options={{
          title: "My Lookbook",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYModularWardrobe"
        component={DFYModularWardrobeScreen}
        options={{
          title: "Modular Wardrobe",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="DFYCalendar"
        component={DFYCalendarScreen}
        options={{
          title: "DFY Calendar",
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
