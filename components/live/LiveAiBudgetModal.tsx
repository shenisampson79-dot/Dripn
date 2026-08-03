/**
 * Live AI monthly-usage limit — charming pause, not a cold error.
 *
 * In-screen overlay (not RN Modal). When hidden it returns null so nothing
 * remains in the tree to intercept touches.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTranslations } from '@/contexts/TranslationContext';
import { isAiBudgetError } from '@/utils/aiBudgetError';
import { isTopTier, normalizeSubscriptionTier } from '@/utils/subscriptionTier';
import type { SubscriptionTier } from '@/contexts/AuthContext';

export { isAiBudgetError };

const COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  midnight: '#1A1A2E',
  ink: '#0F0F1A',
};

type Props = {
  visible: boolean;
  /** Backdrop — just close the sheet. */
  onClose: () => void;
  onUpgrade: () => void;
  /** Leave Live and open Quick Sanity Check. */
  onContinueSanityCheck: () => void;
  /**
   * Billing tier from the *server* budget response when available.
   * Prefer this over cached local Auth — testing downgrades must show correctly.
   */
  planTier?: string | null;
};

export function LiveAiBudgetModal({
  visible,
  onClose,
  onUpgrade,
  onContinueSanityCheck,
  planTier = null,
}: Props) {
  const { t } = useTranslations();
  const tier = normalizeSubscriptionTier(planTier);
  const topTier = isTopTier(tier);
  const canUpgrade = tier === 'free' || tier === 'personal_stylist';

  const title = t('live.budgetModal.title')
    || "That's your lot for this month";

  const body = topTier
    ? (t('live.budgetModal.bodyTopTier')
      || "Your live AI styling allowance is empty. Keep going with Quick sanity check or Stylist Chat — Live will be ready when your pot refills.")
    : tier === 'personal_stylist'
      ? (t('live.budgetModal.bodyPersonal')
        || "Your live AI styling allowance is spent. Upgrade for a bigger monthly pot, or continue with Quick sanity check or Stylist Chat.")
      : (t('live.budgetModal.body')
        || "Your live AI styling allowance is spent — even the best stylists need a coffee break. Upgrade for a bigger pot, or continue with Quick sanity check or Stylist Chat.");

  const upgradeLabel = t('live.budgetModal.upgrade') || 'See plans';
  const dismissLabel = t('live.budgetModal.dismiss') || 'Continue with Quick Sanity Check';

  // HARD unmount — never leave an invisible touch-blocking layer
  if (!visible) return null;

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpgrade();
  };

  const handleContinueSanity = () => {
    Haptics.selectionAsync();
    onContinueSanityCheck();
  };

  const handleBackdrop = () => {
    Haptics.selectionAsync();
    onClose();
  };

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleBackdrop}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.sheet} pointerEvents="auto">
        <LinearGradient colors={[COLORS.midnight, COLORS.ink]} style={styles.gradient}>
          <View style={styles.iconWrap}>
            <LinearGradient
              colors={[COLORS.gold, COLORS.deepGold]}
              style={styles.iconCircle}
            >
              <Feather name="coffee" size={22} color={COLORS.midnight} />
            </LinearGradient>
          </View>

          <ThemedText type="h3" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="body" style={styles.body}>
            {body}
          </ThemedText>

          {canUpgrade ? (
            <Pressable onPress={handleUpgrade} style={styles.upgradeBtn}>
              <LinearGradient
                colors={[COLORS.gold, COLORS.deepGold]}
                style={styles.upgradeGradient}
              >
                <ThemedText type="body" style={styles.upgradeText}>
                  {upgradeLabel}
                </ThemedText>
              </LinearGradient>
            </Pressable>
          ) : null}

          <Pressable onPress={handleContinueSanity} style={styles.dismissBtn} hitSlop={8}>
            <ThemedText type="body" style={styles.dismissText}>
              {dismissLabel}
            </ThemedText>
          </Pressable>
        </LinearGradient>
      </View>
    </View>
  );
}

/** Extract plan tier from a thrown AI budget API error (server usage snapshot). */
export function planTierFromBudgetError(err: unknown): SubscriptionTier | null {
  const usage = (err as { usage?: { tier?: string } } | null)?.usage;
  if (usage?.tier) return normalizeSubscriptionTier(usage.tier);
  return null;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  gradient: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl + 24,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontWeight: '700',
  },
  body: {
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  upgradeBtn: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  upgradeText: {
    color: COLORS.midnight,
    fontWeight: '700',
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
  },
});
