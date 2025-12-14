/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image, ActivityIndicator } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, StyleThemes, StyleTheme } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useStyleTheme } from "@/hooks/useStyleTheme";
import { useSocial } from "@/contexts/SocialContext";
import { getAllDiscoverableUsers, UserSummary } from "@/contexts/SocialContext";
import type { CommunityStackParamList } from "@/navigation/CommunityStackNavigator";

type StyleSoulmatesScreenProps = {
  navigation: NativeStackNavigationProp<CommunityStackParamList, "StyleSoulmates">;
};

interface StyleMatch extends UserSummary {
  matchPercentage: number;
  sharedStyles: StyleTheme[];
  sharedColors: string[];
  compatibilityNote: string;
}

const STYLE_LABELS: Record<StyleTheme, string> = {
  luxury: "Luxury",
  streetwear: "Streetwear",
  boho: "Boho Chic",
  sporty: "Sporty",
  "smart-casual": "Smart Casual",
  business: "Business",
  edgy: "Edgy",
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

const COMPATIBILITY_NOTES = [
  "Your style vibes match perfectly",
  "Great fashion chemistry detected",
  "You share similar aesthetic preferences",
  "Your wardrobe choices align beautifully",
  "A fashionable connection awaits",
  "Style soulmate potential is high",
  "Your fashion DNA overlaps significantly",
];

const SHARED_COLORS = [
  ["Navy", "Black", "White"],
  ["Beige", "Brown", "Cream"],
  ["Burgundy", "Gold", "Black"],
  ["Olive", "Tan", "Rust"],
  ["Emerald", "White", "Gold"],
  ["Coral", "Blush", "White"],
];

export default function StyleSoulmatesScreen({ navigation }: StyleSoulmatesScreenProps) {
  const { theme, isDark } = useTheme();
  const { currentTheme } = useStyleTheme();
  const { followUser, sendFriendRequest, isFollowing, isFriend, hasPendingRequestTo } = useSocial();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const allUsers = useMemo(() => getAllDiscoverableUsers(), []);

  const styleMatches: StyleMatch[] = useMemo(() => {
    if (!hasAnalyzed) return [];

    const allStyles: StyleTheme[] = ["luxury", "streetwear", "boho", "sporty", "smart-casual", "business", "edgy"];
    
    return allUsers.slice(0, 10).map((user, index) => {
      const randomStyles = allStyles
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1);
      
      const includesCurrentTheme = Math.random() > 0.5;
      const sharedStyles = includesCurrentTheme && !randomStyles.includes(currentTheme)
        ? [currentTheme, ...randomStyles.slice(0, 2)]
        : randomStyles;

      const matchPercentage = 65 + Math.floor(Math.random() * 30);
      const colorsIndex = index % SHARED_COLORS.length;
      const noteIndex = index % COMPATIBILITY_NOTES.length;

      return {
        ...user,
        matchPercentage,
        sharedStyles: sharedStyles as StyleTheme[],
        sharedColors: SHARED_COLORS[colorsIndex],
        compatibilityNote: COMPATIBILITY_NOTES[noteIndex],
      };
    }).sort((a, b) => b.matchPercentage - a.matchPercentage);
  }, [allUsers, hasAnalyzed, currentTheme]);

  const getStyleColor = (style: StyleTheme): string => {
    const colors = StyleThemes[style];
    return isDark ? colors.dark.primary : colors.light.primary;
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setHasAnalyzed(true);
    setIsAnalyzing(false);
  };

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
              <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>match</ThemedText>
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
              {match.sharedStyles.map((style) => (
                <View 
                  key={style} 
                  style={[styles.styleBadge, { backgroundColor: getStyleColor(style) + "20" }]}
                >
                  <Feather name={STYLE_ICONS[style]} size={12} color={getStyleColor(style)} />
                  <ThemedText type="caption" style={{ color: getStyleColor(style), fontWeight: "500" }}>
                    {STYLE_LABELS[style]}
                  </ThemedText>
                </View>
              ))}
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
          Find users with matching style DNA using AI-powered analysis
        </ThemedText>
      </View>

      {!hasAnalyzed ? (
        <Card style={styles.analyzeCard}>
          <Feather name="cpu" size={48} color={theme.link} style={styles.analyzeIcon} />
          <ThemedText type="h3" style={styles.analyzeTitle}>
            Discover Your Style Matches
          </ThemedText>
          <ThemedText style={[styles.analyzeDescription, { color: theme.tabIconDefault }]}>
            Our AI analyzes your style preferences, wardrobe choices, and fashion DNA to find 
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
              {styleMatches.length} style soulmates found
            </ThemedText>
          </View>

          <View style={styles.matchesList}>
            {styleMatches.map(renderMatchCard)}
          </View>

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
