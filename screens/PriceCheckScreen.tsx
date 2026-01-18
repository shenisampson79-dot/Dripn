import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

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

type PriceCheckScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "PriceCheck">;
};

interface PriceRound {
  id: string;
  imageUrl: string;
  itemName: string;
  itemDescription: string;
  brand?: string;
  hints: string[];
  expiresAt: string;
  userGuess?: number;
  actualPrice?: number;
  isRevealed: boolean;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string;
  score: number;
  rank: number;
  accuracyRate: number;
}

export default function PriceCheckScreen({ navigation }: PriceCheckScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [round, setRound] = useState<PriceRound | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [guessInput, setGuessInput] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [result, setResult] = useState<{ difference?: number; points?: number; rank?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [roundRes, leaderboardRes] = await Promise.all([
        apiService.getActivePriceCheck(),
        apiService.getPriceCheckLeaderboard(),
      ]);
      
      if (roundRes.available && roundRes.round) {
        const r = roundRes.round;
        const totalPrice = r.outfit?.items?.reduce((sum: number, item: any) => sum + (item.price || 0), 0) || 0;
        setRound({
          id: String(r.id),
          imageUrl: r.outfit?.imageUrl || "",
          itemName: r.outfit?.name || "Mystery Outfit",
          itemDescription: r.outfit?.funFact || r.category || "",
          brand: r.outfit?.items?.[0]?.brand,
          hints: r.outfit?.hint ? [r.outfit.hint] : [],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          isRevealed: false,
          actualPrice: totalPrice * 100,
        });
      }
      if (leaderboardRes.leaderboard && Array.isArray(leaderboardRes.leaderboard)) {
        setLeaderboard(leaderboardRes.leaderboard);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load price check");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitGuess = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to play.");
      return;
    }

    const guessValue = parseFloat(guessInput.replace(/[^0-9.]/g, ""));
    if (isNaN(guessValue) || guessValue <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price.");
      return;
    }

    if (!round) return;

    try {
      setSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const guessInCents = Math.round(guessValue * 100);
      const response = await apiService.submitPriceGuess(round.id, guessInCents);
      
      if (response.success) {
        setResult({
          difference: response.difference,
          points: response.points,
          rank: response.rank,
        });
        setRound(prev => prev ? { ...prev, userGuess: guessInCents } : null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit guess");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return "Ended";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          Loading price check...
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
          onPress={fetchData}
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
        <View style={styles.header}>
          <View>
            <ThemedText type="h2" style={styles.title}>Price Check</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
              Guess the price. Closest wins!
            </ThemedText>
          </View>
          <Pressable
            onPress={() => setShowLeaderboard(!showLeaderboard)}
            style={[styles.leaderboardToggle, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Feather name="award" size={20} color={theme.warning} />
          </Pressable>
        </View>
      </Animated.View>

      {showLeaderboard ? (
        <Animated.View entering={FadeInDown.springify()}>
          <Card style={styles.leaderboardCard}>
            <View style={styles.leaderboardHeader}>
              <Feather name="award" size={20} color={theme.warning} />
              <ThemedText type="h4">Top Guessers</ThemedText>
            </View>
            {leaderboard.length === 0 ? (
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                No rankings yet
              </ThemedText>
            ) : (
              leaderboard.slice(0, 10).map((entry, index) => (
                <View key={entry.userId} style={styles.leaderboardEntry}>
                  <ThemedText style={[styles.rankText, { color: index < 3 ? theme.warning : theme.tabIconDefault }]}>
                    #{entry.rank}
                  </ThemedText>
                  <View style={styles.entryInfo}>
                    <ThemedText style={styles.entryName}>{entry.name}</ThemedText>
                    <ThemedText style={[styles.entryScore, { color: theme.tabIconDefault }]}>
                      {entry.accuracyRate}% accuracy
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.entryPoints, { color: theme.link }]}>
                    {entry.score} pts
                  </ThemedText>
                </View>
              ))
            )}
          </Card>
        </Animated.View>
      ) : null}

      {!round ? (
        <Card style={styles.emptyCard}>
          <Feather name="clock" size={48} color={theme.tabIconDefault} />
          <ThemedText type="h4" style={styles.emptyTitle}>No Active Round</ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
            Check back soon for the next price check!
          </ThemedText>
        </Card>
      ) : (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={styles.roundCard}>
            <View style={styles.timerBadge}>
              <Feather name="clock" size={14} color={theme.link} />
              <ThemedText style={[styles.timerText, { color: theme.link }]}>
                {getTimeRemaining(round.expiresAt)}
              </ThemedText>
            </View>

            <Image
              source={{ uri: round.imageUrl }}
              style={styles.itemImage}
              contentFit="cover"
            />

            <View style={styles.itemInfo}>
              {round.brand ? (
                <ThemedText style={[styles.brandText, { color: theme.tabIconDefault }]}>
                  {round.brand}
                </ThemedText>
              ) : null}
              <ThemedText type="h3" style={styles.itemName}>{round.itemName}</ThemedText>
              <ThemedText style={[styles.itemDescription, { color: theme.tabIconDefault }]}>
                {round.itemDescription}
              </ThemedText>
            </View>

            {round.hints.length > 0 ? (
              <View style={styles.hintsContainer}>
                <ThemedText style={[styles.hintsTitle, { color: theme.tabIconDefault }]}>
                  Hints:
                </ThemedText>
                {round.hints.map((hint, idx) => (
                  <View key={idx} style={styles.hintItem}>
                    <Feather name="info" size={12} color={theme.link} />
                    <ThemedText style={[styles.hintText, { color: theme.text }]}>
                      {hint}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            {round.userGuess ? (
              <Animated.View entering={FadeInUp.springify()} style={styles.resultContainer}>
                <ThemedText style={[styles.guessedText, { color: theme.tabIconDefault }]}>
                  Your guess: {formatPrice(round.userGuess)}
                </ThemedText>
                {result ? (
                  <View style={styles.resultInfo}>
                    {result.points !== undefined ? (
                      <View style={[styles.resultBadge, { backgroundColor: theme.success + "20" }]}>
                        <Feather name="star" size={16} color={theme.success} />
                        <ThemedText style={{ color: theme.success, fontWeight: "600" }}>
                          +{result.points} points
                        </ThemedText>
                      </View>
                    ) : null}
                    {result.rank !== undefined ? (
                      <ThemedText style={[styles.rankResult, { color: theme.tabIconDefault }]}>
                        Current rank: #{result.rank}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
                {round.isRevealed && round.actualPrice ? (
                  <View style={[styles.revealedPrice, { backgroundColor: theme.warning + "20" }]}>
                    <ThemedText style={{ color: theme.warning, fontWeight: "700" }}>
                      Actual Price: {formatPrice(round.actualPrice)}
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText style={[styles.waitingText, { color: theme.tabIconDefault }]}>
                    Price will be revealed when round ends
                  </ThemedText>
                )}
              </Animated.View>
            ) : (
              <View style={styles.guessInputContainer}>
                <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={styles.dollarSign}>$</ThemedText>
                  <TextInput
                    style={[styles.priceInput, { color: theme.text }]}
                    value={guessInput}
                    onChangeText={setGuessInput}
                    placeholder="0.00"
                    placeholderTextColor={theme.tabIconDefault}
                    keyboardType="decimal-pad"
                    editable={!submitting}
                  />
                </View>
                <Pressable
                  onPress={handleSubmitGuess}
                  disabled={submitting || !guessInput}
                  style={[
                    styles.submitButton,
                    { 
                      backgroundColor: theme.link,
                      opacity: submitting || !guessInput ? 0.5 : 1,
                    },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Feather name="check" size={18} color="#FFFFFF" />
                      <ThemedText style={styles.submitButtonText}>Submit Guess</ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </Card>
        </Animated.View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.body.fontSize,
  },
  leaderboardToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
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
  leaderboardCard: {
    padding: Spacing.lg,
  },
  leaderboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  leaderboardEntry: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  rankText: {
    fontWeight: "700",
    width: 30,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontWeight: "600",
  },
  entryScore: {
    fontSize: Typography.small.fontSize,
  },
  entryPoints: {
    fontWeight: "600",
  },
  roundCard: {
    padding: Spacing.lg,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-end",
    marginBottom: Spacing.sm,
  },
  timerText: {
    fontWeight: "600",
    fontSize: Typography.small.fontSize,
  },
  itemImage: {
    width: "100%",
    height: 280,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  itemInfo: {
    marginBottom: Spacing.md,
  },
  brandText: {
    fontSize: Typography.small.fontSize,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  itemName: {
    marginBottom: Spacing.xs,
  },
  itemDescription: {
    fontSize: Typography.body.fontSize,
    lineHeight: 22,
  },
  hintsContainer: {
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  hintsTitle: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
    marginBottom: 4,
  },
  hintItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  hintText: {
    flex: 1,
    fontSize: Typography.small.fontSize,
  },
  guessInputContainer: {
    gap: Spacing.md,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    height: 56,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: "600",
    marginRight: Spacing.xs,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "600",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: Typography.body.fontSize,
  },
  resultContainer: {
    alignItems: "center",
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  guessedText: {
    fontSize: Typography.body.fontSize,
  },
  resultInfo: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  rankResult: {
    fontSize: Typography.small.fontSize,
  },
  revealedPrice: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  waitingText: {
    fontSize: Typography.small.fontSize,
    fontStyle: "italic",
  },
});
