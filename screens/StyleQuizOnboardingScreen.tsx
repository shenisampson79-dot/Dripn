import React, { useState } from "react";
import { StyleSheet, View, Pressable, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInRight, FadeOutLeft } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { 
  useAuth, 
  BodyMeasurements, 
  HeightUnit,
  WeightUnit,
} from "@/contexts/AuthContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

type StyleQuizOnboardingScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "StyleQuizOnboarding">;
};

export default function StyleQuizOnboardingScreen({ navigation }: StyleQuizOnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { completeQuiz, user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements>({
    height: user?.bodyMeasurements?.height || null,
    heightUnit: user?.bodyMeasurements?.heightUnit || 'cm',
    weight: user?.bodyMeasurements?.weight || null,
    weightUnit: user?.bodyMeasurements?.weightUnit || 'kg',
  });

  const handleSkip = () => {
    navigation.replace("SuggestedFollows");
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      if (bodyMeasurements.height || bodyMeasurements.weight) {
        await completeQuiz({ bodyMeasurements });
      }
      navigation.replace("SuggestedFollows");
    } catch (error) {
      console.error('Failed to save measurements:', error);
      navigation.replace("SuggestedFollows");
    } finally {
      setIsSubmitting(false);
    }
  };

  const gradientColors = ScreenGradients.styleMeProperly.primary;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={Spacing.xl + insets.bottom}
      >
        <View style={styles.header}>
          <View style={styles.backButtonPlaceholder} />
          <ThemedText type="h3" style={styles.headerTitle}>
            Body Measurements
          </ThemedText>
          <Pressable onPress={handleSkip} style={styles.skipButton}>
            <ThemedText type="body" style={{ color: theme.link }}>
              Skip
            </ThemedText>
          </Pressable>
        </View>

        <Animated.View
          entering={FadeInRight.duration(300)}
          exiting={FadeOutLeft.duration(200)}
          style={styles.stepContent}
        >
          <ThemedText type="h2" style={styles.stepTitle}>
            Your Measurements
          </ThemedText>
          <ThemedText type="body" style={styles.stepSubtitle}>
            Help us find your perfect fit (optional)
          </ThemedText>

          <View style={styles.measurementSection}>
            <ThemedText type="caption" style={styles.sectionLabel}>
              Height
            </ThemedText>
            <View style={styles.measurementRow}>
              <TextInput
                style={[
                  styles.measurementInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.backgroundSecondary,
                  },
                ]}
                placeholder={bodyMeasurements.heightUnit === 'cm' ? "170" : "5'7\""}
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="numeric"
                value={bodyMeasurements.height?.toString() || ""}
                onChangeText={(text) => {
                  const num = parseFloat(text);
                  setBodyMeasurements({
                    ...bodyMeasurements,
                    height: isNaN(num) ? null : num,
                  });
                }}
              />
              <View style={styles.unitToggle}>
                {(['cm', 'ft'] as HeightUnit[]).map((unit) => (
                  <Pressable
                    key={unit}
                    onPress={() => setBodyMeasurements({ ...bodyMeasurements, heightUnit: unit })}
                    style={[
                      styles.unitButton,
                      {
                        backgroundColor: bodyMeasurements.heightUnit === unit
                          ? theme.link
                          : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{
                        color: bodyMeasurements.heightUnit === unit ? "#FFFFFF" : theme.text,
                        fontWeight: bodyMeasurements.heightUnit === unit ? "600" : "400",
                      }}
                    >
                      {unit.toUpperCase()}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.measurementSection}>
            <ThemedText type="caption" style={styles.sectionLabel}>
              Weight
            </ThemedText>
            <View style={styles.measurementRow}>
              <TextInput
                style={[
                  styles.measurementInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.backgroundSecondary,
                  },
                ]}
                placeholder={bodyMeasurements.weightUnit === 'kg' ? "70" : "154"}
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="numeric"
                value={bodyMeasurements.weight?.toString() || ""}
                onChangeText={(text) => {
                  const num = parseFloat(text);
                  setBodyMeasurements({
                    ...bodyMeasurements,
                    weight: isNaN(num) ? null : num,
                  });
                }}
              />
              <View style={styles.unitToggle}>
                {(['kg', 'lbs'] as WeightUnit[]).map((unit) => (
                  <Pressable
                    key={unit}
                    onPress={() => setBodyMeasurements({ ...bodyMeasurements, weightUnit: unit })}
                    style={[
                      styles.unitButton,
                      {
                        backgroundColor: bodyMeasurements.weightUnit === unit
                          ? theme.link
                          : theme.backgroundSecondary,
                      },
                    ]}
                  >
                    <ThemedText
                      type="caption"
                      style={{
                        color: bodyMeasurements.weightUnit === unit ? "#FFFFFF" : theme.text,
                        fontWeight: bodyMeasurements.weightUnit === unit ? "600" : "400",
                      }}
                    >
                      {unit.toUpperCase()}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.infoCard, { backgroundColor: theme.link + '15' }]}>
            <Feather name="info" size={20} color={theme.link} />
            <ThemedText type="caption" style={[styles.infoText, { color: theme.text }]}>
              Your measurements help our AI stylists recommend clothes that fit perfectly. 
              This information is private and never shared.
            </ThemedText>
          </View>
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button
            onPress={handleComplete}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </View>
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  backButtonPlaceholder: {
    width: 32,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  skipButton: {
    padding: Spacing.xs,
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
  measurementSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionLabel: {
    marginBottom: Spacing.md,
  },
  measurementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  measurementInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  unitToggle: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  unitButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  infoText: {
    flex: 1,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
});
