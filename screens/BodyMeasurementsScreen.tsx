import React, { useState } from "react";
import { StyleSheet, View, Pressable, TextInput, Alert } from "react-native";
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
import { useColorScheme } from "@/contexts/ColorSchemeContext";
import { useTranslations } from "@/contexts/TranslationContext";

type BodyMeasurementsScreenProps = {
  navigation: any;
};

export default function BodyMeasurementsScreen({ navigation }: BodyMeasurementsScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user, updateProfile } = useAuth();
  const { palette } = useColorScheme();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurements>({
    height: user?.bodyMeasurements?.height || null,
    heightUnit: user?.bodyMeasurements?.heightUnit || 'cm',
    weight: user?.bodyMeasurements?.weight || null,
    weightUnit: user?.bodyMeasurements?.weightUnit || 'kg',
  });

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await updateProfile({ bodyMeasurements });
      Alert.alert(t('common.saved') || "Saved", t('common.yourBodyMeasurementsHaveBeenUpdated') || "Your body measurements have been updated.", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Failed to save measurements:', error);
      Alert.alert(t('common.error') || "Error", t('common.failedToSaveMeasurementsPleaseTryAgain') || "Failed to save measurements. Please try again.");
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
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <ThemedText type="h3" style={styles.headerTitle}>
          Body Measurements
        </ThemedText>
        <View style={styles.backButtonPlaceholder} />
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          entering={FadeInRight.duration(300)}
          exiting={FadeOutLeft.duration(200)}
          style={styles.content}
        >
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={[palette.rose, palette.coral]}
              style={styles.iconGradient}
            >
              <Feather name="user" size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <ThemedText type="h2" style={styles.title}>
            Your Measurements
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            Update your height and weight for personalized styling recommendations
          </ThemedText>

          <View style={styles.measurementSection}>
            <ThemedText type="small" style={styles.measurementLabel}>
              Height
            </ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.measurementInput,
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
                    color: isDark ? '#FFFFFF' : '#1A1A2E',
                  }
                ]}
                value={bodyMeasurements.height?.toString() || ''}
                onChangeText={(text) => setBodyMeasurements(prev => ({
                  ...prev,
                  height: text ? parseFloat(text) : null
                }))}
                keyboardType="numeric"
                placeholder={bodyMeasurements.heightUnit === 'cm' ? "175" : "5.9"}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
              />
              <View style={styles.unitToggle}>
                <Pressable
                  style={[
                    styles.unitButton,
                    bodyMeasurements.heightUnit === 'cm' && { backgroundColor: palette.violet }
                  ]}
                  onPress={() => setBodyMeasurements(prev => ({ ...prev, heightUnit: 'cm' }))}
                >
                  <ThemedText 
                    type="small" 
                    style={[
                      styles.unitText,
                      bodyMeasurements.heightUnit === 'cm' && { color: '#FFFFFF' }
                    ]}
                  >
                    cm
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.unitButton,
                    bodyMeasurements.heightUnit === 'ft' && { backgroundColor: palette.violet }
                  ]}
                  onPress={() => setBodyMeasurements(prev => ({ ...prev, heightUnit: 'ft' }))}
                >
                  <ThemedText 
                    type="small"
                    style={[
                      styles.unitText,
                      bodyMeasurements.heightUnit === 'ft' && { color: '#FFFFFF' }
                    ]}
                  >
                    ft
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.measurementSection}>
            <ThemedText type="small" style={styles.measurementLabel}>
              Weight
            </ThemedText>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.measurementInput,
                  { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
                    color: isDark ? '#FFFFFF' : '#1A1A2E',
                  }
                ]}
                value={bodyMeasurements.weight?.toString() || ''}
                onChangeText={(text) => setBodyMeasurements(prev => ({
                  ...prev,
                  weight: text ? parseFloat(text) : null
                }))}
                keyboardType="numeric"
                placeholder={bodyMeasurements.weightUnit === 'kg' ? "70" : "154"}
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}
              />
              <View style={styles.unitToggle}>
                <Pressable
                  style={[
                    styles.unitButton,
                    bodyMeasurements.weightUnit === 'kg' && { backgroundColor: palette.violet }
                  ]}
                  onPress={() => setBodyMeasurements(prev => ({ ...prev, weightUnit: 'kg' }))}
                >
                  <ThemedText 
                    type="small"
                    style={[
                      styles.unitText,
                      bodyMeasurements.weightUnit === 'kg' && { color: '#FFFFFF' }
                    ]}
                  >
                    kg
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.unitButton,
                    bodyMeasurements.weightUnit === 'lbs' && { backgroundColor: palette.violet }
                  ]}
                  onPress={() => setBodyMeasurements(prev => ({ ...prev, weightUnit: 'lbs' }))}
                >
                  <ThemedText 
                    type="small"
                    style={[
                      styles.unitText,
                      bodyMeasurements.weightUnit === 'lbs' && { color: '#FFFFFF' }
                    ]}
                  >
                    lbs
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Feather name="lock" size={16} color={palette.gold} />
            <ThemedText type="small" style={styles.infoText}>
              Your measurements are private and only used to provide personalized recommendations
            </ThemedText>
          </View>
        </Animated.View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Pressable
            onPress={handleSave}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.saveButton,
              { opacity: pressed || isSubmitting ? 0.8 : 1 }
            ]}
          >
            <LinearGradient
              colors={[palette.violet, palette.rose]}
              style={styles.saveButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ThemedText type="body" style={styles.saveButtonText}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 40,
  },
  headerTitle: {
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  measurementSection: {
    marginBottom: Spacing.lg,
  },
  measurementLabel: {
    color: 'rgba(255,255,255,0.9)',
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  measurementInput: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 18,
    fontWeight: '500',
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  unitButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  unitText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  infoText: {
    flex: 1,
    color: 'rgba(255,255,255,0.7)',
  },
  footer: {
    paddingTop: Spacing.xl,
  },
  saveButton: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
