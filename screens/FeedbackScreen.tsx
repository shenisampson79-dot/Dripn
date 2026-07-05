import React, { useState } from "react";
import { StyleSheet, View, Pressable, TextInput, Alert, ActivityIndicator, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Device from "expo-device";
import Constants from "expo-constants";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type FeedbackType = "bug" | "feature" | "general" | "rating";
type FeedbackCategory = "scanner" | "chat" | "login" | "wardrobe" | "other";

interface FeedbackOption {
  type: FeedbackType;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

interface CategoryOption {
  category: FeedbackCategory;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const FEEDBACK_TYPES: FeedbackOption[] = [
  { type: "bug", label: "Bug Report", icon: "alert-circle", description: "Something isn't working" },
  { type: "feature", label: "Feature Request", icon: "zap", description: "Suggest an improvement" },
  { type: "general", label: "General Feedback", icon: "message-circle", description: "Share your thoughts" },
  { type: "rating", label: "Rate Experience", icon: "star", description: "Rate your overall experience" },
];

const CATEGORIES: CategoryOption[] = [
  { category: "scanner", label: "Wardrobe Scanner", icon: "camera" },
  { category: "chat", label: "AI Stylist Chat", icon: "message-square" },
  { category: "login", label: "Login / Account", icon: "user" },
  { category: "wardrobe", label: "Wardrobe", icon: "grid" },
  { category: "other", label: "Other", icon: "more-horizontal" },
];

type FeedbackScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Feedback">;
};

export default function FeedbackScreen({ navigation }: FeedbackScreenProps) {
  const { theme, isDark } = useTheme();
  const { palette } = useColorScheme();

  const LUXURY_COLORS = {
    gold: palette.gold,
    deepGold: palette.deepGold,
    rose: palette.rose,
    berry: palette.berry,
    violet: palette.violet,
    deepViolet: palette.deepViolet,
    champagne: '#F5E6D3',
    midnight: '#1A1A2E',
    coral: palette.coral,
    teal: palette.teal,
    emerald: palette.emerald,
  };

  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDeviceInfo = (): string => {
    const osName = Platform.OS === 'ios' ? 'iOS' : 'Android';
    const osVersion = Platform.Version;
    const deviceName = Device.modelName || 'Unknown';
    return `${osName} ${osVersion} (${deviceName})`;
  };

  const getAppVersion = (): string => {
    return Constants.expoConfig?.version || "1.0.0";
  };

  const handleSubmit = async () => {
    if (!feedbackType) {
      Alert.alert("Required", "Please select a feedback type.");
      return;
    }
    if (!category) {
      Alert.alert("Required", "Please select a category.");
      return;
    }
    if (!title.trim()) {
      Alert.alert("Required", "Please enter a title for your feedback.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Required", "Please describe your feedback in detail.");
      return;
    }
    if (feedbackType === "rating" && rating === 0) {
      Alert.alert("Required", "Please select a rating.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        feedbackType,
        category,
        title: title.trim(),
        description: description.trim(),
        deviceInfo: getDeviceInfo(),
        appVersion: getAppVersion(),
      };

      if (feedbackType === "rating" && rating > 0) {
        payload.rating = rating;
      }

      const response = await apiService.submitFeedback(payload);

      if (response.success) {
        Alert.alert(
          "Thank You!",
          response.message || "Your feedback has been submitted successfully.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error("Submission failed");
      }
    } catch (error) {
      console.error("Feedback submission error:", error);
      Alert.alert(
        "Submission Failed",
        "We couldn't submit your feedback. Please try again later."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarRating = () => {
    return (
      <View style={styles.ratingContainer}>
        <ThemedText type="body" style={styles.ratingLabel}>
          How would you rate your experience?
        </ThemedText>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setRating(star)}
              style={styles.starButton}
            >
              <Feather
                name={star <= rating ? "star" : "star"}
                size={32}
                color={star <= rating ? LUXURY_COLORS.gold : theme.tabIconDefault}
                style={star <= rating ? { opacity: 1 } : { opacity: 0.3 }}
              />
            </Pressable>
          ))}
        </View>
        {rating > 0 && (
          <ThemedText type="small" style={[styles.ratingText, { color: LUXURY_COLORS.gold }]}>
            {rating === 5 ? "Excellent!" : rating === 4 ? "Great!" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}
          </ThemedText>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          ScreenGradients.profile.primary[0],
          ScreenGradients.profile.primary[1],
          LuxuryColors.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ScreenKeyboardAwareScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={styles.introSection}>
          <ThemedText type="body" style={styles.introText}>
            Help us improve Dripn! Your feedback is invaluable for making the app better for everyone.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            What type of feedback?
          </ThemedText>
          <View style={styles.optionsGrid}>
            {FEEDBACK_TYPES.map((option) => (
              <Pressable
                key={option.type}
                onPress={() => setFeedbackType(option.type)}
                style={[
                  styles.optionCard,
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                    borderColor: feedbackType === option.type ? LUXURY_COLORS.violet : 'transparent',
                    borderWidth: 2,
                  },
                ]}
              >
                <LinearGradient
                  colors={feedbackType === option.type 
                    ? [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]
                    : [LUXURY_COLORS.teal + '40', LUXURY_COLORS.emerald + '40']
                  }
                  style={styles.optionIcon}
                >
                  <Feather name={option.icon} size={18} color="#FFFFFF" />
                </LinearGradient>
                <ThemedText type="body" style={styles.optionLabel}>
                  {option.label}
                </ThemedText>
                <ThemedText type="caption" style={styles.optionDescription}>
                  {option.description}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Which area?
          </ThemedText>
          <View style={styles.categoriesRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.category}
                onPress={() => setCategory(cat.category)}
                style={[
                  styles.categoryChip,
                  { 
                    backgroundColor: category === cat.category 
                      ? LUXURY_COLORS.violet 
                      : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <Feather 
                  name={cat.icon} 
                  size={14} 
                  color={category === cat.category ? '#FFFFFF' : theme.text} 
                />
                <ThemedText 
                  type="small" 
                  style={[
                    styles.categoryLabel,
                    { color: category === cat.category ? '#FFFFFF' : theme.text }
                  ]}
                >
                  {cat.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {feedbackType === "rating" && renderStarRating()}

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Title
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                color: theme.text,
              },
            ]}
            placeholder="Brief summary of your feedback"
            placeholderTextColor={theme.tabIconDefault}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Description
          </ThemedText>
          <TextInput
            style={[
              styles.textArea,
              { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                color: theme.text,
              },
            ]}
            placeholder="Please describe in detail..."
            placeholderTextColor={theme.tabIconDefault}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.submitButton,
            { opacity: pressed || isSubmitting ? 0.8 : 1 },
          ]}
        >
          <LinearGradient
            colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
            style={styles.submitGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={18} color="#FFFFFF" />
                <ThemedText type="body" style={styles.submitText}>
                  Submit Feedback
                </ThemedText>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <View style={styles.footer}>
          <ThemedText type="caption" style={styles.footerText}>
            Your feedback helps us build a better Dripn experience. All submissions are reviewed by our team.
          </ThemedText>
        </View>
      </ScreenKeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  introSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  introText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  optionCard: {
    width: '48%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  optionLabel: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  optionDescription: {
    opacity: 0.7,
    textAlign: 'center',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  categoryLabel: {
    fontWeight: '500',
  },
  ratingContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  ratingLabel: {
    color: '#FFFFFF',
    marginBottom: Spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
  },
  ratingText: {
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
  input: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 16,
    minHeight: 150,
  },
  submitButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    padding: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  footerText: {
    textAlign: 'center',
    opacity: 0.5,
  },
});
