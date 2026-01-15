import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type MixMatchScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "MixMatch">;
};

interface Challenge {
  id: string;
  title: string;
  description: string;
  theme: string;
  requiredPieces: string[];
  expiresAt: string;
  entryCount: number;
  prizeDescription?: string;
  hasSubmitted?: boolean;
}

interface Entry {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  imageUrl: string;
  description: string;
  votes: number;
  submittedAt: string;
}

export default function MixMatchScreen({ navigation }: MixMatchScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getActiveMixMatch();
      if (response.success) {
        setChallenges(response.challenges);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load challenges");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const fetchEntries = async (challengeId: string) => {
    try {
      setLoadingEntries(true);
      const response = await apiService.getMixMatchEntries(challengeId);
      if (response.success) {
        setEntries(response.entries);
      }
    } catch (err: any) {
      console.error("Failed to load entries:", err);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleSelectChallenge = async (challenge: Challenge) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChallenge(challenge);
    await fetchEntries(challenge.id);
  };

  const handleSubmitEntry = async () => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to submit an entry.");
      return;
    }

    if (!selectedChallenge) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const imageBase64 = result.assets[0].base64;
      if (!imageBase64) {
        Alert.alert("Error", "Failed to process image");
        return;
      }

      setSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const imageUrl = `data:image/jpeg;base64,${imageBase64}`;
      const response = await apiService.submitMixMatchEntry(selectedChallenge.id, {
        imageUrl,
        description: `My ${selectedChallenge.theme} outfit`,
      });

      if (response.success) {
        Alert.alert("Success", "Your entry has been submitted!");
        setSelectedChallenge(prev => prev ? { ...prev, hasSubmitted: true } : null);
        await fetchEntries(selectedChallenge.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit entry");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (entryId: string) => {
    if (!user) {
      Alert.alert("Sign In Required", "Please sign in to vote.");
      return;
    }

    if (!selectedChallenge) return;

    try {
      setVoting(entryId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const response = await apiService.voteMixMatchEntry(selectedChallenge.id, entryId);
      if (response.success) {
        setEntries(prev => prev.map(e => 
          e.id === entryId ? { ...e, votes: e.votes + 1 } : e
        ));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to vote");
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
    if (hours > 24) return `${Math.floor(hours / 24)}d left`;
    return `${hours}h left`;
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          Loading challenges...
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
          onPress={fetchChallenges}
          style={[styles.retryButton, { backgroundColor: theme.link }]}
        >
          <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (selectedChallenge) {
    return (
      <ScreenScrollView contentContainerStyle={styles.container}>
        <Pressable
          onPress={() => {
            setSelectedChallenge(null);
            setEntries([]);
          }}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={20} color={theme.link} />
          <ThemedText style={{ color: theme.link }}>Back to Challenges</ThemedText>
        </Pressable>

        <Card style={styles.challengeDetailCard}>
          <View style={styles.challengeHeader}>
            <View style={[styles.themeBadge, { backgroundColor: theme.warning + "20" }]}>
              <ThemedText style={[styles.themeText, { color: theme.warning }]}>
                {selectedChallenge.theme}
              </ThemedText>
            </View>
            <View style={[styles.timeBadge, { backgroundColor: theme.link + "20" }]}>
              <Feather name="clock" size={12} color={theme.link} />
              <ThemedText style={[styles.timeText, { color: theme.link }]}>
                {getTimeRemaining(selectedChallenge.expiresAt)}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="h3" style={styles.challengeTitle}>
            {selectedChallenge.title}
          </ThemedText>
          <ThemedText style={[styles.challengeDescription, { color: theme.tabIconDefault }]}>
            {selectedChallenge.description}
          </ThemedText>

          <View style={styles.requiredSection}>
            <ThemedText style={styles.requiredLabel}>Required Pieces:</ThemedText>
            <View style={styles.piecesList}>
              {selectedChallenge.requiredPieces.map((piece, idx) => (
                <View key={idx} style={[styles.pieceBadge, { backgroundColor: theme.backgroundSecondary }]}>
                  <ThemedText style={styles.pieceText}>{piece}</ThemedText>
                </View>
              ))}
            </View>
          </View>

          {selectedChallenge.prizeDescription ? (
            <View style={[styles.prizeContainer, { backgroundColor: theme.success + "10" }]}>
              <Feather name="gift" size={16} color={theme.success} />
              <ThemedText style={{ color: theme.success }}>
                {selectedChallenge.prizeDescription}
              </ThemedText>
            </View>
          ) : null}

          {!selectedChallenge.hasSubmitted ? (
            <Pressable
              onPress={handleSubmitEntry}
              disabled={submitting}
              style={[
                styles.submitEntryButton,
                { backgroundColor: theme.link, opacity: submitting ? 0.6 : 1 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Feather name="camera" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.submitButtonText}>Submit My Outfit</ThemedText>
                </>
              )}
            </Pressable>
          ) : (
            <View style={[styles.submittedBadge, { backgroundColor: theme.success + "20" }]}>
              <Feather name="check-circle" size={16} color={theme.success} />
              <ThemedText style={{ color: theme.success }}>You've submitted an entry!</ThemedText>
            </View>
          )}
        </Card>

        <View style={styles.entriesSection}>
          <ThemedText type="h4" style={styles.entriesTitle}>
            Entries ({selectedChallenge.entryCount})
          </ThemedText>

          {loadingEntries ? (
            <ActivityIndicator color={theme.link} />
          ) : entries.length === 0 ? (
            <Card style={styles.emptyEntriesCard}>
              <Feather name="image" size={32} color={theme.tabIconDefault} />
              <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
                No entries yet. Be the first!
              </ThemedText>
            </Card>
          ) : (
            <View style={styles.entriesGrid}>
              {entries.map((entry, index) => (
                <Animated.View 
                  key={entry.id} 
                  entering={FadeInDown.delay(index * 50).springify()}
                  style={styles.entryCard}
                >
                  <Image
                    source={{ uri: entry.imageUrl }}
                    style={styles.entryImage}
                    contentFit="cover"
                  />
                  <View style={[styles.entryInfo, { backgroundColor: theme.backgroundDefault }]}>
                    <View style={styles.entryUser}>
                      <ThemedText style={styles.entryUserName}>{entry.userName}</ThemedText>
                    </View>
                    <Pressable
                      onPress={() => handleVote(entry.id)}
                      disabled={voting === entry.id}
                      style={[styles.voteButton, { backgroundColor: theme.link + "20" }]}
                    >
                      {voting === entry.id ? (
                        <ActivityIndicator color={theme.link} size="small" />
                      ) : (
                        <>
                          <Feather name="heart" size={14} color={theme.link} />
                          <ThemedText style={{ color: theme.link, fontWeight: "600" }}>
                            {entry.votes}
                          </ThemedText>
                        </>
                      )}
                    </Pressable>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <Animated.View entering={FadeIn.duration(300)}>
        <ThemedText type="h2" style={styles.title}>Mix & Match</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.tabIconDefault }]}>
          Create winning outfit combinations
        </ThemedText>
      </Animated.View>

      {challenges.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="clock" size={48} color={theme.tabIconDefault} />
          <ThemedText type="h4" style={styles.emptyTitle}>No Active Challenges</ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.tabIconDefault }]}>
            Check back soon for new styling challenges!
          </ThemedText>
        </Card>
      ) : (
        challenges.map((challenge, index) => (
          <Animated.View key={challenge.id} entering={FadeInDown.delay(index * 100).springify()}>
            <Pressable onPress={() => handleSelectChallenge(challenge)}>
              <Card style={styles.challengeCard}>
                <View style={styles.challengeHeader}>
                  <View style={[styles.themeBadge, { backgroundColor: theme.warning + "20" }]}>
                    <ThemedText style={[styles.themeText, { color: theme.warning }]}>
                      {challenge.theme}
                    </ThemedText>
                  </View>
                  <View style={[styles.timeBadge, { backgroundColor: theme.link + "20" }]}>
                    <Feather name="clock" size={12} color={theme.link} />
                    <ThemedText style={[styles.timeText, { color: theme.link }]}>
                      {getTimeRemaining(challenge.expiresAt)}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText type="h4" style={styles.challengeCardTitle}>
                  {challenge.title}
                </ThemedText>
                <ThemedText style={[styles.challengeCardDescription, { color: theme.tabIconDefault }]}>
                  {challenge.description}
                </ThemedText>

                <View style={styles.challengeFooter}>
                  <View style={styles.entriesCount}>
                    <Feather name="users" size={14} color={theme.tabIconDefault} />
                    <ThemedText style={[styles.entriesCountText, { color: theme.tabIconDefault }]}>
                      {challenge.entryCount} entries
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
                </View>
              </Card>
            </Pressable>
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
  challengeCard: {
    padding: Spacing.lg,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  themeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  themeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
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
  challengeCardTitle: {
    marginBottom: Spacing.xs,
  },
  challengeCardDescription: {
    fontSize: Typography.small.fontSize,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  challengeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entriesCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  entriesCountText: {
    fontSize: Typography.small.fontSize,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  challengeDetailCard: {
    padding: Spacing.lg,
  },
  challengeTitle: {
    marginBottom: Spacing.sm,
  },
  challengeDescription: {
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  requiredSection: {
    marginBottom: Spacing.lg,
  },
  requiredLabel: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  piecesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  pieceBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  pieceText: {
    fontSize: Typography.small.fontSize,
  },
  prizeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  submitEntryButton: {
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
  },
  submittedBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  entriesSection: {
    marginTop: Spacing.md,
  },
  entriesTitle: {
    marginBottom: Spacing.md,
  },
  emptyEntriesCard: {
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  entriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  entryCard: {
    width: "48%",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  entryImage: {
    width: "100%",
    height: 160,
  },
  entryInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.sm,
  },
  entryUser: {
    flex: 1,
  },
  entryUserName: {
    fontSize: Typography.small.fontSize,
    fontWeight: "600",
  },
  voteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
});
