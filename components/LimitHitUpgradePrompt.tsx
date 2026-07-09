import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTranslations } from "@/contexts/TranslationContext";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  midnight: '#1A1A2E',
};

interface LimitHitUpgradePromptProps {
  title?: string;
  message?: string;
  ctaLabel?: string;
  onUpgrade: () => void;
  variant?: 'banner' | 'card';
}

export function LimitHitUpgradePrompt({
  title,
  message,
  ctaLabel,
  onUpgrade,
  variant = 'banner',
}: LimitHitUpgradePromptProps) {
  const { t } = useTranslations();
  const resolvedTitle = title ?? t('upgrade.limitHit.title');
  const resolvedMessage = message ?? t('upgrade.limitHit.message');
  const resolvedCta = ctaLabel ?? t('upgrade.limitHit.cta');
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpgrade();
  };

  if (variant === 'card') {
    return (
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={[LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          <View style={styles.cardContent}>
            <View style={styles.iconCircle}>
              <Feather name="zap" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.textBlock}>
              <ThemedText type="body" style={styles.cardTitle}>{resolvedTitle}</ThemedText>
              <ThemedText type="small" style={styles.cardMessage}>{resolvedMessage}</ThemedText>
            </View>
          </View>
          <Pressable onPress={handlePress} style={styles.cardButton}>
            <ThemedText type="body" style={styles.cardButtonText}>{resolvedCta}</ThemedText>
            <Feather name="arrow-right" size={16} color={LUXURY_COLORS.violet} />
          </Pressable>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <LinearGradient
        colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.bannerGradient}
      >
        <Feather name="alert-circle" size={16} color={LUXURY_COLORS.midnight} />
        <View style={styles.bannerTextBlock}>
          <ThemedText type="small" style={styles.bannerTitle}>{resolvedTitle}</ThemedText>
          <ThemedText type="caption" style={styles.bannerMessage}>{resolvedMessage}</ThemedText>
        </View>
        <Pressable onPress={handlePress} style={styles.bannerCta}>
          <ThemedText type="caption" style={styles.bannerCtaText}>{resolvedCta}</ThemedText>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  bannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  bannerTextBlock: {
    flex: 1,
  },
  bannerTitle: {
    color: LUXURY_COLORS.midnight,
    fontWeight: '700',
  },
  bannerMessage: {
    color: 'rgba(26,26,46,0.75)',
  },
  bannerCta: {
    backgroundColor: LUXURY_COLORS.midnight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  bannerCtaText: {
    color: LUXURY_COLORS.gold,
    fontWeight: '700',
  },
  cardWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  cardGradient: {
    padding: Spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 2,
  },
  cardMessage: {
    color: 'rgba(255,255,255,0.85)',
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  cardButtonText: {
    color: LUXURY_COLORS.violet,
    fontWeight: '700',
  },
});
