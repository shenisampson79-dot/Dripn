import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { OutfitPieceVisual } from '@/components/OutfitPiecesVisual';
import { buildWardrobeImageProxyUrl, resolveWardrobeImageUri } from '@/utils/wardrobeImage';
import { sanitizeWardrobeItemName } from '@/utils/wardrobeItemName';

const MATCH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'with', 'in', 'of', 'for', 'your', 'my', 'from',
  'cotton', 'linen', 'wool', 'leather', 'light', 'dark', 'soft', 'pair', 'wear',
  'carry', 'this', 'works', 'because', 'optional',
]);

/** Phrases that name garments to exclude from wardrobe visuals. */
const AVOIDANCE_CLAUSE_PATTERNS = [
  /\bbe\s+careful\s+with\s+(?:the\s+|your\s+)?([^.!?\n]+)/gi,
  /\b(?:avoid|skip|steer\s+clear\s+of)\s+(?:the\s+|your\s+|wearing\s+)?([^.!?\n]+)/gi,
  /\bdon'?t\s+wear\s+(?:the\s+|your\s+)?([^.!?\n]+)/gi,
  /\bdo\s+not\s+wear\s+(?:the\s+|your\s+)?([^.!?\n]+)/gi,
  /\bkeep\s+(?:the\s+|your\s+)?([^.!?\n]+?)\s+for\s+(?:running|gym|sport|workouts?|training|exercise)\b/gi,
  /\b(?:not\s+for\s+outfits?|rather\s+than\s+wearing)\s+(?:the\s+|your\s+)?([^.!?\n]+)/gi,
];

const AVOIDANCE_SENTENCE_STRIP = new RegExp(
  [
    String.raw`[^.!?\n]*\bbe\s+careful\s+with\b[^.!?\n]*[.!?]?`,
    String.raw`[^.!?\n]*\b(?:avoid|skip|steer\s+clear\s+of)\b[^.!?\n]*[.!?]?`,
    String.raw`[^.!?\n]*\bdon'?t\s+wear\b[^.!?\n]*[.!?]?`,
    String.raw`[^.!?\n]*\bdo\s+not\s+wear\b[^.!?\n]*[.!?]?`,
    String.raw`[^.!?\n]*\bkeep\b[^.!?\n]*\bfor\s+(?:running|gym|sport|workouts?|training|exercise)\b[^.!?\n]*[.!?]?`,
    String.raw`[^.!?\n]*\b(?:clashes?|not\s+for\s+outfits?)\b[^.!?\n]*[.!?]?`,
  ].join('|'),
  'gi',
);

function normalizeForMatch(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSignificantTokens(value: string) {
  return normalizeForMatch(value)
    .split(' ')
    .filter((word) => word.length > 2 && !MATCH_STOP_WORDS.has(word));
}

function scoreItemMatch(itemName: string, text: string) {
  const normName = normalizeForMatch(itemName);
  const normText = normalizeForMatch(text);
  if (!normName || !normText) return 0;

  if (normText.includes(normName)) return normName.length + 50;

  const tokens = getSignificantTokens(itemName);
  if (tokens.length === 0) return 0;

  const matched = tokens.filter((token) => normText.includes(token));
  const ratio = matched.length / tokens.length;

  if (matched.length >= 2 && ratio >= 0.38) {
    return matched.join('').length + ratio * 20;
  }
  if (tokens.length === 1 && matched.length === 1) {
    return matched[0].length;
  }
  return 0;
}

/** Collect raw avoidance clause text (garments the stylist told the user not to use). */
export function collectAvoidanceMatchText(text = '') {
  const source = String(text || '');
  if (!source.trim()) return '';

  const chunks: string[] = [];
  for (const pattern of AVOIDANCE_CLAUSE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      const clause = String(match[1] || '').trim();
      if (clause.length >= 3) chunks.push(clause);
    }
  }
  return chunks.join(' ');
}

