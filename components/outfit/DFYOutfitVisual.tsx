import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { OutfitPiecesVisual } from '@/components/OutfitPiecesVisual';
import { ThemedText } from '@/components/ThemedText';
import { Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { DFYOutfit } from '@/services/DFYService';
import { dfyOutfitItemsToVisualPieces } from '@/utils/dfyOutfitImages';
import { computeOutfitVisualScaleForModal } from '@/utils/outfitVisualScale';
import { WARDROBE_CUTOUT_TILE_BG } from '@/utils/wardrobeImage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = {
  outfit: DFYOutfit;
  wardrobeItems: WardrobeItem[];
  canvasWidth?: number;
  minHeight?: number;
  emptyMessage?: string;
};

export function DFYOutfitVisual({
  outfit,
  wardrobeItems,
  canvasWidth = SCREEN_WIDTH - Spacing.xl * 2,
  minHeight = 300,
  emptyMessage = 'Wardrobe photos loading…',
}: Props) {
  const pieces = useMemo(
    () => dfyOutfitItemsToVisualPieces(outfit.items || [], wardrobeItems),
    [outfit.items, wardrobeItems],
  );

  const visualScale = useMemo(
    () => computeOutfitVisualScaleForModal(Math.max(pieces.length, outfit.items?.length || 1), SCREEN_HEIGHT),
    [pieces.length, outfit.items?.length],
  );

  if (pieces.length === 0) {
    return (
      <View style={[styles.container, styles.empty, { minHeight }]}>
        <Feather name="image" size={48} color="rgba(0,0,0,0.2)" />
        <ThemedText style={styles.emptyText}>
          {outfit.items?.length ? emptyMessage : 'Outfit photo will appear here'}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OutfitPiecesVisual
        pieces={pieces}
        wardrobeItems={wardrobeItems}
        label=""
        large
        canvasWidth={canvasWidth}
        visualScale={visualScale}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: WARDROBE_CUTOUT_TILE_BG,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  emptyText: {
    color: 'rgba(0,0,0,0.45)',
    textAlign: 'center',
  },
});
