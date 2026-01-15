import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Modal, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { 
  CommunityVotingService, 
  VotingSession, 
  VotingResult,
  OutfitOption,
  VoteReason,
} from "@/services/CommunityVotingService";
import { useAuth } from "@/contexts/AuthContext";

interface SecondOpinionButtonProps {
  outfitOptions: OutfitOption[];
  aiRecommendedOptionId: string;
  occasion?: string;
  onResultReceived?: (result: VotingResult) => void;
  stylistId?: string;
}

export function SecondOpinionButton({
  outfitOptions,
  aiRecommendedOptionId,
  occasion,
  onResultReceived,
  stylistId,
}: SecondOpinionButtonProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [session, setSession] = useState<VotingSession | null>(null);
  const [result, setResult] = useState<VotingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (session && session.status === "voting") {
      interval = setInterval(() => {
        const remaining = CommunityVotingService.getTimeRemaining(session);
        setTimeRemaining(remaining);
        
        if (remaining.expired) {
          handleCheckResults();
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [session]);

  const handleStartVoting = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const newSession = await CommunityVotingService.createVotingSession(
        user.id,
        outfitOptions,
        aiRecommendedOptionId,
        { occasion, description: `Outfit decision for ${occasion || "today"}` }
      );
      setSession(newSession);
      setShowModal(true);
    } catch (error) {
      console.error("Error creating voting session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckResults = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      const votingResult = await CommunityVotingService.getVotingResults(session.id, stylistId);
      if (votingResult) {
        setResult(votingResult);
        onResultReceived?.(votingResult);
      }
    } catch (error) {
      console.error("Error getting results:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderModalContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={styles.loadingText}>
            {result ? "Checking results..." : "Setting up your confidence check..."}
          </ThemedText>
        </View>
      );
    }

    if (result) {
      return (
        <View style={styles.resultContainer}>
          <View style={[styles.resultHeader, { backgroundColor: theme.link }]}>
            <Feather name="check-circle" size={24} color="#FFFFFF" />
            <ThemedText type="h3" style={styles.resultHeaderText}>
              Here's the reassurance
            </ThemedText>
          </View>

          <View style={styles.resultBody}>
            <ThemedText type="body" style={styles.aiInterpretation}>
              "{result.aiInterpretation}"
            </ThemedText>

            {result.totalVotes > 0 ? (
              <View style={[styles.voteSummary, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' 
              }]}>
                <ThemedText type="small" style={styles.voteSummaryText}>
                  {result.totalVotes} {result.totalVotes === 1 ? "person" : "people"} with similar style voted
                </ThemedText>
                {result.optionResults.map((option) => (
                  <View key={option.optionId} style={styles.optionResult}>
                    <View style={[styles.voteBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                      <View 
                        style={[
                          styles.voteBarFill, 
                          { 
                            width: `${option.percentage}%`,
                            backgroundColor: option.optionId === aiRecommendedOptionId ? theme.link : theme.tabIconDefault,
                          }
                        ]} 
                      />
                    </View>
                    <ThemedText type="small" style={styles.votePercentage}>
                      {option.percentage}%
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <Button onPress={() => setShowModal(false)} style={styles.resultButton}>
            I'll wear this
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.waitingContainer}>
        <View style={styles.waitingHeader}>
          <ThemedText type="h2" style={styles.waitingTitle}>
            Quick confidence check
          </ThemedText>
          <ThemedText type="body" style={styles.waitingSubtitle}>
            We'll quietly check what people with similar style would choose.
          </ThemedText>
        </View>

        <View style={[styles.outfitPreview, { 
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }]}>
          {outfitOptions.map((option, index) => (
            <View key={option.id} style={styles.outfitOption}>
              <View style={[styles.optionLabel, { 
                backgroundColor: option.id === aiRecommendedOptionId ? theme.link : theme.backgroundSecondary 
              }]}>
                <ThemedText type="small" style={{ color: option.id === aiRecommendedOptionId ? '#FFFFFF' : theme.text }}>
                  Option {String.fromCharCode(65 + index)}
                </ThemedText>
              </View>
              <ThemedText type="small" numberOfLines={2} style={styles.optionDescription}>
                {option.description}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.timerContainer}>
          <Feather name="clock" size={16} color={theme.tabIconDefault} />
          <ThemedText type="body" style={styles.timerText}>
            Results in ~{timeRemaining.minutes || 45} minutes
          </ThemedText>
        </View>

        <ThemedText type="small" style={styles.reassurance}>
          This doesn't change my recommendation — it just adds reassurance.
        </ThemedText>

        <View style={styles.voterInfo}>
          <Feather name="users" size={14} color={theme.tabIconDefault} />
          <ThemedText type="small" style={styles.voterInfoText}>
            People with similar style & occasion
          </ThemedText>
        </View>

        <View style={styles.buttonRow}>
          <Button onPress={handleCheckResults} style={styles.checkButton}>
            Start confidence check
          </Button>
          <Pressable onPress={() => setShowModal(false)} style={styles.skipLink}>
            <ThemedText type="small" style={styles.skipText}>
              No thanks, I trust you
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <>
      <Pressable
        onPress={handleStartVoting}
        disabled={isLoading}
        style={({ pressed }) => [
          styles.secondOpinionButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <ThemedText type="small" style={[styles.secondOpinionText, { color: theme.tabIconDefault }]}>
          Want a quick second opinion?
        </ThemedText>
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowModal(false)} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          {renderModalContent()}
        </ThemedView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  secondOpinionButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  secondOpinionText: {
    textDecorationLine: "underline",
  },
  modalContainer: {
    flex: 1,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
  },
  loadingText: {
    opacity: 0.8,
  },
  waitingContainer: {
    flex: 1,
  },
  waitingHeader: {
    marginBottom: Spacing.xl,
  },
  waitingTitle: {
    marginBottom: Spacing.sm,
  },
  waitingSubtitle: {
    opacity: 0.8,
  },
  outfitPreview: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  outfitOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  optionLabel: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  optionDescription: {
    flex: 1,
    opacity: 0.85,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  timerText: {
    opacity: 0.8,
  },
  reassurance: {
    fontStyle: "italic",
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  voterInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  voterInfoText: {
    opacity: 0.7,
  },
  buttonRow: {
    gap: Spacing.md,
  },
  checkButton: {
    width: "100%",
  },
  skipLink: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    opacity: 0.7,
  },
  resultContainer: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  resultHeaderText: {
    color: "#FFFFFF",
  },
  resultBody: {
    flex: 1,
  },
  aiInterpretation: {
    fontSize: 18,
    lineHeight: 26,
    marginBottom: Spacing.xl,
  },
  voteSummary: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  voteSummaryText: {
    opacity: 0.7,
    marginBottom: Spacing.sm,
  },
  optionResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  voteBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  voteBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  votePercentage: {
    width: 40,
    textAlign: "right",
  },
  resultButton: {
    marginTop: Spacing.xl,
  },
});