/** Remove avoidance sentences so positive matching cannot pick excluded pieces. */
export function stripAvoidanceClauses(text = '') {
  return String(text || '')
    .replace(AVOIDANCE_SENTENCE_STRIP, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip server outfit contract markers so chat bubbles stay clean. */
export function stripStructuredOutfitMarkers(text = '') {
  return String(text || '')
    .replace(/<<<DRIPN_OUTFIT>>>[\s\S]*?<<<END_DRIPN_OUTFIT>>>/gi, ' ')
    .replace(/```(?:json)?\s*\{[\s\S]*?"outfit"\s*:[\s\S]*?\}\s*```/gi, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function collectExcludedWardrobeItemIdsFromMentions(
  text = '',
  wardrobeItems: WardrobeItem[] = [],
) {
  const avoidanceText = collectAvoidanceMatchText(text);
  if (!avoidanceText || wardrobeItems.length === 0) {
    return new Set<string>();
  }

  const excluded = new Set<string>();
  for (const item of wardrobeItems) {
    if (scoreItemMatch(item.name || '', avoidanceText) > 0) {
      excluded.add(item.id);
    }
  }
  return excluded;
}

export function categoryToVisualRole(category?: string): string {
  const cat = String(category || '').toLowerCase();
  if (cat === 'outerwear') return 'outerwear';
  if (cat === 'dresses') return 'dress';
  if (cat === 'shoes' || cat === 'footwear') return 'shoes';
  if (cat === 'bags' || cat === 'accessories') return 'accessory';
  if (cat === 'bottoms' || cat === 'activewear_bottoms') return 'bottom';
  if (cat === 'tops' || cat === 'activewear_tops' || cat === 'formal') return 'top';
  return 'top';
}

export function shouldAttachWardrobeVisual(userMessage = '', assistantText = '') {
  const combined = `${userMessage} ${assistantText}`.toLowerCase();
  return /wardrobe|outfit|favorite|favourite|favorit|what.*wear|what.*like|my (closet|clothes|pieces|look)|from my|piece|blazer|jacket|shirt|trouser|pant|jean|shoe|trainer|sneaker|boot|bag|tote|dress|styling|style me|put together|recommend.*wear|ideas|brewing|looks|options|combinations|trip|travel|vacation|holiday|pack|bahamas|beach|resort/i.test(combined);
}

export function extractSectionTitle(section: string) {
  const text = String(section || '').trim().replace(/^\*+/, '');
  const numbered = text.match(/^(\d+[\.)]\s*[^:\n]+):?/);
  if (numbered) return numbered[1].replace(/^\d+[\.)]\s*/, '').trim();
  const bold = text.match(/^\*\*([^*]+)\*\*/);
  if (bold) return bold[1].replace(/^\d+[\.)]\s*/, '').replace(/:$/, '').trim();
  const labeled = text.match(/^((?:Outfit|Look|Option|Day|Idea)\s*#?\s*\d+[^\n:]*)/i);
  if (labeled) return labeled[1].trim();
  const label = text.match(/^([A-Z][^:\n]{2,40}:)/);
  if (label) return label[1].replace(/:$/, '').trim();
  return null;
}

export function inferOutfitCountFromText(text: string) {
  const normalized = String(text || '').trim();
  if (!normalized) return 0;

  const counts = [
    (normalized.match(/\*\*\d+[\.)]/g) || []).length,
    (normalized.match(/\n\s*\d+[\.)]\s+/g) || []).length,
    (normalized.match(/(?:^|\n)\s*(?:outfit|look|option|day|idea)\s*#?\s*\d+/gi) || []).length,
    (normalized.match(/\*\*[^*\n]{3,}\*\*/g) || []).length,
    (normalized.match(/(?:^|\n)\s*[-•]\s+/g) || []).length,
  ];

  const maxDetected = Math.max(...counts, 0);
  const sections = splitIntoOutfitSections(normalized);
  const numberedSections = sections.filter((section) => isNumberedOutfitSection(section)).length;
  // Only count explicit numbered / labelled outfits — not paragraph splits from weather add-ons.
  return Math.max(maxDetected, numberedSections);
}

export function splitIntoOutfitSections(text: string) {
  const normalized = String(text || '').trim();
  if (!normalized) return [];

  const splitters = [
    /(?=\*\*\d+[\.)]\s*)/,
    /\n(?=\*\*(?:\d+[\.)]\s*)?[^*\n]{2,}\*\*)/,
    /\n(?=\d+[\.)]\s+)/,
    /\n(?=(?:Outfit|Look|Option|Day|Idea)\s*#?\s*\d+[\s:–-])/i,
    /\n(?=[A-Z][^:\n]{2,40}:)/,
    /\n(?=[-•]\s+)/,
    /\n{2,}/,
  ];

  for (const splitter of splitters) {
    const chunks = normalized.split(splitter).map((chunk) => chunk.trim()).filter(Boolean);
    if (chunks.length >= 2) {
      return chunks;
    }
  }

  return [normalized];
}

export function isNumberedOutfitSection(section: string) {
  const trimmed = String(section || '').trim();
  return /^\*\*\d+[\.)]|^\d+[\.)]\s+/i.test(trimmed);
}

