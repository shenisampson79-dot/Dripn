import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { apiService } from "@/services/ApiService";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
};

interface ColorTrend {
  id?: string;
  name: string;
  hexCode: string;
  pantoneCode?: string;
  season?: string;
  year?: number;
  description?: string;
  pairingColors: string[];
  bestFor: string[];
}

interface ColorOfTheYear {
  name: string;
  hexCode: string;
  pantoneCode?: string;
  description: string;
  pairingColors: string[];
  bestFor: string[];
  year: number;
}

const FALLBACK_COLOR_OF_YEAR: ColorOfTheYear = {
  name: "Mocha Mousse",
  hexCode: "#A47864",
  pantoneCode: "PANTONE 17-1230",
  description: "A warm, earthy brown that evokes comfort and timeless elegance.",
  pairingColors: ["#FFFFFF", "#000000", "#D4A574", "#8B7355"],
  bestFor: ["Warm", "Neutral"],
  year: 2025,
};

const FALLBACK_SEASONAL_PALETTE: ColorTrend[] = [
  {
    id: "1",
    name: "Butter Cream",
    hexCode: "#F5E6C8",
    pantoneCode: "PANTONE 13-0720",
    season: "Spring",
    year: 2026,
    pairingColors: ["#A47864", "#6B5B4F", "#FFFFFF"],
    bestFor: ["Warm", "Neutral"],
  },
  {
    id: "2",
    name: "Sage Mist",
    hexCode: "#B8C4A8",
    pantoneCode: "PANTONE 15-6316",
    season: "Spring",
    year: 2026,
    pairingColors: ["#FFFFFF", "#F5E6C8", "#6B7355"],
    bestFor: ["Cool", "Neutral"],
  },
  {
    id: "3",
    name: "Dusty Rose",
    hexCode: "#D4A5A5",
    pantoneCode: "PANTONE 15-1614",
    season: "Spring",
    year: 2026,
    pairingColors: ["#FFFFFF", "#000000", "#C9A87C"],
    bestFor: ["Warm", "Cool"],
  },
  {
    id: "4",
    name: "Ocean Depth",
    hexCode: "#2E5A6B",
    pantoneCode: "PANTONE 19-4241",
    season: "Spring",
    year: 2026,
    pairingColors: ["#FFFFFF", "#F5E6C8", "#C9A87C"],
    bestFor: ["Cool", "Neutral"],
  },
];

