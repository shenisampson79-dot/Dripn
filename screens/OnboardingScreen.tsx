import React, { useState } from "react";
import { StyleSheet, View, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, StyleTheme, StyleThemes } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SizeRange, BodyShape, BudgetRange } from "@/contexts/AuthContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

type OnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Onboarding">;
};

const STYLE_OPTIONS: { id: StyleTheme; name: string; description: string }[] = [
  { id: "luxury", name: "Luxury", description: "Elegant, refined, timeless pieces" },
  { id: "streetwear", name: "Streetwear", description: "Urban, bold, trend-forward" },
  { id: "boho", name: "Boho", description: "Earthy, relaxed, artistic" },
  { id: "sporty", name: "Sporty", description: "Active, dynamic, athletic" },
  { id: "romantic", name: "Romantic", description: "Soft, feminine, delicate" },
  { id: "edgy", name: "Edgy", description: "Bold, alternative, dramatic" },
];

const SIZE_OPTIONS: SizeRange[] = ["XS-S", "M-L", "XL-2X", "3X+"];

const BODY_SHAPE_OPTIONS: { id: BodyShape; name: string }[] = [
  { id: "Hourglass", name: "Hourglass" },
  { id: "Pear", name: "Pear" },
  { id: "Apple", name: "Apple" },
  { id: "Rectangle", name: "Rectangle" },
  { id: "Athletic", name: "Athletic" },
];

const BUDGET_OPTIONS: { id: BudgetRange; name: string }[] = [
  { id: "Budget", name: "Budget-Friendly" },
  { id: "Mid-Range", name: "Mid-Range" },
  { id: "Premium", name: "Premium" },
  { id: "Luxury", name: "Luxury" },
];

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "South Korea",
  "Brazil",
  "Mexico",
  "Other",
];

export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { completeOnboarding } = useAuth();

  const [step, setStep] = useState(0);
  const [country, setCountry] = useState("United States");
  const [stylePreference, setStylePreference] = useState<StyleTheme>("luxury");
  const [sizeRange, setSizeRange] = useState<SizeRange>(null);
  const [bodyShape, setBodyShape] = useState<BodyShape>(null);
  const [budgetRange, setBudgetRange] = useState<BudgetRange>(null);

  const totalSteps = 3;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    await completeOnboarding({
      country,
      stylePreference,
      sizeRange,
      bodyShape,
      budgetRange,
    });
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Where are you located?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              This helps us show seasonal and regional content
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.optionsGrid}>
                {COUNTRIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCountry(c)}
                    style={({ pressed }) => [
                      styles.optionChip,
                      {
                        backgroundColor:
                          country === c ? theme.link : theme.backgroundDefault,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      type="body"
                      style={{
                        color: country === c ? "#FFFFFF" : theme.text,
                      }}
                    >
                      {c}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              What's your style?
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Pick the aesthetic that speaks to you
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.styleOptions}>
                {STYLE_OPTIONS.map((s) => {
                  const styleColors = StyleThemes[s.id].light;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setStylePreference(s.id)}
                      style={({ pressed }) => [
                        styles.styleOption,
                        {
                          backgroundColor:
                            stylePreference === s.id
                              ? theme.link
                              : theme.backgroundDefault,
                          borderColor:
                            stylePreference === s.id
                              ? theme.link
                              : "transparent",
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.styleColorPreview,
                          { backgroundColor: styleColors.primary },
                        ]}
                      />
                      <View style={styles.styleTextContainer}>
                        <ThemedText
                          type="h3"
                          style={{
                            color: stylePreference === s.id ? "#FFFFFF" : theme.text,
                          }}
                        >
                          {s.name}
                        </ThemedText>
                        <ThemedText
                          type="small"
                          style={{
                            color: stylePreference === s.id ? "#FFFFFF" : theme.text,
                            opacity: 0.7,
                          }}
                        >
                          {s.description}
                        </ThemedText>
                      </View>
                      {stylePreference === s.id ? (
                        <Feather name="check-circle" size={24} color="#FFFFFF" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <ThemedText type="h2" style={styles.stepTitle}>
              Tell us more (optional)
            </ThemedText>
            <ThemedText type="body" style={styles.stepSubtitle}>
              Help us personalize your recommendations
            </ThemedText>
            <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Size Range
                </ThemedText>
                <View style={styles.optionsRow}>
                  {SIZE_OPTIONS.map((size) => (
                    <Pressable
                      key={size}
                      onPress={() => setSizeRange(sizeRange === size ? null : size)}
                      style={({ pressed }) => [
                        styles.optionChip,
                        {
                          backgroundColor:
                            sizeRange === size ? theme.link : theme.backgroundDefault,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: sizeRange === size ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {size}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Body Shape
                </ThemedText>
                <View style={styles.optionsRow}>
                  {BODY_SHAPE_OPTIONS.map((shape) => (
                    <Pressable
                      key={shape.id}
                      onPress={() =>
                        setBodyShape(bodyShape === shape.id ? null : shape.id)
                      }
                      style={({ pressed }) => [
                        styles.optionChip,
                        {
                          backgroundColor:
                            bodyShape === shape.id
                              ? theme.link
                              : theme.backgroundDefault,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: bodyShape === shape.id ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {shape.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.optionalSection}>
                <ThemedText type="h3" style={styles.sectionLabel}>
                  Budget Range
                </ThemedText>
                <View style={styles.optionsRow}>
                  {BUDGET_OPTIONS.map((budget) => (
                    <Pressable
                      key={budget.id}
                      onPress={() =>
                        setBudgetRange(budgetRange === budget.id ? null : budget.id)
                      }
                      style={({ pressed }) => [
                        styles.optionChip,
                        {
                          backgroundColor:
                            budgetRange === budget.id
                              ? theme.link
                              : theme.backgroundDefault,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemedText
                        type="body"
                        style={{
                          color: budgetRange === budget.id ? "#FFFFFF" : theme.text,
                        }}
                      >
                        {budget.name}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor: i <= step ? theme.link : theme.backgroundSecondary,
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [
            styles.skipButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText type="body" style={{ color: theme.link }}>
            Skip
          </ThemedText>
        </Pressable>
      </View>

      {renderStep()}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Button onPress={handleNext} style={styles.nextButton}>
          {step === totalSteps - 1 ? "Get Started" : "Continue"}
        </Button>
      </View>
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
    paddingBottom: Spacing.lg,
  },
  progressContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  stepTitle: {
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    opacity: 0.7,
    marginBottom: Spacing.xl,
  },
  optionsScroll: {
    flex: 1,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionChip: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  styleOptions: {
    gap: Spacing.md,
  },
  styleOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  styleColorPreview: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  styleTextContainer: {
    flex: 1,
  },
  optionalSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    marginBottom: Spacing.md,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  nextButton: {
    width: "100%",
  },
});
