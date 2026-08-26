import React, { useState, useLayoutEffect } from "react";
import { StyleSheet, View, Pressable, TextInput, Alert, ActivityIndicator, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Device from "expo-device";
import Constants from "expo-constants";

import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type FeedbackType = "bug" | "feature" | "general" | "rating";
type FeedbackCategory =
  | "stylist"
  | "wardrobe"
  | "lookbook"
  | "scanner"
  | "billing"
  | "account"
  | "blog"
  | "other";

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

const FEEDBACK_FALLBACKS: Record<string, string> = {
  "feedback.screenTitle": "Send Feedback",
  "feedback.intro":
    "Help us improve Dripn! Your feedback is invaluable for making the app better for everyone.",
  "feedback.whatType": "What type of feedback?",
  "feedback.whichArea": "Which area of the app?",
  "feedback.type.bug.label": "Bug Report",
  "feedback.type.bug.description": "Something isn't working",
  "feedback.type.feature.label": "Feature Request",
  "feedback.type.feature.description": "Suggest an improvement",
  "feedback.type.general.label": "General Feedback",
  "feedback.type.general.description": "Share your thoughts",
  "feedback.type.rating.label": "Rate Experience",
  "feedback.type.rating.description": "Rate your overall experience",
  "feedback.category.stylist": "AI Stylist",
  "feedback.category.wardrobe": "Wardrobe",
  "feedback.category.lookbook": "Lookbook & outfits",
  "feedback.category.scanner": "Camera & uploads",
  "feedback.category.billing": "Billing & subscription",
  "feedback.category.account": "Account & login",
  "feedback.category.blog": "Fashion Blog",
  "feedback.category.other": "Other",
  "feedback.ratingPrompt": "How would you rate your experience?",
  "feedback.rating.excellent": "Excellent!",
  "feedback.rating.great": "Great!",
  "feedback.rating.good": "Good",
  "feedback.rating.fair": "Fair",
  "feedback.rating.poor": "Poor",
  "feedback.titleLabel": "Title",
  "feedback.titlePlaceholder": "Brief summary of your feedback",
  "feedback.descriptionLabel": "Description",
  "feedback.descriptionPlaceholder":
    "Please describe in detail. What happened, what you expected, and any steps to reproduce...",
  "feedback.submit": "Submit Feedback",
  "feedback.footer":
    "Your feedback helps us improve Dripn. Our team reviews every submission.",
  "feedback.requiredTitle": "Required",
  "feedback.requiredType": "Please select a feedback type.",
  "feedback.requiredCategory": "Please select an area.",
  "feedback.requiredTitleField": "Please enter a title for your feedback.",
  "feedback.requiredDescription": "Please describe your feedback in detail.",
  "feedback.requiredRating": "Please select a rating.",
  "feedback.thankYouTitle": "Thank You!",
  "feedback.thankYouMessage":
    "Thanks — we've got your feedback.",
  "feedback.submissionFailedTitle": "Submission Failed",
  "feedback.submissionFailedMessage":
    "We couldn't submit your feedback. Please check your connection and try again.",
  "feedback.offlineMessage":
    "You're offline. Connect to Wi‑Fi or mobile data, then try submitting again.",
};

const CORRUPT_VALUES = new Set([
  "label",
  "description",
  "wardrobe",
  "grid",
  "more-horizontal",
  "other",
  "user",
  "login",
  "message-square",
  "ok",
  "we couldn",
  "required title",
  "required category",
  "required description",
  "required rating",
  "required type",
  "required title field",
  "submission failed",
]);

function tx(t: (key: string) => string, key: string): string {
  const fallback = FEEDBACK_FALLBACKS[key] || "";
  const value = (t(key) || "").trim();
  if (!value) return fallback;
  if (CORRUPT_VALUES.has(value.toLowerCase())) return fallback;
  if (value.includes("response.message") || value.includes('|| "')) return fallback;
  if (key === "feedback.screenTitle" && value.toLowerCase() === "wardrobe") return fallback;
  return value;
}

function getFeedbackTypes(t: (key: string) => string): FeedbackOption[] {
  return [
    {
      type: "bug",
      label: tx(t, "feedback.type.bug.label"),
      icon: "alert-circle",
      description: tx(t, "feedback.type.bug.description"),
    },
    {
      type: "feature",
      label: tx(t, "feedback.type.feature.label"),
      icon: "zap",
      description: tx(t, "feedback.type.feature.description"),
    },
    {
      type: "general",
      label: tx(t, "feedback.type.general.label"),
      icon: "message-circle",
      description: tx(t, "feedback.type.general.description"),
    },
    {
      type: "rating",
      label: tx(t, "feedback.type.rating.label"),
      icon: "star",
      description: tx(t, "feedback.type.rating.description"),
    },
  ];
}

function getCategories(t: (key: string) => string): CategoryOption[] {
  return [
    { category: "stylist", label: tx(t, "feedback.category.stylist"), icon: "message-circle" },
    { category: "wardrobe", label: tx(t, "feedback.category.wardrobe"), icon: "grid" },
    { category: "lookbook", label: tx(t, "feedback.category.lookbook"), icon: "calendar" },
    { category: "scanner", label: tx(t, "feedback.category.scanner"), icon: "camera" },
    { category: "billing", label: tx(t, "feedback.category.billing"), icon: "credit-card" },
    { category: "account", label: tx(t, "feedback.category.account"), icon: "user" },
    { category: "blog", label: tx(t, "feedback.category.blog"), icon: "book-open" },
    { category: "other", label: tx(t, "feedback.category.other"), icon: "more-horizontal" },
  ];
}

type FeedbackScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Feedback">;
};

