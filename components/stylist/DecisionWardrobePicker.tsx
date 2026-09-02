import React, { useMemo } from 'react';
import { StyleSheet, View, Pressable, Image, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius, LuxuryColors } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import {
  groupWardrobeItemsForDecision,
  MAX_DECISION_WARDROBE_ITEMS,
} from '@/utils/decisionWardrobeGroups';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WARDROBE_THUMB = (SCREEN_WIDTH - Spacing.xl * 2 - Spacing.sm * 2) / 3;

export interface DecisionWardrobePickerItem {
  id: string | number;
  category?: string | null;
  name?: string;
  subcategory?: string;
  enhancedImageUri?: string | null;
  imageUri?: string | null;
}

interface DecisionWardrobePickerProps {
  items: DecisionWardrobePickerItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  maxItems?: number;
  disabled?: boolean;
  /** When false, omit the standalone `{count}/{max} selected` caption. Default true (Event). */
  showSelectedCount?: boolean;
}

export function DecisionWardrobePicker({
  items,
  selectedIds,
  onToggle,
  maxItems = MAX_DECISION_WARDROBE_ITEMS,
  disabled = false,
  showSelectedCount = true,
}: DecisionWardrobePickerProps) {
  const theme = useTheme();
  const { t } = useTranslations();

  const sections = useMemo(() => groupWardrobeItemsForDecision(items), [items]);
  const atLimit = selectedIds.length >= maxItems;

  if (items.length === 0) {
    return (
      <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
        {t('stylistFlow.emptyWardrobeHint')}
      </ThemedText>
    );
  }

  if (sections.length === 0) {
    return (
      <ThemedText type="caption" style={{ color: theme.tabIconDefault }}>
        {t('stylistFlow.emptyWardrobeHint')}
      </ThemedText>
    );
  }

  return (
    <View style={styles.root}>
      {showSelectedCount ? (
        <ThemedText type="caption" style={{ color: theme.tabIconDefault, marginBottom: Spacing.xs }}>
          {(t('stylistFlow.wardrobeSelectedCount') || '{count}/{max} selected')
            .replace('{count}', String(selectedIds.length))
            .replace('{max}', String(maxItems))}
        </ThemedText>
      ) : null}

      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <ThemedText type="small" style={[styles.sectionHeader, { color: theme.text }]}>
            {t(section.labelKey)}
          </ThemedText>
          <View style={styles.grid}>
            {section.items.map((item) => {
              const id = String(item.id);
              const selected = selectedIds.includes(id);
              const uri = item.enhancedImageUri || item.imageUri;
              if (!uri) return null;
              const blocked = disabled || (!selected && atLimit);
              return (
                <Pressable
                  key={id}
                  disabled={blocked && !selected}
                  onPress={() => onToggle(id)}
                  style={[
                    styles.thumb,
                    selected && { borderColor: LuxuryColors.gold, borderWidth: 2 },
                    blocked && !selected && { opacity: 0.45 },
                  ]}
                >
                  <Image source={{ uri }} style={styles.thumbImage} />
                  {selected ? (
                    <View style={styles.check}>
                      <Feather name="check" size={12} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    fontSize: 11,
    opacity: 0.75,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  thumb: {
    width: WARDROBE_THUMB,
    height: WARDROBE_THUMB,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LuxuryColors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
