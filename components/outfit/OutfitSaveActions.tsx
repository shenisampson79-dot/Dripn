import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { SaveOutfitPromptModal, type SaveOutfitIntent } from '@/components/outfit/SaveOutfitPromptModal';
import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from "@/contexts/TranslationContext";

type Props = {
  wardrobeItemIds: string[];
  defaultTitle?: string;
  defaultDescription?: string;
  occasion?: string;
  onSaved?: () => void;
};

export function OutfitSaveActions({
  wardrobeItemIds,
  defaultTitle,
  defaultDescription,
  occasion = 'custom',
  onSaved,
}: Props) {
  const { t } = useTranslations();
  const { isDark } = useTheme();
  const [promptVisible, setPromptVisible] = useState(false);
  const [intent, setIntent] = useState<SaveOutfitIntent>('save');

  if (wardrobeItemIds.length === 0) return null;

  const openPrompt = (nextIntent: SaveOutfitIntent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIntent(nextIntent);
    setPromptVisible(true);
  };

  return (
    <>
      <View style={[styles.row, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
        <Pressable
          onPress={() => openPrompt('love')}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
        >
          <Feather name="heart" size={18} color={LuxuryColors.rose} />
          <ThemedText type="caption" style={styles.actionLabel}>Love</ThemedText>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }]} />

        <Pressable
          onPress={() => openPrompt('save')}
          style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.75 }]}
        >
          <Feather name="bookmark" size={18} color={LuxuryColors.gold} />
          <ThemedText type="caption" style={styles.actionLabel}>Save</ThemedText>
        </Pressable>
      </View>

      <SaveOutfitPromptModal
        visible={promptVisible}
        intent={intent}
        wardrobeItemIds={wardrobeItemIds}
        defaultTitle={defaultTitle}
        defaultDescription={defaultDescription}
        occasion={occasion}
        onClose={() => setPromptVisible(false)}
        onSaved={onSaved}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
  },
  actionLabel: {
    fontWeight: '600',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
