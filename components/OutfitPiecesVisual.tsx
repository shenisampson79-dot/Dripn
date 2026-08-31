import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View, type DimensionValue } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { WardrobeItemImage } from '@/components/WardrobeItemImage';
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary';
import { BorderRadius, Spacing } from '@/constants/theme';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';
import { sanitizeOutfitPieces } from '@/utils/safeRender';
import {
  getOutfitPieceSlot,
  resolveOutfitVisualSlots,
  type OutfitVisualSlot,
} from '@/utils/outfitVisualSlots';
import {
  buildWardrobeImageProxyUrl,
  enrichWardrobeItemForOutfitVisual,
  isProxyWardrobeImageUri,
  itemHasProcessedCutout,
  normalizeRemoteApiUrl,
  resolveWardrobeImageUri,
  wardrobeProcessedTileBackground,
  wardrobeTileBackground,
} from '@/utils/wardrobeImage';

export { resolveOutfitVisualSlots, getOutfitPieceSlot };
export type { OutfitVisualSlot };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;
/** Stack overlap — keep modest so semantic edges (hem / waist) stay visible. */
const STACK_OVERLAP = 14;

/** Preserve critical garment zones: tops keep hem, bottoms keep waistband, shoes stay whole. */
const SLOT_CONTENT_POSITION: Record<LayerSlot, string> = {
  outerwear: 'top',
  top: 'top',
  bottom: 'top',
  shoes: 'bottom',
  dress: 'center',
  accessory: 'center',
};

const SLOT_SAFE_PAD: Record<LayerSlot, { paddingTop: number; paddingBottom: number }> = {
  outerwear: { paddingTop: 4, paddingBottom: 18 },
  top: { paddingTop: 2, paddingBottom: 22 },
  bottom: { paddingTop: 20, paddingBottom: 10 },
  shoes: { paddingTop: 8, paddingBottom: 4 },
  dress: { paddingTop: 6, paddingBottom: 10 },
  accessory: { paddingTop: 4, paddingBottom: 4 },
};

/** Large card uses gap stacking — lighter pad so contain-fit garments sit closer. */
const SLOT_SAFE_PAD_LARGE: Record<LayerSlot, { paddingTop: number; paddingBottom: number }> = {
  outerwear: { paddingTop: 2, paddingBottom: 4 },
  top: { paddingTop: 2, paddingBottom: 4 },
  bottom: { paddingTop: 4, paddingBottom: 2 },
  shoes: { paddingTop: 2, paddingBottom: 2 },
  dress: { paddingTop: 4, paddingBottom: 4 },
  accessory: { paddingTop: 2, paddingBottom: 2 },
};

export type OutfitPieceVisual = {
  role?: string;
  name?: string;
  wardrobeItemId?: number | string;
  imageUrl?: string | null;
  stylingNote?: string;
  category?: string | null;
};

type LayerSlot = OutfitVisualSlot;

type ResolvedLayer = {
  key: string;
  slot: LayerSlot;
  piece: OutfitPieceVisual;
  item: WardrobeItem;
};

const LAYER_HEIGHT: Record<LayerSlot, number> = {
  outerwear: 188,
  top: 172,
  bottom: 210,
  shoes: 118,
  dress: 330,
  accessory: 118,
};

const LAYER_HEIGHT_LARGE: Record<LayerSlot, number> = {
  outerwear: 200,
  top: 168,
  bottom: 190,
  shoes: 120,
  dress: 300,
  accessory: 140,
};

const LAYER_WIDTH: Record<LayerSlot, number> = {
  outerwear: 0.92,
  top: 0.8,
  bottom: 0.74,
  shoes: 0.64,
  dress: 0.78,
  accessory: 0.36,
};

const LAYER_WIDTH_LARGE: Record<LayerSlot, number> = {
  outerwear: 1,
  top: 0.94,
  bottom: 0.88,
  shoes: 0.84,
  dress: 0.92,
  accessory: 0.4,
};

const STACK_OVERLAP_LARGE = 22;

/** Large visual cards (Event, Stylist Chat, ranked looks) — positive gap between garment bounds (~8px). */
const STACK_GAP_LARGE = 8;