export default function FeedbackScreen({ navigation }: FeedbackScreenProps) {
  const { theme, isDark } = useTheme();
  const { palette } = useColorScheme();
  const { t } = useTranslations();

  const feedbackTypes = getFeedbackTypes(t);
  const categories = getCategories(t);

  const LUXURY_COLORS = {
    gold: palette.gold,
    deepGold: palette.deepGold,
    rose: palette.rose,
    berry: palette.berry,
    violet: palette.violet,
    deepViolet: palette.deepViolet,
    champagne: "#F5E6D3",
    midnight: "#1A1A2E",
    coral: palette.coral,
    teal: palette.teal,
    emerald: palette.emerald,
  };

  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionHeight, setDescriptionHeight] = useState(150);
  const [rating, setRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useLayoutEffect(() => {
    const screenTitle = tx(t, "feedback.screenTitle");
    navigation.setOptions({ title: screenTitle });
  }, [navigation, t]);

  const resolveFeedbackType = (): FeedbackType | null => {
    if (feedbackType) return feedbackType;
    if (category) return "general";
    return null;
  };

  const getDeviceInfo = (): string => {
    const osName = Platform.OS === "ios" ? "iOS" : Platform.OS === "web" ? "Web" : "Android";
    const osVersion = Platform.Version;
    const deviceName = Device.modelName || "Unknown";
    return `${osName} ${osVersion} (${deviceName})`;
  };

  const getAppVersion = (): string => {
    return Constants.expoConfig?.version || "1.0.0";
  };

  const getRatingLabel = (value: number): string => {
    switch (value) {
      case 5:
        return tx(t, "feedback.rating.excellent");
      case 4:
        return tx(t, "feedback.rating.great");
      case 3:
        return tx(t, "feedback.rating.good");
      case 2:
        return tx(t, "feedback.rating.fair");
      case 1:
        return tx(t, "feedback.rating.poor");
      default:
        return "";
    }
  };

  const handleSubmit = async () => {
    const effectiveType = resolveFeedbackType();
    if (!effectiveType) {
      Alert.alert(tx(t, "feedback.requiredTitle"), tx(t, "feedback.requiredType"));
      return;
    }
    if (!category) {
      Alert.alert(tx(t, "feedback.requiredTitle"), tx(t, "feedback.requiredCategory"));
      return;
    }
    if (!title.trim()) {
      Alert.alert(tx(t, "feedback.requiredTitle"), tx(t, "feedback.requiredTitleField"));
      return;
    }
    if (!description.trim()) {
      Alert.alert(tx(t, "feedback.requiredTitle"), tx(t, "feedback.requiredDescription"));
      return;
    }
    if (effectiveType === "rating" && rating === 0) {
      Alert.alert(tx(t, "feedback.requiredTitle"), tx(t, "feedback.requiredRating"));
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        feedbackType: effectiveType,
        category,
        title: title.trim(),
        description: description.trim(),
        deviceInfo: getDeviceInfo(),
        appVersion: getAppVersion(),
      };

      if (effectiveType === "rating" && rating > 0) {
        payload.rating = rating;
      }

      const response = await apiService.submitFeedback(payload);

      if (response.success) {
        setFeedbackType(null);
        setCategory(null);
        setTitle("");
        setDescription("");
        setRating(0);
        // Stay on Send Feedback — do not navigate away on OK.
        Alert.alert(
          tx(t, "feedback.thankYouTitle"),
          tx(t, "feedback.thankYouMessage"),
          [{ text: t("common.ok") || "OK" }],
        );
      } else {
        throw new Error("Submission failed");
      }
    } catch (error) {
      console.warn("Feedback submission error:", error instanceof Error ? error.message : error);
      const errMsg = String(error instanceof Error ? error.message : error).toLowerCase();
      const looksOffline =
        errMsg.includes("network") ||
        errMsg.includes("offline") ||
        errMsg.includes("fetch") ||
        errMsg.includes("failed to fetch") ||
        errMsg.includes("internet");
      Alert.alert(
        tx(t, "feedback.submissionFailedTitle"),
        looksOffline
          ? tx(t, "feedback.offlineMessage")
          : tx(t, "feedback.submissionFailedMessage"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarRating = () => {
    return (
      <View style={styles.ratingContainer}>
        <ThemedText type="body" style={[styles.ratingLabel, { color: theme.text }]}>
          {tx(t, "feedback.ratingPrompt")}
        </ThemedText>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(star)} style={styles.starButton}>
              <Feather
                name="star"
                size={32}
                color={star <= rating ? LUXURY_COLORS.gold : theme.tabIconDefault}
                style={star <= rating ? { opacity: 1 } : { opacity: 0.3 }}
              />
            </Pressable>
          ))}
        </View>
        {rating > 0 && (
          <ThemedText type="small" style={[styles.ratingText, { color: LUXURY_COLORS.gold }]}>
            {getRatingLabel(rating)}
          </ThemedText>
        )}
      </View>
    );
  };

  const inputSurface = isDark ? "rgba(255,255,255,0.08)" : "#FFFFFF";

  return (
    <ScreenKeyboardAwareScrollView
      opaqueHeader
      style={{ backgroundColor: theme.backgroundRoot }}
    >
      <View style={styles.introSection}>
        <ThemedText type="h3" style={[styles.pageTitle, { color: theme.text }]}>
          {tx(t, "feedback.screenTitle")}
        </ThemedText>
        <ThemedText type="body" style={[styles.introText, { color: theme.tabIconDefault }]}>
          {tx(t, "feedback.intro")}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          {tx(t, "feedback.whatType")}
        </ThemedText>
        <View style={styles.optionsGrid}>
          {feedbackTypes.map((option) => (
            <Pressable
              key={option.type}
              onPress={() => setFeedbackType(option.type)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF",
                  borderColor:
                    feedbackType === option.type ? LUXURY_COLORS.violet : "transparent",
                  borderWidth: 2,
                },
              ]}
            >
              <LinearGradient
                colors={
                  feedbackType === option.type
                    ? [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]
                    : [LUXURY_COLORS.teal + "40", LUXURY_COLORS.emerald + "40"]
                }
                style={styles.optionIcon}
              >
                <Feather name={option.icon} size={18} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="body" style={[styles.optionLabel, { color: theme.text }]}>
                {option.label}
              </ThemedText>
              <ThemedText
                type="caption"
                style={[styles.optionDescription, { color: theme.tabIconDefault }]}
              >
                {option.description}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          {tx(t, "feedback.whichArea")}
        </ThemedText>
        <View style={styles.categoriesRow}>
          {categories.map((cat) => (
            <Pressable
              key={cat.category}
              onPress={() => setCategory(cat.category)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor:
                    category === cat.category
                      ? LUXURY_COLORS.violet
                      : isDark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <Feather
                name={cat.icon}
                size={14}
                color={category === cat.category ? "#FFFFFF" : theme.text}
              />
              <ThemedText
                type="small"
                style={[
                  styles.categoryLabel,
                  { color: category === cat.category ? "#FFFFFF" : theme.text },
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
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          {tx(t, "feedback.titleLabel")}
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: inputSurface,
              color: theme.text,
            },
          ]}
          placeholder={tx(t, "feedback.titlePlaceholder")}
          placeholderTextColor={theme.tabIconDefault}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          multiline={false}
          numberOfLines={1}
          returnKeyType="next"
          blurOnSubmit
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.text }]}>
          {tx(t, "feedback.descriptionLabel")}
        </ThemedText>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: inputSurface,
              color: theme.text,
              height: Math.max(150, descriptionHeight),
            },
          ]}
          placeholder={tx(t, "feedback.descriptionPlaceholder")}
          placeholderTextColor={theme.tabIconDefault}
          value={description}
          onChangeText={setDescription}
          multiline
          scrollEnabled
          textAlignVertical="top"
          blurOnSubmit={false}
          returnKeyType="default"
          maxLength={4000}
          onContentSizeChange={(e) => {
            const next = Math.min(320, Math.max(150, e.nativeEvent.contentSize.height + 24));
            setDescriptionHeight(next);
          }}
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
                {tx(t, "feedback.submit")}
              </ThemedText>
            </>
          )}
        </LinearGradient>
      </Pressable>

      <View style={styles.footer}>
        <ThemedText type="caption" style={[styles.footerText, { color: theme.tabIconDefault }]}>
          {tx(t, "feedback.footer")}
        </ThemedText>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  introSection: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  pageTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  introText: {
    textAlign: "center",
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  optionLabel: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  optionDescription: {
    textAlign: "center",
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  categoryLabel: {
    fontWeight: "500",
  },
  ratingContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  ratingLabel: {
    marginBottom: Spacing.md,
  },
  starsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  starButton: {
    padding: Spacing.xs,
  },
  ratingText: {
    marginTop: Spacing.sm,
    fontWeight: "600",
  },
  input: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    lineHeight: 22,
  },
  textArea: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 150,
  },
  submitButton: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  submitGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  footer: {
    padding: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  footerText: {
    textAlign: "center",
  },
});