export default function ColourInsightsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [colorOfTheYear, setColorOfTheYear] = useState<ColorOfTheYear | null>(null);
  const [seasonalPalette, setSeasonalPalette] = useState<ColorTrend[]>([]);
  const [showSeasonalPalette, setShowSeasonalPalette] = useState(false);

  useEffect(() => {
    loadColorTrends();
  }, []);

  const loadColorTrends = async () => {
    try {
      const res = await apiService.getCurrentColorTrends();
      setColorOfTheYear(res.colorOfTheYear);
      setSeasonalPalette(res.seasonalPalette || []);
    } catch {
      setColorOfTheYear(FALLBACK_COLOR_OF_YEAR);
      setSeasonalPalette(FALLBACK_SEASONAL_PALETTE);
    }
  };

  const undertone = user?.skinUndertone;

  const warmSwatches = [
    { hex: '#C19A6B', name: 'Camel' },
    { hex: '#E27D60', name: 'Terracotta' },
    { hex: '#6B7A3A', name: 'Olive' },
    { hex: '#B7410E', name: 'Rust' },
    { hex: '#C9A87C', name: 'Gold' },
    { hex: '#FFFDD0', name: 'Cream' },
  ];

  const coolSwatches = [
    { hex: '#001F5B', name: 'Navy' },
    { hex: '#800020', name: 'Burgundy' },
    { hex: '#9B7EBD', name: 'Lavender' },
    { hex: '#0047AB', name: 'Cobalt' },
    { hex: '#E8B4B8', name: 'Rose' },
    { hex: '#8F9CC0', name: 'Slate' },
  ];

  const neutralSwatches = [
    { hex: '#001F5B', name: 'Navy' },
    { hex: '#FFFFFF', name: 'White' },
    { hex: '#1A1A1A', name: 'Black' },
    { hex: '#C19A6B', name: 'Camel' },
    { hex: '#E8B4B8', name: 'Blush' },
    { hex: '#8B8589', name: 'Taupe' },
  ];

  const profileSwatches =
    undertone === 'warm' ? warmSwatches :
    undertone === 'cool' ? coolSwatches :
    undertone === 'neutral' ? neutralSwatches : [];

  const profileTitle =
    undertone === 'warm' ? 'Warm Undertone' :
    undertone === 'cool' ? 'Cool Undertone' :
    undertone === 'neutral' ? 'Neutral Undertone' : null;

  const profileDesc =
    undertone === 'warm'
      ? "Earth tones and rich, warm hues make you radiate. Lean into camel, terracotta, olive, rust, and gold — they work with your natural warmth rather than against it."
    : undertone === 'cool'
      ? "Cool, jewel-toned shades bring out the best in you. Navy, burgundy, lavender, cobalt, and rose all complement your undertone beautifully."
    : undertone === 'neutral'
      ? "You have the most versatile palette — almost any colour works. Anchor looks with navy, camel, or white, then experiment freely with bolder accent shades."
    : "Complete your profile to unlock a personalised colour palette based on your unique undertone.";

  const s = makeStyles(theme);

  return (
    <ScreenScrollView style={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={s.headerIcon}>
          <Feather name="droplet" size={22} color={LUXURY_COLORS.gold} />
        </View>
        <View>
          <ThemedText type="h2" style={s.headerTitle}>Colour Insights</ThemedText>
          <ThemedText type="small" style={s.headerSubtitle}>Your personal colour guide</ThemedText>
        </View>
      </View>

      {/* Personal Colour Profile */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
            style={s.cardIconBadge}
          >
            <Feather name="user" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="small" style={s.cardBadgeText}>YOUR COLOUR PROFILE</ThemedText>
        </View>

        {profileTitle ? (
          <View style={s.cardBody}>
            <ThemedText type="body" style={s.cardTitle}>{profileTitle}</ThemedText>
            <ThemedText type="small" style={s.cardDesc}>{profileDesc}</ThemedText>
            <View style={s.swatchRow}>
              {profileSwatches.map((c, i) => (
                <View key={i} style={s.swatchChip}>
                  <View style={[
                    s.swatchCircle,
                    { backgroundColor: c.hex },
                    c.hex === '#FFFFFF' ? { borderWidth: 1, borderColor: theme.backgroundSecondary } : null,
                  ]} />
                  <ThemedText type="caption" style={s.swatchLabel}>{c.name}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.cardBody}>
            <ThemedText type="small" style={s.cardDesc}>{profileDesc}</ThemedText>
          </View>
        )}
      </View>

      {/* Colour of the Year */}
      {colorOfTheYear ? (
        <View style={[s.yearCard, { borderLeftColor: colorOfTheYear.hexCode }]}>
          <View style={[s.yearBadge, { backgroundColor: colorOfTheYear.hexCode }]}>
            <Feather name="award" size={12} color="#FFFFFF" />
            <ThemedText type="small" style={s.yearBadgeText}>
              COLOUR OF THE YEAR {colorOfTheYear.year}
            </ThemedText>
          </View>
          <View style={s.yearContent}>
            <View style={[s.yearSwatch, { backgroundColor: colorOfTheYear.hexCode }]} />
            <View style={s.yearInfo}>
              <ThemedText type="body" style={s.yearName}>{colorOfTheYear.name}</ThemedText>
              <ThemedText type="small" style={s.yearHex}>{colorOfTheYear.hexCode}</ThemedText>
              {colorOfTheYear.pantoneCode ? (
                <ThemedText type="small" style={s.yearPantone}>{colorOfTheYear.pantoneCode}</ThemedText>
              ) : null}
            </View>
          </View>
          <ThemedText type="small" style={s.yearDesc}>{colorOfTheYear.description}</ThemedText>
          <View style={s.pairingRow}>
            <ThemedText type="small" style={s.pairingLabel}>Pairs with:</ThemedText>
            <View style={s.pairingSwatches}>
              {colorOfTheYear.pairingColors.map((color, idx) => (
                <View key={idx} style={[s.pairingSwatch, { backgroundColor: color }]} />
              ))}
            </View>
          </View>
          <View style={s.bestForRow}>
            <ThemedText type="small" style={s.bestForLabel}>Best for:</ThemedText>
            <ThemedText type="small" style={s.bestForValue}>
              {colorOfTheYear.bestFor.join(' & ')}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Colour Harmony Guide */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            style={s.cardIconBadge}
          >
            <Feather name="grid" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="small" style={s.cardBadgeText}>COLOUR HARMONY GUIDE</ThemedText>
        </View>

        <View style={s.harmonyRules}>
          {[
            {
              name: 'Monochrome',
              desc: 'One hue in light, mid, and dark shades — effortlessly polished.',
              swatches: ['#2E3B8F', '#5B6FC4', '#A8B3E8'],
              widths: [18, 18, 18],
            },
            {
              name: 'Complementary',
              desc: 'Opposite colours on the wheel (e.g. blue + orange) create bold contrast.',
              swatches: ['#1A5276', '#E67E22', '#1A5276'],
              widths: [18, 18, 18],
            },
            {
              name: '60-30-10 Rule',
              desc: '60% dominant, 30% secondary, 10% accent — the formula for a balanced outfit.',
              swatches: ['#1A3A5C', '#6B7A3A', '#C9A87C'],
              widths: [28, 18, 10],
            },
          ].map((rule, rIdx) => (
            <View key={rIdx}>
              {rIdx > 0 ? <View style={s.harmonyDivider} /> : null}
              <View style={s.harmonyRule}>
                <View style={s.harmonySwatches}>
                  {rule.swatches.map((c, i) => (
                    <View
                      key={i}
                      style={[s.harmonySwatch, { backgroundColor: c, width: rule.widths[i] }]}
                    />
                  ))}
                </View>
                <View style={s.harmonyText}>
                  <ThemedText type="body" style={s.harmonyName}>{rule.name}</ThemedText>
                  <ThemedText type="small" style={s.harmonyDesc}>{rule.desc}</ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Seasonal Palette */}
      <Pressable
        onPress={() => setShowSeasonalPalette(!showSeasonalPalette)}
        style={({ pressed }) => [s.expandBtn, { opacity: pressed ? 0.8 : 1 }]}
      >
        <ThemedText type="body" style={s.expandBtnText}>
          {showSeasonalPalette
            ? 'Hide Seasonal Palette'
            : `This Season's Palette (${seasonalPalette.length})`}
        </ThemedText>
        <Feather
          name={showSeasonalPalette ? "chevron-up" : "chevron-down"}
          size={18}
          color={LUXURY_COLORS.gold}
        />
      </Pressable>

      {showSeasonalPalette ? (
        <View style={s.seasonalGrid}>
          {seasonalPalette.map((color) => (
            <View key={color.id ?? color.name} style={s.seasonalCard}>
              <View style={[s.seasonalSwatch, { backgroundColor: color.hexCode }]} />
              <View style={s.seasonalInfo}>
                <ThemedText type="body" style={s.seasonalName}>{color.name}</ThemedText>
                <ThemedText type="small" style={s.seasonalHex}>{color.hexCode}</ThemedText>
                {color.pantoneCode ? (
                  <ThemedText type="small" style={s.seasonalPantone}>{color.pantoneCode}</ThemedText>
                ) : null}
                <View style={s.miniSwatches}>
                  {color.pairingColors.slice(0, 3).map((pc, idx) => (
                    <View key={idx} style={[s.miniSwatch, { backgroundColor: pc }]} />
                  ))}
                </View>
                <ThemedText type="small" style={s.seasonalBestFor}>
                  {color.bestFor.join(' & ')}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScreenScrollView>
  );
}

function makeStyles(theme: Record<string, string>) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing["2xl"],
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: 'rgba(201,168,124,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontWeight: '700',
      color: theme.text,
    },
    headerSubtitle: {
      color: theme.tabIconDefault,
      marginTop: 2,
    },
    card: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.lg,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
      marginBottom: Spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    cardIconBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBadgeText: {
      color: theme.tabIconDefault,
      fontWeight: '700',
      letterSpacing: 0.8,
      fontSize: 11,
    },
    cardBody: {
      gap: Spacing.sm,
    },
    cardTitle: {
      color: theme.text,
      fontWeight: '700',
    },
    cardDesc: {
      color: theme.tabIconDefault,
      lineHeight: 20,
    },
    swatchRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    swatchChip: {
      alignItems: 'center',
      gap: 4,
    },
    swatchCircle: {
      width: 38,
      height: 38,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
    },
    swatchLabel: {
      color: theme.tabIconDefault,
      fontSize: 9,
      textAlign: 'center',
    },
    yearCard: {
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderLeftWidth: 4,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
    },
    yearBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: Spacing.sm,
      borderRadius: BorderRadius.full,
      alignSelf: 'flex-start',
      marginBottom: Spacing.md,
    },
    yearBadgeText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 10,
      letterSpacing: 1,
    },
    yearContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    yearSwatch: {
      width: 64,
      height: 64,
      borderRadius: BorderRadius.lg,
      borderWidth: 2,
      borderColor: theme.backgroundSecondary,
    },
    yearInfo: {
      flex: 1,
    },
    yearName: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 18,
      marginBottom: 2,
    },
    yearHex: {
      color: theme.tabIconDefault,
      fontFamily: 'monospace',
      marginBottom: 2,
    },
    yearPantone: {
      color: theme.tabIconDefault,
      fontSize: 11,
    },
    yearDesc: {
      color: theme.tabIconDefault,
      lineHeight: 18,
      marginBottom: Spacing.md,
    },
    pairingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    pairingLabel: {
      color: theme.tabIconDefault,
    },
    pairingSwatches: {
      flexDirection: 'row',
      gap: 6,
    },
    pairingSwatch: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
    },
    bestForRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    bestForLabel: {
      color: theme.tabIconDefault,
    },
    bestForValue: {
      color: theme.text,
      fontWeight: '600',
    },
    harmonyRules: {
      gap: 0,
    },
    harmonyDivider: {
      height: 1,
      backgroundColor: theme.backgroundSecondary,
      marginVertical: 2,
    },
    harmonyRule: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    harmonySwatches: {
      flexDirection: 'row',
      gap: 4,
      alignItems: 'center',
      paddingTop: 2,
    },
    harmonySwatch: {
      height: 36,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
    },
    harmonyText: {
      flex: 1,
      gap: 2,
    },
    harmonyName: {
      color: theme.text,
      fontWeight: '600',
      fontSize: 14,
    },
    harmonyDesc: {
      color: theme.tabIconDefault,
      lineHeight: 18,
      fontSize: 12,
    },
    expandBtn: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
      marginBottom: Spacing.md,
    },
    expandBtnText: {
      color: theme.text,
      fontWeight: '500',
    },
    seasonalGrid: {
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    seasonalCard: {
      flexDirection: 'row',
      backgroundColor: theme.backgroundDefault,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
    },
    seasonalSwatch: {
      width: 56,
      height: 56,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
    },
    seasonalInfo: {
      flex: 1,
    },
    seasonalName: {
      color: theme.text,
      fontWeight: '600',
      marginBottom: 2,
    },
    seasonalHex: {
      color: theme.tabIconDefault,
      fontFamily: 'monospace',
      fontSize: 11,
    },
    seasonalPantone: {
      color: theme.tabIconDefault,
      fontSize: 10,
      marginBottom: 4,
    },
    miniSwatches: {
      flexDirection: 'row',
      gap: 4,
      marginVertical: 4,
    },
    miniSwatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: theme.backgroundSecondary,
    },
    seasonalBestFor: {
      color: theme.tabIconDefault,
      fontSize: 10,
    },
  });
}
