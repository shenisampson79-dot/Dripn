import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Alert,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import {
  CommunityVotingService,
  VotingSession,
  VoteReason,
  VotingResult,
} from "@/services/CommunityVotingService";
import { useAuth } from "@/contexts/AuthContext";

const PREVIEW_SESSION: VotingSession = {
  id: "preview_session",
  userId: "other_user",
  occasion: "Evening Gala",
  context:
    "I'm going to a formal black-tie event and want to make sure I look sophisticated but modern.",
  outfitOptions: [
    {
      id: "1",
      description:
        "Midnight blue tuxedo with a silk lapel, paired with polished patent leather shoes.",
      aiExplanation: "Classic formal choice that suits your profile.",
      label: "Recommended",
      imageUrl:
        "https://images.unsplash.com/photo-1594932224031-94f064146311?auto=format&fit=crop&q=80&w=400",
    },
    {
      id: "2",
      description:
        "Dark charcoal velvet blazer with black tailored trousers and a silk turtleneck.",
      aiExplanation: "A modern alternative for a contemporary formal look.",
      label: "Backup option",
      imageUrl:
        "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&q=80&w=400",
    },
  ],
  status: "voting",
  expiresAt: new Date(Date.now() + 10 * 60000).toISOString(),
  aiRecommendedOptionId: "1",
};

