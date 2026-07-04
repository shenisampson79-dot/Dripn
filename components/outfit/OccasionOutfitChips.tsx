import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { OUTFIT_OCCASION_CHIPS, type OutfitOccasionId } from '@/constants/outfitOccasions';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  generatingOccasionId?: string | null;
  disabled?: boolean;
  onOccasionPress: (occasionId: OutfitOccasionId) => void;
  onWeatherPress?: () => void;
};

export function OccasionOutfitChips({
  generatingOccasionId,
  disabled,
  onOccasionPress,
  onWeatherPress,
}: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.label, { color: theme.tabIconDefault }]}>
        Outfit from your wardrobe
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {onWeatherPress ? (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onWeatherPress();
            }}
            disabled={disabled}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.75 : disabled ? 0.5 : 1 },
            ]}
          >
            <Feather name="cloud" size={14} color={theme.link} />
            <ThemedText style={styles.chipText}>Weather look</ThemedText>
          </Pressable>
        ) : null}

        {OUTFIT_OCCASION_CHIPS.map((option) => {
          const isGenerating = generatingOccasionId === option.id;
          return (
            <Pressable
              key={option.id}
              disabled={disabled || Boolean(generatingOccasionId)}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onOccasionPress(option.id);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: theme.backgroundSecondary,
                  opacity: pressed || (disabled && !isGenerating) ? 0.55 : 1,
                },
              ]}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color={theme.link} />
              ) : (
                <Feather name={option.icon} size={14} color={theme.link} />
              )}
              <ThemedText style={styles.chipText}>{option.label}</ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
