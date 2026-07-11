import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Modal, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

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
  ExpressResultsInfo,
} from "@/services/CommunityVotingService";
import { decisionService, CommunityVotingEligibility } from "@/services/DecisionService";
import { dfyService } from "@/services/DFYService";
import { currencyService } from "@/services/CurrencyService";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/contexts/TranslationContext";

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
  const { t } = useTranslations();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [showModal, setShowModal] = useState(false);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [session, setSession] = useState<VotingSession | null>(null);
  const [result, setResult] = useState<VotingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 0, seconds: 0, expired: false });
  const [eligibility, setEligibility] = useState<CommunityVotingEligibility | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);
  const [showSpeedChoice, setShowSpeedChoice] = useState(false);
  const [expressInfo, setExpressInfo] = useState<ExpressResultsInfo | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const symbol = currencyService.getCurrencySymbol();
    setExpressInfo(CommunityVotingService.getExpressResultsInfo(symbol));
  }, []);

  useEffect(() => {
    const checkEligibility = async () => {
      if (!user?.id) {
        setIsCheckingEligibility(false);
        return;
      }
      
      try {
        const dfyAccess = await dfyService.checkDFYAccess(user.id);
        const hasDFYCompleted = dfyAccess.hasAccess || dfyAccess.tier !== null;
        const eligibilityResult = await decisionService.checkCommunityVotingEligibility(
          user.id,
          user.subscriptionTier || 'free',
          hasDFYCompleted
        );
        setEligibility(eligibilityResult);
      } catch (error) {
        console.error("Error checking eligibility:", error);
        setEligibility({ eligible: false, reason: "Unable to check access", decisionsCompleted: 0, requiredDecisions: 5 });
      } finally {
        setIsCheckingEligibility(false);
      }
    };
    
    checkEligibility();
  }, [user?.id, user?.subscriptionTier]);

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

  const handleButtonPress = () => {
    if (!eligibility?.eligible) {
      setShowLockedModal(true);
      return;
    }
    setShowSpeedChoice(true);
    setShowModal(true);
  };

  const handleStartVoting = async (isExpress: boolean = false) => {
    if (!user?.id) return;
    
    setShowSpeedChoice(false);
    setIsLoading(true);
    try {
      const newSession = await CommunityVotingService.createVotingSession(
        user.id,
        outfitOptions,
        aiRecommendedOptionId,
        { occasion, description: `Outfit decision for ${occasion || "today"}` },
        isExpress
      );
      setSession(newSession);
    } catch (error) {
      console.error("Error creating voting session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpressChoice = async () => {
    setIsProcessingPayment(true);
    try {
      await handleStartVoting(true);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStandardChoice = async () => {
    await handleStartVoting(false);
  };

  const handleUpgradePress = () => {
    setShowLockedModal(false);
    navigation.navigate("ProfileStack", { screen: "Subscription" });
  };

  const renderLockedModal = () => {
    const decisionsLeft = eligibility ? eligibility.requiredDecisions - eligibility.decisionsCompleted : 5;
    
    return (
      <Modal
        visible={showLockedModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowLockedModal(false)}
      >
        <View style={styles.lockedModalOverlay}>
          <View style={[styles.lockedModalContent, { backgroundColor: isDark ? '#1A1A2E' : '#FFFFFF' }]}>
            <Pressable onPress={() => setShowLockedModal(false)} style={styles.lockedModalClose}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            
            <View style={[styles.lockedIconContainer, { backgroundColor: theme.link + '20' }]}>
              <Feather name="lock" size={28} color={theme.link} />
            </View>
            
            <ThemedText type="h2" style={styles.lockedTitle}>
              {t('secondOpinion.title') || 'Second Opinion'}
            </ThemedText>
            
            <ThemedText type="body" style={[styles.lockedDescription, { color: theme.tabIconDefault }]}>
              {decisionService.getSecondOpinionLockedCopy()}
            </ThemedText>
            
            <View style={[styles.lockedOptionsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
              <View style={styles.lockedOption}>
                <View style={[styles.lockedOptionIcon, { backgroundColor: theme.link + '20' }]}>
                  <Feather name="star" size={16} color={theme.link} />
                </View>
                <View style={styles.lockedOptionText}>
                  <ThemedText type="small" style={{ fontWeight: '600' }}>Subscribe to Personal Stylist</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>Instant access to community voting</ThemedText>
                </View>
              </View>
              
              <View style={styles.lockedOptionDivider} />
              
              <View style={styles.lockedOption}>
                <View style={[styles.lockedOptionIcon, { backgroundColor: theme.link + '20' }]}>
                  <Feather name="target" size={16} color={theme.link} />
                </View>
                <View style={styles.lockedOptionText}>
                  <ThemedText type="small" style={{ fontWeight: '600' }}>Complete {decisionsLeft} more decision{decisionsLeft !== 1 ? 's' : ''}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
                    {eligibility?.decisionsCompleted || 0} of 5 decisions completed
                  </ThemedText>
                </View>
              </View>
              
              <View style={styles.lockedOptionDivider} />
              
              <View style={styles.lockedOption}>
                <View style={[styles.lockedOptionIcon, { backgroundColor: theme.link + '20' }]}>
                  <Feather name="package" size={16} color={theme.link} />
                </View>
                <View style={styles.lockedOptionText}>
                  <ThemedText type="small" style={{ fontWeight: '600' }}>Complete DFY setup</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>Unlock with Outfit or Wardrobe Setup</ThemedText>
                </View>
              </View>
            </View>
            
            <Button onPress={handleUpgradePress} style={styles.lockedUpgradeButton}>
              {t('secondOpinion.viewSubscriptionOptions') || 'View subscription options'}
            </Button>
            
            <Pressable onPress={() => setShowLockedModal(false)} style={styles.lockedDismiss}>
              <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                {t('secondOpinion.maybeLater') || 'Maybe later'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
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
    if (isLoading || isProcessingPayment) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={styles.loadingText}>
            {isProcessingPayment
              ? (t('secondOpinion.listening') || 'Listening…')
              : result
                ? (t('secondOpinion.listening') || 'Listening…')
                : (t('secondOpinion.tapToSpeak') || 'Tap to speak')}
          </ThemedText>
        </View>
      );
    }

    if (showSpeedChoice && expressInfo) {
      return (
        <View style={styles.speedChoiceContainer}>
          <View style={styles.speedChoiceHeader}>
            <ThemedText type="h2" style={styles.speedChoiceTitle}>
              How quickly do you need this?
            </ThemedText>
            <ThemedText type="body" style={[styles.speedChoiceSubtitle, { color: theme.tabIconDefault }]}>
              Choose your results speed
            </ThemedText>
          </View>

          <View style={styles.speedOptionsContainer}>
            <Pressable 
              onPress={handleExpressChoice}
              style={({ pressed }) => [
                styles.speedOption,
                styles.expressOption,
                { 
                  backgroundColor: isDark ? 'rgba(201,168,124,0.15)' : 'rgba(201,168,124,0.1)',
                  borderColor: '#C9A87C',
                  opacity: pressed ? 0.8 : 1,
                }
              ]}
            >
              <View style={styles.speedOptionHeader}>
                <View style={[styles.speedBadge, { backgroundColor: '#C9A87C' }]}>
                  <Feather name="zap" size={14} color="#FFFFFF" />
                  <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 4 }}>
                    EXPRESS
                  </ThemedText>
                </View>
                <ThemedText type="h3" style={{ color: '#C9A87C' }}>
                  {expressInfo.formattedPrice}
                </ThemedText>
              </View>
              <ThemedText type="h3" style={styles.speedOptionTitle}>
                Results in ~{expressInfo.waitTimeMinutes} minutes
              </ThemedText>
              <ThemedText type="small" style={[styles.speedOptionDesc, { color: theme.tabIconDefault }]}>
                Skip the wait and get your community verdict faster
              </ThemedText>
            </Pressable>

            <Pressable 
              onPress={handleStandardChoice}
              style={({ pressed }) => [
                styles.speedOption,
                { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  opacity: pressed ? 0.8 : 1,
                }
              ]}
            >
              <View style={styles.speedOptionHeader}>
                <View style={[styles.speedBadge, { backgroundColor: theme.tabIconDefault }]}>
                  <Feather name="clock" size={14} color="#FFFFFF" />
                  <ThemedText type="caption" style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: 4 }}>
                    STANDARD
                  </ThemedText>
                </View>
                <ThemedText type="h3" style={{ color: theme.link }}>
                  Free
                </ThemedText>
              </View>
              <ThemedText type="h3" style={styles.speedOptionTitle}>
                Results in ~{expressInfo.standardWaitMinutes} minutes
              </ThemedText>
              <ThemedText type="small" style={[styles.speedOptionDesc, { color: theme.tabIconDefault }]}>
                We'll notify you when votes are in
              </ThemedText>
            </Pressable>
          </View>

          <Pressable onPress={() => setShowModal(false)} style={styles.skipLink}>
            <ThemedText type="small" style={styles.skipText}>
              {t('secondOpinion.maybeLater') || 'Maybe later'}
            </ThemedText>
          </Pressable>
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
            {t('secondOpinion.title') || 'Second Opinion'}
          </ThemedText>
          <ThemedText type="body" style={styles.waitingSubtitle}>
            {t('secondOpinion.tapToSpeak') || 'Tap to speak'}
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
            {t('secondOpinion.send') || 'Send'}
          </Button>
          <Pressable onPress={() => setShowModal(false)} style={styles.skipLink}>
            <ThemedText type="small" style={styles.skipText}>
              {t('secondOpinion.noThanksTrust') || 'No thanks, I trust you'}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  const isLocked = !isCheckingEligibility && !eligibility?.eligible;

  return (
    <>
      <Pressable
        onPress={handleButtonPress}
        disabled={isLoading || isCheckingEligibility}
        style={({ pressed }) => [
          styles.secondOpinionButton,
          { opacity: pressed || isCheckingEligibility ? 0.7 : 1 },
        ]}
      >
        <View style={styles.secondOpinionRow}>
          {isLocked ? (
            <Feather name="lock" size={12} color={theme.tabIconDefault} style={{ marginRight: Spacing.xs }} />
          ) : null}
          <ThemedText type="small" style={[styles.secondOpinionText, { color: theme.tabIconDefault }]}>
            {isLocked
              ? (t('secondOpinion.title') || 'Second Opinion')
              : (t('secondOpinion.askAnother') || 'Ask another stylist')}
          </ThemedText>
        </View>
      </Pressable>

      {renderLockedModal()}

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
  secondOpinionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lockedModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  lockedModalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingTop: Spacing["2xl"],
  },
  lockedModalClose: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    padding: Spacing.sm,
    zIndex: 1,
  },
  lockedIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  lockedTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  lockedDescription: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  lockedOptionsContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  lockedOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  lockedOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  lockedOptionText: {
    flex: 1,
    gap: 2,
  },
  lockedOptionDivider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginVertical: Spacing.xs,
  },
  lockedUpgradeButton: {
    width: "100%",
  },
  lockedDismiss: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  speedChoiceContainer: {
    flex: 1,
  },
  speedChoiceHeader: {
    marginBottom: Spacing.xl,
  },
  speedChoiceTitle: {
    marginBottom: Spacing.sm,
  },
  speedChoiceSubtitle: {
    opacity: 0.8,
  },
  speedOptionsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  speedOption: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  expressOption: {
    borderWidth: 2,
  },
  speedOptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  speedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  speedOptionTitle: {
    marginBottom: Spacing.xs,
  },
  speedOptionDesc: {
    opacity: 0.8,
  },
});
