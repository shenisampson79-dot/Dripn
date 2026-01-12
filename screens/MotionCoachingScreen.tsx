import React, { useState, useCallback } from "react";
import { StyleSheet, View, Pressable, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import apiService from "@/services/ApiService";
import type { DiscoverStackParamList } from "@/navigation/DiscoverStackNavigator";

type MotionCoachingScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, "MotionCoaching">;
};

interface MotionAnalysisResult {
  postureAnalysis: {
    score: number;
    strengths: string[];
    improvements: string[];
  };
  gaitAnalysis: {
    walkingStyle: string;
    energyType: string;
    tips: string[];
  };
  vibeScore: {
    confidence: number;
    presence: number;
    approachability: number;
    overallVibe: string;
  };
  clothingRecommendations: string[];
  microCoaching: {
    tip: string;
    exercise: string;
    timeline: string;
  }[];
  affirmation: string;
}

export default function MotionCoachingScreen({ navigation }: MotionCoachingScreenProps) {
  const { theme, isDark } = useTheme();
  const [motionDescription, setMotionDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<MotionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = useCallback(async () => {
    if (!motionDescription.trim()) {
      setError("Please describe how you move or walk");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const data = await apiService.post<MotionAnalysisResult>("/api/motion/analyze", {
        motionDescription: motionDescription.trim(),
        analysisType: "general",
      });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [motionDescription]);

  const renderScoreBar = (score: number, label: string, color: string) => (
    <View style={styles.scoreRow}>
      <ThemedText type="caption" style={{ width: 100 }}>{label}</ThemedText>
      <View style={[styles.scoreBarBg, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={[styles.scoreBarFill, { width: `${score * 10}%`, backgroundColor: color }]} />
      </View>
      <ThemedText type="caption" style={{ width: 30, textAlign: "right" }}>{score}/10</ThemedText>
    </View>
  );

  return (
    <ScreenScrollView style={styles.container}>
      <Card style={styles.introCard}>
        <View style={styles.introHeader}>
          <View style={[styles.iconCircle, { backgroundColor: theme.link + "20" }]}>
            <Feather name="activity" size={28} color={theme.link} />
          </View>
          <View style={styles.introText}>
            <ThemedText type="h3">Presence Analysis</ThemedText>
            <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
              Analyze your posture, gait, and overall vibe
            </ThemedText>
          </View>
        </View>
      </Card>

      <Card style={styles.inputCard}>
        <ThemedText type="body" style={{ marginBottom: Spacing.sm, fontWeight: "600" }}>
          Describe Your Movement Style
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.md }}>
          How do you walk? What's your posture like? How do you carry yourself?
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="e.g., I walk with long strides, tend to slouch when sitting, feel confident in heels..."
          placeholderTextColor={theme.tabIconDefault}
          multiline
          numberOfLines={4}
          value={motionDescription}
          onChangeText={setMotionDescription}
          textAlignVertical="top"
        />

        {error && (
          <ThemedText type="caption" style={{ color: theme.error, marginTop: Spacing.sm }}>
            {error}
          </ThemedText>
        )}

        <Button
          onPress={handleAnalyze}
          disabled={isAnalyzing}
          style={{ marginTop: Spacing.md }}
        >
          {isAnalyzing ? "Analyzing..." : "Analyze My Presence"}
        </Button>
      </Card>

      {isAnalyzing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.link} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, textAlign: "center" }}>
            Analyzing your movement patterns...
          </ThemedText>
        </View>
      )}

      {result && !isAnalyzing && (
        <>
          <Card style={styles.resultCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              Your Vibe Score
            </ThemedText>
            {renderScoreBar(result.vibeScore.confidence, "Confidence", "#4CAF50")}
            {renderScoreBar(result.vibeScore.presence, "Presence", "#2196F3")}
            {renderScoreBar(result.vibeScore.approachability, "Approachability", "#FF9800")}
            <View style={[styles.vibeTag, { backgroundColor: theme.link + "20" }]}>
              <ThemedText type="body" style={{ color: theme.link, fontWeight: "600" }}>
                {result.vibeScore.overallVibe}
              </ThemedText>
            </View>
          </Card>

          <Card style={styles.resultCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              Posture Analysis
            </ThemedText>
            <View style={styles.scoreCircle}>
              <ThemedText type="h1" style={{ color: theme.link }}>{result.postureAnalysis.score}</ThemedText>
              <ThemedText type="caption">/10</ThemedText>
            </View>
            
            {result.postureAnalysis.strengths.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                  Strengths
                </ThemedText>
                {result.postureAnalysis.strengths.map((s, i) => (
                  <View key={i} style={styles.bulletItem}>
                    <Feather name="check-circle" size={16} color="#4CAF50" />
                    <ThemedText type="caption" style={{ marginLeft: Spacing.sm, flex: 1 }}>{s}</ThemedText>
                  </View>
                ))}
              </View>
            )}

            {result.postureAnalysis.improvements.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.sm }}>
                  Areas to Improve
                </ThemedText>
                {result.postureAnalysis.improvements.map((s, i) => (
                  <View key={i} style={styles.bulletItem}>
                    <Feather name="arrow-up-circle" size={16} color={theme.link} />
                    <ThemedText type="caption" style={{ marginLeft: Spacing.sm, flex: 1 }}>{s}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card style={styles.resultCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              Gait Analysis
            </ThemedText>
            <View style={[styles.tagRow, { marginBottom: Spacing.md }]}>
              <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="caption">{result.gaitAnalysis.walkingStyle}</ThemedText>
              </View>
              <View style={[styles.tag, { backgroundColor: theme.link + "20" }]}>
                <ThemedText type="caption" style={{ color: theme.link }}>{result.gaitAnalysis.energyType}</ThemedText>
              </View>
            </View>
            {result.gaitAnalysis.tips.map((tip, i) => (
              <View key={i} style={styles.bulletItem}>
                <Feather name="info" size={16} color={theme.tabIconDefault} />
                <ThemedText type="caption" style={{ marginLeft: Spacing.sm, flex: 1 }}>{tip}</ThemedText>
              </View>
            ))}
          </Card>

          <Card style={styles.resultCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              Micro-Coaching Plan
            </ThemedText>
            {result.microCoaching.map((coaching, i) => (
              <View key={i} style={[styles.coachingItem, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={styles.coachingHeader}>
                  <Feather name="target" size={18} color={theme.link} />
                  <ThemedText type="body" style={{ fontWeight: "600", marginLeft: Spacing.sm, flex: 1 }}>
                    {coaching.timeline}
                  </ThemedText>
                </View>
                <ThemedText type="body" style={{ marginTop: Spacing.sm }}>{coaching.tip}</ThemedText>
                <ThemedText type="caption" style={{ marginTop: Spacing.xs, color: theme.tabIconDefault }}>
                  Exercise: {coaching.exercise}
                </ThemedText>
              </View>
            ))}
          </Card>

          <Card style={styles.resultCard}>
            <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
              Clothing Recommendations
            </ThemedText>
            {result.clothingRecommendations.map((rec, i) => (
              <View key={i} style={styles.bulletItem}>
                <Feather name="star" size={16} color="#FFD700" />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, flex: 1 }}>{rec}</ThemedText>
              </View>
            ))}
          </Card>

          <Card style={[styles.affirmationCard, { backgroundColor: theme.link + "15" }]}>
            <Feather name="heart" size={24} color={theme.link} style={{ alignSelf: "center", marginBottom: Spacing.sm }} />
            <ThemedText type="body" style={{ textAlign: "center", fontStyle: "italic" }}>
              "{result.affirmation}"
            </ThemedText>
          </Card>
        </>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  introCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  introHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  introText: {
    flex: 1,
  },
  inputCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 100,
    fontSize: 16,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  resultCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.lg,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  scoreBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginHorizontal: Spacing.sm,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  vibeTag: {
    alignSelf: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  scoreCircle: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  section: {
    marginTop: Spacing.md,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  coachingItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  coachingHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  affirmationCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
});
