import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { TodaysOutfitCard } from "@/components/TodaysOutfitCard";
import { navigateToSubscription } from "@/utils/navigateToSubscription";
import {
  FEATURE_FLAGS,
  LAUNCH_HIDDEN_STYLIST_FEATURE_IDS,
} from "@/constants/featureFlags";
import { consumePendingCameraWow } from "@/services/CameraWowIntentService";

import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

type StylistHubScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "StylistHub">;
};

const GRID_GAP = Spacing.md;
const GRID_ROWS = 4;
/** Same gap under Today's outfit / Style Tools header as attachment 1 */
const GRID_TOP_GAP = Spacing.md;
/** Little breathing room above the tab bar */
const BOTTOM_BREATHING = Spacing.md;

type GradientKey = 'primary' | 'secondary' | 'accent' | 'warm' | 'cool' | 'jewel';

interface StylistFeature {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  screen?: keyof UserStylistStackParamList;
  gradientKey: GradientKey;
  category: "stylist" | "wardrobe" | "tools";
  premium?: boolean;
}

const getFeatures = (t: (key: string) => string): StylistFeature[] => [
  {
    id: "ai-stylist",
    title: t('stylistHub.personalStylist') || "Stylist Chat",
    description: t('stylistHub.personalStylistDesc') || "Chat, photos & wardrobe advice",
    icon: "message-circle",
    screen: "AIStylist",
    gradientKey: "primary",
    category: "stylist",
  },
  {
    id: "scan-wardrobe",
    title: t('wardrobe.getOutfitsNow') || "Get outfits now",
    description: "Scan a few pieces → up to 3 looks",
    icon: "camera",
    screen: "ScanWardrobe",
    gradientKey: "jewel",
    category: "wardrobe",
  },
  {
    id: "live-stylist",
    title: "Live stylist",
    description: "Camera tips on your outfit",
    icon: "aperture",
    screen: "LiveStylist",
    gradientKey: "accent",
    category: "stylist",
  },
  {
    id: "outfit-calendar",
    title: t('stylistHub.outfitCalendar') || "Outfit Calendar",
    description: t('stylistHub.outfitCalendarDesc') || "Plan your looks ahead",
    icon: "calendar",
    screen: "OutfitCalendar",
    gradientKey: "cool",
    category: "wardrobe",
  },
  {
    id: "weather-outfit",
    title: t('stylistHub.weatherOutfits') || "Weather Outfits",
    description: t('stylistHub.weatherOutfitsDesc') || "Dress for the forecast",
    icon: "cloud",
    screen: "WeatherOutfit",
    gradientKey: "secondary",
    category: "wardrobe",
  },
  {
    id: "fashion-blog",
    title: t('stylistHub.blog') || "Blog",
    description: t('stylistHub.blogDesc') || "Fashion tips & guides",
    icon: "book-open",
    screen: "FashionBlog",
    gradientKey: "warm",
    category: "tools",
  },
  {
    id: "style-rules",
    title: t('stylistHub.styleRules') || "Style Rules",
    description: t('stylistHub.styleRulesDesc') || "Your personal guidelines",
    icon: "list",
    screen: "StyleRules",
    gradientKey: "primary",
    category: "tools",
  },
  {
    id: "colour-insights",
    title: t('stylistHub.colourInsights') || "Colour Insights",
    description: t('stylistHub.colourInsightsDesc') || "Discover your palette",
    icon: "droplet",
    screen: "ColourInsights",
    gradientKey: "accent",
    category: "tools",
  },
];

