import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { OccasionPickerList } from '@/components/outfit/OccasionPickerList';
import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';

type Props = {
  wardrobeCount: number;
  generatingDays: number;
  onDaysChange: (days: number) => void;
  focusOccasionId: OutfitOccasionId | null;
  onFocusOccasionChange: (id: OutfitOccasionId | null) => void;
  isGenerating: boolean;
  progress: { current: number; total: number };
  onGenerate: () => void;
};

export function WeeklyOutfitPlannerPanel({
  wardrobeCount,
  generatingDays,
  onDaysChange,
  focusOccasionId,
  onFocusOccasionChange,
  isGenerating,
  progress,
  onGenerate,
}: Props) {
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const secondaryText = isDark ? '#B0B0B0' : '#666666';
  const tr = (key: string, vars?: Record<string, string | number>) => {
    let s = t(key) || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        s = s.replace(`{${k}}`, String(v));
      });
    }
    return s;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <LinearGradient
          colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
          style={styles.icon}
        >
          <Feather name="cpu" size={32} color="#FFFFFF" />
        </LinearGradient>
        <ThemedText type="h3" style={styles.headerTitle}>
          {t('weeklyPlanner.title') || 'Weekly Outfit Planner'}
        </ThemedText>
        <ThemedText type="body" style={[styles.headerDesc, { color: secondaryText }]}>
          {t('weeklyPlanner.subtitle') || 'Plan looks for the week ahead'}
        </ThemedText>
        <ThemedText type="caption" style={{ color: secondaryText, marginTop: Spacing.xs }}>
          {t('weeklyPlanner.today') || 'Today'}
        </ThemedText>
      </View>

      <View style={styles.daysRow}>
        {[3, 5, 7].map((days) => (
          <Pressable
            key={days}
            onPress={() => onDaysChange(days)}
            style={[
              styles.dayChip,
              generatingDays === days
                ? { backgroundColor: theme.link }
                : { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 },
            ]}
          >
            <ThemedText
              type="body"
              style={{ color: generatingDays === days ? '#FFFFFF' : theme.text, fontWeight: '600' }}
            >
              {tr('weeklyPlanner.days', { n: days })}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <OccasionPickerList
        title="Focus occasion (optional)"
        selectionMode="select"
        selectedOccasionId={focusOccasionId}
        showWeatherLink={false}
        disabled={isGenerating}
        onSelect={(id) => onFocusOccasionChange(focusOccasionId === id ? null : id)}
      />

      <Card elevation={1} style={styles.infoCard}>
        <Feather name="info" size={16} color={theme.link} />
        <ThemedText type="caption" style={[styles.infoText, { color: secondaryText }]}>
          {wardrobeCount === 0
            ? (t('weeklyPlanner.empty') || 'No plan yet — generate outfits for the week.')
            : focusOccasionId
              ? `All ${generatingDays} days will use the same occasion focus. Tap again to clear and use a mixed week.`
              : 'Without a focus, AI rotates work, casual, and date-night styles across the week.'}
        </ThemedText>
      </Card>

      <Pressable
        onPress={onGenerate}
        disabled={isGenerating}
        style={[styles.generateButton, { opacity: isGenerating ? 0.7 : 1 }]}
      >
        <LinearGradient
          colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.generateGradient}
        >
          {isGenerating ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <ThemedText type="body" style={styles.generateText}>
                {progress.total > 0
                  ? `Creating outfit ${Math.min(progress.current + 1, progress.total)} of ${progress.total}...`
                  : 'Creating outfits...'}
              </ThemedText>
            </>
          ) : (
            <>
              <Feather name="zap" size={20} color="#FFFFFF" />
              <ThemedText type="body" style={styles.generateText}>
                {t('weeklyPlanner.generate') || 'Generate week'}
              </ThemedText>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  headerDesc: {
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  sectionLabel: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  daysRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  dayChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  infoText: {
    flex: 1,
    lineHeight: 18,
  },
  generateButton: {
    marginTop: Spacing.sm,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  generateText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
