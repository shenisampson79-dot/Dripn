/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useCallback } from "react";
import { StyleSheet, View, Pressable, Image, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, StyleThemes, StyleTheme, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSocial, UserSummary } from "@/contexts/SocialContext";
import { useBodyProfile } from "@/contexts/BodyProfileContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";
import { apiService } from "@/services/ApiService";

type StyleSoulmatesScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "StyleSoulmates">;
};

interface StyleMatch extends UserSummary {
  matchPercentage: number;
  styleMatchPercentage: number;
  bodyMatchPercentage: number;
  sharedStyles: string[];
  sharedColors: string[];
  compatibilityNote: string;
}

const STYLE_LABELS: Record<StyleTheme, string> = {
  luxury: "Minimalist",
  streetwear: "Casual",
  boho: "Creative",
  sporty: "Active",
  "smart-casual": "Smart Casual",
  business: "Professional",
  edgy: "Trendsetter",
};

const STYLE_ICONS: Record<StyleTheme, keyof typeof Feather.glyphMap> = {
  luxury: "award",
  streetwear: "zap",
  boho: "sun",
  sporty: "activity",
  "smart-casual": "coffee",
  business: "briefcase",
  edgy: "moon",
};

export default function StyleSoulmatesScreen({ navigation }: StyleSoulmatesScreenProps) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { followUser, sendFriendRequest, isFollowing, isFriend, hasPendingRequestTo } = useSocial();
  const { hasBodyProfile } = useBodyProfile();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [styleMatches, setStyleMatches] = useState<StyleMatch[]>([]);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const getStyleColor = (style: StyleTheme): string => {
    const colors = StyleThemes[style];
    return isDark ? colors.dark.primary : colors.light.primary;
  };

  const handleAnalyze = useCallback(async () => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await apiService.getStyleSoulmates();
      const raw = result.soulmates || [];
      const mapped: StyleMatch[] = raw.map((m) => ({
        id: m.id,
        name: m.name,
        avatar: m.avatar,
        tier: (m.tier as UserSummary['tier']) || 'styleContributor',
        matchPercentage: m.matchPercentage,
        styleMatchPercentage: m.styleMatchPercentage,
        bodyMatchPercentage: m.bodyMatchPercentage,
        sharedStyles: m.sharedStyles || [],
        sharedColors: m.sharedColors || [],
        compatibilityNote: m.compatibilityNote || 'Style DNA overlap',
      }));
      setStyleMatches(mapped);
      setHasAnalyzed(true);
    } catch (err) {
      console.warn('[StyleSoulmates] fetch failed:', err);
      setStyleMatches([]);
      setHasAnalyzed(true);
      setAnalyzeError('Could not load matches right now. Try again in a moment.');
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleUserPress = (userId: string) => {
    navigation.navigate("UserProfile", { userId });
  };

  const handleFollow = async (user: StyleMatch) => {
    if (!isFollowing(user.id)) {
      await followUser(user.id);
    }
  };

  const handleConnect = async (user: StyleMatch) => {
    if (!isFriend(user.id) && !hasPendingRequestTo(user.id)) {
      await sendFriendRequest(user.id, user.name);
    }
  };

  const handleScanBody = () => {
    navigation.navigate("BodyScanner");
  };

  const renderMatchCard = (match: StyleMatch) => {
    const isFollowingUser = isFollowing(match.id);
    const isFriendUser = isFriend(match.id);
    const hasPending = hasPendingRequestTo(match.id);

    return (
      <Card key={match.id} style={styles.matchCard}>
        <Pressable
          onPress={() => handleUserPress(match.id)}
          style={({ pressed }) => [styles.cardContent, { opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={styles.matchHeader}>
            <View style={[styles.avatarContainer, { borderColor: theme.link }]}>
              {match.avatar ? (
                <Image source={{ uri: match.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="user" size={28} color={theme.tabIconDefault} />
                </View>
              )}
            </View>
            
            <View style={styles.matchInfo}>
              <ThemedText type="h3">{match.name}</ThemedText>
              <View style={styles.locationRow}>
                <Feather name="map-pin" size={12} color={theme.tabIconDefault} />
                <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                  {match.country || "Unknown"}
                </ThemedText>
              </View>
            </View>

            <View style={styles.matchPercentageContainer}>
              <LinearGradient
                colors={["#667eea", "#764ba2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.percentageBadge}
              >
                <ThemedText style={styles.percentageText}>{match.matchPercentage}%</ThemedText>
              </LinearGradient>
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>overall</ThemedText>
            </View>
          </View>

          <View style={styles.matchBreakdown}>
            <View style={styles.matchBreakdownItem}>
              <Feather name="heart" size={14} color={theme.link} />
              <ThemedText type="small" style={{ color: theme.text }}>
                Style: {match.styleMatchPercentage}%
              </ThemedText>
            </View>
            <View style={styles.matchBreakdownItem}>
              <Feather name="user" size={14} color={hasBodyProfile ? theme.success : theme.tabIconDefault} />
              <ThemedText type="small" style={{ color: hasBodyProfile ? theme.text : theme.tabIconDefault }}>
                Body: {hasBodyProfile ? `${match.bodyMatchPercentage}%` : "Scan needed"}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="small" style={[styles.compatibilityNote, { color: theme.tabIconDefault }]}>
            {match.compatibilityNote}
          </ThemedText>

          <View style={styles.sharedSection}>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
              Shared Styles
            </ThemedText>
            <View style={styles.sharedStylesRow}>
              {match.sharedStyles.map((style) => {
                const themeKey = style as StyleTheme;
                const known = Boolean(STYLE_LABELS[themeKey]);
                const color = known ? getStyleColor(themeKey) : theme.link;
                return (
                  <View
                    key={style}
                    style={[styles.styleBadge, { backgroundColor: color + "20" }]}
                  >
                    <Feather
                      name={known ? STYLE_ICONS[themeKey] : "tag"}
                      size={12}
                      color={color}
                    />
                    <ThemedText type="caption" style={{ color, fontWeight: "500" }}>
                      {known ? STYLE_LABELS[themeKey] : style}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.sharedSection}>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
              Color Palette Match
            </ThemedText>
            <View style={styles.colorsRow}>
              {match.sharedColors.map((color, index) => (
                <View key={index} style={styles.colorChip}>
                  <ThemedText type="caption">{color}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => handleFollow(match)}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: isFollowingUser ? theme.backgroundSecondary : theme.link,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={isFollowingUser ? "check" : "user-plus"}
                size={14}
                color={isFollowingUser ? theme.text : "#FFFFFF"}
              />
              <ThemedText
                type="small"
                style={{ color: isFollowingUser ? theme.text : "#FFFFFF", fontWeight: "600" }}
              >
                {isFollowingUser ? "Following" : "Follow"}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleConnect(match)}
              disabled={isFriendUser || hasPending}
              style={({ pressed }) => [
                styles.actionButton,
                styles.connectButton,
                {
                  backgroundColor: isFriendUser ? theme.link + "20" : theme.backgroundSecondary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={isFriendUser ? "heart" : hasPending ? "clock" : "users"}
                size={14}
                color={isFriendUser ? theme.link : theme.text}
              />
              <ThemedText
                type="small"
                style={{ color: isFriendUser ? theme.link : theme.text, fontWeight: "600" }}
              >
                {isFriendUser ? "Connected" : hasPending ? "Pending" : "Connect"}
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Card>
    );
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerSection}>
        <LinearGradient
          colors={["#667eea", "#764ba2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerIcon}
        >
          <Feather name="heart" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h1" style={styles.title}>Style Soulmates</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Find users with matching style DNA and body compatibility
        </ThemedText>
      </View>

      {!hasBodyProfile ? (
        <Card style={styles.bodyScanPrompt}>
          <View style={styles.bodyScanPromptContent}>
            <View style={[styles.bodyScanIcon, { backgroundColor: theme.warning + "20" }]}>
              <Feather name="user" size={24} color={theme.warning} />
            </View>
            <View style={styles.bodyScanPromptText}>
              <ThemedText type="h4">Enhance Your Matches</ThemedText>
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                Scan your body to find users with similar body types
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={handleScanBody}
            style={({ pressed }) => [
              styles.bodyScanButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="camera" size={16} color="#FFFFFF" />
            <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Scan Body</ThemedText>
          </Pressable>
        </Card>
      ) : (
        <Card style={styles.bodyProfileBadge}>
          <View style={styles.bodyProfileBadgeContent}>
            <View style={[styles.bodyScanIcon, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check-circle" size={24} color={theme.success} />
            </View>
            <View style={styles.bodyScanPromptText}>
              <ThemedText type="h4">Body Profile Active</ThemedText>
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                {bodyProfile?.bodyShape ? BODY_SHAPE_LABELS[bodyProfile.bodyShape] : "Unknown"} body type
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={handleScanBody}
            style={({ pressed }) => [
              styles.bodyScanButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={16} color={theme.link} />
            <ThemedText style={{ color: theme.link, fontWeight: "600" }}>Update</ThemedText>
          </Pressable>
        </Card>
      )}

      {!hasAnalyzed ? (
        <Card style={styles.analyzeCard}>
          <Feather name="cpu" size={48} color={theme.link} style={styles.analyzeIcon} />
          <ThemedText type="h3" style={styles.analyzeTitle}>
            Discover Your Style Matches
          </ThemedText>
          <ThemedText style={[styles.analyzeDescription, { color: theme.tabIconDefault }]}>
            Our AI analyzes your style preferences, wardrobe choices, and{hasBodyProfile ? " body compatibility" : " fashion DNA"} to find 
            users with compatible aesthetics
          </ThemedText>
          
          <Pressable
            onPress={handleAnalyze}
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
              style={styles.analyzeButtonGradient}
            >
              {isAnalyzing ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <ThemedText style={styles.analyzeButtonText}>Analyzing Style DNA...</ThemedText>
                </>
              ) : (
                <>
                  <Feather name="search" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.analyzeButtonText}>Find My Style Soulmates</ThemedText>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Card>
      ) : (
        <>
          <View style={styles.resultsHeader}>
            <ThemedText type="h3">Your Matches</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              {styleMatches.length} style soulmate{styleMatches.length === 1 ? '' : 's'} found
            </ThemedText>
          </View>

          {analyzeError ? (
            <ThemedText type="body" style={{ color: theme.tabIconDefault, textAlign: 'center' }}>
              {analyzeError}
            </ThemedText>
          ) : null}

          {styleMatches.length === 0 ? (
            <Card style={styles.analyzeCard}>
              <Feather name="users" size={40} color={theme.tabIconDefault} style={styles.analyzeIcon} />
              <ThemedText type="h3" style={styles.analyzeTitle}>
                No soulmates yet
              </ThemedText>
              <ThemedText style={[styles.analyzeDescription, { color: theme.tabIconDefault }]}>
                Matching uses real member style profiles. As more people complete their Style DNA, soulmates will appear here.
              </ThemedText>
            </Card>
          ) : (
            <View style={styles.matchesList}>
              {styleMatches.map(renderMatchCard)}
            </View>
          )}

          <Pressable
            onPress={handleAnalyze}
            style={({ pressed }) => [
              styles.refreshButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={16} color={theme.link} />
            <ThemedText style={{ color: theme.link, fontWeight: "600" }}>
              Refresh Matches
            </ThemedText>
          </Pressable>
        </>
      )}
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
  bodyScanPrompt: {
    padding: Spacing.md,
  },
  bodyScanPromptContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  bodyScanIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyScanPromptText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  bodyScanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  bodyProfileBadge: {
    padding: Spacing.md,
  },
  bodyProfileBadgeContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  analyzeCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  analyzeIcon: {
    marginBottom: Spacing.md,
  },
  analyzeTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  analyzeDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  analyzeButton: {
    width: "100%",
  },
  analyzeButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  analyzeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchesList: {
    gap: Spacing.md,
  },
  matchCard: {
    padding: 0,
    overflow: "hidden",
  },
  cardContent: {
    padding: Spacing.md,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  matchInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  matchPercentageContainer: {
    alignItems: "center",
  },
  percentageBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  percentageText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  matchBreakdown: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  matchBreakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  bodyMatchSection: {
    marginBottom: Spacing.md,
  },
  bodyMatchTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  bodyTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  compatibilityNote: {
    fontStyle: "italic",
    marginBottom: Spacing.md,
  },
  sharedSection: {
    marginBottom: Spacing.md,
  },
  sharedStylesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  styleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  colorsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  colorChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(128, 128, 128, 0.2)",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  connectButton: {},
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
});