const getLaunchDecisionTiles = (t: (key: string) => string): StylistFeature[] => [
  {
    id: "choosing-what-to-buy",
    title: t('stylistHub.choosingWhatToBuy') || "Choosing what to buy",
    description: t('stylistHub.choosingWhatToBuyDesc') || "Help me decide between options",
    icon: "shopping-bag",
    screen: "ChoosingWhatToBuy",
    gradientKey: "warm",
    category: "stylist",
  },
  {
    id: "outfit-for-event",
    title: t('stylistHub.outfitForEvent') || "Outfit for an event",
    description: t('stylistHub.outfitForEventDesc') || "Something specific coming up",
    icon: "calendar",
    screen: "EventOutfit",
    gradientKey: "jewel",
    category: "stylist",
  },
  {
    id: "quick-sanity-check",
    title: t('stylistHub.quickSanityCheck') || "Quick sanity check",
    description: t('stylistHub.quickSanityCheckDesc') || "Just need a second pair of eyes",
    icon: "check-circle",
    screen: "SanityCheck",
    gradientKey: "accent",
    category: "stylist",
  },
];

/** Fixed 2-column grid order — do not persist or allow reorder. */
const FIXED_TILES_ORDER = FEATURE_FLAGS.launchSimplified
  ? [
      "scan-wardrobe",
      "live-stylist",
      "choosing-what-to-buy",
      "quick-sanity-check",
      "ai-stylist",
      "outfit-for-event",
      "fashion-blog",
      "style-rules",
    ]
  : ["scan-wardrobe", "ai-stylist", "live-stylist", "outfit-calendar", "weather-outfit", "fashion-blog", "style-rules", "colour-insights"];

const getGradientColors = (key: GradientKey, palette: any): readonly [string, string] => {
  const gradientMap: Record<GradientKey, readonly [string, string]> = {
    primary: palette.gradientPrimary,
    secondary: palette.gradientSecondary,
    accent: palette.gradientAccent,
    warm: palette.gradientWarm,
    cool: palette.gradientCool,
    jewel: palette.gradientJewel ?? palette.gradientAccent,
  };
  return gradientMap[key];
};

