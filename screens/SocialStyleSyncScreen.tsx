/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Image, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useWardrobe, WardrobeItem, ClothingColor } from "@/contexts/WardrobeContext";
import type { UserStylistStackParamList } from "@/navigation/UserStylistStackNavigator";

const SOCIAL_SYNC_STORAGE_KEY = "@dripn_social_sync";

type SocialStyleSyncScreenProps = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, "SocialStyleSync">;
};

interface SocialAccount {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  connected: boolean;
  username?: string;
  postsAnalyzed?: number;
}

interface DetectedStyle {
  name: string;
  percentage: number;
  color: string;
}

interface ColorPalette {
  hex: string;
  name: string;
  percentage: number;
}

interface TrendInsight {
  trend: string;
  count: number;
  icon: keyof typeof Feather.glyphMap;
}

interface WardrobeMatch {
  id: string;
  savedImage: string;
  matchedItems: string[];
  matchPercentage: number;
  missingPieces: string[];
}

interface AIInsight {
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  actionLabel?: string;
}

const SOCIAL_ACCOUNTS: SocialAccount[] = [
  { id: "instagram", name: "Instagram", icon: "instagram", color: "#E4405F", connected: false },
  { id: "pinterest", name: "Pinterest", icon: "grid", color: "#E60023", connected: false },
  { id: "tiktok", name: "TikTok", icon: "video", color: "#000000", connected: false },
];

const MOCK_DETECTED_STYLES: DetectedStyle[] = [
  { name: "Minimalist", percentage: 45, color: "#8B7355" },
  { name: "Streetwear", percentage: 28, color: "#1A1A2E" },
  { name: "Boho Chic", percentage: 18, color: "#D4A373" },
  { name: "Athleisure", percentage: 9, color: "#4A90D9" },
];

const MOCK_COLOR_PALETTE: ColorPalette[] = [
  { hex: "#1A1A2E", name: "Deep Navy", percentage: 32 },
  { hex: "#E8DED5", name: "Warm Cream", percentage: 24 },
  { hex: "#8B7355", name: "Taupe", percentage: 18 },
  { hex: "#D4A373", name: "Camel", percentage: 15 },
  { hex: "#FFFFFF", name: "White", percentage: 11 },
];

const MOCK_TREND_INSIGHTS: TrendInsight[] = [
  { trend: "Oversized blazers", count: 47, icon: "wind" },
  { trend: "Wide-leg trousers", count: 38, icon: "maximize-2" },
  { trend: "Layered jewelry", count: 29, icon: "star" },
  { trend: "Neutral tones", count: 52, icon: "droplet" },
];

const MOCK_WARDROBE_MATCHES: WardrobeMatch[] = [
  {
    id: "1",
    savedImage: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=200&h=300&fit=crop",
    matchedItems: ["Beige trench coat", "White tee", "Dark jeans"],
    matchPercentage: 85,
    missingPieces: ["Loafers"],
  },
  {
    id: "2",
    savedImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=200&h=300&fit=crop",
    matchedItems: ["Black blazer", "White shirt"],
    matchPercentage: 60,
    missingPieces: ["High-waist trousers", "Pointed heels"],
  },
];

const MOCK_AI_INSIGHTS: AIInsight[] = [
  {
    title: "Your Style DNA",
    description: "You've been saving lots of minimalist outfits with neutral tones. Your aesthetic leans toward clean lines and understated elegance.",
    icon: "zap",
    actionLabel: "Explore Minimalist Picks",
  },
  {
    title: "Trending in Your Saves",
    description: "Oversized blazers appear in 47% of your saved looks. Consider adding a camel or navy option to your wardrobe.",
    icon: "trending-up",
    actionLabel: "Shop Blazers",
  },
  {
    title: "Color Insight",
    description: "Your saves show a strong preference for warm neutrals. Try incorporating soft terracotta or dusty rose for variety.",
    icon: "droplet",
  },
];