function VoteBar({
  percentage,
  color,
  delay = 0,
}: {
  percentage: number;
  color: string;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: percentage,
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  return (
    <View style={barStyles.track}>
      <Animated.View
        style={[
          barStyles.fill,
          {
            backgroundColor: color,
            width: anim.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    flex: 1,
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});

export default function CommunityVotingScreen({ navigation, route }: any) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<VoteReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [votingResult, setVotingResult] = useState<VotingResult | null>(null);

  const session: VotingSession = route.params?.session || PREVIEW_SESSION;
  const stylistId = user?.stylistPreferences?.selectedStylistId;
  const reasons = CommunityVotingService.getVotingReasons();

  const handleSubmitVote = async () => {
    if (!selectedOptionId) return;

    if (!user?.id) {
      Alert.alert(
        "Sign in required",
        "Create a free account to help other members with their style decisions.",
        [{ text: "OK" }]
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await CommunityVotingService.submitVote(
        user.id,
        session.id,
        selectedOptionId,
        selectedReason || undefined
      );

      if (result.success) {
        const results = await CommunityVotingService.getVotingResults(
          session.id,
          stylistId
        );
        setVotingResult(results);
        setHasVoted(true);
      } else {
        Alert.alert("Unable to submit", result.error || "Please try again.");
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderResultsView = () => {
    const hasEnoughVotes = (votingResult?.totalVotes ?? 0) >= 3;

    return (
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.thankYouCard,
            {
              backgroundColor: isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.03)",
            },
          ]}
        >
          <View
            style={[
              styles.thankYouIcon,
              { backgroundColor: theme.link + "20" },
            ]}
          >
            <Feather name="check-circle" size={28} color={theme.link} />
          </View>
          <ThemedText type="h3" style={styles.thankYouTitle}>
            Opinion submitted
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.thankYouSubtitle, { color: theme.textSecondary }]}
          >
            Your style expertise helps the community make better decisions.
          </ThemedText>
        </View>

        {hasEnoughVotes && votingResult ? (
          <>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Community vote so far
            </ThemedText>

            <View style={styles.resultsList}>
              {session.outfitOptions.map((option, index) => {
                const optResult = votingResult.optionResults.find(
                  (r) => r.optionId === option.id
                );
                const pct = optResult?.percentage ?? 0;
                const isWinner =
                  optResult?.optionId === votingResult.winningOptionId;
                const isYourVote = selectedOptionId === option.id;
                const barColor = isWinner ? theme.link : theme.textSecondary;

                return (
                  <View
                    key={option.id}
                    style={[
                      styles.resultCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.02)",
                        borderColor: isWinner
                          ? theme.link + "40"
                          : "transparent",
                        borderWidth: 1.5,
                      },
                    ]}
                  >
                    <View style={styles.resultHeader}>
                      <View style={styles.resultLabelRow}>
                        <ThemedText type="small" style={styles.optionLabel}>
                          Option {String.fromCharCode(65 + index)}
                        </ThemedText>
                        {isYourVote ? (
                          <View
                            style={[
                              styles.yourVoteBadge,
                              { backgroundColor: theme.link + "15" },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={{ color: theme.link, fontWeight: "600" }}
                            >
                              Your pick
                            </ThemedText>
                          </View>
                        ) : null}
                        {isWinner ? (
                          <View
                            style={[
                              styles.yourVoteBadge,
                              { backgroundColor: theme.link + "20" },
                            ]}
                          >
                            <Feather
                              name="trending-up"
                              size={10}
                              color={theme.link}
                            />
                            <ThemedText
                              type="small"
                              style={{ color: theme.link, fontWeight: "700" }}
                            >
                              Leading
                            </ThemedText>
                          </View>
                        ) : null}
                      </View>
                      <ThemedText
                        type="h3"
                        style={{ color: isWinner ? theme.link : theme.text }}
                      >
                        {pct}%
                      </ThemedText>
                    </View>

                    <VoteBar
                      percentage={pct}
                      color={barColor}
                      delay={index * 150}
                    />

                    <ThemedText
                      type="small"
                      style={[
                        styles.resultDesc,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {option.description}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            <View
              style={[
                styles.stylistCard,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.03)",
                },
              ]}
            >
              <View style={styles.stylistCardHeader}>
                <Feather name="zap" size={14} color={theme.link} />
                <ThemedText
                  type="small"
                  style={[styles.stylistLabel, { color: theme.link }]}
                >
                  Stylist's read
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginLeft: "auto" }}
                >
                  {votingResult.totalVotes} vote
                  {votingResult.totalVotes !== 1 ? "s" : ""}
                </ThemedText>
              </View>
              <ThemedText type="body" style={styles.stylistInterpretation}>
                {votingResult.aiInterpretation}
              </ThemedText>
            </View>
          </>
        ) : (
          <View
            style={[
              styles.stylistCard,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.03)",
              },
            ]}
          >
            <View style={styles.stylistCardHeader}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={[
                  styles.stylistLabel,
                  { color: theme.textSecondary },
                ]}
              >
                Waiting for more votes
              </ThemedText>
            </View>
            <ThemedText
              type="body"
              style={[styles.stylistInterpretation, { color: theme.textSecondary }]}
            >
              {votingResult?.totalVotes === 1
                ? "One vote in so far. Results will show when more people weigh in."
                : "Results will appear once enough people have voted."}
            </ThemedText>
          </View>
        )}

        <Button onPress={() => navigation.goBack()} style={styles.doneButton}>
          Done
        </Button>
      </ScrollView>
    );
  };

  const renderVotingView = () => (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: insets.bottom + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.contextCard}>
        {session.occasion ? (
          <View style={styles.occasionBadge}>
            <Feather name="calendar" size={14} color={theme.link} />
            <ThemedText
              type="small"
              style={[styles.occasionText, { color: theme.link }]}
            >
              {session.occasion}
            </ThemedText>
          </View>
        ) : null}
        {session.context ? (
          <ThemedText type="body" style={styles.contextText}>
            "{session.context}"
          </ThemedText>
        ) : null}
      </View>

      <ThemedText type="h3" style={styles.sectionTitle}>
        Which look works best?
      </ThemedText>

      <View style={styles.optionsContainer}>
        {session.outfitOptions.map((option, index) => {
          const isSelected = selectedOptionId === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setSelectedOptionId(option.id)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.02)",
                  borderColor: isSelected ? theme.link : "transparent",
                  borderWidth: 2,
                },
              ]}
            >
              <View style={styles.optionHeader}>
                <ThemedText type="small" style={styles.optionLabel}>
                  Option {String.fromCharCode(65 + index)}
                </ThemedText>
                {isSelected ? (
                  <View
                    style={[
                      styles.checkCircle,
                      { backgroundColor: theme.link },
                    ]}
                  >
                    <Feather name="check" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>

              {option.imageUrl ? (
                <Image
                  source={{ uri: option.imageUrl }}
                  style={styles.optionImage}
                  contentFit="cover"
                />
              ) : null}

              <ThemedText type="body" style={styles.optionDescription}>
                {option.description}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {selectedOptionId ? (
        <View style={styles.reasonSection}>
          <ThemedText type="h3" style={styles.sectionTitle}>
            Why this one? (Optional)
          </ThemedText>
          <View style={styles.reasonsGrid}>
            {reasons.map((reason) => {
              const isReasonSelected = selectedReason === reason.id;
              return (
                <Pressable
                  key={reason.id}
                  onPress={() =>
                    setSelectedReason(isReasonSelected ? null : reason.id)
                  }
                  style={[
                    styles.reasonChip,
                    {
                      backgroundColor: isReasonSelected
                        ? theme.link
                        : "transparent",
                      borderColor: isReasonSelected
                        ? theme.link
                        : isDark
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(0,0,0,0.1)",
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: isReasonSelected ? "#FFFFFF" : theme.text,
                    }}
                  >
                    {reason.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Button
        onPress={handleSubmitVote}
        disabled={!selectedOptionId || isSubmitting}
        style={styles.submitButton}
      >
        {isSubmitting ? "Submitting..." : "Submit my opinion"}
      </Button>
    </ScrollView>
  );

  return (
    <ThemedView style={styles.container}>
      <View
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">
          {hasVoted ? "Results" : "Community Vote"}
        </ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {hasVoted ? renderResultsView() : renderVotingView()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  contextCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(201,168,124,0.1)",
    marginBottom: Spacing.xl,
  },
  occasionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  occasionText: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contextText: {
    fontStyle: "italic",
    lineHeight: 22,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  optionCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionLabel: {
    fontWeight: "600",
    opacity: 0.6,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  optionDescription: {
    lineHeight: 20,
  },
  reasonSection: {
    marginBottom: Spacing.xl,
  },
  reasonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  thankYouCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  thankYouIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  thankYouTitle: {
    textAlign: "center",
  },
  thankYouSubtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  resultsList: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  resultCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resultLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    flexWrap: "wrap",
  },
  yourVoteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  resultDesc: {
    lineHeight: 18,
  },
  stylistCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  stylistCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  stylistLabel: {
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stylistInterpretation: {
    lineHeight: 22,
  },
  doneButton: {
    marginTop: Spacing.sm,
  },
});