/** Zoom processed cutouts in large stacks — matches GeneratedOutfitModal / outfit reel pattern. */
const LARGE_CUTOUT_DISPLAY_SCALE = 1.18;

const STACK_ORDER: LayerSlot[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes'];

function getPieceSlot(piece: OutfitPieceVisual, item?: WardrobeItem | null): LayerSlot {
  return getOutfitPieceSlot({
    role: piece.role,
    category: piece.category || item?.category,
    name: piece.name || item?.name,
  });
}

function findWardrobeItemForPiece(
  piece: OutfitPieceVisual,
  wardrobeItems: WardrobeItem[],
): WardrobeItem | null {
  if (!piece || typeof piece !== 'object') return null;
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
    const enriched = enrichWardrobeItemForOutfitVisual(wardrobeItem) as WardrobeItem;
    const enrichedUri = resolveWardrobeImageUri(enriched);
    if (enrichedUri) return enriched;
    // Wardrobe row exists but has no usable photo — keep ID and use piece/proxy URL
    if (fallbackUri) {
      return {
        ...enriched,
        imageUri: fallbackUri,
        enhancedImageUri: fallbackUri,
        imageProcessed: true,
      };
    }
    return enriched;
  }

  if (piece.wardrobeItemId != null && (fallbackUri || piece.name)) {
    return {
      id: String(piece.wardrobeItemId),
      userId: '',
      imageUri: fallbackUri || '',
      enhancedImageUri: fallbackUri || undefined,
      imageProcessed: Boolean(fallbackUri),
      category: (piece.category as WardrobeItem['category']) || 'tops',
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

  // Keep named pieces visible even without an image URL (placeholder tile).
  if (piece.name) {
    return {
      id: String(piece.wardrobeItemId || piece.name),
      userId: '',
      imageUri: fallbackUri || '',
      enhancedImageUri: fallbackUri || undefined,
      imageProcessed: Boolean(fallbackUri),
      category: (piece.category as WardrobeItem['category']) || 'tops',
      color: 'multicolor',
      name: piece.name,
      seasons: ['all-season'],
      occasions: ['everyday'],
      timesWorn: 0,
      isFavorite: false,
      createdAt: '',
      updatedAt: '',
    };
  }

  return null;
}

function buildLayers(
  pieces: OutfitPieceVisual[],
  wardrobeItems: WardrobeItem[],
): { stack: ResolvedLayer[]; accessories: ResolvedLayer[] } {
  const bySlot: Partial<Record<LayerSlot, ResolvedLayer>> = {};
  const accessories: ResolvedLayer[] = [];

  pieces.forEach((piece, index) => {
    if (!piece || typeof piece !== 'object') return;
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
  large?: boolean;
  canvasWidth?: number;
  /** Shrinks layer sizes proportionally (e.g. fit full outfit in a detail modal). */
  visualScale?: number;
  /** Pull stacked pieces closer together (higher overlap). */
  tight?: boolean;
};

export function OutfitPiecesVisual({
  pieces,
  wardrobeItems = [],
  label = 'Your outfit',
  compact = false,
  large = false,
  canvasWidth,
  visualScale,
  tight = false,
}: Props) {
  const { isDark } = useTheme();
  const sizeScale = compact ? 0.72 : (visualScale ?? 1);
  const effectiveCanvasWidth = canvasWidth ?? CANVAS_WIDTH;

  const safePieces = useMemo(
    () => sanitizeOutfitPieces(pieces, { log: true }),
    [pieces],
  );

  const { stack, accessories } = useMemo(
    () => buildLayers(safePieces, wardrobeItems),
    [safePieces, wardrobeItems],
  );

  if (stack.length === 0 && accessories.length === 0) {
    const fallbackBg = large ? wardrobeProcessedTileBackground() : wardrobeTileBackground(isDark);
    return (
      <View
        style={[
          styles.container,
          large && styles.containerLarge,
          { width: '100%', maxWidth: effectiveCanvasWidth, alignSelf: 'stretch' },
        ]}
      >
        <View style={[styles.canvas, styles.canvasSeamless, { width: '100%', minHeight: 120, backgroundColor: fallbackBg }]}>
          {safePieces.map((piece, index) => {
            if (!piece || typeof piece !== 'object') return null;
            const wardrobeItem = findWardrobeItemForPiece(piece, wardrobeItems);
            const displayItem = pieceToWardrobeItem(piece, wardrobeItem);
            if (!displayItem) return null;
            const thumb = Math.round(96 * sizeScale);
            return (
              <View
                key={`fallback-${piece.wardrobeItemId || index}`}
                style={{
                  width: thumb,
                  height: thumb,
                  marginVertical: Spacing.xs,
                  alignSelf: 'center',
                  backgroundColor: wardrobeTileBackground(isDark),
                }}
              >
                <WardrobeItemImage
                  item={displayItem}
                  style={styles.layerImage}
                  processed={itemHasProcessedCutout(displayItem)}
                  contentFit="contain"
                  preferCover={false}
                  tileBackgroundColor={wardrobeTileBackground(isDark)}
                  imageVariant="medium"
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  const layerHeight = (slot: LayerSlot) => {
    const base = large ? LAYER_HEIGHT_LARGE[slot] : LAYER_HEIGHT[slot];
    return Math.round(base * sizeScale);
  };
  const layerWidth = (slot: LayerSlot) => {
    const base = large ? LAYER_WIDTH_LARGE[slot] : LAYER_WIDTH[slot];
    return base * (compact ? 0.94 : 1);
  };
  const baseOverlap = compact ? 22 : large ? STACK_OVERLAP_LARGE : STACK_OVERLAP;
  const useStackGap = large && !tight && !compact;
  const stackSpacing = useStackGap
    ? Math.round(STACK_GAP_LARGE * sizeScale)
    : Math.round(baseOverlap * sizeScale * (tight ? 1.1 : 1));

  // Adaptive canvas: taller stacks get more vertical room (tall shirts / dresses).
  const adaptiveBoost = stack.some((l) => l.slot === 'dress') ? 1.04
    : stack.filter((l) => l.slot === 'top' || l.slot === 'outerwear').length >= 2 ? 1.02
      : 1;

  const canvasHeight =
    stack.reduce((sum, layer, index) => {
      const layerH = Math.round(layerHeight(layer.slot) * adaptiveBoost);
      if (index === 0) return sum + layerH;
      return sum + layerH + (useStackGap ? stackSpacing : -stackSpacing);
    }, (compact ? Spacing.sm : Spacing.md) * 2);

  const seamlessWhite = large;
  const canvasBg = seamlessWhite ? wardrobeProcessedTileBackground() : wardrobeTileBackground(isDark);

  const layerFrameStyle = (isProcessedLayer: boolean) => ({
    backgroundColor: isProcessedLayer ? wardrobeProcessedTileBackground() : wardrobeTileBackground(isDark),
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    overflow: 'visible' as const,
  });

  const renderLayerImage = (layer: ResolvedLayer, layerBg: string, isProcessedLayer: boolean) => (
    <RenderErrorBoundary fallbackMessage="Item preview unavailable">
      <WardrobeItemImage
        item={layer.item}
        style={styles.layerImage}
        processed={isProcessedLayer}
        contentFit="contain"
        contentPosition={SLOT_CONTENT_POSITION[layer.slot]}
        preferCover={false}
        showLoading
        displayScale={large && !tight && !compact ? LARGE_CUTOUT_DISPLAY_SCALE : 1}
        tileBackgroundColor={layerBg}
        imageVariant="medium"
      />
    </RenderErrorBoundary>
  );

  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        large && styles.containerLarge,
        { width: '100%', maxWidth: effectiveCanvasWidth, alignSelf: 'stretch' },
      ]}
    >
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
      <View
        style={[
          styles.canvas,
          compact && styles.canvasCompact,
          styles.canvasSeamless,
          {
            width: '100%',
            minHeight: Math.max(canvasHeight, 120),
            backgroundColor: canvasBg,
            borderWidth: 0,
            borderColor: 'transparent',
          },
        ]}
      >
        <View style={[styles.stackColumn, styles.stackColumnSeamless]}>
          {stack.map((layer, index) => {
            const isProcessedLayer = itemHasProcessedCutout(layer.item);
            const layerBg = isProcessedLayer
              ? wardrobeProcessedTileBackground()
              : wardrobeTileBackground(isDark);
            const widthPct = `${Math.round(layerWidth(layer.slot) * 100)}%` as DimensionValue;
            const safePad = (large ? SLOT_SAFE_PAD_LARGE : SLOT_SAFE_PAD)[layer.slot];
            return (
              <View
                key={layer.key}
                style={[
                  styles.layer,
                  layerFrameStyle(isProcessedLayer),
                  {
                    width: widthPct,
                    maxWidth: '100%',
                    height: Math.round(layerHeight(layer.slot) * adaptiveBoost),
                    marginTop: index === 0 ? 0 : (useStackGap ? stackSpacing : -stackSpacing),
                    zIndex: large ? 10 + index : index + 1,
                    paddingTop: Math.round(safePad.paddingTop * sizeScale),
                    paddingBottom: Math.round(safePad.paddingBottom * sizeScale),
                    justifyContent:
                      layer.slot === 'shoes' ? 'flex-end'
                        : layer.slot === 'bottom' ? 'flex-start'
                          : layer.slot === 'top' || layer.slot === 'outerwear' ? 'flex-start'
                            : 'center',
                  },
                ]}
              >
                {renderLayerImage(layer, layerBg, isProcessedLayer)}
              </View>
            );
          })}
        </View>
      </View>

      {/* Canonical accessories: dedicated strip (not a tiny transparent float). */}
      {accessories.length > 0 ? (
        <View
          style={[
            styles.accessoryStrip,
            large && styles.accessoryStripLarge,
          ]}
          accessibilityRole="summary"
          accessibilityLabel={`Accessories: ${accessories.map((a) => a.piece.name || 'accessory').join(', ')}`}
        >
          <ThemedText
            type="small"
            lightColor="#5A4D3A"
            darkColor="rgba(255,255,255,0.75)"
            style={styles.accessoryStripLabel}
          >
            Also wearing
          </ThemedText>
          <View style={styles.accessoryStripRow}>
            {accessories.map((layer) => {
              const isProcessedLayer = itemHasProcessedCutout(layer.item);
              const layerBg = isProcessedLayer
                ? wardrobeProcessedTileBackground()
                : wardrobeTileBackground(isDark);
              const tile = Math.round((large ? 96 : 72) * sizeScale);
              return (
                <View key={layer.key} style={styles.accessoryStripItem}>
                  <View
                    style={[
                      styles.accessoryStripTile,
                      {
                        width: tile,
                        height: tile,
                        backgroundColor: layerBg,
                      },
                    ]}
                  >
                    {renderLayerImage(layer, layerBg, isProcessedLayer)}
                  </View>
                  {layer.piece.name ? (
                    <ThemedText
                      type="small"
                      numberOfLines={2}
                      lightColor="#3D3428"
                      darkColor="rgba(255,255,255,0.9)"
                      style={styles.accessoryStripName}
                    >
                      {layer.piece.name}
                    </ThemedText>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  containerLarge: {
    overflow: 'visible',
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
    borderRadius: 0,
    overflow: 'visible',
    borderWidth: 0,
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
  canvasSeamless: {
    borderRadius: 0,
    overflow: 'visible',
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 2,
  },
  stackColumn: {
    alignItems: 'center',
    width: '100%',
  },
  stackColumnSeamless: {
    overflow: 'visible',
    paddingHorizontal: 2,
  },
  layer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  layerImage: {
    width: '100%',
    height: '100%',
  },
  accessoryStrip: {
    marginTop: Spacing.sm,
    width: '100%',
    alignItems: 'flex-start',
  },
  accessoryStripLarge: {
    marginTop: Spacing.md,
  },
  accessoryStripLabel: {
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  accessoryStripRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    width: '100%',
  },
  accessoryStripItem: {
    alignItems: 'center',
    maxWidth: 112,
  },
  accessoryStripTile: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessoryStripName: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
  },
});
