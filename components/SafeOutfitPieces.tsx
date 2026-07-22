import React, { useMemo } from 'react';

import {
  OutfitPiecesVisual,
  type OutfitPieceVisual,
} from '@/components/OutfitPiecesVisual';
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary';
import { SoftRenderFallback } from '@/components/SoftRenderFallback';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import { sanitizeOutfitPieces, toOutfitViewModel } from '@/utils/safeRender';

type Props = {
  pieces?: OutfitPieceVisual[] | unknown;
  wardrobeItems?: WardrobeItem[];
  label?: string;
  compact?: boolean;
  large?: boolean;
  canvasWidth?: number;
  visualScale?: number;
  tight?: boolean;
  /** When true, show soft fallback instead of null when pieces are empty/invalid. */
  showEmptyFallback?: boolean;
  emptyMessage?: string;
};

/**
 * Safe entry point for outfit piece strips.
 * Sanitizes → view model → OutfitPiecesVisual inside a local RenderErrorBoundary.
 */
export function SafeOutfitPieces({
  pieces,
  wardrobeItems = [],
  label = 'Your outfit',
  compact = false,
  large = false,
  canvasWidth,
  visualScale,
  tight = false,
  showEmptyFallback = false,
  emptyMessage = 'Outfit preview unavailable',
}: Props) {
  const safePieces = useMemo(() => {
    const vm = toOutfitViewModel(pieces, { label, log: true });
    if (vm?.pieces?.length) return vm.pieces;
    return sanitizeOutfitPieces(pieces, { log: true });
  }, [pieces, label]);

  if (!safePieces.length) {
    if (showEmptyFallback) {
      return <SoftRenderFallback message={emptyMessage} compact={compact} />;
    }
    return null;
  }

  return (
    <RenderErrorBoundary fallbackMessage={emptyMessage}>
      <OutfitPiecesVisual
        pieces={safePieces}
        wardrobeItems={wardrobeItems}
        label={label}
        compact={compact}
        large={large}
        canvasWidth={canvasWidth}
        visualScale={visualScale}
        tight={tight}
      />
    </RenderErrorBoundary>
  );
}
