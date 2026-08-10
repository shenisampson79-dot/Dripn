/**
 * Soft paywall state after the user dismisses an AI allowance alert.
 * Keeps a visible primary CTA + optional recovery path so flows never dead-end.
 */

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import {
  getAiAllowancePaywallCopy,
  type AiAllowanceCta,
} from '@/utils/aiBudgetError';

type Props = {
  tier?: string | null;
  /** Optional override body — defaults to paywall.message */
  message?: string;
  onPrimary: (action: AiAllowanceCta) => void;
  /** Recovery path (Start over, leave, etc.) */
  onSecondary?: () => void;
  secondaryLabel?: string;
};

export function AiAllowanceBlockedBanner({
  tier,
  message,
  onPrimary,
  onSecondary,
  secondaryLabel = 'Start over',
}: Props) {
  const { theme, isDark } = useTheme();
  const paywall = useMemo(() => getAiAllowancePaywallCopy(tier), [tier]);

  return (
    <View
      style={[
        styles.banner,
        {
          borderColor: LuxuryColors.gold,
          backgroundColor: isDark ? 'rgba(201,168,124,0.12)' : 'rgba(201,168,124,0.15)',
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Feather name="alert-circle" size={18} color={LuxuryColors.deepGold} />
        <ThemedText type="body" style={styles.title}>
          {paywall.title}
        </ThemedText>
      </View>
      <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
        {message || paywall.message}
      </ThemedText>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPrimary(paywall.primaryAction);
        }}
        style={[styles.primaryBtn, { backgroundColor: LuxuryColors.gold }]}
      >
        <ThemedText type="body" style={styles.primaryLabel}>
          {paywall.primaryLabel}
        </ThemedText>
      </Pressable>
      {onSecondary ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onSecondary();
          }}
          style={[styles.secondaryBtn, { borderColor: theme.border }]}
        >
          <ThemedText type="body" style={{ color: theme.text, fontWeight: '600' }}>
            {secondaryLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  primaryLabel: {
    color: LuxuryColors.midnight,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
