import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Alert, Dimensions } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withSpring, useSharedValue } from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LinearGradient } from "expo-linear-gradient";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type StyleShowdownScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "StyleShowdown">;
};

interface Showdown {
  id: string;
  title: string;
  description: string;
  options: Array<{
    id: number;
    imageUrl: string;
    label: string;
    votes: number;
  }>;
  expiresAt: string;
  totalVotes: number;
  userVoted?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const OPTION_SIZE = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.md) / 2;

export default function StyleShowdownScreen({ navigation }: StyleShowdownScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const [showdowns, setShowdowns] = useState<Showdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchShowdowns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getActiveShowdowns();
      if (response.showdowns && Array.isArray(response.showdowns)) {
        const mapped = response.showdowns.map((s: any) => ({
          id: String(s.id),
          title: s.theme || "Style Battle",
          description: s.outfitA?.occasion || "",
          options: [
            { id: 1, imageUrl: s.outfitA?.imageUrl || "", label: s.outfitA?.name || "Option A", votes: s.votesA || 0 },
            { id: 2, imageUrl: s.outfitB?.imageUrl || "", label: s.outfitB?.name || "Option B", votes: s.votesB || 0 },
          ],
          expiresAt: s.expiresAt,
          totalVotes: s.totalVotes || 0,
          outfitA: s.outfitA,
          outfitB: s.outfitB,
        }));
        setShowdowns(mapped);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load showdowns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShowdowns();
  }, [fetchShowdowns]);

  const handleVote = async (showdownId: string, optionId: number) => {
    if (!user) {
      Alert.alert(t('common.signInRequired'), t('common.pleaseSignInToVote'));
      return;
    }

    try {
      setVoting(showdownId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const response = await apiService.voteShowdown(showdownId, optionId);
      if (response.success) {
        setShowdowns(prev => prev.map(s => {
          if (s.id === showdownId) {
            return {
              ...s,
              userVoted: optionId,
              totalVotes: s.totalVotes + 1,
              options: s.options.map(o => ({
                ...o,
                votes: response.updatedVotes[o.id] ?? o.votes,
              })),
            };
          }
          return s;
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('styleShowdown.failedSubmitVote'));
    } finally {
      setVoting(null);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return "Ended";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const getVotePercentage = (option: { votes: number }, totalVotes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((option.votes / totalVotes) * 100);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          Loading showdowns...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <Feather name="alert-circle" size={48} color={theme.error} />
        <ThemedText style={[styles.errorText, { color: theme.error }]}>{error}</ThemedText>
        <Pressable 
          onPress={fetchShowdowns}
          style={[styles.retryButton, { backgroundColor: theme.link }]}
        >
          <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <Animated.View entering={FadeIn.duration(300)}>
        <ThemedText type="h2" style={styles.title}>Style Showdown</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Vote for your favorite outfit. Quick decisions!
        </ThemedText>
      </Animated.View>

      {showdowns.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="clock" size={48} color={theme.tabIconDefault} />
          <ThemedText type="h4" style={styles.emptyTitle}>No Active Showdowns</ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
            Check back soon for new outfit battles!
          </ThemedText>
        </Card>
      ) : (
        showdowns.map((showdown, index) => (
          <Animated.View 
            key={showdown.id} 
            entering={FadeInDown.delay(index * 100).springify()}
          >
            <Card style={styles.showdownCard}>
              <View style={styles.showdownHeader}>
                <View style={styles.showdownTitleRow}>
                  <Feather name="zap" size={20} color={theme.warning} />
                  <ThemedText type="h4" style={styles.showdownTitle}>
                    {showdown.title}
                  </ThemedText>
                </View>
                <View style={[styles.timeBadge, { backgroundColor: theme.link + "20" }]}>
                  <Feather name="clock" size={12} color={theme.link} />
                  <ThemedText style={[styles.timeText, { color: theme.link }]}>
                    {getTimeRemaining(showdown.expiresAt)}
                  </ThemedText>
                </View>
              </View>

              <ThemedText style={[styles.showdownDescription, { color: theme.tabIconDefault }]}>
                {showdown.description}
              </ThemedText>

              <View style={styles.optionsContainer}>
                {showdown.options.map((option) => {
                  const hasVoted = showdown.userVoted !== undefined;
                  const isSelected = showdown.userVoted === option.id;
                  const percentage = getVotePercentage(option, showdown.totalVotes);

                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => !hasVoted && handleVote(showdown.id, option.id)}
                      disabled={hasVoted || voting === showdown.id}
                      style={({ pressed }) => [
                        styles.optionCard,
                        { 
                          borderColor: isSelected ? theme.link : theme.border,
                          opacity: pressed && !hasVoted ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: option.imageUrl }}
                        style={styles.optionImage}
                        contentFit="cover"
                      />
                      
                      {hasVoted ? (
                        <View style={styles.resultsOverlay}>
                          <View 
                            style={[
                              styles.percentageBar, 
                              { 
                                width: `${percentage}%`,
                                backgroundColor: isSelected ? theme.link : theme.tabIconDefault,
                              }
                            ]} 
                          />
                          <ThemedText style={styles.percentageText}>
                            {percentage}%
                          </ThemedText>
                        </View>
                      ) : null}

                      <View style={[styles.optionLabel, { backgroundColor: theme.backgroundDefault }]}>
                        <ThemedText style={styles.optionLabelText}>{option.label}</ThemedText>
                        {isSelected ? (
                          <Feather name="check-circle" size={16} color={theme.link} />
                        ) : null}
                      </View>

                      {voting === showdown.id ? (
                        <View style={styles.votingOverlay}>
                          <ActivityIndicator color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.voteCountContainer}>
                <Feather name="users" size={14} color={theme.tabIconDefault} />
                <ThemedText style={[styles.voteCount, { color: theme.tabIconDefault }]}>
                  {showdown.totalVotes} votes
                </ThemedText>
              </View>
            </Card>
          </Animated.View>
        ))
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
    marginBottom: Spacing.md,
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  errorText: {
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
  },
  showdownCard: {
    padding: Spacing.lg,
  },
  showdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  showdownTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flex: 1,
  },
  showdownTitle: {
    flex: 1,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  showdownDescription: {
    fontSize: Typography.small.fontSize,
    marginBottom: Spacing.md,
  },
  optionsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  optionCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    borderWidth: 2,
  },
  optionImage: {
    width: "100%",
    height: 180,
  },
  resultsOverlay: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
  },
  percentageBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.7,
  },
  percentageText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
  optionLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  optionLabelText: {
    fontWeight: "600",
    fontSize: Typography.small.fontSize,
  },
  votingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  voteCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  voteCount: {
    fontSize: Typography.small.fontSize,
  },
});
