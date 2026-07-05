import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { wardrobeTileBackground } from '@/utils/wardrobeImage';

export type SavedOutfitTableRow = {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  badgeLabel: string;
  badgeColors: readonly [string, string];
  previewItems: Array<{
    id: string;
    name: string;
    imageUri?: string | null;
  }>;
};

type Props = {
  outfits: SavedOutfitTableRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const ROW_HEIGHT_ESTIMATE = 88;
const HEADER_HEIGHT = 36;
const MAX_VISIBLE_ROWS = 6;

export function SavedOutfitsTable({ outfits, selectedId, onSelect }: Props) {
  const { theme, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();

  if (outfits.length === 0) return null;

  const scrollMaxHeight = Math.min(
    windowHeight * 0.38,
    HEADER_HEIGHT + ROW_HEIGHT_ESTIMATE * MAX_VISIBLE_ROWS,
  );

  return (
    <View
      style={[
        styles.table,
        {
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
        },
      ]}
    >
      <View style={[styles.tableHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
        <ThemedText type="caption" style={[styles.headerCell, styles.titleCol, { color: theme.tabIconDefault }]}>
          Outfit ({outfits.length})
        </ThemedText>
        <ThemedText type="caption" style={[styles.headerCell, styles.previewCol, { color: theme.tabIconDefault }]}>
          Preview
        </ThemedText>
      </View>

      <ScrollView
        style={{ maxHeight: scrollMaxHeight }}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {outfits.map((outfit, index) => {
          const selected = outfit.id === selectedId;
          const thumbs = outfit.previewItems.length > 0
            ? outfit.previewItems.slice(0, 3)
            : [{ id: 'placeholder', name: 'Item', imageUri: null }];

          return (
            <Pressable
              key={outfit.id}
              onPress={() => onSelect(outfit.id)}
              style={({ pressed }) => [
                styles.row,
                index < outfits.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                },
                selected && {
                  backgroundColor: isDark ? 'rgba(201,168,124,0.12)' : 'rgba(201,168,124,0.14)',
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.titleCol}>
                <LinearGradient
                  colors={outfit.badgeColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.badge}
                >
                  <ThemedText type="caption" style={styles.badgeText} numberOfLines={1}>
                    {outfit.badgeLabel}
                  </ThemedText>
                </LinearGradient>
                <ThemedText type="body" style={styles.rowTitle} numberOfLines={1}>
                  {outfit.title}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.tabIconDefault }} numberOfLines={2}>
                  {outfit.description || `${outfit.itemCount} items`}
                </ThemedText>
              </View>

              <View style={styles.previewCol}>
                <View style={styles.thumbRow}>
                  {thumbs.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.thumb, { backgroundColor: wardrobeTileBackground(isDark) }]}
                    >
                      {item.imageUri ? (
                        <Image source={{ uri: item.imageUri }} style={styles.thumbImage} contentFit="contain" />
                      ) : (
                        <Feather name="image" size={14} color={theme.tabIconDefault} />
                      )}
                    </View>
                  ))}
                </View>
                <Feather
                  name="chevron-right"
                  size={18}
                  color={selected ? theme.link : theme.tabIconDefault}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {outfits.length > MAX_VISIBLE_ROWS ? (
        <ThemedText type="caption" style={[styles.scrollHint, { color: theme.tabIconDefault }]}>
          Scroll the list to browse all {outfits.length} outfits
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCell: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontSize: 10,
  },
  scrollContent: {
    flexGrow: 0,
  },
  scrollHint: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
    minHeight: ROW_HEIGHT_ESTIMATE,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  previewCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginBottom: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 9,
  },
  rowTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 4,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
});
