import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WardrobeScreen from "@/screens/WardrobeScreen";
import AddWardrobeItemScreen from "@/screens/AddWardrobeItemScreen";
import QuickAddScreen from "@/screens/QuickAddScreen";
import ImproveRecognitionScreen from "@/screens/ImproveRecognitionScreen";
import BulkWardrobeUploadScreen from "@/screens/BulkWardrobeUploadScreen";
import ScanWardrobeScreen from "@/screens/ScanWardrobeScreen";
import DigitizeWardrobeScreen from "@/screens/DigitizeWardrobeScreen";
import LiveStylistScreen from "@/screens/LiveStylistScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import SanityCheckScreen from "@/screens/SanityCheckScreen";
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
import { getCommonScreenOptions, getSettingsChildScreenOptions } from "@/navigation/screenOptions";
import { DFYTier } from "@/services/DFYService";
import type { SubscriptionTier } from "@/contexts/AuthContext";

export type WardrobeStackParamList = {
  Wardrobe: undefined;
  /** Fast single-item capture: snap → tag → save. */
  QuickAdd: undefined;
  /** Guided front + care-label capture after Quick Add save. */
  ImproveRecognition: {
    itemId: string;
    itemName?: string;
    /** Reuse the Quick Add front photo — skip re-shooting the garment. */
    frontImageUri?: string;
    frontImageBase64?: string;
  };
  /** Full manual add / edit form (also used by Quick Add → Edit / Improve). */
  AddWardrobeItem: undefined;
  /** Outfit-engine scan (still used by Live Stylist → Still scan). */
  ScanWardrobe: undefined;
  /** Wardrobe Creation layer — digitise rail/drawer photos into items. */
  DigitizeWardrobe: undefined;
  LiveStylist: { occasionType?: string } | undefined;
  /** Same-stack replace target from Live — avoids modal dismiss / black slide. */
  Subscription: {
    highlightPlan?: SubscriptionTier;
    scrollToDFY?: boolean;
    scrollToAiTopUp?: boolean;
  } | undefined;
  SanityCheck: undefined;
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
        name="QuickAdd"
        component={QuickAddScreen}
        options={{
          title: t('wardrobe.quickAdd') || "Quick Add",
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />
      <Stack.Screen
        name="ImproveRecognition"
        component={ImproveRecognitionScreen}
        options={{
          title: "Improve recognition",
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade",
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
        name="DigitizeWardrobe"
        component={DigitizeWardrobeScreen}
        options={{
          title: t('wardrobe.scanMyWardrobe') || "Scan my wardrobe",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="ScanWardrobe"
        component={ScanWardrobeScreen}
        options={{
          title: "Scan Wardrobe",
          headerShown: false,
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="LiveStylist"
        component={LiveStylistScreen}
        options={{
          title: "Live Stylist",
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          ...getSettingsChildScreenOptions({ theme, isDark, title: t('subscription.screenTitle') }),
          animation: "none",
        }}
      />
      <Stack.Screen
        name="SanityCheck"
        component={SanityCheckScreen}
        options={{
          ...getSettingsChildScreenOptions({
            theme,
            isDark,
            title: t('navTitles.sanityCheck') || t('stylistHub.quickSanityCheck'),
          }),
          animation: "none",
        }}
      />
      <Stack.Screen
        name="BulkWardrobeUpload"
        component={BulkWardrobeUploadScreen}
        options={{
          title: t('navTitles.bulkAddItems') || t('wardrobe.bulkUpload') || "Bulk Add",
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
