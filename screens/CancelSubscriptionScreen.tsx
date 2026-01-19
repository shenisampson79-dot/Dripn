import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, TextInput, Switch, ActivityIndicator, Alert } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius, LuxuryColors } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/ApiService";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type CancelSubscriptionScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "CancelSubscription">;
};

interface CancellationStartData {
  stylist: string;
  stylistName: string;
  message: string;
  feedbackPrompt: string;
  cancellationReasons: Array<{ value: string; label: string }>;
}

interface FarewellData {
  stylistName: string;
  farewellMessage: string;
  reactivationOffer: {
    options: Array<{ type: string; label: string; price: string }>;
  };
}

const STYLIST_COLORS: Record<string, readonly [string, string]> = {
  ruby: ['#E8B4B8', '#D4949A'],
  max: ['#9B7EBD', '#6B4E8D'],
  ace: ['#0D0B09', '#1A1A1A'],
  ivy: ['#059669', '#2A9D8F'],
};

const STYLIST_ICONS: Record<string, string> = {
  ruby: 'heart',
  max: 'zap',
  ace: 'target',
  ivy: 'compass',
};

export default function CancelSubscriptionScreen({ navigation }: CancelSubscriptionScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [startData, setStartData] = useState<CancellationStartData | null>(null);
  const [farewellData, setFarewellData] = useState<FarewellData | null>(null);

  const [selectedReason, setSelectedReason] = useState<string>("");
  const [feedback, setFeedback] = useState("");
  const [wouldReturn, setWouldReturn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadCancellationStart();
  }, []);

  const loadCancellationStart = async () => {
    try {
      const data = await apiService.startSubscriptionCancellation();
      setStartData(data);
    } catch (error: any) {
      setStartData({
        stylist: user?.stylistPreferences?.selectedStylistId || 'ruby',
        stylistName: 'Ruby',
        message: "Oh no, I really hate to see you go...",
        feedbackPrompt: "Before you go, would you mind telling me why?",
        cancellationReasons: [
          { value: 'too-expensive', label: 'Too expensive for my budget' },
          { value: 'not-using', label: "I'm not using it enough" },
          { value: 'found-alternative', label: 'Found an alternative' },
          { value: 'missing-features', label: 'Missing features I need' },
          { value: 'technical-issues', label: 'Technical issues' },
          { value: 'other', label: 'Other reason' },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueToFeedback = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(2);
  };

  const handleSubmitFeedback = async () => {
    if (!selectedReason) {
      Alert.alert('Please select a reason', 'Help us understand why you\'re leaving.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiService.submitCancellationFeedback({
        reason: selectedReason,
        feedback: feedback.trim() || undefined,
        wouldReturn,
      });

      const farewell = await apiService.completeCancellation();
      setFarewellData(farewell);
      setStep(3);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setFarewellData({
        stylistName: startData?.stylistName || 'Ruby',
        farewellMessage: "I'm always here whenever you need advice...",
        reactivationOffer: {
          options: [
            { type: 'occasion', label: 'Single Occasion Styling', price: '£9.99' },
          ],
        },
      });
      setStep(3);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeepSubscription = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const handleDone = () => {
    navigation.goBack();
  };

  const handleReactivation = (option: { type: string; label: string; price: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      option.label,
      `Would you like to try ${option.label} for ${option.price}?`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Yes, please!', onPress: () => navigation.navigate('Subscription') },
      ]
    );
  };

  const stylistId = startData?.stylist || 'ruby';
  const gradientColors = STYLIST_COLORS[stylistId] || STYLIST_COLORS.ruby;
  const iconName = STYLIST_ICONS[stylistId] || 'heart';

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
      </ThemedView>
    );
  }

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.avatarContainer}>
        <LinearGradient colors={gradientColors} style={styles.avatar}>
          <Feather name={iconName as any} size={40} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h3" style={styles.stylistName}>
          {startData?.stylistName}
        </ThemedText>
      </View>

      <Card style={styles.messageCard}>
        <ThemedText type="body" style={styles.messageText}>
          {startData?.message}
        </ThemedText>
      </Card>

      <View style={styles.actionButtons}>
        <Button
          label="I've changed my mind"
          onPress={handleKeepSubscription}
          style={styles.keepButton}
        />
        <Pressable
          onPress={handleContinueToFeedback}
          style={({ pressed }) => [
            styles.continueLink,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText style={{ color: theme.tabIconDefault }}>
            Continue with cancellation
          </ThemedText>
          <Feather name="chevron-right" size={16} color={theme.tabIconDefault} />
        </Pressable>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.avatarContainer}>
        <LinearGradient colors={gradientColors} style={styles.avatarSmall}>
          <Feather name={iconName as any} size={24} color="#FFFFFF" />
        </LinearGradient>
      </View>

      <ThemedText type="h2" style={styles.title}>
        {startData?.feedbackPrompt}
      </ThemedText>

      <View style={styles.reasonsContainer}>
        {startData?.cancellationReasons.map((reason) => {
          const isSelected = selectedReason === reason.value;
          return (
            <Pressable
              key={reason.value}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedReason(reason.value);
              }}
              style={({ pressed }) => [
                styles.reasonOption,
                {
                  backgroundColor: isSelected ? theme.link : theme.backgroundSecondary,
                  borderColor: isSelected ? theme.link : theme.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[
                styles.radioCircle,
                {
                  borderColor: isSelected ? '#FFFFFF' : theme.border,
                  backgroundColor: isSelected ? '#FFFFFF' : 'transparent',
                },
              ]}>
                {isSelected ? (
                  <View style={[styles.radioInner, { backgroundColor: theme.link }]} />
                ) : null}
              </View>
              <ThemedText
                type="body"
                style={{ color: isSelected ? '#FFFFFF' : theme.text, flex: 1 }}
              >
                {reason.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.feedbackSection}>
        <ThemedText type="small" style={{ marginBottom: Spacing.sm, color: theme.tabIconDefault }}>
          Additional feedback (optional)
        </ThemedText>
        <TextInput
          style={[
            styles.feedbackInput,
            {
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              borderColor: theme.border,
            },
          ]}
          placeholder="Tell us more..."
          placeholderTextColor={theme.tabIconDefault}
          value={feedback}
          onChangeText={setFeedback}
          multiline
          textAlignVertical="top"
        />
      </View>

      <View style={styles.returnToggle}>
        <ThemedText type="body" style={{ flex: 1 }}>
          Would you consider returning in the future?
        </ThemedText>
        <Switch
          value={wouldReturn}
          onValueChange={setWouldReturn}
          trackColor={{ false: theme.border, true: theme.link }}
          thumbColor="#FFFFFF"
        />
      </View>

      <View style={styles.actionButtons}>
        <Button
          label={isSubmitting ? "Processing..." : "Cancel subscription"}
          onPress={handleSubmitFeedback}
          disabled={isSubmitting}
          style={[styles.cancelButton, { backgroundColor: '#DC2626' }]}
        />
        <Pressable
          onPress={handleKeepSubscription}
          style={({ pressed }) => [
            styles.continueLink,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ThemedText style={{ color: theme.link }}>
            Never mind, keep my subscription
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.avatarContainer}>
        <LinearGradient colors={gradientColors} style={styles.avatar}>
          <Feather name={iconName as any} size={40} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h3" style={styles.stylistName}>
          {farewellData?.stylistName}
        </ThemedText>
      </View>

      <Card style={styles.messageCard}>
        <ThemedText type="body" style={styles.messageText}>
          {farewellData?.farewellMessage}
        </ThemedText>
      </Card>

      {farewellData?.reactivationOffer?.options && farewellData.reactivationOffer.options.length > 0 ? (
        <View style={styles.reactivationSection}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.md, textAlign: 'center' }}>
            Still need style advice sometimes?
          </ThemedText>
          {farewellData.reactivationOffer.options.map((option, index) => (
            <Pressable
              key={index}
              onPress={() => handleReactivation(option)}
              style={({ pressed }) => [
                styles.reactivationOption,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.link,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View>
                <ThemedText type="body" style={{ fontWeight: '600' }}>
                  {option.label}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
                  One-time purchase
                </ThemedText>
              </View>
              <ThemedText type="h3" style={{ color: theme.link }}>
                {option.price}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Button
        label="Done"
        onPress={handleDone}
        style={styles.doneButton}
      />
    </View>
  );

  return (
    <ScreenScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Cancel Subscription</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              {
                backgroundColor: s <= step ? theme.link : theme.border,
              },
            ]}
          />
        ))}
      </View>

      {step === 1 ? renderStep1() : null}
      {step === 2 ? renderStep2() : null}
      {step === 3 ? renderStep3() : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepContent: {
    paddingHorizontal: Spacing.lg,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylistName: {
    textAlign: 'center',
  },
  messageCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  messageText: {
    textAlign: 'center',
    lineHeight: 24,
  },
  actionButtons: {
    gap: Spacing.md,
    alignItems: 'center',
  },
  keepButton: {
    width: '100%',
  },
  cancelButton: {
    width: '100%',
  },
  doneButton: {
    width: '100%',
    marginTop: Spacing.xl,
  },
  continueLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  reasonsContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  feedbackSection: {
    marginBottom: Spacing.xl,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: 100,
  },
  returnToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  reactivationSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  reactivationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.md,
  },
});