export default function StylistHubScreen({ navigation }: StylistHubScreenProps) {
  const { limits } = useSubscription();
  const { palette, colorScheme } = useColorScheme();
  const { t } = useTranslations();
  const insets = useSafeAreaInsets();
  const tabBarHeightContext = React.useContext(BottomTabBarHeightContext);
  const tabBarHeight =
    typeof tabBarHeightContext === "number" && tabBarHeightContext > 0
      ? tabBarHeightContext
      : 56 + insets.bottom;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = await consumePendingCameraWow();
      if (!cancelled && pending) {
        navigation.navigate("ScanWardrobe");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  const features = React.useMemo(() => {
    const base = getFeatures(t);
    const byId = new Map<string, StylistFeature>();

    if (FEATURE_FLAGS.launchSimplified) {
      const hidden = new Set<string>(LAUNCH_HIDDEN_STYLIST_FEATURE_IDS);
      for (const feature of base) {
        if (!hidden.has(feature.id)) byId.set(feature.id, feature);
      }
      for (const feature of getLaunchDecisionTiles(t)) {
        byId.set(feature.id, feature);
      }
    } else {
      for (const feature of base) {
        byId.set(feature.id, feature);
      }
    }

    const ordered: StylistFeature[] = [];
    for (const id of FIXED_TILES_ORDER) {
      const feature = byId.get(id);
      if (feature) ordered.push(feature);
    }
    // Append any unexpected extras so they are not lost if flags change.
    for (const feature of byId.values()) {
      if (!FIXED_TILES_ORDER.includes(feature.id)) ordered.push(feature);
    }
    return ordered;
  }, [t]);

  const handleFeaturePress = (feature: StylistFeature) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (feature.id === "outfit-calendar" && !limits.canAccessOutfitCalendar) {
      navigateToSubscription(navigation);
      return;
    }
    if (feature.screen) {
      navigation.navigate(feature.screen);
    }
  };

  const renderFeatureTile = (feature: StylistFeature) => (
    <View key={feature.id} style={styles.tileWrapper}>
      <Pressable
        onPress={() => handleFeaturePress(feature)}
        style={({ pressed }) => [
          styles.featureTile,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <LinearGradient
          colors={getGradientColors(feature.gradientKey, palette)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tileGradient}
        >
          <View style={styles.iconContainer}>
            <Feather name={feature.icon} size={30} color="#FFFFFF" />
          </View>
          <View style={styles.tileContent}>
            <ThemedText type="body" style={styles.tileTitle} numberOfLines={2}>
              {feature.title}
              {feature.id === 'outfit-calendar' && !limits.canAccessOutfitCalendar
                ? ` · ${t('subscription.plan.personalStylist.name') || 'Personal Stylist'}`
                : ''}
            </ThemedText>
            <ThemedText type="caption" style={styles.tileDescription} numberOfLines={2}>
              {feature.id === 'outfit-calendar' && !limits.canAccessOutfitCalendar
                ? (t('stylistHub.outfitCalendarLockedDesc') || 'Plan outfits ahead — Personal Stylist')
                : feature.description}
            </ThemedText>
          </View>
          {feature.id === 'outfit-calendar' && !limits.canAccessOutfitCalendar ? (
            <View style={styles.premiumBadge}>
              <Feather name="lock" size={14} color="#FFFFFF" />
            </View>
          ) : null}
        </LinearGradient>
      </Pressable>
    </View>
  );

  const featureRows = React.useMemo(() => {
    const rows: StylistFeature[][] = [];
    for (let i = 0; i < features.length; i += 2) {
      rows.push(features.slice(i, i + 2));
    }
    // Pad to 4 rows so flex fill stays even if a tile is missing
    while (rows.length < GRID_ROWS) rows.push([]);
    return rows.slice(0, GRID_ROWS);
  }, [features]);

  const headerGradientColors: readonly [string, string, string] = colorScheme === 'minimalist'
    ? ['#C9A87C', '#A88B5C', '#3D3426'] as const
    : [ScreenGradients.stylistHub.primary[0], ScreenGradients.stylistHub.primary[1], LuxuryColors.obsidian] as const;

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={headerGradientColors}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.screenBody, { paddingTop: insets.top + Spacing.sm, paddingBottom: tabBarHeight + BOTTOM_BREATHING }]}>
        <View style={styles.headerContent}>
          <View style={{ width: 40 }} />
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>{t('stylistHub.screenTitle') || 'Stylist'}</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.contentSection}>
          <View style={styles.headerSection}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1, paddingRight: Spacing.sm }}>
                <ThemedText type="h3" style={[styles.title, { color: '#3D3426' }]}>
                  {t('stylistHub.styleToolsTitle') || 'Style Tools'}
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: '#5A4D3A' }]} numberOfLines={1}>
                  {t('stylistHub.styleToolsSubtitle') || 'Your personal fashion assistant'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Same top gap as under Today's outfit in attachment 1; tiles flex-fill the rest */}
          <View style={[styles.featuresGrid, { marginTop: GRID_TOP_GAP }]}>
            {featureRows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.featureRow}>
                {row.map((feature) => renderFeatureTile(feature))}
                {row.length === 1 ? <View style={styles.tileWrapper} /> : null}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Overlay — does not affect Style Tools layout */}
      <TodaysOutfitCard
        onOpenStylist={(prompt) => navigation.navigate("AIStylist", { initialPrompt: prompt })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenBody: {
    flex: 1,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  contentSection: {
    paddingHorizontal: Spacing.xl,
    flex: 1,
  },
  headerSection: {
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.small.fontSize,
    lineHeight: 20,
  },
  featuresGrid: {
    flex: 1,
    gap: GRID_GAP,
  },
  featureRow: {
    flex: 1,
    flexDirection: "row",
    gap: GRID_GAP,
  },
  tileWrapper: {
    flex: 1,
  },
  featureTile: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  tileGradient: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: "space-between",
  },
  iconContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingTop: Spacing.sm,
  },
  tileContent: {
    gap: 2,
  },
  tileTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 18,
  },
  tileDescription: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    lineHeight: 15,
  },
  premiumBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});
