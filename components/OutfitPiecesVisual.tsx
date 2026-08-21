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
  buildWardrobeImageProxyUrl,
  enrichWardrobeItemForOutfitVisual,
  isProxyWardrobeImageUri,
  itemHasProcessedCutout,
  normalizeRemoteApiUrl,
  resolveWardrobeImageUri,
  wardrobeProcessedTileBackground,
  wardrobeTileBackground,
} from '@/utils/wardrobeImage';

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
  outerwear: 188,
  top: 172,
  bottom: 210,
  shoes: 118,
  dress: 330,
  accessory: 118,
};

const LAYER_HEIGHT_LARGE: Record<LayerSlot, number> = {
  outerwear: 268,
  top: 242,
  bottom: 272,
  shoes: 188,
  dress: 420,
  accessory: 168,
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

const STACK_ORDER: LayerSlot[] = ['outerwear', 'top', 'dress', 'bottom', 'shoes'];

function inferSlotFromText(text: string): LayerSlot | null {
  const t = text.toLowerCase();
  if (/\b(dress|jumpsuit|romper|playsuit)\b/.test(t)) return 'dress';
  if (/\b(blazer|jacket|coat|outerwear|cardigan|parka|trench|overcoat|gilet|vest)\b/.test(t)) return 'outerwear';
  if (/\b(trouser|pant|jean|short|skirt|cargo|chino|bottom|legging)\b/.test(t)) return 'bottom';
  if (/\b(shoe|trainer|sneaker|boot|loafer|heel|sandal|footwear|mule|flat)\b/.test(t)) return 'shoes';
  if (/\b(bag|tote|purse|belt|scarf|hat|tie|bowtie|accessory|necklace|earring|watch)\b/.test(t)) return 'accessory';
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
  if (['shoes', 'footwear', 'trainers', 'boots', 'sneakers'].includes(role) || ['shoes', 'footwear'].includes(category)) {
    return 'shoes';
  }
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

  // Keep named pieces visible even without an image URL (placeholder tile).
  if (piece.name) {
    return {
      id: String(piece.wardrobeItemId || piece.name),
      userId: '',
      imageUri: fallbackUri || '',
      enhancedImageUri: fallbackUri || undefined,
      imageProcessed: Boolean(fallbackUri),
      category: 'tops',
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
  // Prefer readable hems over dense collage; tight only nudges slightly.
  const stackOverlap = Math.round(baseOverlap * sizeScale * (tight ? 1.1 : 1));

  // Adaptive canvas: taller stacks get more vertical room (tall shirts / dresses).
  const adaptiveBoost = stack.some((l) => l.slot === 'dress') ? 1.06
    : stack.filter((l) => l.slot === 'top' || l.slot === 'outerwear').length >= 2 ? 1.04
      : 1;

  const canvasHeight =
    stack.reduce((sum, layer, index) => {
      const overlap = index === 0 ? 0 : stackOverlap;
      return sum + Math.round(layerHeight(layer.slot) * adaptiveBoost) - overlap;
    }, (compact ? Spacing.sm : Spacing.md) * 2);

  const getAccessoryTop = (index: number) => {
    if (!large) {
      return (compact ? 64 : 88) + index * (compact ? 22 : 28);
    }

    const outerwearLayer = stack.find((layer) => layer.slot === 'outerwear');
    const topLayer = stack.find((layer) => layer.slot === 'top');
    let torsoAnchor = 20;

    if (outerwearLayer) {
      torsoAnchor = layerHeight('outerwear') - Math.round(stackOverlap * 0.55);
    } else if (topLayer) {
      torsoAnchor = Math.round(layerHeight('top') * 0.35);
    }

    if (topLayer && outerwearLayer) {
      torsoAnchor += Math.round(layerHeight('top') * 0.12);
    }

    return torsoAnchor + index * (layerHeight('accessory') + 12);
  };

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
            const safePad = SLOT_SAFE_PAD[layer.slot];
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
                    marginTop: index === 0 ? 0 : -stackOverlap,
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

        {accessories.map((layer, index) => {
          const isProcessedLayer = itemHasProcessedCutout(layer.item);
          // Transparent float — white tote tiles were covering adjacent top arms.
          const layerBg = 'transparent';
          const accessoryWidthPct = `${Math.round(layerWidth('accessory') * 100)}%` as DimensionValue;
          return (
            <View
              key={layer.key}
              style={[
                styles.accessoryFloat,
                {
                  backgroundColor: 'transparent',
                  borderRadius: 0,
                  borderWidth: 0,
                  overflow: 'visible' as const,
                  width: large ? accessoryWidthPct : effectiveCanvasWidth * layerWidth('accessory'),
                  maxWidth: large ? '38%' : undefined,
                  height: layerHeight('accessory'),
                  top: getAccessoryTop(index),
                  right: large ? 4 : 0,
                  zIndex: 2 + index,
                },
              ]}
            >
              {renderLayerImage(layer, layerBg, isProcessedLayer)}
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
  accessoryFloat: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
