import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { WardrobeItemImage } from '@/components/WardrobeItemImage';
import { BorderRadius, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';
import {
  buildWardrobeImageProxyUrl,
  enrichWardrobeItemForDisplay,
  isProxyWardrobeImageUri,
  normalizeRemoteApiUrl,
  wardrobeTileBackground,
} from '@/utils/wardrobeImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
const STACK_OVERLAP = 42;

export type OutfitPieceVisual = {
  role?: string;
  name?: string;
  wardrobeItemId?: number | string;
  imageUrl?: string | null;
  stylingNote?: string;
  category?: string | null;
};

type LayerSlot = 'outerwear' | 'top' | 'bottom' | 'shoes' | 'dress' | 'accessory';

type ResolvedLayer = {
  key: string;
  slot: LayerSlot;
  piece: OutfitPieceVisual;
  item: WardrobeItem;
};

const LAYER_HEIGHT: Record<LayerSlot, number> = {
  outerwear: 152,
  top: 132,
  bottom: 172,
  shoes: 92,
  dress: 290,
  accessory: 108,
};

const LAYER_WIDTH: Record<LayerSlot, number> = {
  outerwear: 0.92,
  top: 0.8,
  bottom: 0.74,
  shoes: 0.64,
  dress: 0.78,
  accessory: 0.36,
};

const STACK_ORDER: LayerSlot[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes'];

function inferSlotFromText(text: string): LayerSlot | null {
  const t = text.toLowerCase();
  if (/\b(dress|jumpsuit|romper|playsuit)\b/.test(t)) return 'dress';
  if (/\b(blazer|jacket|coat|outerwear|cardigan|parka|trench|overcoat|gilet|vest)\b/.test(t)) return 'outerwear';
  if (/\b(trouser|pant|jean|short|skirt|cargo|chino|bottom|legging)\b/.test(t)) return 'bottom';
  if (/\b(shoe|trainer|sneaker|boot|loafer|heel|sandal|footwear|mule|flat)\b/.test(t)) return 'shoes';
  if (/\b(bag|tote|purse|belt|scarf|hat|accessory|necklace|earring|watch)\b/.test(t)) return 'accessory';
  if (/\b(shirt|blouse|top|tee|t-shirt|sweater|knit|polo|tank|camisole)\b/.test(t)) return 'top';
  return null;
}

function getPieceSlot(piece: OutfitPieceVisual, item?: WardrobeItem | null): LayerSlot {
  const role = String(piece.role || '').toLowerCase();
  const category = String(piece.category || item?.category || '').toLowerCase();
  const name = String(piece.name || item?.name || '').toLowerCase();

  if (['dress', 'jumpsuit'].includes(role) || category === 'dresses') return 'dress';
  if (['outerwear', 'blazer', 'jacket', 'coat'].includes(role) || category === 'outerwear') return 'outerwear';
  if (['bottom', 'trousers', 'pants', 'jeans', 'skirt'].includes(role) || ['bottoms', 'activewear_bottoms'].includes(category)) {
    return 'bottom';
  }
  if (['shoes', 'footwear', 'trainers', 'boots', 'sneakers'].includes(role) || category === 'shoes') return 'shoes';
  if (['accessory', 'accessories', 'bag'].includes(role) || ['bags', 'accessories'].includes(category)) return 'accessory';
  if (['top', 'shirt', 'blouse', 'sweater'].includes(role) || ['tops', 'activewear_tops', 'formal'].includes(category)) {
    return 'top';
  }

  return inferSlotFromText(`${role} ${name}`) || 'top';
}

function findWardrobeItemForPiece(
  piece: OutfitPieceVisual,
  wardrobeItems: WardrobeItem[],
): WardrobeItem | null {
  if (piece.wardrobeItemId != null) {
    const match = wardrobeItems.find((item) => String(item.id) === String(piece.wardrobeItemId));
    if (match) return match;
  }
  if (!piece.name) return null;
  const norm = piece.name.toLowerCase().trim();
  return (
    wardrobeItems.find((item) => item.name?.toLowerCase().trim() === norm)
    || wardrobeItems.find((item) => norm.includes(item.name?.toLowerCase().trim() || ''))
    || wardrobeItems.find((item) => item.name?.toLowerCase().includes(norm.slice(0, 24)))
    || null
  );
}

function pieceToWardrobeItem(piece: OutfitPieceVisual, wardrobeItem?: WardrobeItem | null): WardrobeItem | null {
  const serverImageUrl = normalizeRemoteApiUrl(piece.imageUrl) || piece.imageUrl || undefined;
  const serverCdn =
    serverImageUrl && !isProxyWardrobeImageUri(serverImageUrl) ? serverImageUrl : undefined;
  const proxyFromId =
    piece.wardrobeItemId != null ? buildWardrobeImageProxyUrl(piece.wardrobeItemId) : undefined;
  const fallbackUri = serverCdn || serverImageUrl || proxyFromId;

  if (wardrobeItem) {
    return enrichWardrobeItemForDisplay(wardrobeItem) as WardrobeItem;
  }

  if (piece.wardrobeItemId != null && (fallbackUri || piece.name)) {
    return {
      id: String(piece.wardrobeItemId),
      userId: '',
      imageUri: fallbackUri || '',
      enhancedImageUri: fallbackUri || undefined,
      imageProcessed: Boolean(fallbackUri),
      category: 'tops',
      color: 'multicolor',
      name: piece.name || 'Item',
      seasons: ['all-season'],
      occasions: ['everyday'],
      timesWorn: 0,
      isFavorite: false,
      createdAt: '',
      updatedAt: '',
    };
  }

  if (!piece.imageUrl || piece.wardrobeItemId == null) return null;
  const imageUrl = normalizeRemoteApiUrl(piece.imageUrl) || piece.imageUrl;
  return {
    id: String(piece.wardrobeItemId),
    userId: '',
    imageUri: imageUrl,
    enhancedImageUri: imageUrl,
    imageProcessed: true,
    category: 'tops',
    color: 'multicolor',
    name: piece.name || 'Item',
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
  };
}

function buildLayers(
  pieces: OutfitPieceVisual[],
  wardrobeItems: WardrobeItem[],
): { stack: ResolvedLayer[]; accessories: ResolvedLayer[] } {
  const bySlot: Partial<Record<LayerSlot, ResolvedLayer>> = {};
  const accessories: ResolvedLayer[] = [];

  pieces.forEach((piece, index) => {
    const wardrobeItem = findWardrobeItemForPiece(piece, wardrobeItems);
    const displayItem = pieceToWardrobeItem(piece, wardrobeItem);
    if (!displayItem) return;

    const slot = getPieceSlot(piece, wardrobeItem);
    const layer: ResolvedLayer = {
      key: `${slot}-${piece.wardrobeItemId || piece.name || index}`,
      slot,
      piece,
      item: displayItem,
    };

    if (slot === 'accessory') {
      accessories.push(layer);
      return;
    }
    if (!bySlot[slot]) {
      bySlot[slot] = layer;
    }
  });

  const hasDress = Boolean(bySlot.dress);
  const stack: ResolvedLayer[] = [];

  STACK_ORDER.forEach((slot) => {
    if (hasDress && (slot === 'top' || slot === 'bottom')) return;
    const layer = bySlot[slot];
    if (layer) stack.push(layer);
  });

  return { stack, accessories };
}

type Props = {
  pieces: OutfitPieceVisual[];
  wardrobeItems?: WardrobeItem[];
  label?: string;
  compact?: boolean;
};

export function OutfitPiecesVisual({ pieces, wardrobeItems = [], label = 'Your outfit', compact = false }: Props) {
  const { isDark } = useTheme();
  const scale = compact ? 0.72 : 1;

  const { stack, accessories } = useMemo(
    () => buildLayers(pieces, wardrobeItems),
    [pieces, wardrobeItems],
  );

  if (stack.length === 0 && accessories.length === 0) return null;

  const layerHeight = (slot: LayerSlot) => Math.round(LAYER_HEIGHT[slot] * scale);
  const layerWidth = (slot: LayerSlot) => LAYER_WIDTH[slot] * (compact ? 0.94 : 1);
  const stackOverlap = compact ? 30 : STACK_OVERLAP;

  const canvasHeight =
    stack.reduce((sum, layer, index) => {
      const overlap = index === 0 ? 0 : stackOverlap;
      return sum + layerHeight(layer.slot) - overlap;
    }, (compact ? Spacing.sm : Spacing.md) * 2)
    + (accessories.length > 0 ? (compact ? 8 : 12) : 0);

  const canvasBg = wardrobeTileBackground(isDark);
  const canvasBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {label ? (
        <ThemedText
          type="small"
          lightColor="#5A4D3A"
          darkColor="rgba(255,255,255,0.75)"
          style={[styles.label, compact && styles.labelCompact]}
        >
          {label}
        </ThemedText>
      ) : null}
      <View style={[styles.canvas, compact && styles.canvasCompact, { height: canvasHeight, backgroundColor: canvasBg, borderColor: canvasBorder }]}>
        <View style={styles.stackColumn}>
          {stack.map((layer, index) => {
            const layerBg = wardrobeTileBackground(isDark);
            return (
              <View
                key={layer.key}
                style={[
                  styles.layer,
                  {
                    width: CANVAS_WIDTH * layerWidth(layer.slot),
                    height: layerHeight(layer.slot),
                    marginTop: index === 0 ? 0 : -stackOverlap,
                    zIndex: index + 1,
                    backgroundColor: layerBg,
                    borderRadius: BorderRadius.md,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  },
                ]}
              >
                <WardrobeItemImage
                  item={layer.item}
                  style={styles.layerImage}
                  processed={!!(layer.item.imageProcessed || layer.item.aiAnalyzed)}
                  contentFit="contain"
                  preferCover
                  showLoading
                />
              </View>
            );
          })}
        </View>

        {accessories.map((layer, index) => {
          const layerBg = wardrobeTileBackground(isDark);
          return (
            <View
              key={layer.key}
              style={[
                styles.accessoryFloat,
                {
                  width: CANVAS_WIDTH * layerWidth('accessory'),
                  height: layerHeight('accessory'),
                  top: (compact ? 64 : 88) + index * (compact ? 22 : 28),
                  right: Spacing.sm,
                  zIndex: stack.length + 10 + index,
                  backgroundColor: layerBg,
                  borderRadius: BorderRadius.md,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
              ]}
            >
              <WardrobeItemImage
                item={layer.item}
                style={styles.layerImage}
                processed={!!(layer.item.imageProcessed || layer.item.aiAnalyzed)}
                contentFit="contain"
                preferCover
                showLoading
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  containerCompact: {
    marginBottom: Spacing.md,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  labelCompact: {
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  canvas: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  canvasCompact: {
    borderRadius: BorderRadius.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  stackColumn: {
    alignItems: 'center',
    width: '100%',
  },
  layer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerImage: {
    width: '100%',
    height: '100%',
  },
  accessoryFloat: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
