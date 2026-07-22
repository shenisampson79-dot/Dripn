/**
 * Safe Rendering Layer — sanitization adapters.
 * Contract: Raw → Validate → Sanitize → View Model. Never throws.
 * Keep this module free of React / component imports (avoid cycles).
 */

import { logInvalidRender } from '@/utils/safeRender/logInvalidRender';

/** Structurally matches OutfitPieceVisual in components/OutfitPiecesVisual. */
export type SanitizedOutfitPiece = {
  role?: string;
  name?: string;
  wardrobeItemId?: number | string;
  imageUrl?: string | null;
  stylingNote?: string;
  category?: string | null;
};

/** Minimal wardrobe visual shape (avoids circular import with wardrobeMentionMatcher). */
export type SafeWardrobeOutfit = {
  title?: string | null;
  sectionIndex?: number;
  pieces?: unknown;
};

export type SafeWardrobeVisual = {
  layout?: 'highlight' | 'stacked' | 'multi' | string;
  pieces?: unknown;
  outfits?: SafeWardrobeOutfit[];
  source?: 'wardrobe' | string;
  matchScore?: number;
};

export type OutfitViewModel = {
  layout: 'highlight' | 'stacked' | 'multi';
  pieces: SanitizedOutfitPiece[];
  outfits?: Array<{
    title?: string | null;
    sectionIndex: number;
    pieces: SanitizedOutfitPiece[];
  }>;
  source?: 'wardrobe';
  matchScore?: number;
  label?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Present id usable by wardrobe lookups (string or number; never null/empty). */
function normalizePieceId(raw: unknown): string | number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function isRenderablePiece(piece: unknown): piece is SanitizedOutfitPiece {
  if (!piece || typeof piece !== 'object') return false;
  const p = piece as SanitizedOutfitPiece;
  const id = normalizePieceId(p.wardrobeItemId);
  const hasName = isNonEmptyString(p.name);
  const hasImage = isNonEmptyString(p.imageUrl);
  return id != null || hasName || hasImage;
}

/**
 * Filter and normalize outfit pieces. Never throws.
 * Returns [] for non-arrays / empty after filter.
 */
export function sanitizeOutfitPieces(
  pieces: unknown,
  options?: { log?: boolean },
): SanitizedOutfitPiece[] {
  try {
    if (pieces == null) return [];
    if (!Array.isArray(pieces)) {
      if (options?.log !== false) {
        logInvalidRender('outfit_pieces', pieces, { reason: 'not_array' });
      }
      return [];
    }

    const cleaned: SanitizedOutfitPiece[] = [];
    let dropped = 0;

    for (const piece of pieces) {
      if (!isRenderablePiece(piece)) {
        dropped += 1;
        continue;
      }
      const id = normalizePieceId(piece.wardrobeItemId);
      cleaned.push({
        role: typeof piece.role === 'string' ? piece.role : undefined,
        name: isNonEmptyString(piece.name) ? piece.name.trim() : undefined,
        wardrobeItemId: id,
        imageUrl: isNonEmptyString(piece.imageUrl) ? piece.imageUrl.trim() : (piece.imageUrl ?? null),
        stylingNote: typeof piece.stylingNote === 'string' ? piece.stylingNote : undefined,
        category: typeof piece.category === 'string' ? piece.category : (piece.category ?? null),
      });
    }

    if (dropped > 0 && options?.log !== false) {
      logInvalidRender('outfit_pieces', { dropped, kept: cleaned.length }, {
        reason: 'null_or_malformed_pieces',
      });
    }

    return cleaned;
  } catch (err) {
    logInvalidRender('outfit_pieces', pieces, {
      reason: 'sanitize_threw',
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Sanitize a single outfit object with pieces. Returns null if unusable.
 */
export function sanitizeOutfit(
  outfit: unknown,
  options?: { log?: boolean },
): { title?: string | null; sectionIndex: number; pieces: SanitizedOutfitPiece[] } | null {
  try {
    if (!outfit || typeof outfit !== 'object') {
      if (options?.log !== false) {
        logInvalidRender('outfit', outfit, { reason: 'not_object' });
      }
      return null;
    }
    const o = outfit as SafeWardrobeOutfit;
    const pieces = sanitizeOutfitPieces(o.pieces, { log: options?.log });
    if (pieces.length === 0) return null;
    return {
      title: typeof o.title === 'string' ? o.title : null,
      sectionIndex: typeof o.sectionIndex === 'number' && Number.isFinite(o.sectionIndex)
        ? o.sectionIndex
        : 0,
      pieces,
    };
  } catch (err) {
    logInvalidRender('outfit', outfit, {
      reason: 'sanitize_threw',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Sanitize wardrobe visual payloads for chat/UI. Returns null if nothing renderable.
 * Aligns with normalizeWardrobeVisual layout rules (multi collapse, etc.).
 */
export function sanitizeWardrobeVisual(
  visual: SafeWardrobeVisual | null | undefined,
  options?: { log?: boolean },
): OutfitViewModel | null {
  try {
    if (!visual || typeof visual !== 'object') return null;

    if (visual.layout === 'multi' && Array.isArray(visual.outfits) && visual.outfits.length > 0) {
      const outfits = visual.outfits
        .map((outfit) => sanitizeOutfit(outfit, { log: false }))
        .filter((outfit): outfit is NonNullable<typeof outfit> => outfit != null);

      if (outfits.length === 0) {
        if (options?.log !== false) {
          logInvalidRender('wardrobe_visual', visual, { reason: 'multi_no_valid_outfits' });
        }
        return null;
      }

      const pieces = outfits.flatMap((outfit) => outfit.pieces);
      if (outfits.length === 1) {
        return {
          layout: pieces.length === 1 ? 'highlight' : 'stacked',
          pieces,
          source: visual.source === 'wardrobe' ? 'wardrobe' : undefined,
          matchScore: typeof visual.matchScore === 'number' ? visual.matchScore : undefined,
        };
      }
      return {
        layout: 'multi',
        pieces: [],
        outfits,
        source: visual.source === 'wardrobe' ? 'wardrobe' : undefined,
        matchScore: typeof visual.matchScore === 'number' ? visual.matchScore : undefined,
      };
    }

    const pieces = sanitizeOutfitPieces(visual.pieces, { log: options?.log });
    if (pieces.length === 0) {
      if (options?.log !== false && visual.pieces != null) {
        logInvalidRender('wardrobe_visual', visual, { reason: 'no_valid_pieces' });
      }
      return null;
    }
    return {
      layout: visual.layout === 'highlight' ? 'highlight' : 'stacked',
      pieces,
      source: visual.source === 'wardrobe' ? 'wardrobe' : undefined,
      matchScore: typeof visual.matchScore === 'number' ? visual.matchScore : undefined,
    };
  } catch (err) {
    logInvalidRender('wardrobe_visual', visual, {
      reason: 'sanitize_threw',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Minimal guaranteed view model for outfit UI. Returns null if unusable.
 */
export function toOutfitViewModel(
  input: unknown,
  options?: { label?: string; log?: boolean },
): OutfitViewModel | null {
  try {
    if (input == null) return null;

    if (Array.isArray(input)) {
      const pieces = sanitizeOutfitPieces(input, { log: options?.log });
      if (pieces.length === 0) return null;
      return {
        layout: pieces.length === 1 ? 'highlight' : 'stacked',
        pieces,
        label: options?.label,
      };
    }

    if (typeof input !== 'object') {
      if (options?.log !== false) {
        logInvalidRender('outfit', input, { reason: 'bad_view_model_input' });
      }
      return null;
    }

    const obj = input as SafeWardrobeVisual;
    const sanitized = sanitizeWardrobeVisual(obj, { log: options?.log });
    if (!sanitized) {
      const pieces = sanitizeOutfitPieces(obj.pieces, { log: options?.log });
      if (pieces.length === 0) return null;
      return {
        layout: pieces.length === 1 ? 'highlight' : 'stacked',
        pieces,
        label: options?.label,
      };
    }

    return {
      ...sanitized,
      label: options?.label,
    };
  } catch (err) {
    logInvalidRender('outfit', input, {
      reason: 'toOutfitViewModel_threw',
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