export function matchWardrobeItemsInText(
  text: string,
  wardrobeItems: WardrobeItem[],
  limit = 8,
): WardrobeItem[] {
  if (!text || wardrobeItems.length === 0) return [];

  const excludedIds = collectExcludedWardrobeItemIdsFromMentions(text, wardrobeItems);
  const positiveText = stripAvoidanceClauses(text) || text;

  const scored = wardrobeItems
    .map((item) => ({
      item,
      score: scoreItemMatch(item.name || '', positiveText),
    }))
    .filter((entry) => entry.score > 0 && !excludedIds.has(entry.item.id))
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const results: WardrobeItem[] = [];
  for (const entry of scored) {
    if (seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    results.push(entry.item);
    if (results.length >= limit) break;
  }
  return results;
}

export type WardrobeOutfitVisual = {
  title?: string | null;
  sectionIndex: number;
  pieces: OutfitPieceVisual[];
};

export type WardrobeVisualPayload = {
  layout: 'highlight' | 'stacked' | 'multi';
  pieces?: OutfitPieceVisual[];
  outfits?: WardrobeOutfitVisual[];
  source?: 'wardrobe';
  matchScore?: number;
};

function buildPiecesFromItems(matched: WardrobeItem[]): OutfitPieceVisual[] {
  return matched.map((item) => ({
    wardrobeItemId: item.id,
    name: sanitizeWardrobeItemName(item.name || '', { color: item.color, brand: item.brand }),
    category: item.category,
    role: categoryToVisualRole(item.category),
    imageUrl: resolveWardrobeImageUri(item) || (item.id ? buildWardrobeImageProxyUrl(item.id) : null),
  }));
}

function buildOutfitsFromSections(assistantText: string, wardrobeItems: WardrobeItem[]) {
  const sections = splitIntoOutfitSections(assistantText);
  const outfits: WardrobeOutfitVisual[] = [];

  sections.forEach((section, sectionIndex) => {
    if (!isNumberedOutfitSection(section) && sectionIndex > 0 && outfits.length > 0) {
      return;
    }

    const matched = matchWardrobeItemsInText(section, wardrobeItems, 8);
    const pieces = buildPiecesFromItems(matched);
    if (pieces.length === 0) return;

    outfits.push({
      title: extractSectionTitle(section) || `Outfit ${outfits.length + 1}`,
      sectionIndex,
      pieces,
    });
  });

  return { sections, outfits };
}

function buildMultiOutfitVisual(
  assistantText: string,
  wardrobeItems: WardrobeItem[],
): WardrobeVisualPayload | null {
  const { outfits } = buildOutfitsFromSections(assistantText, wardrobeItems);
  if (outfits.length < 2) return null;

  return {
    layout: 'multi',
    outfits,
  };
}

function sanitizeOutfitPieces(pieces: unknown): OutfitPieceVisual[] {
  if (!Array.isArray(pieces)) return [];
  return pieces.filter(
    (piece): piece is OutfitPieceVisual =>
      !!piece
      && typeof piece === 'object'
      && (
        (piece as OutfitPieceVisual).wardrobeItemId != null
        || typeof (piece as OutfitPieceVisual).name === 'string'
        || typeof (piece as OutfitPieceVisual).imageUrl === 'string'
      ),
  );
}

export function normalizeWardrobeVisual(
  visual: WardrobeVisualPayload | null | undefined,
): WardrobeVisualPayload | null {
  if (!visual || typeof visual !== 'object') return null;

  if (visual.layout === 'multi' && Array.isArray(visual.outfits) && visual.outfits.length > 0) {
    const outfits = visual.outfits
      .filter((outfit) => outfit && typeof outfit === 'object')
      .map((outfit) => ({
        title: typeof outfit.title === 'string' ? outfit.title : null,
        sectionIndex: typeof outfit.sectionIndex === 'number' ? outfit.sectionIndex : 0,
        pieces: sanitizeOutfitPieces(outfit.pieces),
      }))
      .filter((outfit) => outfit.pieces.length > 0);

    if (outfits.length === 0) return null;

    const pieces = outfits.flatMap((outfit) => outfit.pieces);
    if (outfits.length === 1) {
      return {
        ...visual,
        layout: pieces.length === 1 ? 'highlight' : 'stacked',
        pieces,
        outfits: undefined,
        source: visual.source === 'wardrobe' ? 'wardrobe' : undefined,
        matchScore: typeof visual.matchScore === 'number' ? visual.matchScore : undefined,
      };
    }
    return {
      ...visual,
      layout: 'multi',
      outfits,
      pieces: undefined,
      source: visual.source === 'wardrobe' ? 'wardrobe' : undefined,
      matchScore: typeof visual.matchScore === 'number' ? visual.matchScore : undefined,
    };
  }

  const pieces = sanitizeOutfitPieces(visual.pieces);
  if (pieces.length === 0) return null;
  return {
    ...visual,
    layout: visual.layout === 'highlight' ? 'highlight' : 'stacked',
    pieces,
    outfits: undefined,
    source: visual.source === 'wardrobe' ? 'wardrobe' : undefined,
    matchScore: typeof visual.matchScore === 'number' ? visual.matchScore : undefined,
  };
}

export function capWardrobeVisualForAccess(
  visual: WardrobeVisualPayload | null,
  subscriptionTier?: string | null,
): WardrobeVisualPayload | null {
  if (!visual) return null;
  if (hasPaidMultiOutfitAccess(subscriptionTier)) return normalizeWardrobeVisual(visual) || visual;

  if (visual.layout === 'multi' && visual.outfits && visual.outfits.length > 1) {
    return normalizeWardrobeVisual({ ...visual, outfits: visual.outfits.slice(0, 1) });
  }

  return normalizeWardrobeVisual(visual);
}

const DFY_LITE_TIERS = new Set(['lite', 'done_for_you_lite', 'outfit_setup']);
const DFY_CORE_TIERS = new Set(['core', 'core_wardrobe', 'done_for_you_core']);

export function hasPaidMultiOutfitAccess(subscriptionTier?: string | null): boolean {
  const tier = String(subscriptionTier || 'free').toLowerCase().trim();
  return DFY_LITE_TIERS.has(tier) || DFY_CORE_TIERS.has(tier);
}

export function getPrimaryOutfitMatchText(assistantText: string): string {
  const sections = splitIntoOutfitSections(assistantText);
  const primary = sections[0] || assistantText;
  const followUpOnly = /^(if|when|alternatively|optional|for (chilly|cold|warm|hot|rain)|in case)\b/i.test(primary.trim());
  if (followUpOnly && sections.length > 1) {
    return sections.slice(0, 2).join('\n\n');
  }
  return primary;
}

export function buildWardrobeVisualFromChat(
  _userMessage: string,
  _assistantText: string,
  _wardrobeItems: WardrobeItem[],
  _subscriptionTier?: string | null,
): WardrobeVisualPayload | null {
  // Retired: stylist chat wardrobe strips are server-authority only (DRIPN_OUTFIT / allocator IDs).
  // Never rebuild chips from prose — prevents avoid∩outfit drift (e.g. Asics in strip).
  return null;
}

/** @deprecated Internal legacy matcher — do not use for chat strips. Kept for reference/tests only. */
export function legacyBuildWardrobeVisualFromChatProse(
  userMessage: string,
  assistantText: string,
  wardrobeItems: WardrobeItem[],
  subscriptionTier?: string | null,
): WardrobeVisualPayload | null {
  if (!shouldAttachWardrobeVisual(userMessage, assistantText)) return null;

  const multi = buildMultiOutfitVisual(assistantText, wardrobeItems);
  if (multi) {
    return capWardrobeVisualForAccess(multi, subscriptionTier)
      || normalizeWardrobeVisual(multi);
  }

  const outfitCount = inferOutfitCountFromText(assistantText);
  const matchText = outfitCount >= 2 && !hasPaidMultiOutfitAccess(subscriptionTier)
    ? getPrimaryOutfitMatchText(assistantText)
    : assistantText;

  const matched = matchWardrobeItemsInText(matchText, wardrobeItems, 8);
  if (matched.length === 0 && matchText !== assistantText) {
    const fallbackMatched = matchWardrobeItemsInText(assistantText, wardrobeItems, 8);
    if (fallbackMatched.length > 0) {
      return {
        layout: fallbackMatched.length === 1 ? 'highlight' : 'stacked',
        pieces: buildPiecesFromItems(fallbackMatched),
      };
    }
  }
  if (matched.length === 0) return null;

  const pieces = buildPiecesFromItems(matched);
  return {
    layout: matched.length === 1 ? 'highlight' : 'stacked',
    pieces,
  };
}

/**
 * ID-only image hydration: fill missing imageUrl from local wardrobe by wardrobeItemId.
 * Never adds, removes, reorders, or invents pieces from prose.
 */
export function hydrateWardrobeVisualImagesByIds(
  visual: WardrobeVisualPayload | null | undefined,
  wardrobeItems: WardrobeItem[],
): WardrobeVisualPayload | null {
  try {
    const normalized = normalizeWardrobeVisual(visual);
    if (!normalized || !Array.isArray(wardrobeItems) || wardrobeItems.length === 0) {
      return normalized;
    }

    const hydratePiece = (piece: OutfitPieceVisual): OutfitPieceVisual => {
      if (!piece || typeof piece !== 'object') {
        return { name: 'Item', role: 'piece' };
      }
      if (piece.imageUrl) return piece;
      if (piece.wardrobeItemId == null) return piece;
      const item = wardrobeItems.find((row) => String(row.id) === String(piece.wardrobeItemId));
      if (!item) return piece;
      const localUrl = resolveWardrobeImageUri(item) || (item.id ? buildWardrobeImageProxyUrl(item.id) : null);
      if (!localUrl) return piece;
      return { ...piece, imageUrl: localUrl };
    };

    if (normalized.layout === 'multi' && normalized.outfits?.length) {
      return {
        ...normalized,
        outfits: normalized.outfits.map((outfit) => ({
          ...outfit,
          pieces: sanitizeOutfitPieces(outfit.pieces).map(hydratePiece),
        })),
      };
    }

    if (normalized.pieces?.length) {
      return {
        ...normalized,
        pieces: sanitizeOutfitPieces(normalized.pieces).map(hydratePiece),
      };
    }
    return normalized;
  } catch (error) {
    console.warn('[wardrobeVisual] hydrate failed closed:', error);
    return null;
  }
}

export function wardrobeVisualFromOutfitSuggestion(
  items: WardrobeItem[],
): WardrobeVisualPayload | null {
  if (!items.length) return null;
  return {
    layout: items.length === 1 ? 'highlight' : 'stacked',
    pieces: buildPiecesFromItems(items),
  };
}
