/**
 * Compact like / not-this controls for outfit recommendations.
 * Soft taste only — never bypasses hard clash / dress-code rules.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';

type Props = {
  disabled?: boolean;
  liked?: boolean;
  skipped?: boolean;
  onLike?: () => void;
  onSkip?: () => void;
  /** Optional third action e.g. Show another */
  onAnother?: () => void;
  anotherLabel?: string;
  compact?: boolean;
};

export function OutfitTasteFeedback({
  disabled,
  liked,
  skipped,
  onLike,
  onSkip,
  onAnother,
  anotherLabel,
  compact,
}: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  const btn = (
    label: string,
    icon: React.ComponentProps<typeof Feather>['name'],
    active: boolean | undefined,
    onPress?: () => void,
    danger?: boolean,
  ) => (
    <Pressable
      disabled={disabled || !onPress}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.btn,
        compact && styles.btnCompact,
        {
          borderColor: active
            ? (danger ? '#C45C5C' : theme.link)
            : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'),
          backgroundColor: active
            ? (danger
              ? (isDark ? 'rgba(196,92,92,0.2)' : 'rgba(196,92,92,0.1)')
              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'))
            : 'transparent',
          opacity: pressed || disabled ? 0.65 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather
        name={icon}
        size={compact ? 14 : 16}
        color={active ? (danger ? '#C45C5C' : theme.link) : theme.text}
      />
      <ThemedText
        type="small"
        style={{
          color: active ? (danger ? '#C45C5C' : theme.link) : theme.text,
          fontWeight: '600',
          fontSize: compact ? 12 : 13,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {onLike
        ? btn(t('outfitFeedback.like') || 'Like', liked ? 'heart' : 'heart', liked, onLike)
        : null}
      {onSkip
        ? btn(
            t('outfitFeedback.dontLike') || "Don't like",
            'thumbs-down',
            skipped,
            onSkip,
            true,
          )
        : null}
      {onAnother
        ? btn(
            anotherLabel || t('outfitFeedback.showAnother') || 'Show another',
            'refresh-cw',
            false,
            onAnother,
          )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  rowCompact: {
    gap: Spacing.xs,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
});
