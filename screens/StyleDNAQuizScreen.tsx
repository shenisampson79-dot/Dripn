import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, Pressable, ActivityIndicator, Alert, Dimensions } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInRight, SlideInRight, SlideOutLeft } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";
import { useTranslations } from "@/contexts/TranslationContext";

type StyleDNAQuizScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "StyleQuiz">;
};

interface Question {
  id: number;
  question: string;
  options: Array<{
    id: number;
    text: string;
    imageUrl?: string;
  }>;
}

interface QuizResult {
  tribe: string;
  tribeDescription: string;
  tribeIcon: string;
  personalityBreakdown: Array<{
    trait: string;
    percentage: number;
    color: string;
  }>;
  recommendations: Array<{
    title: string;
    description: string;
    imageUrl?: string;
  }>;
  compatibleTribes: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function StyleDNAQuizScreen({ navigation }: StyleDNAQuizScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getStyleDNAQuestions();
      if (response.questions && Array.isArray(response.questions)) {
        const mapped = response.questions.map((q: any) => ({
          id: q.id,
          question: q.question,
          options: q.options.map((o: any, idx: number) => ({
            id: idx,
            text: o.text,
            imageUrl: o.imageUrl,
          })),
        }));
        setQuestions(mapped);
        setAnswers(new Array(mapped.length).fill(-1));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleSelectOption = (optionId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newAnswers = [...answers];
    newAnswers[currentIndex] = optionId;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (answers[currentIndex] === -1) {
      Alert.alert(t('onboarding.selectAnOption') || "Select an Option", t('onboarding.pleaseChooseAnAnswerBeforeContinuing') || "Please choose an answer before continuing.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitQuiz();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const submitQuiz = async () => {
    if (!user) {
      Alert.alert(t('onboarding.signInRequired') || "Sign In Required", t('onboarding.pleaseSignInToSaveYourResults') || "Please sign in to save your results.");
      return;
    }

    try {
      setSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const response = await apiService.submitStyleDNAAnswers(answers);
      if (response.success) {
        setResult(response.result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setAnswers(new Array(questions.length).fill(-1));
    setResult(null);
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={[styles.loadingText, { color: theme.tabIconDefault }]}>
          Loading quiz...
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
          onPress={fetchQuestions}
          style={[styles.retryButton, { backgroundColor: theme.link }]}
        >
          <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (result) {
    return (
      <ScreenScrollView contentContainerStyle={styles.container}>
        <Animated.View entering={FadeIn.duration(500)}>
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <ThemedText type="h2" style={styles.resultTitle}>
                Your Style Tribe
              </ThemedText>
              <View style={[styles.tribeIconContainer, { backgroundColor: theme.link + "20" }]}>
                <ThemedText style={styles.tribeIcon}>{result.tribeIcon}</ThemedText>
              </View>
              <ThemedText type="h1" style={[styles.tribeName, { color: theme.link }]}>
                {result.tribe}
              </ThemedText>
              <ThemedText style={[styles.tribeDescription, { color: theme.tabIconDefault }]}>
                {result.tribeDescription}
              </ThemedText>
            </View>

            <View style={styles.breakdownSection}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Personality Breakdown
              </ThemedText>
              {result.personalityBreakdown.map((trait, idx) => (
                <View key={idx} style={styles.traitRow}>
                  <ThemedText style={styles.traitName}>{trait.trait}</ThemedText>
                  <View style={styles.traitBarContainer}>
                    <View 
                      style={[
                        styles.traitBar, 
                        { width: `${trait.percentage}%`, backgroundColor: trait.color }
                      ]} 
                    />
                  </View>
                  <ThemedText style={[styles.traitPercent, { color: theme.tabIconDefault }]}>
                    {trait.percentage}%
                  </ThemedText>
                </View>
              ))}
            </View>

            {result.recommendations.length > 0 ? (
              <View style={styles.recommendationsSection}>
                <ThemedText type="h4" style={styles.sectionTitle}>
                  Recommendations for You
                </ThemedText>
                {result.recommendations.map((rec, idx) => (
                  <View key={idx} style={styles.recItem}>
                    <Feather name="check-circle" size={16} color={theme.success} />
                    <View style={styles.recContent}>
                      <ThemedText style={styles.recTitle}>{rec.title}</ThemedText>
                      <ThemedText style={[styles.recDescription, { color: theme.tabIconDefault }]}>
                        {rec.description}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {result.compatibleTribes.length > 0 ? (
              <View style={styles.compatibleSection}>
                <ThemedText type="body" style={[styles.compatibleLabel, { color: theme.tabIconDefault }]}>
                  Compatible Tribes:
                </ThemedText>
                <View style={styles.compatibleList}>
                  {result.compatibleTribes.map((tribe, idx) => (
                    <View 
                      key={idx} 
                      style={[styles.compatibleBadge, { backgroundColor: theme.backgroundSecondary }]}
                    >
                      <ThemedText style={styles.compatibleText}>{tribe}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={restartQuiz}
              style={[styles.restartButton, { borderColor: theme.link }]}
            >
              <Feather name="refresh-cw" size={18} color={theme.link} />
              <ThemedText style={{ color: theme.link, fontWeight: "600" }}>
                Retake Quiz
              </ThemedText>
            </Pressable>
          </Card>
        </Animated.View>
      </ScreenScrollView>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <ThemedView style={styles.quizContainer}>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
          <Animated.View 
            style={[
              styles.progressFill, 
              { width: `${progress}%`, backgroundColor: theme.link }
            ]} 
          />
        </View>
        <ThemedText style={[styles.progressText, { color: theme.tabIconDefault }]}>
          {currentIndex + 1} of {questions.length}
        </ThemedText>
      </View>

      <Animated.View 
        key={currentIndex}
        entering={SlideInRight.springify()}
        style={styles.questionContainer}
      >
        <ThemedText type="h3" style={styles.questionText}>
          {currentQuestion?.question}
        </ThemedText>

        <View style={styles.optionsContainer}>
          {currentQuestion?.options.map((option) => {
            const isSelected = answers[currentIndex] === option.id;
            
            return (
              <Pressable
                key={option.id}
                onPress={() => handleSelectOption(option.id)}
                style={({ pressed }) => [
                  styles.optionButton,
                  {
                    backgroundColor: isSelected ? theme.link + "20" : theme.backgroundSecondary,
                    borderColor: isSelected ? theme.link : "transparent",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                {option.imageUrl ? (
                  <Image
                    source={{ uri: option.imageUrl }}
                    style={styles.optionImage}
                    contentFit="cover"
                  />
                ) : null}
                <ThemedText 
                  style={[
                    styles.optionText, 
                    { color: isSelected ? theme.link : theme.text }
                  ]}
                >
                  {option.text}
                </ThemedText>
                {isSelected ? (
                  <Feather name="check-circle" size={20} color={theme.link} />
                ) : (
                  <View style={[styles.optionCircle, { borderColor: theme.tabIconDefault }]} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>

      <View style={styles.navigationButtons}>
        <Pressable
          onPress={handleBack}
          disabled={currentIndex === 0}
          style={[
            styles.navButton,
            { 
              backgroundColor: theme.backgroundSecondary,
              opacity: currentIndex === 0 ? 0.5 : 1,
            },
          ]}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
          <ThemedText>Back</ThemedText>
        </Pressable>

        <Pressable
          onPress={handleNext}
          disabled={submitting}
          style={[styles.navButton, styles.nextButton, { backgroundColor: theme.link }]}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <ThemedText style={styles.nextButtonText}>
                {currentIndex === questions.length - 1 ? "See Results" : "Next"}
              </ThemedText>
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  quizContainer: {
    flex: 1,
    padding: Spacing.xl,
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
  progressContainer: {
    marginBottom: Spacing.xl,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: Typography.small.fontSize,
    textAlign: "right",
  },
  questionContainer: {
    flex: 1,
  },
  questionText: {
    marginBottom: Spacing.xl,
    lineHeight: 32,
  },
  optionsContainer: {
    gap: Spacing.md,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  optionImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
  },
  optionText: {
    flex: 1,
    fontSize: Typography.body.fontSize,
  },
  optionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  navigationButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  nextButton: {},
  nextButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  resultCard: {
    padding: Spacing.xl,
  },
  resultHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  resultTitle: {
    marginBottom: Spacing.lg,
  },
  tribeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  tribeIcon: {
    fontSize: 40,
  },
  tribeName: {
    marginBottom: Spacing.sm,
  },
  tribeDescription: {
    textAlign: "center",
    lineHeight: 22,
  },
  breakdownSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  traitRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  traitName: {
    width: 100,
    fontSize: Typography.small.fontSize,
  },
  traitBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(128,128,128,0.2)",
    borderRadius: 4,
    overflow: "hidden",
  },
  traitBar: {
    height: "100%",
    borderRadius: 4,
  },
  traitPercent: {
    width: 40,
    textAlign: "right",
    fontSize: Typography.small.fontSize,
  },
  recommendationsSection: {
    marginBottom: Spacing.xl,
  },
  recItem: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  recContent: {
    flex: 1,
  },
  recTitle: {
    fontWeight: "600",
    marginBottom: 2,
  },
  recDescription: {
    fontSize: Typography.small.fontSize,
    lineHeight: 18,
  },
  compatibleSection: {
    marginBottom: Spacing.xl,
  },
  compatibleLabel: {
    marginBottom: Spacing.sm,
  },
  compatibleList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  compatibleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  compatibleText: {
    fontSize: Typography.small.fontSize,
  },
  restartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
});
