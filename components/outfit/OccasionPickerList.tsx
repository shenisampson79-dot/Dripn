import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import {
  OUTFIT_OCCASION_OPTIONS,
  type OutfitOccasionId,
  type OutfitOccasionOption,
} from '@/constants/outfitOccasions';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  title?: string;
  options?: OutfitOccasionOption[];
  generatingOccasionId?: string | null;
  selectedOccasionId?: OutfitOccasionId | null;
  selectionMode?: 'generate' | 'select';
  disabled?: boolean;
  showWeatherLink?: boolean;
  onSelect: (occasionId: OutfitOccasionId) => void;
  onWeatherPress?: () => void;
};

export function OccasionPickerList({
  title = 'Generate outfits for:',
  options = OUTFIT_OCCASION_OPTIONS,
  generatingOccasionId,
  selectedOccasionId,
  selectionMode = 'generate',
  disabled = false,
  showWeatherLink = true,
  onSelect,
  onWeatherPress,
}: Props) {
  const { theme, isDark } = useTheme();

  const renderRow = (option: OutfitOccasionOption) => {
    const isGenerating = generatingOccasionId === option.id;
    const isSelected = selectedOccasionId === option.id;

    return (
      <Pressable
        key={option.id}
        disabled={disabled || Boolean(generatingOccasionId)}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSelect(option.id);
        }}
        style={({ pressed }) => [
          styles.optionCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            opacity: pressed || (disabled && !isGenerating) ? 0.55 : 1,
            borderWidth: isSelected ? 2 : 0,
            borderColor: isSelected ? theme.link : 'transparent',
          },
        ]}
      >
        <LinearGradient
          colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
          style={styles.optionIcon}
        >
          <Feather name={option.icon} size={18} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.optionText}>
          <ThemedText type="body" style={{ fontWeight: '600' }}>{option.label}</ThemedText>
          <ThemedText type="small" style={{ color: theme.tabIconDefault }}>{option.description}</ThemedText>
        </View>
        {isGenerating ? (
          <ActivityIndicator size="small" color={LuxuryColors.violet} />
        ) : (
          <Feather
            name={selectionMode === 'select' && isSelected ? 'check-circle' : 'chevron-right'}
            size={20}
            color={isSelected ? theme.link : theme.tabIconDefault}
          />
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <ThemedText type="body" style={styles.title}>{title}</ThemedText>

      {showWeatherLink && onWeatherPress ? (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onWeatherPress();
          }}
          style={({ pressed }) => [
            styles.weatherCard,
            {
              backgroundColor: isDark ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)',
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={[LuxuryColors.teal, '#0E7490']}
            style={styles.optionIcon}
          >
            <Feather name="cloud" size={18} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.optionText}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>Today&apos;s look</ThemedText>
            <ThemedText type="small" style={{ color: theme.tabIconDefault }}>
              Dress for the forecast — open Weather Outfits
            </ThemedText>
          </View>
          <Feather name="external-link" size={18} color={theme.link} />
        </Pressable>
      ) : null}

      {options.map(renderRow)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  title: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'capitalize',
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