export default function SocialStyleSyncScreen({ navigation }: SocialStyleSyncScreenProps) {
  const { theme, isDark } = useTheme();
  const { items: wardrobeItems, getOwnedItems } = useWardrobe();
  
  const [accounts, setAccounts] = useState<SocialAccount[]>(SOCIAL_ACCOUNTS);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [detectedStyles, setDetectedStyles] = useState<DetectedStyle[]>([]);
  const [colorPalette, setColorPalette] = useState<ColorPalette[]>([]);
  const [trendInsights, setTrendInsights] = useState<TrendInsight[]>([]);
  const [wardrobeMatches, setWardrobeMatches] = useState<WardrobeMatch[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);

  const connectedAccounts = accounts.filter(a => a.connected);

  const handleConnectAccount = async (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    if (account.connected) {
      Alert.alert(
        "Disconnect Account",
        `Are you sure you want to disconnect ${account.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              setAccounts(prev =>
                prev.map(a =>
                  a.id === accountId ? { ...a, connected: false, username: undefined, postsAnalyzed: undefined } : a
                )
              );
              if (connectedAccounts.length <= 1) {
                setHasAnalyzed(false);
                setDetectedStyles([]);
                setColorPalette([]);
                setTrendInsights([]);
                setWardrobeMatches([]);
                setAiInsights([]);
              }
            },
          },
        ]
      );
      return;
    }

    try {
      await WebBrowser.openBrowserAsync(`https://dripn.app/oauth/${accountId}`);
      setAccounts(prev =>
        prev.map(a =>
          a.id === accountId
            ? {
                ...a,
                connected: true,
                username: `@${accountId}_user`,
                postsAnalyzed: Math.floor(Math.random() * 200) + 50,
              }
            : a
        )
      );
    } catch (error) {
      setAccounts(prev =>
        prev.map(a =>
          a.id === accountId
            ? {
                ...a,
                connected: true,
                username: `@${accountId}_user`,
                postsAnalyzed: Math.floor(Math.random() * 200) + 50,
              }
            : a
        )
      );
    }
  };

  const generateDynamicWardrobeMatches = useCallback((): WardrobeMatch[] => {
    const ownedItems = getOwnedItems();
    if (ownedItems.length === 0) {
      return MOCK_WARDROBE_MATCHES;
    }
    
    const categoryNames: Record<string, string> = {
      tops: "top", bottoms: "bottoms", dresses: "dress", outerwear: "jacket",
      shoes: "shoes", bags: "bag", accessories: "accessory"
    };
    
    const matchedItemNames = ownedItems.slice(0, 3).map(item => 
      `${item.color.charAt(0).toUpperCase() + item.color.slice(1)} ${item.name || categoryNames[item.category] || item.category}`
    );
    
    const missingByStyle: Record<string, string[]> = {
      minimalist: ["Structured blazer", "Leather loafers"],
      streetwear: ["Chunky sneakers", "Graphic hoodie"],
      boho: ["Flowy maxi skirt", "Layered necklaces"],
      athleisure: ["Performance leggings", "Running shoes"]
    };
    
    const styleKey = detectedStyles[0]?.name.toLowerCase().replace(" ", "") || "minimalist";
    const missing = missingByStyle[styleKey] || ["Statement piece"];
    
    return [
      {
        id: "dynamic_1",
        savedImage: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=200&h=300&fit=crop",
        matchedItems: matchedItemNames.length > 0 ? matchedItemNames : ["Your wardrobe items"],
        matchPercentage: Math.min(85, 40 + ownedItems.length * 5),
        missingPieces: missing.slice(0, 1),
      },
      {
        id: "dynamic_2",
        savedImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=200&h=300&fit=crop",
        matchedItems: matchedItemNames.length > 1 ? matchedItemNames.slice(0, 2) : ["Add items to wardrobe"],
        matchPercentage: Math.min(70, 30 + ownedItems.length * 4),
        missingPieces: missing,
      }
    ];
  }, [getOwnedItems, detectedStyles]);

  const generateDynamicInsights = useCallback((): AIInsight[] => {
    const ownedItems = getOwnedItems();
    const itemCount = ownedItems.length;
    const topStyle = detectedStyles[0]?.name || "minimalist";
    const topTrend = trendInsights[0]?.trend || "versatile basics";
    
    return [
      {
        title: "Your Style DNA",
        description: `You've been saving lots of ${topStyle.toLowerCase()} outfits with neutral tones. ${itemCount > 0 ? `With ${itemCount} items in your wardrobe, you can recreate many of these looks.` : "Add items to your wardrobe to see how you can recreate these looks."}`,
        icon: "zap",
        actionLabel: `Explore ${topStyle} Picks`,
      },
      {
        title: "Trending in Your Saves",
        description: `${topTrend.charAt(0).toUpperCase() + topTrend.slice(1)} appear frequently in your saved looks. Consider adding a complementary piece to your wardrobe.`,
        icon: "trending-up",
        actionLabel: "Shop Recommendations",
      },
      {
        title: "Color Insight",
        description: `Your saves show a strong preference for ${colorPalette[0]?.name || "warm neutrals"}. Try incorporating complementary tones for variety.`,
        icon: "droplet",
      },
    ];
  }, [getOwnedItems, detectedStyles, trendInsights, colorPalette]);

  const handleAnalyzeSaves = async () => {
    if (connectedAccounts.length === 0) {
      Alert.alert("Connect an Account", "Please connect at least one social account to analyze your saved posts.");
      return;
    }

    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setDetectedStyles(MOCK_DETECTED_STYLES);
    setColorPalette(MOCK_COLOR_PALETTE);
    setTrendInsights(MOCK_TREND_INSIGHTS);
    
    const dynamicMatches = generateDynamicWardrobeMatches();
    setWardrobeMatches(dynamicMatches);
    
    const dynamicInsights = generateDynamicInsights();
    setAiInsights(dynamicInsights);
    
    setHasAnalyzed(true);
    setIsAnalyzing(false);
    
    try {
      await AsyncStorage.setItem(SOCIAL_SYNC_STORAGE_KEY, JSON.stringify({
        lastAnalyzed: new Date().toISOString(),
        connectedAccounts: accounts.filter(a => a.connected).map(a => a.id),
      }));
    } catch (e) {}
  };

  const renderSocialAccountButton = (account: SocialAccount) => (
    <Pressable
      key={account.id}
      onPress={() => handleConnectAccount(account.id)}
      style={({ pressed }) => [
        styles.accountButton,
        {
          backgroundColor: account.connected ? account.color + "15" : theme.backgroundSecondary,
          borderColor: account.connected ? account.color : "transparent",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.accountIcon, { backgroundColor: account.color }]}>
        <Feather name={account.icon} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.accountInfo}>
        <ThemedText style={{ fontWeight: "600" }}>{account.name}</ThemedText>
        {account.connected ? (
          <ThemedText type="caption" style={{ color: theme.success }}>
            {account.username} - {account.postsAnalyzed} saves
          </ThemedText>
        ) : (
          <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
            Tap to connect
          </ThemedText>
        )}
      </View>
      <Feather
        name={account.connected ? "check-circle" : "plus-circle"}
        size={22}
        color={account.connected ? theme.success : theme.tabIconDefault}
      />
    </Pressable>
  );

  const renderStyleBar = (style: DetectedStyle, index: number) => (
    <View key={style.name} style={styles.styleBarRow}>
      <ThemedText type="small" style={{ width: 90 }}>{style.name}</ThemedText>
      <View style={styles.styleBarContainer}>
        <View
          style={[
            styles.styleBar,
            { width: `${style.percentage}%`, backgroundColor: style.color },
          ]}
        />
      </View>
      <ThemedText type="small" style={{ width: 40, textAlign: "right", color: theme.tabIconDefault }}>
        {style.percentage}%
      </ThemedText>
    </View>
  );

  const renderColorSwatch = (color: ColorPalette) => (
    <View key={color.hex} style={styles.colorSwatchItem}>
      <View style={[styles.colorSwatch, { backgroundColor: color.hex, borderColor: isDark ? "#333" : "#ddd" }]} />
      <ThemedText type="caption" style={{ textAlign: "center" }}>{color.name}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>{color.percentage}%</ThemedText>
    </View>
  );

  const renderTrendInsight = (insight: TrendInsight) => (
    <View key={insight.trend} style={[styles.trendItem, { backgroundColor: theme.backgroundSecondary }]}>
      <Feather name={insight.icon} size={16} color={theme.link} />
      <ThemedText type="small" style={{ flex: 1 }}>{insight.trend}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
        {insight.count} saves
      </ThemedText>
    </View>
  );

  const renderWardrobeMatch = (match: WardrobeMatch) => (
    <Card key={match.id} style={styles.matchCard}>
      <View style={styles.matchContent}>
        <Image source={{ uri: match.savedImage }} style={styles.matchImage} />
        <View style={styles.matchDetails}>
          <View style={styles.matchHeader}>
            <ThemedText style={{ fontWeight: "600" }}>Saved Look</ThemedText>
            <View style={[styles.matchBadge, { backgroundColor: theme.link + "20" }]}>
              <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
                {match.matchPercentage}% Match
              </ThemedText>
            </View>
          </View>
          
          <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.xs }}>
            In Your Wardrobe:
          </ThemedText>
          {match.matchedItems.map((item, idx) => (
            <View key={idx} style={styles.matchedItemRow}>
              <Feather name="check" size={12} color={theme.success} />
              <ThemedText type="small">{item}</ThemedText>
            </View>
          ))}
          
          {match.missingPieces.length > 0 ? (
            <>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginTop: Spacing.sm }}>
                Missing Pieces:
              </ThemedText>
              {match.missingPieces.map((item, idx) => (
                <View key={idx} style={styles.matchedItemRow}>
                  <Feather name="shopping-bag" size={12} color={theme.warning} />
                  <ThemedText type="small" style={{ color: theme.warning }}>{item}</ThemedText>
                </View>
              ))}
            </>
          ) : null}
          
          <Pressable
            style={({ pressed }) => [
              styles.recreateButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={14} color="#FFFFFF" />
            <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Recreate This Look
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Card>
  );

  const renderAIInsight = (insight: AIInsight, index: number) => (
    <Card key={index} style={styles.insightCard}>
      <View style={styles.insightHeader}>
        <View style={[styles.insightIcon, { backgroundColor: theme.link + "20" }]}>
          <Feather name={insight.icon} size={18} color={theme.link} />
        </View>
        <ThemedText type="h4">{insight.title}</ThemedText>
      </View>
      <ThemedText style={[styles.insightDescription, { color: theme.tabIconDefault }]}>
        {insight.description}
      </ThemedText>
      {insight.actionLabel ? (
        <Pressable
          style={({ pressed }) => [
            styles.insightAction,
            { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <ThemedText type="small" style={{ color: theme.link, fontWeight: "600" }}>
            {insight.actionLabel}
          </ThemedText>
          <Feather name="arrow-right" size={14} color={theme.link} />
        </Pressable>
      ) : null}
    </Card>
  );

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={["#E4405F", "#5851DB", "#E60023"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="refresh-cw" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h1" style={styles.title}>Social Style Sync</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Analyze your saved posts to discover your aesthetic and recreate looks with your wardrobe
        </ThemedText>
      </View>

      <Card style={styles.accountsCard}>
        <ThemedText type="h4" style={styles.sectionTitle}>Connect Your Accounts</ThemedText>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.md }}>
          Link your social accounts to analyze your saved posts and inspiration
        </ThemedText>
        
        <View style={styles.accountsList}>
          {accounts.map(renderSocialAccountButton)}
        </View>
      </Card>

      {connectedAccounts.length > 0 ? (
        <Pressable
          onPress={handleAnalyzeSaves}
          disabled={isAnalyzing}
          style={({ pressed }) => [
            styles.analyzeButton,
            { opacity: pressed || isAnalyzing ? 0.8 : 1 },
          ]}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.analyzeGradient}
          >
            {isAnalyzing ? (
              <>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <ThemedText style={styles.analyzeText}>Analyzing Your Saves...</ThemedText>
              </>
            ) : (
              <>
                <Feather name="cpu" size={20} color="#FFFFFF" />
                <ThemedText style={styles.analyzeText}>
                  {hasAnalyzed ? "Re-analyze Saves" : "Analyze My Saves"}
                </ThemedText>
              </>
            )}
          </LinearGradient>
        </Pressable>
      ) : null}

      {hasAnalyzed ? (
        <>
          <Card style={styles.analysisCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>Your Aesthetic Profile</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.lg }}>
              Based on {connectedAccounts.reduce((sum, a) => sum + (a.postsAnalyzed || 0), 0)} saved posts
            </ThemedText>
            
            <ThemedText style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
              Detected Styles
            </ThemedText>
            <View style={styles.styleBars}>
              {detectedStyles.map(renderStyleBar)}
            </View>
          </Card>

          <Card style={styles.paletteCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>Your Color Palette</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.md }}>
              Colors that dominate your saved looks
            </ThemedText>
            <View style={styles.colorSwatches}>
              {colorPalette.map(renderColorSwatch)}
            </View>
          </Card>

          <Card style={styles.trendsCard}>
            <ThemedText type="h4" style={styles.sectionTitle}>Trending in Your Saves</ThemedText>
            <View style={styles.trendsList}>
              {trendInsights.map(renderTrendInsight)}
            </View>
          </Card>

          <View style={styles.matchesSection}>
            <ThemedText type="h3" style={styles.sectionHeader}>Wardrobe Matches</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.md }}>
              Recreate your saved looks with items you own
            </ThemedText>
            {wardrobeMatches.map(renderWardrobeMatch)}
          </View>

          <View style={styles.insightsSection}>
            <ThemedText type="h3" style={styles.sectionHeader}>AI Style Insights</ThemedText>
            {aiInsights.map(renderAIInsight)}
          </View>
        </>
      ) : connectedAccounts.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="image" size={48} color={theme.tabIconDefault} />
          <ThemedText type="h4" style={styles.emptyTitle}>Connect to Get Started</ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
            Link your Instagram or Pinterest to analyze your saved posts and discover your unique style DNA
          </ThemedText>
        </Card>
      ) : null}

      <Card style={styles.privacyCard}>
        <View style={styles.privacyHeader}>
          <Feather name="shield" size={18} color={theme.link} />
          <ThemedText style={{ fontWeight: "600" }}>Your Privacy</ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.tabIconDefault, lineHeight: 20 }}>
          We only analyze your saved and liked posts to understand your style preferences. Your data is never shared and you can disconnect accounts at any time.
        </ThemedText>
      </Card>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  sectionHeader: {
    marginBottom: Spacing.xs,
  },
  accountsCard: {
    padding: Spacing.lg,
  },
  accountsList: {
    gap: Spacing.sm,
  },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  accountInfo: {
    flex: 1,
  },
  analyzeButton: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  analyzeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  analyzeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  analysisCard: {
    padding: Spacing.lg,
  },
  styleBars: {
    gap: Spacing.sm,
  },
  styleBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  styleBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(128,128,128,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  styleBar: {
    height: "100%",
    borderRadius: 4,
  },
  paletteCard: {
    padding: Spacing.lg,
  },
  colorSwatches: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  colorSwatchItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  trendsCard: {
    padding: Spacing.lg,
  },
  trendsList: {
    gap: Spacing.sm,
  },
  trendItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  matchesSection: {
    gap: Spacing.md,
  },
  matchCard: {
    padding: Spacing.md,
  },
  matchContent: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  matchImage: {
    width: 100,
    height: 140,
    borderRadius: BorderRadius.md,
  },
  matchDetails: {
    flex: 1,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  matchedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 4,
  },
  recreateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  insightsSection: {
    gap: Spacing.md,
  },
  insightCard: {
    padding: Spacing.lg,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  insightDescription: {
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  insightAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
  privacyCard: {
    padding: Spacing.lg,
  },
  privacyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
});
