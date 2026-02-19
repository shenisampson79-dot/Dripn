import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView, Dimensions, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { CommunityVotingService, VotingSession, VoteReason } from "@/services/CommunityVotingService";
import { useAuth } from "@/contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function CommunityVotingScreen({ navigation, route }: any) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<VoteReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock session data for preview if none provided
  const session: VotingSession = route.params?.session || {
    id: "preview_session",
    userId: "other_user",
    occasion: "Evening Gala",
    context: "I'm going to a formal black-tie event and want to make sure I look sophisticated but modern.",
    outfitOptions: [
      {
        id: "1",
        description: "Midnight blue tuxedo with a silk lapel, paired with polished patent leather shoes.",
        aiExplanation: "Classic formal choice that suits your profile.",
        label: "Recommended",
        imageUrl: "https://images.unsplash.com/photo-1594932224031-94f064146311?auto=format&fit=crop&q=80&w=400"
      },
      {
        id: "2",
        description: "Dark charcoal velvet blazer with black tailored trousers and a silk turtleneck.",
        aiExplanation: "A modern alternative for a contemporary formal look.",
        label: "Backup option",
        imageUrl: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&q=80&w=400"
      }
    ],
    status: "voting",
    expiresAt: new Date(Date.now() + 45 * 60000).toISOString(),
    aiRecommendedOptionId: "1"
  };

  const reasons = CommunityVotingService.getVotingReasons();

  const handleSubmitVote = async () => {
    if (!user?.id || !selectedOptionId) return;
    
    setIsSubmitting(true);
    try {
      const result = await CommunityVotingService.submitVote(
        user.id,
        session.id,
        selectedOptionId,
        selectedReason || undefined
      );
      
      if (result.success) {
        Alert.alert(
          "Vote Submitted",
          "Thanks for helping a fellow member! Your style expertise matters.",
          [{ text: "Done", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert("Error", result.error || "Failed to submit vote");
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Community Vote</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contextCard}>
          <View style={styles.occasionBadge}>
            <Feather name="calendar" size={14} color={theme.link} />
            <ThemedText type="small" style={[styles.occasionText, { color: theme.link }]}>
              {session.occasion}
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.contextText}>
            "{session.context}"
          </ThemedText>
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
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderColor: isSelected ? theme.link : 'transparent',
                    borderWidth: 2
                  }
                ]}
              >
                <View style={styles.optionHeader}>
                  <ThemedText type="small" style={styles.optionLabel}>
                    Option {String.fromCharCode(65 + index)}
                  </ThemedText>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: theme.link }]}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                
                {option.imageUrl && (
                  <Image 
                    source={{ uri: option.imageUrl }} 
                    style={styles.optionImage}
                    contentFit="cover"
                  />
                )}
                
                <ThemedText type="body" style={styles.optionDescription}>
                  {option.description}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {selectedOptionId && (
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
                    onPress={() => setSelectedReason(isReasonSelected ? null : reason.id)}
                    style={[
                      styles.reasonChip,
                      { 
                        backgroundColor: isReasonSelected ? theme.link : 'transparent',
                        borderColor: isReasonSelected ? theme.link : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
                      }
                    ]}
                  >
                    <ThemedText 
                      type="small" 
                      style={{ color: isReasonSelected ? '#FFFFFF' : theme.text }}
                    >
                      {reason.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Button
          onPress={handleSubmitVote}
          disabled={!selectedOptionId || isSubmitting}
          style={styles.submitButton}
        >
          Submit my opinion
        </Button>
      </ScrollView>
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
    backgroundColor: 'rgba(201,168,124,0.1)',
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
});
