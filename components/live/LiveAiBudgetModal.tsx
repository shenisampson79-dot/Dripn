/**
 * Live AI monthly-usage limit — charming pause, not a cold error.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTranslations } from '@/contexts/TranslationContext';
import { isAiBudgetError } from '@/utils/aiBudgetError';

export { isAiBudgetError };

const COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  midnight: '#1A1A2E',
  ink: '#0F0F1A',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  /** Top-tier users already maxed — softer upgrade framing. */
  isTopTier?: boolean;
};

export function LiveAiBudgetModal({
  visible,
  onClose,
  onUpgrade,
  isTopTier = false,
}: Props) {
  const { t } = useTranslations();

  const title = t('live.budgetModal.title')
    || "That's your lot for this month";
  const body = isTopTier
    ? (t('live.budgetModal.bodyTopTier')
      || "Even Stylist Unlimited has a monthly AI pot — and yours is empty. Give it until next month, or check your plan if something looks off.")
    : (t('live.budgetModal.body')
      || "Your AI styling allowance is spent — even the best stylists need a coffee break. Upgrade for a bigger monthly pot, or swing back when it resets. The mirror will wait.");
  const upgradeLabel = isTopTier
    ? (t('live.budgetModal.seePlans') || 'See plans')
    : (t('live.budgetModal.upgrade') || 'Upgrade');
  const dismissLabel = t('live.budgetModal.dismiss') || "Ok, I'm fine";

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpgrade();
  };

  const handleDismiss = () => {
    Haptics.selectionAsync();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
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

            <Pressable onPress={handleUpgrade} style={styles.upgradeBtn}>
              <LinearGradient
                colors={[COLORS.gold, COLORS.deepGold]}
                style={styles.upgradeGradient}
              >
                <ThemedText type="body" style={styles.upgradeText}>
                  {upgradeLabel}
                </ThemedText>
                <Feather name="arrow-right" size={16} color={COLORS.midnight} />
              </LinearGradient>
            </Pressable>

            <Pressable onPress={handleDismiss} style={styles.dismissBtn} hitSlop={8}>
              <ThemedText type="body" style={styles.dismissText}>
                {dismissLabel}
              </ThemedText>
            </Pressable>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
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
