/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Feather } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTranslations } from "@/contexts/TranslationContext";

interface NamePronunciationPromptProps {
  memberName: string;
  stylistName: string;
  onConfirmCorrect: () => void;
  onConfirmIncorrect: () => void;
  onDismiss?: () => void;
}

export function NamePronunciationPrompt({
  memberName,
  stylistName,
  onConfirmCorrect,
  onConfirmIncorrect,
  onDismiss,
}: NamePronunciationPromptProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.header}>
        <ThemedText type="h4" style={styles.title}>
          {t('onboarding.namePronunciationTitle') || 'Name Pronunciation Check'}
        </ThemedText>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Feather name="x" size={20} color={theme.tabIconDefault} />
          </Pressable>
        )}
      </View>
      
      <ThemedText type="body" style={[styles.question, { color: theme.tabIconDefault }]}>
        {t('onboarding.namePronunciationQuestion')?.replace('{stylist}', stylistName).replace('{name}', memberName)
          || `Did ${stylistName} pronounce "${memberName}" correctly?`}
      </ThemedText>
      
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.yesButton,
            { 
              backgroundColor: theme.success,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={onConfirmCorrect}
        >
          <Feather name="check" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.buttonText}>
            {t('onboarding.namePronunciationYes') || 'Yes, perfect!'}
          </ThemedText>
        </Pressable>
        
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.noButton,
            { 
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={onConfirmIncorrect}
        >
          <Feather name="x" size={18} color={theme.text} />
          <ThemedText type="body" style={[styles.buttonText, { color: theme.text }]}>
            {t('onboarding.namePronunciationNo') || 'Not quite'}
          </ThemedText>
        </Pressable>
      </View>
      
      <ThemedText type="caption" style={[styles.hint, { color: theme.tabIconDefault }]}>
        {t('onboarding.namePronunciationHint') || `If incorrect, we'll use friendly terms like "bella" or "amigo" instead`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontWeight: '600',
  },
  question: {
    marginBottom: Spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  yesButton: {},
  noButton: {
    borderWidth: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  hint: {
    marginTop: Spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
