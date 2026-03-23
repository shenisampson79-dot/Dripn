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

  return (
    <ScreenScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}>
          <Feather name="droplet" size={22} color={LUXURY_COLORS.gold} />
        </View>
        <View>
          <ThemedText type="h2" style={styles.headerTitle}>Colour Insights</ThemedText>
          <ThemedText type="small" style={styles.headerSubtitle}>Your personal colour guide</ThemedText>
        </View>
      </View>

      {/* Personal Colour Profile */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
            style={styles.cardIconBadge}
          >
            <Feather name="user" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="small" style={styles.cardBadgeText}>YOUR COLOUR PROFILE</ThemedText>
        </View>

        {profileTitle ? (
          <View style={styles.cardBody}>
            <ThemedText type="body" style={styles.cardTitle}>{profileTitle}</ThemedText>
            <ThemedText type="small" style={styles.cardDesc}>{profileDesc}</ThemedText>
            <View style={styles.swatchRow}>
              {profileSwatches.map((c, i) => (
                <View key={i} style={styles.swatchChip}>
                  <View style={[
                    styles.swatchCircle,
                    { backgroundColor: c.hex },
                    c.hex === '#FFFFFF' ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' } : null,
                  ]} />
                  <ThemedText type="caption" style={styles.swatchLabel}>{c.name}</ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.cardBody}>
            <ThemedText type="small" style={styles.cardDesc}>{profileDesc}</ThemedText>
          </View>
        )}
      </View>

      {/* Colour of the Year */}
      {colorOfTheYear ? (
        <View style={[styles.yearCard, { borderLeftColor: colorOfTheYear.hexCode }]}>
          <View style={[styles.yearBadge, { backgroundColor: colorOfTheYear.hexCode }]}>
            <Feather name="award" size={12} color="#FFFFFF" />
            <ThemedText type="small" style={styles.yearBadgeText}>
              COLOUR OF THE YEAR {colorOfTheYear.year}
            </ThemedText>
          </View>
          <View style={styles.yearContent}>
            <View style={[styles.yearSwatch, { backgroundColor: colorOfTheYear.hexCode }]} />
            <View style={styles.yearInfo}>
              <ThemedText type="body" style={styles.yearName}>{colorOfTheYear.name}</ThemedText>
              <ThemedText type="small" style={styles.yearHex}>{colorOfTheYear.hexCode}</ThemedText>
              {colorOfTheYear.pantoneCode ? (
                <ThemedText type="small" style={styles.yearPantone}>{colorOfTheYear.pantoneCode}</ThemedText>
              ) : null}
            </View>
          </View>
          <ThemedText type="small" style={styles.yearDesc}>{colorOfTheYear.description}</ThemedText>
          <View style={styles.pairingRow}>
            <ThemedText type="small" style={styles.pairingLabel}>Pairs with:</ThemedText>
            <View style={styles.pairingSwatches}>
              {colorOfTheYear.pairingColors.map((color, idx) => (
                <View key={idx} style={[styles.pairingSwatch, { backgroundColor: color }]} />
              ))}
            </View>
          </View>
          <View style={styles.bestForRow}>
            <ThemedText type="small" style={styles.bestForLabel}>Best for:</ThemedText>
            <ThemedText type="small" style={styles.bestForValue}>
              {colorOfTheYear.bestFor.join(' & ')}
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Colour Harmony Guide */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            style={styles.cardIconBadge}
          >
            <Feather name="grid" size={12} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="small" style={styles.cardBadgeText}>COLOUR HARMONY GUIDE</ThemedText>
        </View>

        <View style={styles.harmonyRules}>
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
              {rIdx > 0 ? <View style={styles.harmonyDivider} /> : null}
              <View style={styles.harmonyRule}>
                <View style={styles.harmonySwatches}>
                  {rule.swatches.map((c, i) => (
                    <View
                      key={i}
                      style={[styles.harmonySwatch, { backgroundColor: c, width: rule.widths[i] }]}
                    />
                  ))}
                </View>
                <View style={styles.harmonyText}>
                  <ThemedText type="body" style={styles.harmonyName}>{rule.name}</ThemedText>
                  <ThemedText type="small" style={styles.harmonyDesc}>{rule.desc}</ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Seasonal Palette */}
      <Pressable
        onPress={() => setShowSeasonalPalette(!showSeasonalPalette)}
        style={({ pressed }) => [styles.expandBtn, { opacity: pressed ? 0.8 : 1 }]}
      >
        <ThemedText type="body" style={styles.expandBtnText}>
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
        <View style={styles.seasonalGrid}>
          {seasonalPalette.map((color) => (
            <View key={color.id ?? color.name} style={styles.seasonalCard}>
              <View style={[styles.seasonalSwatch, { backgroundColor: color.hexCode }]} />
              <View style={styles.seasonalInfo}>
                <ThemedText type="body" style={styles.seasonalName}>{color.name}</ThemedText>
                <ThemedText type="small" style={styles.seasonalHex}>{color.hexCode}</ThemedText>
                {color.pantoneCode ? (
                  <ThemedText type="small" style={styles.seasonalPantone}>{color.pantoneCode}</ThemedText>
                ) : null}
                <View style={styles.miniSwatches}>
                  {color.pairingColors.slice(0, 3).map((pc, idx) => (
                    <View key={idx} style={[styles.miniSwatch, { backgroundColor: pc }]} />
                  ))}
                </View>
                <ThemedText type="small" style={styles.seasonalBestFor}>
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

const styles = StyleSheet.create({
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
  },
  headerSubtitle: {
    opacity: 0.6,
    marginTop: 2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    letterSpacing: 0.8,
    fontSize: 11,
  },
  cardBody: {
    gap: Spacing.sm,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.7)',
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
    borderColor: 'rgba(255,255,255,0.15)',
  },
  swatchLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    textAlign: 'center',
  },
  yearCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
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
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  yearInfo: {
    flex: 1,
  },
  yearName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 2,
  },
  yearHex: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  yearPantone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  yearDesc: {
    color: 'rgba(255,255,255,0.8)',
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
    color: 'rgba(255,255,255,0.6)',
  },
  pairingSwatches: {
    flexDirection: 'row',
    gap: 6,
  },
  pairingSwatch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bestForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bestForLabel: {
    color: 'rgba(255,255,255,0.6)',
  },
  bestForValue: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  harmonyRules: {
    gap: 0,
  },
  harmonyDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    borderColor: 'rgba(255,255,255,0.15)',
  },
  harmonyText: {
    flex: 1,
    gap: 2,
  },
  harmonyName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  harmonyDesc: {
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 18,
    fontSize: 12,
  },
  expandBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: Spacing.md,
  },
  expandBtnText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  seasonalGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  seasonalCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  seasonalSwatch: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  seasonalInfo: {
    flex: 1,
  },
  seasonalName: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  seasonalHex: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  seasonalPantone: {
    color: 'rgba(255,255,255,0.5)',
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
    borderColor: 'rgba(255,255,255,0.2)',
  },
  seasonalBestFor: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
  },
});
