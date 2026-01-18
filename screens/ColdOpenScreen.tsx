import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { dfyService, DFYOccasion, ColdOpenFlow } from "@/services/DFYService";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  obsidian: '#0D0B09',
};

interface OccasionOption {
  id: DFYOccasion;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  gradient: readonly [string, string];
  description: string;
}

const OCCASION_OPTIONS: OccasionOption[] = [
  {
    id: 'work',
    label: 'Work',
    icon: 'briefcase',
    gradient: [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet],
    description: 'Office, meetings, professional',
  },
  {
    id: 'holiday',
    label: 'Holiday',
    icon: 'sun',
    gradient: [LUXURY_COLORS.coral, '#C46A4F'],
    description: 'Vacation, travel, relaxed',
  },
  {
    id: 'event',
    label: 'Event',
    icon: 'star',
    gradient: [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold],
    description: 'Party, wedding, special occasion',
  },
  {
    id: 'casual',
    label: 'Casual',
    icon: 'coffee',
    gradient: [LUXURY_COLORS.teal, LUXURY_COLORS.emerald],
    description: 'Everyday, weekend, errands',
  },
  {
    id: 'browsing',
    label: 'Just Browsing',
    icon: 'eye',
    gradient: [LUXURY_COLORS.rose, '#D4949A'],
    description: 'Exploring options, no rush',
  },
];

type ColdOpenScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function ColdOpenScreen({ navigation }: ColdOpenScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedOccasion, setSelectedOccasion] = useState<DFYOccasion | null>(null);
  const [struggleText, setStruggleText] = useState("");
  const [showStruggleInput, setShowStruggleInput] = useState(false);

  const handleOccasionSelect = (occasion: DFYOccasion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOccasion(occasion);
  };

  const handleContinue = async () => {
    if (!selectedOccasion) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const flow: ColdOpenFlow = {
      occasion: selectedOccasion,
      struggleText: struggleText.trim() || undefined,
      timestamp: new Date().toISOString(),
    };

    await dfyService.saveColdOpenFlow(flow);
    navigation.navigate('DFYComparison');
  };

  const handleSkipStruggle = () => {
    setShowStruggleInput(false);
    setStruggleText("");
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          LUXURY_COLORS.violet,
          LUXURY_COLORS.deepViolet,
          LUXURY_COLORS.obsidian,
        ]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
          <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.content}>
            <ThemedText type="h1" style={styles.title}>
              What are you getting dressed for?
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Pick the occasion that's on your mind right now
            </ThemedText>

            <View style={styles.occasionsGrid}>
              {OCCASION_OPTIONS.map((occasion) => {
                const isSelected = selectedOccasion === occasion.id;
                return (
                  <Pressable
                    key={occasion.id}
                    onPress={() => handleOccasionSelect(occasion.id)}
                    style={({ pressed }) => [
                      styles.occasionCard,
                      {
                        opacity: pressed ? 0.9 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={occasion.gradient}
                      style={[
                        styles.occasionGradient,
                        isSelected && styles.occasionSelected,
                      ]}
                    >
                      <Feather name={occasion.icon} size={28} color="#FFFFFF" />
                      <ThemedText type="h3" style={styles.occasionLabel}>
                        {occasion.label}
                      </ThemedText>
                      <ThemedText type="small" style={styles.occasionDescription}>
                        {occasion.description}
                      </ThemedText>
                      {isSelected ? (
                        <View style={styles.checkmark}>
                          <Feather name="check" size={16} color={LUXURY_COLORS.midnight} />
                        </View>
                      ) : null}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            {selectedOccasion && !showStruggleInput ? (
              <Pressable
                onPress={() => setShowStruggleInput(true)}
                style={styles.struggleToggle}
              >
                <Feather name="message-circle" size={16} color="rgba(255,255,255,0.7)" />
                <ThemedText style={styles.struggleToggleText}>
                  Having a specific struggle? Tell me more (optional)
                </ThemedText>
              </Pressable>
            ) : null}

            {showStruggleInput ? (
              <View style={styles.struggleContainer}>
                <View style={styles.struggleHeader}>
                  <ThemedText type="body" style={styles.struggleLabel}>
                    What's making it hard?
                  </ThemedText>
                  <Pressable onPress={handleSkipStruggle}>
                    <ThemedText style={styles.skipButton}>Skip</ThemedText>
                  </Pressable>
                </View>
                <TextInput
                  style={[
                    styles.struggleInput,
                    { color: '#FFFFFF' },
                  ]}
                  placeholder="e.g., Nothing feels right, I'm bored of my clothes..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={struggleText}
                  onChangeText={setStruggleText}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
                <ThemedText type="small" style={styles.charCount}>
                  {struggleText.length}/200
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <LinearGradient
              colors={selectedOccasion 
                ? [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]
                : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
              }
              style={styles.continueButtonGradient}
            >
              <Pressable
                onPress={handleContinue}
                disabled={!selectedOccasion}
                style={[
                  styles.continueButton,
                  !selectedOccasion && styles.continueButtonDisabled,
                ]}
              >
                <ThemedText
                  type="body"
                  style={[
                    styles.continueButtonText,
                    { color: selectedOccasion ? LUXURY_COLORS.midnight : 'rgba(255,255,255,0.4)' },
                  ]}
                >
                  Continue
                </ThemedText>
                <Feather
                  name="arrow-right"
                  size={18}
                  color={selectedOccasion ? LUXURY_COLORS.midnight : 'rgba(255,255,255,0.4)'}
                />
              </Pressable>
            </LinearGradient>
          </View>
        </ScreenScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 24,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  occasionsGrid: {
    gap: Spacing.md,
  },
  occasionCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  occasionGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  occasionSelected: {
    borderColor: '#FFFFFF',
  },
  occasionLabel: {
    color: '#FFFFFF',
    flex: 1,
  },
  occasionDescription: {
    color: 'rgba(255,255,255,0.7)',
    flex: 2,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  struggleToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  struggleToggleText: {
    color: 'rgba(255,255,255,0.7)',
  },
  struggleContainer: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.lg,
  },
  struggleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  struggleLabel: {
    color: '#FFFFFF',
  },
  skipButton: {
    color: 'rgba(255,255,255,0.6)',
  },
  struggleInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  charCount: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  continueButtonGradient: {
    borderRadius: BorderRadius.full,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontWeight: '700',
  },
});
